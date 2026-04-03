from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioLimits:
    """Shared upload limits used by both the UI and the backend."""

    max_duration_seconds: int
    max_upload_size_bytes: int


def load_audio_limits() -> AudioLimits:
    """Load the single source of truth for upload limits from the frontend config."""

    repo_root = Path(__file__).resolve().parents[2]
    config_path = repo_root / "frontend" / "config" / "audio-limits.json"
    payload = json.loads(config_path.read_text(encoding="utf-8"))

    max_duration_seconds = int(payload["maxDurationSeconds"])
    max_upload_size_mb = int(payload["maxUploadSizeMb"])

    return AudioLimits(
        max_duration_seconds=max_duration_seconds,
        max_upload_size_bytes=max_upload_size_mb * 1024 * 1024,
    )
