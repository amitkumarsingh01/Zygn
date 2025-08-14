from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone
import secrets
import string
import uuid

def generate_char_id():
    return ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(8))

def generate_user_id():
    return str(uuid.uuid4()).replace('-', '')[:16]

def get_current_datetime():
    return datetime.now(timezone.utc)

class UserRegistration(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    phone_no: str = Field(..., pattern=r'^\+?[1-9]\d{1,14}$')
    password: str = Field(..., min_length=6)
    city: str = Field(..., min_length=2, max_length=50)
    state: str = Field(..., min_length=2, max_length=50)
    confirm_password: str

class UserLogin(BaseModel):
    phone_no: str
    otp: str

class UserInDB(BaseModel):
    user_id: str = Field(default_factory=generate_user_id)
    name: str
    email: EmailStr
    phone_no: str
    password_hash: str
    city: str
    state: str
    char_id: str = Field(default_factory=generate_char_id)
    created_at: datetime = Field(default_factory=get_current_datetime)
    updated_at: datetime = Field(default_factory=get_current_datetime)
    is_active: bool = True
    is_admin: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: str
    char_id: str