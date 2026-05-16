import io
import os
import sys
import tempfile
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from PIL import Image


app = FastAPI(title="AI Service (STT + OCR + TTS)")

# ── CORS (allow backend + dev frontends) ──────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_whisper_model = None
_models_ready = False
_vietocr_predictor = None


def _get_vietocr_predictor():
    """Lazily initialize and cache VietOCR predictor (Bug #6 fix — was created per request)."""
    global _vietocr_predictor
    if _vietocr_predictor is not None:
        return _vietocr_predictor

    from vietocr.tool.config import Cfg  # type: ignore
    from vietocr.tool.predictor import Predictor  # type: ignore

    cfg_name = os.environ.get("VIET_OCR_CFG", "vgg_transformer")
    cfg = Cfg.load_config_from_name(cfg_name)
    cfg["device"] = os.environ.get("VIET_OCR_DEVICE", "cpu")

    weights = os.environ.get("VIET_OCR_WEIGHTS")
    if weights:
        cfg["weights"] = weights

    _vietocr_predictor = Predictor(cfg)
    return _vietocr_predictor


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


# ── Health check ─────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Returns service status and model availability."""
    status = {
        "status": "ok",
        "service": "aiservice",
        "ocr_engine": os.environ.get("OCR_ENGINE", "tesseract"),
        "whisper_loaded": _whisper_model is not None,
        "python_version": sys.version,
    }
    # Check optional dependencies
    try:
        import vietocr  # type: ignore # noqa: F401
        status["vietocr_available"] = True
    except ImportError:
        status["vietocr_available"] = False
    try:
        import pytesseract  # type: ignore # noqa: F401
        status["tesseract_available"] = True
    except ImportError:
        status["tesseract_available"] = False
    try:
        import fitz  # type: ignore # noqa: F401
        status["pdf_available"] = True
    except ImportError:
        status["pdf_available"] = False
    try:
        import edge_tts  # type: ignore # noqa: F401
        status["edge_tts_available"] = True
    except ImportError:
        status["edge_tts_available"] = False

    return JSONResponse(status)


# ── Startup: preload Whisper model if configured ─────────────────────────
@app.on_event("startup")
async def startup_event():
    global _models_ready
    preload = os.environ.get("WHISPER_PRELOAD", "1").strip()
    if preload in ("1", "true", "yes"):
        try:
            _get_whisper_model()
            _models_ready = True
            print("[aiservice] Whisper model preloaded successfully")
        except Exception as e:
            print(f"[aiservice] WARNING: Whisper preload failed: {e}")
            print("[aiservice] Model will load on first /transcribe request")
    else:
        print("[aiservice] Whisper preload disabled (set WHISPER_PRELOAD=1 to enable)")


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
    predictor = _get_vietocr_predictor()
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


def _ocr_image(img: Image.Image, lang: Optional[str]) -> str:
    engine = os.environ.get("OCR_ENGINE", "tesseract").strip().lower()
    if engine == "vietocr":
        return _ocr_with_vietocr(img)
    if engine == "auto":
        try:
            text = _ocr_with_tesseract(img, lang)
            if text:
                return text
        except Exception:
            pass
        return _ocr_with_vietocr(img)
    return _ocr_with_tesseract(img, lang)


def _images_from_upload(image_bytes: bytes, filename: Optional[str], content_type: Optional[str]) -> List[Image.Image]:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()
    is_pdf = ctype == "application/pdf" or name.endswith(".pdf")
    if not is_pdf:
        return [Image.open(io.BytesIO(image_bytes)).convert("RGB")]

    try:
        import fitz  # type: ignore
    except ImportError as e:
        raise HTTPException(status_code=503, detail="PDF OCR requires PyMuPDF") from e

    max_pages = int(os.environ.get("OCR_MAX_PDF_PAGES", "20"))
    zoom = float(os.environ.get("OCR_PDF_ZOOM", "2.5"))
    images: List[Image.Image] = []
    with fitz.open(stream=image_bytes, filetype="pdf") as doc:
        for page_index in range(min(len(doc), max_pages)):
            page = doc.load_page(page_index)
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
            images.append(img)
    return images


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """
    Multipart form-data:
    - file: image file
    Returns: { "text": "..." }

    Set OCR_ENGINE=tesseract|vietocr|auto. PDF files are rendered page-by-page when
    PyMuPDF is installed.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Missing file")

    try:
        image_bytes = await file.read()
        images = _images_from_upload(image_bytes, file.filename, file.content_type)

        text_parts = []
        for idx, img in enumerate(images, start=1):
            try:
                page_text = _ocr_image(img, language)
            except Exception as e:
                allow_tess = os.environ.get("OCR_ALLOW_TESSERACT_FALLBACK", "").strip() in ("1", "true", "yes")
                if allow_tess:
                    page_text = _ocr_with_tesseract(img, language)
                else:
                    raise HTTPException(status_code=503, detail=f"OCR failed on page {idx}: {e}") from e
            if page_text:
                text_parts.append(page_text)

        return JSONResponse({"text": "\n\n".join(text_parts).strip()})
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
