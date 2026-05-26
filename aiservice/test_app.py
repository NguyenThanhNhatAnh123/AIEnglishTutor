import os

os.environ["WHISPER_PRELOAD"] = "0"
os.environ["MAX_UPLOAD_BYTES"] = "1024"

from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["service"] == "aiservice"


def test_ocr_requires_file():
    response = client.post("/ocr")

    assert response.status_code == 422


def test_tts_rejects_blank_text():
    response = client.post("/tts", data={"text": "   "})

    assert response.status_code == 400
    assert response.json()["detail"] == "Missing text"


def test_upload_size_limit_is_enforced_before_processing():
    large_payload = b"x" * 2048

    response = client.post(
        "/ocr",
        files={"file": ("large.png", large_payload, "image/png")},
    )

    assert response.status_code == 413
