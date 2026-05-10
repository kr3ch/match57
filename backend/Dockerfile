# Production image for the MATCH 57 v2 backend.
# Builds a slim Python 3.11 runtime, installs deps from pyproject.toml,
# and serves uvicorn on $PORT (8080 by default to match Fly.io conventions).
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System deps: build for bcrypt, libjpeg/libwebp for Pillow image resize.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      libjpeg-dev \
      libpng-dev \
      libwebp-dev \
      libffi-dev \
      curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (better layer caching).
COPY pyproject.toml ./
RUN pip install --upgrade pip \
 && pip install . \
 && pip install "uvicorn[standard]>=0.30"

# App source.
COPY app ./app
COPY scripts ./scripts

# Volume mount for persistent SQLite + uploads.
ENV DATA_DIR=/data \
    UPLOAD_DIR=/data/uploads \
    DATABASE_URL=sqlite+aiosqlite:////data/match57.db
RUN mkdir -p /data/uploads

EXPOSE 8080

# Honour PORT env if set (Fly.io / Render / Railway), default 8080.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
