from pydantic import BaseModel


class SubscriptionStatus(BaseModel):
    user_id: str
    tier: str
    active: bool
