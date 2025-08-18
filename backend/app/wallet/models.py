from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timezone
from enum import Enum

def get_current_datetime():
    return datetime.now(timezone.utc)

class TransactionType(str, Enum):
    CREDIT = "credit"
    DEBIT = "debit"
    PAYMENT = "payment"
    REFUND = "refund"

class WalletResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    balance: float
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True

class TransactionResponse(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    type: TransactionType
    amount: float
    description: str
    payment_id: Optional[str] = None
    payment_receipt: Optional[str] = None
    created_at: datetime
    
    class Config:
        populate_by_name = True

class WalletInDB(BaseModel):
    user_id: str
    balance: float = 0.0
    created_at: datetime = Field(default_factory=get_current_datetime)
    updated_at: datetime = Field(default_factory=get_current_datetime)

class AddFundsRequest(BaseModel):
    amount: float = Field(..., gt=0, le=10000)