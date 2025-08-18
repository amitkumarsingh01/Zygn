from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from app.payments.models import (
    PaymentCreate, PaymentResponse, PaymentInDB, PaymentStatus,
    PaymentDistribution, DocumentPaymentSetup, PaymentCalculationResponse
)
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

@payments_router.get("/document/{document_id}/calculate", response_model=PaymentCalculationResponse)
async def calculate_document_payment(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Calculate payment amount for a document (₹1 per day)"""
    print(f"=== Calculate Document Payment ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Try to find document by ObjectId first, then by document_code
    document = None
    
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception:
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is involved in the document
    if current_user["user_id"] not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Calculate duration and amount
    start_date = document.get("start_date")
    end_date = document.get("end_date")
    
    if not start_date or not end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document must have start and end dates to calculate payment"
        )
    
    # Calculate duration in days
    duration_days = (end_date - start_date).days
    if duration_days <= 0:
        duration_days = 1  # Minimum 1 day
    
    # Calculate total amount (₹1 per day)
    total_amount = duration_days * 1.0
    
    # Check payment status
    payment_status = "pending"
    payment_distributions = None
    can_finalize = False
    
    # Check if payment distributions exist
    existing_distributions = await db.payment_distributions.find_one({"document_id": str(document["_id"])})
    if existing_distributions:
        payment_status = "distributed"
        payment_distributions = [
            PaymentDistribution(
                user_id=dist["user_id"],
                percentage=dist["percentage"],
                amount=dist["amount"]
            )
            for dist in existing_distributions.get("distributions", [])
        ]
        
        # Check if all payments are completed
        all_payments_completed = await check_all_payments_completed(str(document["_id"]), db)
        if all_payments_completed:
            payment_status = "completed"
            can_finalize = True
    
    return PaymentCalculationResponse(
        document_id=str(document["_id"]),
        document_code=document.get("document_code", ""),
        document_name=document.get("name", ""),
        start_date=start_date,
        end_date=end_date,
        duration_days=duration_days,
        total_amount=total_amount,
        payment_status=payment_status,
        payment_distributions=payment_distributions,
        can_finalize=can_finalize
    )

@payments_router.post("/document/{document_id}/setup-distribution")
async def setup_payment_distribution(
    document_id: str,
    payment_setup: DocumentPaymentSetup,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Setup payment distribution for a document (primary user only)"""
    print(f"=== Setup Payment Distribution ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Try to find document by ObjectId first, then by document_code
    document = None
    
    # Check if document_id is a valid ObjectId
    try:
        if ObjectId.is_valid(document_id):
            print(f"Searching by ObjectId: {document_id}")
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
            if document:
                print(f"Found document by ObjectId: {document.get('_id')}")
        else:
            print(f"Not a valid ObjectId, searching by document_code: {document_id}")
    except Exception as e:
        print(f"Error checking ObjectId validity: {e}")
        pass
    
    # If not found by ObjectId, try to find by document_code
    if not document:
        print(f"Searching by document_code: {document_id}")
        document = await db.documents.find_one({"document_code": document_id})
        if document:
            print(f"Found document by document_code: {document.get('document_code')}")
    
    if not document:
        print(f"Document not found with ID/code: {document_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    print(f"Found document: {document.get('_id')} with code: {document.get('document_code')}")
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can setup payment distribution"
        )
    
    # Validate total percentage equals 100%
    total_percentage = sum(dist.percentage for dist in payment_setup.payment_distributions)
    if abs(total_percentage - 100.0) > 0.01:  # Allow small floating point differences
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Total percentage must equal 100%, got {total_percentage}%"
        )
    
    # Validate all users are involved in the document
    involved_users = set(document["involved_users"])
    distribution_users = set(dist.user_id for dist in payment_setup.payment_distributions)
    
    if not distribution_users.issubset(involved_users):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="All users in payment distribution must be involved in the document"
        )
    
    # Save payment distribution
    distribution_data = {
        "document_id": str(document["_id"]),
        "document_code": document.get("document_code", ""),
        "total_amount": payment_setup.total_amount,
        "duration_days": payment_setup.duration_days,
        "distributions": [
            {
                "user_id": dist.user_id,
                "percentage": dist.percentage,
                "amount": dist.amount
            }
            for dist in payment_setup.payment_distributions
        ],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    # Upsert payment distribution
    await db.payment_distributions.update_one(
        {"document_id": str(document["_id"])},
        {"$set": distribution_data},
        upsert=True
    )
    
    print(f"Payment distribution setup successfully for document {document_id}")
    return {"message": "Payment distribution setup successfully"}

@payments_router.get("/document/{document_id}/payment-status")
async def get_document_payment_status(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Get payment status for a document"""
    print(f"=== Get Document Payment Status ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Try to find document by ObjectId first, then by document_code
    document = None
    
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception:
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is involved in the document
    if current_user["user_id"] not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get payment distribution
    payment_distribution = await db.payment_distributions.find_one({"document_id": str(document["_id"])})
    
    if not payment_distribution:
        return {
            "payment_status": "not_setup",
            "message": "Payment distribution not setup yet"
        }
    
    # Get individual payment statuses
    payment_statuses = []
    total_paid = 0
    
    for dist in payment_distribution["distributions"]:
        user_payment = await db.payments.find_one({
            "document_id": str(document["_id"]),
            "user_id": dist["user_id"]
        })
        
        if user_payment and user_payment["status"] == PaymentStatus.COMPLETED:
            payment_statuses.append({
                "user_id": dist["user_id"],
                "percentage": dist["percentage"],
                "amount": dist["amount"],
                "status": "completed",
                "paid_amount": user_payment["amount"]
            })
            total_paid += user_payment["amount"]
        else:
            payment_statuses.append({
                "user_id": dist["user_id"],
                "percentage": dist["percentage"],
                "amount": dist["amount"],
                "status": "pending",
                "paid_amount": 0
            })
    
    total_amount = payment_distribution["total_amount"]
    payment_completed = total_paid >= total_amount
    
    return {
        "payment_status": "completed" if payment_completed else "pending",
        "total_amount": total_amount,
        "total_paid": total_paid,
        "remaining_amount": total_amount - total_paid,
        "can_finalize": payment_completed,
        "payment_distributions": payment_statuses
    }

@payments_router.post("/document/{document_id}/pay")
async def make_document_payment(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Make payment for a document based on assigned distribution"""
    print(f"=== Make Document Payment ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Try to find document by ObjectId first, then by document_code
    document = None
    
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception:
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is involved in the document
    if current_user["user_id"] not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get payment distribution
    payment_distribution = await db.payment_distributions.find_one({"document_id": str(document["_id"])})
    
    if not payment_distribution:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment distribution not setup for this document"
        )
    
    # Find user's payment distribution
    user_distribution = None
    for dist in payment_distribution["distributions"]:
        if dist["user_id"] == current_user["user_id"]:
            user_distribution = dist
            break
    
    if not user_distribution:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No payment distribution found for this user"
        )
    
    # Check if payment already exists
    existing_payment = await db.payments.find_one({
        "document_id": str(document["_id"]),
        "user_id": current_user["user_id"]
    })
    
    if existing_payment and existing_payment["status"] == PaymentStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment already completed for this user"
        )
    
    # Check wallet balance
    wallet = await db.wallets.find_one({"user_id": current_user["user_id"]})
    if not wallet or wallet["balance"] < user_distribution["amount"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient wallet balance. Required: ₹{user_distribution['amount']:.2f}, Available: ₹{wallet['balance'] if wallet else 0:.2f}"
        )
    
    # Create or update payment record
    payment_data = {
        "user_id": current_user["user_id"],
        "document_id": str(document["_id"]),
        "amount": user_distribution["amount"],
        "duration_days": payment_distribution["duration_days"],
        "split_percentage": user_distribution["percentage"],
        "status": PaymentStatus.COMPLETED,
        "transaction_id": str(uuid.uuid4()),
        "updated_at": datetime.now(timezone.utc)
    }
    
    if existing_payment:
        # Update existing payment
        await db.payments.update_one(
            {"_id": existing_payment["_id"]},
            {"$set": payment_data}
        )
        payment_id = str(existing_payment["_id"])
    else:
        # Create new payment
        payment_data["created_at"] = datetime.now(timezone.utc)
        result = await db.payments.insert_one(payment_data)
        payment_id = str(result.inserted_id)
    
    # Deduct from wallet
    await db.wallets.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"balance": -user_distribution["amount"]},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Add transaction history
    await db.transactions.insert_one({
        "user_id": current_user["user_id"],
        "type": "payment",
        "amount": -user_distribution["amount"],
        "description": f"Payment for document {document.get('document_code', document_id)} - {user_distribution['percentage']}%",
        "payment_id": payment_id,
        "created_at": datetime.now(timezone.utc)
    })
    
    print(f"Payment completed successfully for user {current_user['user_id']}: ₹{user_distribution['amount']:.2f}")
    
    return {
        "message": "Payment completed successfully",
        "payment_id": payment_id,
        "amount": user_distribution["amount"],
        "percentage": user_distribution["percentage"],
        "transaction_id": payment_data["transaction_id"]
    }

