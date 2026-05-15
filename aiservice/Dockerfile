FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ffmpeg \
        libglib2.0-0 \
        libgl1 \
        tesseract-ocr \
        tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py /app/app.py

EXPOSE 8002
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD curl -fsS http://127.0.0.1:8002/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8002"]
