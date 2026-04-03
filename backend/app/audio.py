from __future__ import annotations

"""Deterministic audio normalization and password fingerprint helpers."""

import hashlib
import io
import math
import os
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from pydub import AudioSegment
from app.limits import load_audio_limits

TARGET_SAMPLE_RATE = 22_050
PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?"
FFMPEG_ROOT = Path.home() / "AppData" / "Local" / "Microsoft" / "WinGet" / "Packages"
AUDIO_LIMITS = load_audio_limits()


class UnsupportedAudioError(ValueError):
    """Raised when uploaded audio cannot be normalized by the current pipeline."""


@dataclass(frozen=True)
class AudioFingerprint:
    """Compact fingerprint payload used to build the final password response."""

    algorithm: str
    digest: str
    preview: str


def configure_ffmpeg() -> None:
    """Wire pydub to a WinGet-installed ffmpeg build when it is available."""

    ffmpeg_candidates = sorted(FFMPEG_ROOT.glob("Gyan.FFmpeg*/ffmpeg-*/bin/ffmpeg.exe"))
    ffprobe_candidates = sorted(FFMPEG_ROOT.glob("Gyan.FFmpeg*/ffmpeg-*/bin/ffprobe.exe"))

    if not ffmpeg_candidates:
        return

    ffmpeg_path = ffmpeg_candidates[-1]
    ffmpeg_bin = str(ffmpeg_path.parent)
    current_path = os.environ.get("PATH", "")

    if ffmpeg_bin not in current_path.split(os.pathsep):
        os.environ["PATH"] = f"{ffmpeg_bin}{os.pathsep}{current_path}" if current_path else ffmpeg_bin

    AudioSegment.converter = str(ffmpeg_path)

    if ffprobe_candidates:
        AudioSegment.ffprobe = str(ffprobe_candidates[-1])


configure_ffmpeg()


def sniff_format(filename: str | None) -> str | None:
    """Infer the supported upload format from the file extension."""

    if not filename:
        return None

    extension = Path(filename).suffix.lower().lstrip(".")
    if extension in {"wav", "mp3"}:
        return extension

    return None


def decode_wav(contents: bytes) -> tuple[np.ndarray, int]:
    """Decode WAV bytes into a mono float array."""

    try:
        with wave.open(io.BytesIO(contents), "rb") as wav_file:
            channels = wav_file.getnchannels()
            sample_width = wav_file.getsampwidth()
            sample_rate = wav_file.getframerate()
            frame_count = wav_file.getnframes()
            raw_frames = wav_file.readframes(frame_count)
    except wave.Error as exc:
        raise UnsupportedAudioError("The uploaded WAV file could not be decoded.") from exc

    if sample_width not in {1, 2, 4}:
        raise UnsupportedAudioError("Unsupported WAV bit depth for deterministic normalization.")

    dtype_map = {1: np.uint8, 2: np.int16, 4: np.int32}
    audio = np.frombuffer(raw_frames, dtype=dtype_map[sample_width]).astype(np.float32)

    # Fold multichannel uploads into a single mono stream so every client follows one path.
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)

    if sample_width == 1:
        audio = (audio - 128.0) / 128.0
    else:
        peak = float(2 ** (sample_width * 8 - 1))
        audio = audio / peak

    return audio, sample_rate


def decode_compressed_audio(contents: bytes, format_hint: str) -> tuple[np.ndarray, int]:
    """Decode MP3 input through pydub/ffmpeg and convert it to mono floats."""

    try:
        segment = AudioSegment.from_file(io.BytesIO(contents), format=format_hint)
    except Exception as exc:  # pragma: no cover - backend surfaces as HTTP 400
        raise UnsupportedAudioError(
            "The uploaded audio could not be decoded. Make sure ffmpeg is installed and the file is valid."
        ) from exc

    segment = segment.set_channels(1)
    sample_rate = int(segment.frame_rate)
    sample_width = int(segment.sample_width)

    if sample_width not in {1, 2, 4}:
        raise UnsupportedAudioError("Unsupported decoded bit depth for deterministic normalization.")

    audio = np.array(segment.get_array_of_samples(), dtype=np.float32)

    if sample_width == 1:
        audio = (audio - 128.0) / 128.0
    else:
        peak = float(2 ** (sample_width * 8 - 1))
        audio = audio / peak

    return audio, sample_rate


def decode_audio(contents: bytes, filename: str | None) -> tuple[np.ndarray, int]:
    """Decode any supported upload format into raw samples and a sample rate."""

    format_hint = sniff_format(filename)

    if format_hint == "wav":
        return decode_wav(contents)

    if format_hint == "mp3":
        return decode_compressed_audio(contents, format_hint)

    try:
        return decode_wav(contents)
    except UnsupportedAudioError as exc:
        raise UnsupportedAudioError("Supported formats: WAV and MP3.") from exc


def resample_audio(samples: np.ndarray, sample_rate: int, target_rate: int = TARGET_SAMPLE_RATE) -> np.ndarray:
    """Resample audio to the shared target rate used by the fingerprint pipeline."""

    if sample_rate == target_rate:
        return samples.astype(np.float32)

    if samples.size == 0:
        return samples.astype(np.float32)

    duration = samples.size / float(sample_rate)
    target_size = max(1, int(round(duration * target_rate)))
    source_axis = np.linspace(0.0, duration, num=samples.size, endpoint=False)
    target_axis = np.linspace(0.0, duration, num=target_size, endpoint=False)
    return np.interp(target_axis, source_axis, samples).astype(np.float32)