async def check_all_payments_completed(document_id: str, db) -> bool:
    """Check if all payments for a document are completed"""
    payment_distribution = await db.payment_distributions.find_one({"document_id": document_id})
    if not payment_distribution:
        return False
    
    total_amount = payment_distribution["total_amount"]
    total_paid = 0
    
    for dist in payment_distribution["distributions"]:
        user_payment = await db.payments.find_one({
            "document_id": document_id,
            "user_id": dist["user_id"],
            "status": PaymentStatus.COMPLETED
        })
        
        if user_payment:
            total_paid += user_payment["amount"]
    
    return total_paid >= total_amount

@payments_router.get("/document/{document_id}/payments", response_model=List[PaymentResponse])
async def get_document_payments(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Get all payments for a specific document
    """
    print(f"=== Get Document Payments ===")
    print(f"Document ID: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    
    try:
        # Verify document exists and user is involved
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        if not document:
            # Try searching by document_code if ObjectId fails
            document = await db.documents.find_one({"document_code": document_id})
        
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
        
        # Get all payments for this document
        cursor = db.payments.find({"document_id": str(document["_id"])})
        payments = await cursor.to_list(length=None)
        
        print(f"Found {len(payments)} payments for document {document_id}")
        
        # Transform payments to response format
        payment_responses = []
        for payment in payments:
            payment_response = PaymentResponse(
                _id=str(payment["_id"]),
                document_id=payment["document_id"],
                user_id=payment["user_id"],
                amount=payment["amount"],
                status=payment["status"],
                payment_method=payment.get("payment_method", "wallet"),
                created_at=payment["created_at"],
                document_name=document.get("name", "Unknown Document")
            )
            payment_responses.append(payment_response)
        
        return payment_responses
        
    except Exception as e:
        print(f"Error fetching document payments: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch document payments"
        )
