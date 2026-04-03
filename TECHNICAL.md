# MusicGen Technical Guide

## Overview

MusicGen generates deterministic passwords from the acoustic fingerprint of an audio recording.

The project currently supports two fingerprint modes:

- `Exact` - hashes normalized PCM data for strict repeatability
- `Robust` - hashes coarse spectral peaks so similar recordings stay closer together

## Stack

- Frontend: `Next.js 15`, `React 19`, `TypeScript`
- Backend: `FastAPI`, `Python`
- Desktop: `Electron`
- Audio pipeline: deterministic normalization, spectral feature extraction, deterministic password mapping

## Repository layout

```text
frontend/        Next.js user interface
backend/         FastAPI API and audio fingerprint logic
desktop/         Standalone Electron build that works offline
scripts/         Windows and Linux helper scripts for startup and shutdown
deploy/          Extra deployment config for Linux environments
deploy/systemd/  Example systemd units
docs/screenshots README assets
```

## Current behavior

- The backend accepts `WAV` and `MP3`.
- `MP3` decoding depends on `ffmpeg`.
- Password generation stays deterministic as long as the normalized input stays the same.
- The web client trims oversized audio in the browser before upload.
- The desktop app runs fully offline and does not depend on `frontend/` or `backend/` at runtime.

## Quick start

### Windows, production-like mode

Start:

```bat
start_prod.cmd
```

Stop:

```bat
stop_prod.cmd
```

### Linux, production-like mode

Make the scripts executable once:

```bash
chmod +x start_prod.sh stop_prod.sh scripts/*.sh
```

Start:

```bash
./start_prod.sh
```

Stop:

```bash
./stop_prod.sh
```

After startup the default endpoints are:

- frontend: `http://127.0.0.1:3000`
- backend health: `http://127.0.0.1:8000/api/health`

### Windows, development mode

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_all.ps1
```

## Manual development setup

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend on Windows

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Backend on Linux or macOS

```bash
cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Desktop build

The standalone Electron version lives in `desktop/`.

It:

- does not use `frontend/` or `backend/` during runtime
- does not require a local server
- does not require internet access
- can be built as a Windows portable executable

Run it locally:

```powershell
cd desktop
npm install
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm start
```

Build the portable package:

```powershell
cd desktop
npm install
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run build:portable
```

Default artifact path:

```text
desktop/dist/MusicGen-Portable-0.1.2.exe
```

## Linux deployment

Recommended stack:

- process management: `systemd`
- reverse proxy: `Caddy`
- audio decoding: `ffmpeg`

Example dependency install:

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip ffmpeg nodejs npm caddy
```

Install project dependencies:

```bash
cd /opt/musicgen/frontend
npm install
npm run build

cd /opt/musicgen/backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
```

### systemd

Templates live in `deploy/systemd/`.

Copy them after checking paths and user names:

```bash
sudo cp deploy/systemd/musicgen-backend.service /etc/systemd/system/
sudo cp deploy/systemd/musicgen-frontend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now musicgen-backend musicgen-frontend
```

### Caddy

The starter config is stored in `deploy/Caddyfile`.

Replace `example.com` with your real domain or hostname, then install it:

```bash
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

With this setup:

- frontend is served on `/`
- backend is proxied on `/api/*`
- the browser talks to a single host instead of two separate ports

## Tests

Backend tests currently cover:

- deterministic output for identical audio
- password differences between `Exact` and `Robust`
- behavior when gain, noise, shift, or trailing silence changes the source
- trimming behavior for oversized input
- empty file handling
- silent audio handling
- direct HTTP integration through `/api/generate-password`

Run them on Windows:

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

## Environment variables

For a split local frontend/backend setup, copy `frontend/.env.local.example` to `frontend/.env.local`.

If the app is served behind `Caddy` on a single host, the frontend can use relative `/api` requests without an absolute base URL.

Example for local development:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```
