from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone

def get_current_datetime():
    return datetime.now(timezone.utc)

class UserProfile(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    profile_pic: Optional[str] = None
    signature_pic: Optional[str] = None
    eye_pic: Optional[str] = None
    fingerprint: Optional[str] = None
    mpin: Optional[str] = Field(None, min_length=4, max_length=6)
    govt_id_type: Optional[str] = None
    govt_id_number: Optional[str] = None
    char_id: str
    status: str = "active"
    is_active: bool = True
    is_admin: bool = False
    updated_at: datetime = Field(default_factory=get_current_datetime)

class UserProfileResponse(BaseModel):
    id: str = Field(alias="_id")
    name: str
    email: EmailStr
    phone_no: str
    profile_pic: Optional[str] = None
    signature_pic: Optional[str] = None
    eye_pic: Optional[str] = None
    fingerprint: Optional[str] = None
    char_id: str
    city: str
    state: str
    govt_id_type: Optional[str] = None
    govt_id_number: Optional[str] = None
    status: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True

class UserListResponse(BaseModel):
    user_id: str
    char_id: str
    name: str
    email: EmailStr
    phone_no: str
    city: str
    state: str
    status: str
    is_active: bool
    created_at: datetime