import io
import os
import tempfile
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, Response

from PIL import Image


app = FastAPI(title="AI Service (STT + OCR + TTS)")


_whisper_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model

    from faster_whisper import WhisperModel

    model_name = os.environ.get("WHISPER_MODEL", "small")
    device = os.environ.get("WHISPER_DEVICE", "cpu")
    compute_type = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")

    _whisper_model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
    )
    return _whisper_model


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """
    Multipart form-data:
    - file: audio file
    - language (optional): e.g. 'en', 'vi'
    Returns: { "text": "..." }
    """
    if not file:
        raise HTTPException(status_code=400, detail="Missing file")

    suffix = ""
    if file.filename and "." in file.filename:
        suffix = os.path.splitext(file.filename)[1]

    try:
        model = _get_whisper_model()
        with tempfile.TemporaryDirectory() as td:
            audio_path = os.path.join(td, f"audio{suffix}")
            with open(audio_path, "wb") as f:
                f.write(await file.read())

            segments, _info = model.transcribe(
                audio_path,
                language=(language if language else None),
            )

            text_parts = []
            for s in segments:
                if s and getattr(s, "text", None):
                    t = s.text.strip()
                    if t:
                        text_parts.append(t)

            text = "\n".join(text_parts).strip()
            return JSONResponse({"text": text})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _ocr_with_vietocr(img: Image.Image) -> str:
    from vietocr.tool.config import Cfg  # type: ignore
    from vietocr.tool.predictor import Predictor  # type: ignore

    cfg_name = os.environ.get("VIET_OCR_CFG", "vgg_transformer")
    cfg = Cfg.load_config_from_name(cfg_name)
    cfg["device"] = os.environ.get("VIET_OCR_DEVICE", "cpu")

    weights = os.environ.get("VIET_OCR_WEIGHTS")
    if weights:
        cfg["weights"] = weights

    predictor = Predictor(cfg)
    text = predictor.predict(img)
    return (text or "").strip()


def _ocr_with_tesseract(img: Image.Image, lang: Optional[str]) -> str:
    import pytesseract  # type: ignore
    from pytesseract import image_to_string  # type: ignore

    default_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    cmd = os.environ.get("TESSERACT_CMD") or default_cmd
    if cmd and os.path.exists(cmd):
        pytesseract.pytesseract.tesseract_cmd = cmd

    t_lang = (lang or os.environ.get("TESS_LANG") or "eng").strip()
    text = image_to_string(img, lang=t_lang)
    return (text or "").strip()


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """
    Multipart form-data:
    - file: image file
    Returns: { "text": "..." }

    VietOCR is the primary engine. Set OCR_ALLOW_TESSERACT_FALLBACK=1 to allow Tesseract
    when VietOCR fails (development only).
    """
    if not file:
        raise HTTPException(status_code=400, detail="Missing file")

    try:
        image_bytes = await file.read()
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        text = ""
        last_err: Optional[str] = None
        try:
            text = _ocr_with_vietocr(img)
        except Exception as e:
            last_err = str(e)
            allow_tess = os.environ.get("OCR_ALLOW_TESSERACT_FALLBACK", "").strip() in ("1", "true", "yes")
            if allow_tess:
                text = _ocr_with_tesseract(img, language)
            else:
                raise HTTPException(
                    status_code=503,
                    detail=f"VietOCR failed and Tesseract fallback is disabled: {last_err}",
                )

        return JSONResponse({"text": text.strip() if text else ""})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tts")
async def tts(
    text: str = Form(...),
    voice: Optional[str] = Form(None),
):
    """
    Multipart form-data:
    - text: plain text to synthesize
    - voice (optional): edge-tts voice name, default en-US-GuyNeural

    Returns raw MP3 bytes (audio/mpeg).
    """
    if not text or not str(text).strip():
        raise HTTPException(status_code=400, detail="Missing text")

    clean = str(text).strip()
    max_chars = int(os.environ.get("TTS_MAX_CHARS", "5000"))
    if len(clean) > max_chars:
        raise HTTPException(status_code=400, detail=f"Text exceeds {max_chars} characters")

    voice_name = (voice or os.environ.get("EDGE_TTS_VOICE", "en-US-GuyNeural")).strip()

    try:
        import edge_tts  # type: ignore

        communicate = edge_tts.Communicate(clean, voice_name)
        out_path = os.path.join(tempfile.gettempdir(), f"aiservice-tts-{uuid.uuid4().hex}.mp3")
        try:
            await communicate.save(out_path)
            data = Path(out_path).read_bytes()
        finally:
            try:
                os.unlink(out_path)
            except OSError:
                pass
        if not data:
            raise HTTPException(status_code=500, detail="TTS produced empty audio")
        return Response(content=data, media_type="audio/mpeg")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
