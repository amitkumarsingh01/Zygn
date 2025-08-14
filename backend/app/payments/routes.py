from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from app.payments.models import PaymentCreate, PaymentResponse, PaymentInDB, PaymentStatus
from app.auth.utils import verify_token
from app.database import get_database
from bson import ObjectId
from datetime import datetime, timezone
import uuid

payments_router = APIRouter()
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_database)):
    user_id = verify_token(credentials.credentials)
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@payments_router.post("/create", response_model=dict)
async def create_payment(
    payment_data: PaymentCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Verify document exists and user is involved
    document = await db.documents.find_one({"_id": ObjectId(payment_data.document_id)})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if current_user["user_id"] not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check wallet balance
    wallet = await db.wallets.find_one({"user_id": current_user["user_id"]})
    if not wallet or wallet["balance"] < payment_data.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient wallet balance"
        )
    
    # Create payment record
    payment = PaymentInDB(
        user_id=current_user["user_id"],
        document_id=payment_data.document_id,
        amount=payment_data.amount,
        duration_days=payment_data.duration_days,
        split_percentage=payment_data.split_percentage,
        transaction_id=str(uuid.uuid4())
    )
    
    result = await db.payments.insert_one(payment.dict())
    
    # Deduct from wallet
    await db.wallets.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"balance": -payment_data.amount},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Add transaction history
    await db.transactions.insert_one({
        "user_id": current_user["user_id"],
        "type": "payment",
        "amount": -payment_data.amount,
        "description": f"Payment for document {payment_data.document_id}",
        "payment_id": str(result.inserted_id),
        "created_at": datetime.now(timezone.utc)
    })
    
    return {
        "message": "Payment created successfully",
        "payment_id": str(result.inserted_id),
        "transaction_id": payment.transaction_id
    }

@payments_router.put("/{payment_id}/confirm")
async def confirm_payment(
    payment_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Find payment
    payment = await db.payments.find_one({"_id": ObjectId(payment_id)})
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Verify user owns this payment
    if payment["user_id"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Update payment status
    await db.payments.update_one(
        {"_id": ObjectId(payment_id)},
        {
            "$set": {
                "status": PaymentStatus.COMPLETED,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {"message": "Payment confirmed successfully"}

@payments_router.get("/my-payments", response_model=List[PaymentResponse])
async def get_my_payments(current_user=Depends(get_current_user), db=Depends(get_database)):
    payments = await db.payments.find(
        {"user_id": current_user["user_id"]}
    ).sort("created_at", -1).to_list(None)
    
    return [PaymentResponse(**payment, id=str(payment["_id"])) for payment in payments]
