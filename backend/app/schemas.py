from typing import Literal

from pydantic import BaseModel


# The API intentionally exposes only the two supported fingerprint modes.
PasswordMode = Literal["exact", "robust"]


class PasswordResponse(BaseModel):
    """Normalized API payload returned to the client after generation."""

    algorithm: str
    fingerprint_preview: str
    mode: PasswordMode
    password: str
