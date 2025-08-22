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
    involved_users: List[str] = []
    primary_user: str = ""
    upload_raw_docs: List[str] = []
    final_docs: Optional[List[str]] = []
    datetime: datetime
    location: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    name: str = ""
    document_code: str = ""
    ai_forgery_check: bool = False
    blockchain: bool = False
    status: str = "draft"
    is_active: bool = True
    is_primary: bool = False
    daily_rate: Optional[float] = None
    total_days: Optional[int] = None
    total_amount: Optional[float] = None
    payment_status: Optional[str] = "pending"
    # User approval tracking
    user_approvals: Optional[dict] = Field(default_factory=dict, description="Track user approval status")
    # Verification documents collected fresh for each document operation
    verification_documents: Optional[dict] = Field(default_factory=dict, description="Fresh verification documents for this document")
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
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    name: str
    document_code: str = Field(default_factory=generate_document_code)
    ai_forgery_check: bool = False
    blockchain: bool = False
    status: str = "draft"  # draft, pending_approval, approved, payment_pending, payment_completed, finalized
    is_active: bool = True
    is_primary: bool = False
    daily_rate: float = 1.0  # Dynamic daily rate from pricing config
    total_days: int = 1
    total_amount: float = 1.0
    payment_status: str = "pending"
    # User approval tracking - track who has approved
    user_approvals: Optional[dict] = Field(default_factory=dict, description="Track user approval status: {user_id: {approved: bool, approved_at: datetime}}")
    # Verification documents collected fresh for each document operation
    verification_documents: Optional[dict] = Field(default_factory=dict, description="Fresh verification documents for this document")
    created_at: datetime
    updated_at: datetime

class JoinDocumentRequest(BaseModel):
    document_code: str

class InitiateAgreementRequest(BaseModel):
    target_user_char_id: str
    name: str
    location: Optional[str] = None

# Pricing Configuration Models
class PricingConfig(BaseModel):
    daily_rate: float = Field(..., gt=0, description="Daily rate in coins per day")
    is_active: bool = True
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None  # Track who created it
    updated_by: Optional[str] = None  # Track who last updated it

class PricingConfigCreate(BaseModel):
    daily_rate: float = Field(..., gt=0, description="Daily rate in coins per day")

class PricingConfigUpdate(BaseModel):
    daily_rate: float = Field(..., gt=0, description="Daily rate in coins per day")