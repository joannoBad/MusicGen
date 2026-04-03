from __future__ import annotations

"""Regression and behavior tests for the MusicGen backend password pipeline.

This module covers three levels of behavior:

1. Pure fingerprint/password logic
   These tests call the backend helpers directly and validate the core DSP and
   hashing assumptions that the product relies on.

2. Endpoint-level validation
   These tests call the FastAPI route function directly to verify how backend
   exceptions are translated into HTTP errors before any real network layer is
   involved.

3. HTTP integration
   These tests use a real in-process HTTP client against `/api/generate-password`
   to confirm that request parsing, validation, serialization, and response
   payloads behave exactly as the web client expects.
"""

import io
import math
import unittest
import wave

import numpy as np
from fastapi import HTTPException, UploadFile
from fastapi.testclient import TestClient

from app.audio import (
    AUDIO_LIMITS,
    UnsupportedAudioError,
    fingerprint_audio,
    password_from_digest,
)
from app.main import app, generate_password as generate_password_endpoint


TARGET_RATE = 22_050


def build_wave_bytes(samples: np.ndarray, sample_rate: int) -> bytes:
    """Serialize mono float samples into a PCM16 WAV payload.

    Args:
        samples: Normalized float audio in the range roughly `[-1.0, 1.0]`.
        sample_rate: WAV sample rate that should be written into the header.

    Returns:
        A valid byte string containing an in-memory WAV file.

    Raises:
        This helper should not raise for normal test input. If it does, the test
        fixture itself is malformed.
    """

    pcm = (np.clip(samples, -1.0, 1.0) * 32767.0).astype(np.int16)
    buffer = io.BytesIO()

    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm.tobytes())

    return buffer.getvalue()


def synthesize_composite_tone(
    *,
    duration_seconds: float = 2.0,
    sample_rate: int = TARGET_RATE,
    gain: float = 1.0,
) -> np.ndarray:
    """Build a deterministic multi-tone audio fixture for reproducible tests.

    Args:
        duration_seconds: Target duration of the synthetic clip.
        sample_rate: Sample rate used to synthesize the waveform.
        gain: Linear gain multiplier applied to the whole signal.

    Returns:
        A float32 mono waveform composed of several sine components.

    Raises:
        No exception is expected here. If this helper breaks, the whole fixture
        generation chain is invalid.
    """

    axis = np.linspace(0.0, duration_seconds, int(sample_rate * duration_seconds), endpoint=False)
    signal = (
        0.45 * np.sin(2.0 * math.pi * 440.0 * axis)
        + 0.22 * np.sin(2.0 * math.pi * 660.0 * axis)
        + 0.12 * np.sin(2.0 * math.pi * 880.0 * axis)
    )
    return (signal * gain).astype(np.float32)


def generate_password_for_audio(
    contents: bytes,
    mode: str,
    filename: str = "sample.wav",
    trim_if_needed: bool = False,
) -> str:
    """Run the canonical backend pipeline and return the final user password.

    Args:
        contents: Raw bytes of the uploaded audio file.
        mode: Fingerprint mode, expected to be `"exact"` or `"robust"`.
        filename: File name hint used by backend format sniffing.
        trim_if_needed: Whether the backend is allowed to trim long/large audio.

    Returns:
        The final password string returned by the backend hashing pipeline.

    Raises:
        UnsupportedAudioError: When the payload is invalid, empty, silent,
            too long without trimming enabled, or otherwise unsupported.
        ValueError: When an unsupported mode name is passed in.
    """

    fingerprint = fingerprint_audio(contents, mode, filename=filename, trim_if_needed=trim_if_needed)
    return password_from_digest(fingerprint.digest)


