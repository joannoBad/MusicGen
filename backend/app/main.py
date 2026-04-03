from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.audio import UnsupportedAudioError, fingerprint_audio, password_from_digest
from app.limits import load_audio_limits
from app.schemas import PasswordMode, PasswordResponse

# Keep the API version aligned with the current git tag.
app = FastAPI(title="MusicGen Password Lab API", version="0.1.2")
AUDIO_LIMITS = load_audio_limits()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    """Small probe used by local launch scripts and deployment checks."""

    return {"status": "ok"}


@app.post("/api/generate-password", response_model=PasswordResponse)
async def generate_password(
    file: UploadFile = File(...),
    mode: PasswordMode = Form(...),
    trim_if_needed: bool = Form(False),
) -> PasswordResponse:
    """Generate a deterministic password from uploaded audio."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="The uploaded file must have a name.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if len(contents) > AUDIO_LIMITS.max_upload_size_bytes and not trim_if_needed:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Audio size exceeds the limit of "
                f"{AUDIO_LIMITS.max_upload_size_bytes // (1024 * 1024)} MB."
            ),
        )

    try:
        fingerprint = fingerprint_audio(contents, mode, file.filename, trim_if_needed)
    except UnsupportedAudioError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # The web client treats this response as the source of truth for password output.
    return PasswordResponse(
        algorithm=fingerprint.algorithm,
        fingerprint_preview=fingerprint.preview,
        mode=mode,
        password=password_from_digest(fingerprint.digest),
    )
