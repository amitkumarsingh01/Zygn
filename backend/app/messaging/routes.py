from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from app.messaging.models import MessageCreate, MessageResponse, MessageInDB
from app.auth.utils import verify_token
from app.database import get_database
from app.websocket.manager import connection_manager
from app.utils.file_handler import save_uploaded_file
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
    receiver_id: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None),
    payload: Optional[MessageCreate] = Body(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Send Message Request ===")
    # Support both form-data and raw JSON body
    if payload:
        if not receiver_id:
            receiver_id = payload.receiver_id
        if not content:
            content = payload.content

    print(f"Receiver ID/Char ID: {receiver_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Validate required fields after merging sources
    if not receiver_id or not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="receiver_id and content are required"
        )
    
    # Try to find receiver by user_id first, then by char_id (no length assumptions)
    receiver = None
    print(f"Searching receiver by user_id: {receiver_id}")
    receiver = await db.users.find_one({"user_id": receiver_id})
    if receiver:
        print(f"Found receiver by user_id: {receiver.get('user_id')}")
    if not receiver:
        print(f"Receiver not found by user_id, searching by char_id: {receiver_id}")
        receiver = await db.users.find_one({"char_id": receiver_id})
        if receiver:
            print(f"Found receiver by char_id: {receiver.get('char_id')}")
    
    if not receiver:
        print(f"Receiver not found with ID/char_id: {receiver_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiver not found"
        )
    
    print(f"Found receiver: {receiver.get('user_id')} with char_id: {receiver.get('char_id')}")
    
    # Handle file upload if provided
    attachment_path = None
    if attachment:
        filename = await save_uploaded_file(attachment, "message_attachments")
        attachment_path = f"/uploads/message_attachments/{filename}"
    
    # Create message - use the actual user_id from the found receiver
    actual_receiver_id = receiver["user_id"]
    print(f"Creating message with receiver_id: {actual_receiver_id}")
    
    message = MessageInDB(
        sender_id=current_user["user_id"],
        receiver_id=actual_receiver_id,
        content=content,
        attachment=attachment_path
    )
    
    result = await db.messages.insert_one(message.dict())
    
    # Send real-time notification via WebSocket
    await connection_manager.send_personal_message(
        {
            "type": "new_message",
            "message_id": str(result.inserted_id),
            "sender_id": current_user["user_id"],
            "sender_name": current_user["name"],
            "content": content,
            "attachment": attachment_path,
            "created_at": message.created_at.isoformat()
        },
        actual_receiver_id
    )
    
    return {
        "message": "Message sent successfully",
        "message_id": str(result.inserted_id)
    }

@messaging_router.get("/conversations/{user_id}")
async def get_conversation(
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Get Conversation Request ===")
    print(f"User ID/Char ID: {user_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Try to find user by user_id first, then by char_id (no length assumptions)
    target_user = None
    print(f"Searching user by user_id: {user_id}")
    target_user = await db.users.find_one({"user_id": user_id})
    if target_user:
        print(f"Found user by user_id: {target_user.get('user_id')}")
    if not target_user:
        print(f"User not found by user_id, searching by char_id: {user_id}")
        target_user = await db.users.find_one({"char_id": user_id})
        if target_user:
            print(f"Found user by char_id: {target_user.get('char_id')}")
    
    if not target_user:
        print(f"User not found with ID/char_id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    actual_user_id = target_user["user_id"]
    print(f"Found user: {actual_user_id} with char_id: {target_user.get('char_id')}")
    
    # Get conversation between current user and specified user
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["user_id"], "receiver_id": actual_user_id},
            {"sender_id": actual_user_id, "receiver_id": current_user["user_id"]}
        ]
    }).sort("created_at", 1).to_list(None)
    
    # Mark messages as read
    await db.messages.update_many(
        {"sender_id": actual_user_id, "receiver_id": current_user["user_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    response_messages = []
    for msg in messages:
        try:
            response_messages.append({
                "_id": str(msg.get("_id")),
                "sender_id": msg.get("sender_id", ""),
                "receiver_id": msg.get("receiver_id", ""),
                "content": msg.get("content", ""),
                "attachment": msg.get("attachment"),
                "created_at": (msg.get("created_at") or datetime.now(timezone.utc)),
                "is_read": bool(msg.get("is_read", False))
            })
        except Exception as e:
            print(f"Error serializing message {msg.get('_id', 'unknown')}: {e}")
            continue

    print(f"Returning {len(response_messages)} messages")
    return response_messages

@messaging_router.get("/unread-count")
async def get_unread_count(current_user=Depends(get_current_user), db=Depends(get_database)):
    count = await db.messages.count_documents({
        "receiver_id": current_user["user_id"],
        "is_read": False
    })
    
    return {"unread_count": count}