class FingerprintPipelineTests(unittest.TestCase):
    """Behavioral tests for the low-level fingerprint and password pipeline.

    These tests focus on deterministic properties of the algorithm itself:
    repeatability, mode separation, and reaction to controlled audio changes.
    """

    def setUp(self) -> None:
        """Prepare a reusable synthetic audio corpus for all pipeline tests.

        Fixtures created here:
        - base clip
        - resampled equivalent at 44.1 kHz
        - lower-gain version
        - small-noise version
        - time-shifted version
        - version with appended silence
        """

        self.base_samples = synthesize_composite_tone()
        self.base_wav = build_wave_bytes(self.base_samples, TARGET_RATE)
        self.base_wav_44k = build_wave_bytes(synthesize_composite_tone(sample_rate=44_100), 44_100)
        self.gain_variant_wav = build_wave_bytes(synthesize_composite_tone(gain=0.5), TARGET_RATE)

        rng = np.random.default_rng(0)
        noisy = (self.base_samples + 0.003 * rng.normal(size=self.base_samples.shape)).astype(np.float32)
        self.noise_variant_wav = build_wave_bytes(noisy, TARGET_RATE)

        shift = np.concatenate([np.zeros(1200, dtype=np.float32), self.base_samples[:-1200]])
        self.shift_variant_wav = build_wave_bytes(shift, TARGET_RATE)

        extended = np.concatenate([self.base_samples, np.zeros(TARGET_RATE // 2, dtype=np.float32)])
        self.appended_silence_wav = build_wave_bytes(extended, TARGET_RATE)

    def test_same_audio_produces_same_password_in_exact_mode(self) -> None:
        """Check exact-mode determinism for byte-identical source audio.

        Accepts:
        - the same WAV payload twice

        Returns:
        - the same password on both runs

        Error case:
        - any mismatch means exact-mode determinism is broken
        """

        first = generate_password_for_audio(self.base_wav, "exact")
        second = generate_password_for_audio(self.base_wav, "exact")

        self.assertEqual(first, second)

    def test_same_audio_produces_same_password_in_robust_mode(self) -> None:
        """Check robust-mode determinism for byte-identical source audio.

        Accepts:
        - the same WAV payload twice

        Returns:
        - the same password on both runs

        Error case:
        - any mismatch means robust-mode determinism is broken
        """

        first = generate_password_for_audio(self.base_wav, "robust")
        second = generate_password_for_audio(self.base_wav, "robust")

        self.assertEqual(first, second)

    def test_same_signal_with_different_sample_rate_stays_equal_after_resampling(self) -> None:
        """Verify cross-sample-rate stability after backend resampling.

        Accepts:
        - one 22.05 kHz render of the synthetic tone
        - one 44.1 kHz render of the same synthetic tone

        Returns:
        - the same password in both modes after backend normalization/resampling

        Error case:
        - a mismatch would mean the canonical resampling stage is not stable
        """

        exact_22k = generate_password_for_audio(self.base_wav, "exact")
        exact_44k = generate_password_for_audio(self.base_wav_44k, "exact")
        robust_22k = generate_password_for_audio(self.base_wav, "robust")
        robust_44k = generate_password_for_audio(self.base_wav_44k, "robust")

        self.assertEqual(exact_22k, exact_44k)
        self.assertEqual(robust_22k, robust_44k)

    def test_different_modes_produce_different_passwords_for_same_audio(self) -> None:
        """Ensure mode selection actually changes the resulting password.

        Accepts:
        - the same audio payload
        - two different modes: `exact` and `robust`

        Returns:
        - two different passwords

        Error case:
        - equality would mean the mode switch is effectively meaningless
        """

        exact_password = generate_password_for_audio(self.base_wav, "exact")
        robust_password = generate_password_for_audio(self.base_wav, "robust")

        self.assertNotEqual(exact_password, robust_password)

    def test_gain_change_affects_exact_but_not_robust_mode(self) -> None:
        """Measure how gain-only changes affect the current implementation.

        Accepts:
        - the base waveform
        - the same waveform with lower overall gain

        Returns:
        - exact mode changes, because the normalized PCM fingerprint still ends
          up quantized differently for this implementation
        - robust mode stays stable for this particular gain change

        Error case:
        - if exact stays equal or robust changes, the current behavior changed
          and the test suite should force an explicit decision about that change
        """

        exact_base = generate_password_for_audio(self.base_wav, "exact")
        exact_gain = generate_password_for_audio(self.gain_variant_wav, "exact")
        robust_base = generate_password_for_audio(self.base_wav, "robust")
        robust_gain = generate_password_for_audio(self.gain_variant_wav, "robust")

        self.assertNotEqual(exact_base, exact_gain)
        self.assertEqual(robust_base, robust_gain)

    def test_small_noise_changes_both_modes(self) -> None:
        """Confirm that low-amplitude additive noise changes current outputs.

        Accepts:
        - the base waveform
        - a slightly noisy version with deterministic seeded noise

        Returns:
        - a different password in exact mode
        - a different password in robust mode

        Error case:
        - if either mode stops reacting, the effective noise tolerance changed
        """

        exact_base = generate_password_for_audio(self.base_wav, "exact")
        exact_noisy = generate_password_for_audio(self.noise_variant_wav, "exact")
        robust_base = generate_password_for_audio(self.base_wav, "robust")
        robust_noisy = generate_password_for_audio(self.noise_variant_wav, "robust")

        self.assertNotEqual(exact_base, exact_noisy)
        self.assertNotEqual(robust_base, robust_noisy)

    def test_time_shift_affects_exact_but_not_robust_mode(self) -> None:
        """Check sensitivity to a leading time shift.

        Accepts:
        - the base waveform
        - the same waveform delayed by leading zeros

        Returns:
        - exact mode changes
        - robust mode stays equal for this shift pattern

        Error case:
        - a behavior change here means time-shift tolerance changed
        """

        exact_base = generate_password_for_audio(self.base_wav, "exact")
        exact_shifted = generate_password_for_audio(self.shift_variant_wav, "exact")
        robust_base = generate_password_for_audio(self.base_wav, "robust")
        robust_shifted = generate_password_for_audio(self.shift_variant_wav, "robust")

        self.assertNotEqual(exact_base, exact_shifted)
        self.assertEqual(robust_base, robust_shifted)

    def test_appending_silence_changes_both_modes(self) -> None:
        """Verify that trailing silence currently changes both fingerprints.

        Accepts:
        - the base waveform
        - the same waveform with appended silence at the end

        Returns:
        - different passwords in both modes for the current implementation

        Error case:
        - equality would mean trailing-silence handling changed
        """

        exact_base = generate_password_for_audio(self.base_wav, "exact")
        exact_extended = generate_password_for_audio(self.appended_silence_wav, "exact")
        robust_base = generate_password_for_audio(self.base_wav, "robust")
        robust_extended = generate_password_for_audio(self.appended_silence_wav, "robust")

        self.assertNotEqual(exact_base, exact_extended)
        self.assertNotEqual(robust_base, robust_extended)

    def test_long_audio_requires_trim_flag(self) -> None:
        """Verify backend behavior when duration exceeds the configured limit.

        Accepts:
        - a synthetic clip that is one second longer than the configured limit
        - the manually trimmed version of the same clip

        Returns:
        - `UnsupportedAudioError` when trimming is disabled
        - the same password as the manually trimmed clip when trimming is enabled

        Error case:
        - no exception without trimming, or mismatched trimmed output
        """

        duration_seconds = AUDIO_LIMITS.max_duration_seconds + 1
        long_samples = synthesize_composite_tone(duration_seconds=duration_seconds)
        trimmed_samples = long_samples[: TARGET_RATE * AUDIO_LIMITS.max_duration_seconds]
        long_wav = build_wave_bytes(long_samples, TARGET_RATE)
        trimmed_wav = build_wave_bytes(trimmed_samples, TARGET_RATE)

        with self.assertRaisesRegex(UnsupportedAudioError, "Audio duration exceeds the limit"):
            fingerprint_audio(long_wav, "exact", filename="long.wav", trim_if_needed=False)

        exact_trimmed_from_flag = generate_password_for_audio(long_wav, "exact", trim_if_needed=True)
        exact_manual_trim = generate_password_for_audio(trimmed_wav, "exact")
        robust_trimmed_from_flag = generate_password_for_audio(long_wav, "robust", trim_if_needed=True)
        robust_manual_trim = generate_password_for_audio(trimmed_wav, "robust")

        self.assertEqual(exact_trimmed_from_flag, exact_manual_trim)
        self.assertEqual(robust_trimmed_from_flag, robust_manual_trim)


class GeneratePasswordEndpointTests(unittest.IsolatedAsyncioTestCase):
    """Route-function tests for direct FastAPI endpoint invocation."""

    async def test_empty_uploaded_file_returns_http_400(self) -> None:
        """Empty multipart payload should become a clear HTTP 400 error.

        Accepts:
        - an uploaded file object with a valid name but zero bytes

        Returns:
        - HTTP 400 with the message `The uploaded file is empty.`

        Error case:
        - any other status/detail would break the client-side UX contract
        """

        upload = UploadFile(filename="empty.wav", file=io.BytesIO(b""))

        with self.assertRaises(HTTPException) as error:
            await generate_password_endpoint(file=upload, mode="exact", trim_if_needed=False)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "The uploaded file is empty.")

    async def test_silent_audio_returns_http_400_and_no_password(self) -> None:
        """Silent audio should fail explicitly instead of producing a password.

        Accepts:
        - a valid WAV file containing only zero-amplitude samples

        Returns:
        - HTTP 400 with the message `The uploaded audio is silent after normalization.`

        Error case:
        - if a password is generated from silence, the contract is broken
        """

        silent_samples = np.zeros(TARGET_RATE, dtype=np.float32)
        silent_wav = build_wave_bytes(silent_samples, TARGET_RATE)
        upload = UploadFile(filename="silent.wav", file=io.BytesIO(silent_wav))

        with self.assertRaises(HTTPException) as error:
            await generate_password_endpoint(file=upload, mode="exact", trim_if_needed=False)

        self.assertEqual(error.exception.status_code, 400)
        self.assertEqual(error.exception.detail, "The uploaded audio is silent after normalization.")


class GeneratePasswordHttpIntegrationTests(unittest.TestCase):
    """End-to-end HTTP tests for the public FastAPI route."""

    @classmethod
    def setUpClass(cls) -> None:
        """Create a reusable in-process HTTP client for FastAPI integration tests."""

        cls.client = TestClient(app)

    def test_http_endpoint_returns_same_password_for_same_audio(self) -> None:
        """Confirm deterministic behavior through the actual HTTP layer.

        Accepts:
        - two separate POST requests with the same WAV payload
        - mode `exact`

        Returns:
        - HTTP 200 on both requests
        - the same password in both JSON payloads
        - a response body containing algorithm, preview, mode, and password

        Error case:
        - a status mismatch or password mismatch means the public API is not
          deterministic from the web client's point of view
        """

        payload = build_wave_bytes(synthesize_composite_tone(), TARGET_RATE)
        files = {"file": ("sample.wav", payload, "audio/wav")}
        data = {"mode": "exact", "trim_if_needed": "false"}

        first = self.client.post("/api/generate-password", files=files, data=data)
        second = self.client.post("/api/generate-password", files=files, data=data)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json()["password"], second.json()["password"])
        self.assertEqual(first.json()["mode"], "exact")
        self.assertIn("algorithm", first.json())
        self.assertIn("fingerprint_preview", first.json())

    def test_http_endpoint_returns_400_for_empty_upload(self) -> None:
        """Verify the real HTTP API response for an empty uploaded file.

        Accepts:
        - a multipart request with a named file part and zero bytes

        Returns:
        - HTTP 400
        - JSON body with `detail == "The uploaded file is empty."`

        Error case:
        - any other response would mean the frontend cannot rely on the API
          message for user-facing error handling
        """

        response = self.client.post(
            "/api/generate-password",
            files={"file": ("empty.wav", b"", "audio/wav")},
            data={"mode": "exact", "trim_if_needed": "false"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "The uploaded file is empty.")

    def test_http_endpoint_returns_400_for_silent_audio(self) -> None:
        """Verify the real HTTP API response for a valid but silent WAV file.

        Accepts:
        - a multipart request containing a valid WAV with only zero samples

        Returns:
        - HTTP 400
        - JSON body with `detail == "The uploaded audio is silent after normalization."`

        Error case:
        - any password output or any other error detail would break the intended
          product behavior and the user-visible messaging contract
        """

        silent_samples = np.zeros(TARGET_RATE, dtype=np.float32)
        silent_wav = build_wave_bytes(silent_samples, TARGET_RATE)

        response = self.client.post(
            "/api/generate-password",
            files={"file": ("silent.wav", silent_wav, "audio/wav")},
            data={"mode": "exact", "trim_if_needed": "false"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "The uploaded audio is silent after normalization.")


if __name__ == "__main__":
    unittest.main()
