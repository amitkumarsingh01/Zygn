from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional

def get_current_datetime():
    return datetime.now(timezone.utc)

class MessageCreate(BaseModel):
    receiver_id: str
    content: str = Field(..., min_length=1, max_length=1000)
    attachment: Optional[str] = None

class MessageResponse(BaseModel):
    _id: str
    sender_id: str
    receiver_id: str
    content: str
    attachment: Optional[str] = None
    created_at: datetime
    is_read: bool
    
    class Config:
        populate_by_name = True

class MessageInDB(BaseModel):
    sender_id: str
    receiver_id: str
    content: str
    attachment: Optional[str] = None
    created_at: datetime = Field(default_factory=get_current_datetime)
    is_read: bool = False