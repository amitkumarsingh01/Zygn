from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from enum import Enum

def get_current_datetime():
    return datetime.now(timezone.utc)

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class PaymentCreate(BaseModel):
    document_id: str
    amount: float = Field(..., gt=0)
    duration_days: int = Field(..., gt=0)
    split_percentage: Optional[float] = Field(None, ge=0, le=100)

class PaymentResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    document_id: str
    amount: float
    duration_days: int
    split_percentage: Optional[float]
    status: PaymentStatus
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True

class PaymentInDB(BaseModel):
    user_id: str
    document_id: str
    amount: float
    duration_days: int
    split_percentage: Optional[float] = None
    status: PaymentStatus = PaymentStatus.PENDING
    transaction_id: Optional[str] = None
    created_at: datetime = Field(default_factory=get_current_datetime)
    updated_at: datetime = Field(default_factory=get_current_datetime)