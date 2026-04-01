from typing import Literal

from pydantic import BaseModel


PasswordMode = Literal["exact", "robust"]


class PasswordResponse(BaseModel):
    algorithm: str
    fingerprint_preview: str
    mode: PasswordMode
    password: str
