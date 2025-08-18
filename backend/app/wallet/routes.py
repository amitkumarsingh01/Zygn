from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from app.wallet.models import WalletResponse, TransactionResponse, WalletInDB, AddFundsRequest, TransactionType
from app.auth.utils import verify_token
from app.database import get_database
from app.utils.file_handler import save_uploaded_file
from bson import ObjectId
from datetime import datetime, timezone

wallet_router = APIRouter()
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

@wallet_router.get("/balance", response_model=WalletResponse)
async def get_wallet_balance(current_user=Depends(get_current_user), db=Depends(get_database)):
    # Find or create wallet
    wallet = await db.wallets.find_one({"user_id": current_user["user_id"]})
    if not wallet:
        # Create new wallet
        new_wallet = WalletInDB(user_id=current_user["user_id"])
        result = await db.wallets.insert_one(new_wallet.dict())
        wallet = await db.wallets.find_one({"_id": result.inserted_id})
    
    # Convert MongoDB ObjectId to string for response
    wallet_data = {
        "_id": str(wallet["_id"]),
        "user_id": wallet["user_id"],
        "balance": wallet["balance"],
        "created_at": wallet["created_at"],
        "updated_at": wallet["updated_at"]
    }
    return WalletResponse(**wallet_data)

@wallet_router.post("/add-funds")
async def add_funds(
    amount: float = Form(...),
    payment_receipt: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Handle file upload if provided
    payment_receipt_path = None
    if payment_receipt:
        filename = await save_uploaded_file(payment_receipt, "payment_receipts")
        payment_receipt_path = f"/uploads/payment_receipts/{filename}"
    
    # Find or create wallet
    wallet = await db.wallets.find_one({"user_id": current_user["user_id"]})
    if not wallet:
        new_wallet = WalletInDB(user_id=current_user["user_id"], balance=amount)
        await db.wallets.insert_one(new_wallet.dict())
    else:
        # Update wallet balance
        await db.wallets.update_one(
            {"user_id": current_user["user_id"]},
            {
                "$inc": {"balance": amount},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
    
    # Add transaction record
    await db.transactions.insert_one({
        "user_id": current_user["user_id"],
        "type": TransactionType.CREDIT,
        "amount": amount,
        "description": "Funds added to wallet",
        "payment_receipt": payment_receipt_path,
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Funds added successfully", "amount": amount}

@wallet_router.get("/transactions", response_model=List[TransactionResponse])
async def get_transaction_history(current_user=Depends(get_current_user), db=Depends(get_database)):
    try:
        transactions = await db.transactions.find(
            {"user_id": current_user["user_id"]}
        ).sort("created_at", -1).to_list(None)
        
        print(f"Found {len(transactions)} transactions for user {current_user['user_id']}")
        
        result = []
        for txn in transactions:
            try:
                # Ensure all required fields are present with defaults
                transaction_type = txn.get("type", "credit")
                
                # Validate transaction type
                if transaction_type not in ["credit", "debit", "payment", "refund"]:
                    print(f"Invalid transaction type: {transaction_type}, defaulting to 'credit'")
                    transaction_type = "credit"
                
                # Validate created_at field
                created_at = txn.get("created_at")
                if not created_at or not isinstance(created_at, datetime):
                    print(f"Invalid created_at field: {created_at}, using current time")
                    created_at = datetime.now(timezone.utc)
                
                # Validate amount field
                amount = txn.get("amount", 0.0)
                try:
                    amount = float(amount)
                except (ValueError, TypeError):
                    print(f"Invalid amount field: {amount}, defaulting to 0.0")
                    amount = 0.0
                
                # Validate user_id field
                user_id = txn.get("user_id", "")
                if not user_id or not isinstance(user_id, str):
                    print(f"Invalid user_id field: {user_id}, using current user")
                    user_id = current_user["user_id"]
                
                txn_data = {
                    "_id": str(txn["_id"]),
                    "user_id": user_id,
                    "type": transaction_type,
                    "amount": amount,
                    "description": txn.get("description", ""),
                    "payment_id": txn.get("payment_id"),
                    "payment_receipt": txn.get("payment_receipt"),
                    "created_at": created_at
                }
                
                result.append(TransactionResponse(**txn_data))
                print(f"Successfully processed transaction: {txn.get('_id')}")
            except Exception as e:
                print(f"Error processing transaction {txn.get('_id', 'unknown')}: {e}")
                print(f"Transaction data: {txn}")
                continue
        
        print(f"Returning {len(result)} processed transactions")
        return result
    except Exception as e:
        print(f"Error in get_transaction_history: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching transactions: {str(e)}"
        )