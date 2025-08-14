from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from app.wallet.models import WalletResponse, TransactionResponse, WalletInDB, AddFundsRequest, TransactionType
from app.auth.utils import verify_token
from app.database import get_database
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
    funds_request: AddFundsRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Find or create wallet
    wallet = await db.wallets.find_one({"user_id": current_user["user_id"]})
    if not wallet:
        new_wallet = WalletInDB(user_id=current_user["user_id"], balance=funds_request.amount)
        await db.wallets.insert_one(new_wallet.dict())
    else:
        # Update wallet balance
        await db.wallets.update_one(
            {"user_id": current_user["user_id"]},
            {
                "$inc": {"balance": funds_request.amount},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
    
    # Add transaction record
    await db.transactions.insert_one({
        "user_id": current_user["user_id"],
        "type": TransactionType.CREDIT,
        "amount": funds_request.amount,
        "description": "Funds added to wallet",
        "created_at": datetime.now(timezone.utc)
    })
    
    return {"message": "Funds added successfully", "amount": funds_request.amount}

@wallet_router.get("/transactions", response_model=List[TransactionResponse])
async def get_transaction_history(current_user=Depends(get_current_user), db=Depends(get_database)):
    transactions = await db.transactions.find(
        {"user_id": current_user["user_id"]}
    ).sort("created_at", -1).to_list(None)
    
    return [TransactionResponse(**txn, id=str(txn["_id"])) for txn in transactions]