def normalize_audio(samples: np.ndarray) -> np.ndarray:
    """Center and peak-normalize the waveform before fingerprinting."""

    if samples.size == 0:
        raise UnsupportedAudioError("The uploaded audio file is empty.")

    centered = samples - float(np.mean(samples))
    peak = float(np.max(np.abs(centered)))
    if math.isclose(peak, 0.0):
        raise UnsupportedAudioError("The uploaded audio is silent after normalization.")

    normalized = centered / peak
    return np.clip(normalized, -1.0, 1.0).astype(np.float32)


def trim_audio(samples: np.ndarray, sample_rate: int, max_duration_seconds: float) -> np.ndarray:
    """Trim audio from the front when it exceeds the accepted duration budget."""

    max_samples = int(sample_rate * max_duration_seconds)
    if samples.size <= max_samples:
        return samples

    return samples[:max_samples].astype(np.float32)


def exact_fingerprint(samples: np.ndarray) -> AudioFingerprint:
    """Hash normalized PCM16 data for strict repeatability."""

    quantized = np.round(samples * 32767.0).astype(np.int16)
    digest = hashlib.sha256(quantized.tobytes()).hexdigest()
    preview = "-".join(digest[index:index + 4] for index in range(0, 16, 4))
    return AudioFingerprint(algorithm="sha256(normalized_pcm16)", digest=digest, preview=preview)


def robust_fingerprint(samples: np.ndarray) -> AudioFingerprint:
    """Hash coarse spectral peaks so similar recordings stay closer together."""

    window_size = 2048
    hop_size = 512

    if samples.size < window_size:
        samples = np.pad(samples, (0, window_size - samples.size)).astype(np.float32)

    # Build overlapping windows to capture the rough spectral shape over time.
    windows: list[np.ndarray] = []
    for start in range(0, samples.size - window_size + 1, hop_size):
        frame = samples[start:start + window_size]
        windows.append(frame * np.hanning(window_size))

    spectrogram = np.abs(np.fft.rfft(np.vstack(windows), axis=1))
    if spectrogram.size == 0:
        raise UnsupportedAudioError("Unable to compute a spectral fingerprint for this audio.")

    band_count = 24
    bands = np.array_split(spectrogram[:, 1:], band_count, axis=1)
    band_energy = np.stack([band.mean(axis=1) for band in bands], axis=1)
    dominant_bands = np.argsort(band_energy, axis=1)[:, -3:]

    serialized = []
    for frame_index, triple in enumerate(dominant_bands):
        ordered = ",".join(str(int(value)) for value in sorted(triple.tolist()))
        serialized.append(f"{frame_index % 97}:{ordered}")

    payload = "|".join(serialized).encode("utf-8")
    digest = hashlib.sha256(payload).hexdigest()
    preview = " / ".join(serialized[:3])
    return AudioFingerprint(algorithm="sha256(quantized_spectral_peaks)", digest=digest, preview=preview)


def fingerprint_audio(
    contents: bytes,
    mode: str,
    filename: str | None = None,
    trim_if_needed: bool = False,
) -> AudioFingerprint:
    """Run the full backend fingerprint pipeline for one uploaded file."""

    decoded, sample_rate = decode_audio(contents, filename)
    duration_seconds = decoded.size / float(sample_rate) if sample_rate else 0.0
    target_duration_seconds = float(AUDIO_LIMITS.max_duration_seconds)

    # Oversized uploads get a proportional trim budget when trimming is allowed.
    if len(contents) > AUDIO_LIMITS.max_upload_size_bytes:
        size_ratio = AUDIO_LIMITS.max_upload_size_bytes / float(len(contents))
        target_duration_seconds = min(
            target_duration_seconds,
            max(1.0, float(math.floor(duration_seconds * size_ratio))),
        )

    if duration_seconds > AUDIO_LIMITS.max_duration_seconds and not trim_if_needed:
        raise UnsupportedAudioError(
            f"Audio duration exceeds the limit of {AUDIO_LIMITS.max_duration_seconds} seconds."
        )

    if len(contents) > AUDIO_LIMITS.max_upload_size_bytes and not trim_if_needed:
        raise UnsupportedAudioError(
            f"Audio size exceeds the limit of {AUDIO_LIMITS.max_upload_size_bytes // (1024 * 1024)} MB."
        )

    if duration_seconds > target_duration_seconds:
        decoded = trim_audio(decoded, sample_rate, target_duration_seconds)

    resampled = resample_audio(decoded, sample_rate)
    normalized = normalize_audio(resampled)

    if mode == "exact":
        return exact_fingerprint(normalized)

    if mode == "robust":
        return robust_fingerprint(normalized)

    raise ValueError(f"Unsupported mode: {mode}")


def password_from_digest(digest: str, length: int = 18) -> str:
    """Map a hex digest to a readable password with mixed character classes."""

    alphabet_length = len(PASSWORD_ALPHABET)
    characters = [
        PASSWORD_ALPHABET[int(digest[index:index + 2], 16) % alphabet_length]
        for index in range(0, length * 2, 2)
    ]

    password = "".join(characters)

    if not any(character.isupper() for character in password):
        password = f"A{password[1:]}"
    if not any(character.islower() for character in password):
        password = f"{password[:-1]}b"
    if not any(character.isdigit() for character in password):
        password = f"{password[:-2]}7{password[-1]}"
    if all(character.isalnum() for character in password):
        password = f"{password[:-3]}!{password[-2:]}"

    return password
