from pydantic import BaseModel


class UserResponse(BaseModel):
    user_id: str
    email: str
    name: str | None = None
    avatar: str | None = None
    tier: str = "free"
    email_verified: bool = False

    model_config = {"from_attributes": True}
