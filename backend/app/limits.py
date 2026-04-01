from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class AudioLimits:
    max_duration_seconds: int
    max_upload_size_bytes: int


def load_audio_limits() -> AudioLimits:
    repo_root = Path(__file__).resolve().parents[2]
    config_path = repo_root / "frontend" / "config" / "audio-limits.json"
    payload = json.loads(config_path.read_text(encoding="utf-8"))

    max_duration_seconds = int(payload["maxDurationSeconds"])
    max_upload_size_mb = int(payload["maxUploadSizeMb"])

    return AudioLimits(
        max_duration_seconds=max_duration_seconds,
        max_upload_size_bytes=max_upload_size_mb * 1024 * 1024,
    )
