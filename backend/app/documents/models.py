from pydantic import BaseModel, Field
from typing import List, Optional, Union
from datetime import datetime
import secrets
import string

def generate_document_code():
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

class DocumentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

class DocumentResponse(BaseModel):
    id: str = Field(alias="_id")
    involved_users: List[str]
    primary_user: str
    upload_raw_docs: List[str]
    final_docs: Optional[List[str]] = None
    datetime: datetime
    location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    name: str
    document_code: str
    ai_forgery_check: bool = False
    blockchain: bool = False
    status: str = "draft"
    is_active: bool = True
    is_primary: bool = False
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True

class DocumentInDB(BaseModel):
    involved_users: List[str]
    primary_user: str
    upload_raw_docs: List[str] = []
    final_docs: Optional[List[str]] = None
    datetime: datetime
    location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    name: str
    document_code: str = Field(default_factory=generate_document_code)
    ai_forgery_check: bool = False
    blockchain: bool = False
    status: str = "draft"  # draft, pending, approved, finalized
    is_active: bool = True
    is_primary: bool = False
    created_at: datetime
    updated_at: datetime

class JoinDocumentRequest(BaseModel):
    document_code: str