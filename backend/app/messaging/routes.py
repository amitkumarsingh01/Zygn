from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List
from app.messaging.models import MessageCreate, MessageResponse, MessageInDB
from app.auth.utils import verify_token
from app.database import get_database
from app.websocket.manager import connection_manager
from bson import ObjectId
from datetime import datetime, timezone

messaging_router = APIRouter()
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

@messaging_router.post("/send", response_model=dict)
async def send_message(
    message_data: MessageCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Verify receiver exists
    receiver = await db.users.find_one({"user_id": message_data.receiver_id})
    if not receiver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiver not found"
        )
    
    # Create message
    message = MessageInDB(
        sender_id=current_user["user_id"],
        receiver_id=message_data.receiver_id,
        content=message_data.content
    )
    
    result = await db.messages.insert_one(message.dict())
    
    # Send real-time notification via WebSocket
    await connection_manager.send_personal_message(
        {
            "type": "new_message",
            "message_id": str(result.inserted_id),
            "sender_id": current_user["user_id"],
            "sender_name": current_user["name"],
            "content": message_data.content,
            "created_at": message.created_at.isoformat()
        },
        message_data.receiver_id
    )
    
    return {
        "message": "Message sent successfully",
        "message_id": str(result.inserted_id)
    }

@messaging_router.get("/conversations/{user_id}", response_model=List[MessageResponse])
async def get_conversation(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Get conversation between current user and specified user
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["user_id"], "receiver_id": user_id},
            {"sender_id": user_id, "receiver_id": current_user["user_id"]}
        ]
    }).sort("created_at", 1).to_list(None)
    
    # Mark messages as read
    await db.messages.update_many(
        {"sender_id": user_id, "receiver_id": current_user["user_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return [MessageResponse(**msg, id=str(msg["_id"])) for msg in messages]

@messaging_router.get("/unread-count")
async def get_unread_count(current_user=Depends(get_current_user), db=Depends(get_database)):
    count = await db.messages.count_documents({
        "receiver_id": current_user["user_id"],
        "is_read": False
    })
    
    return {"unread_count": count}