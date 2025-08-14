from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import uuid
from datetime import datetime, timezone
from app.users.models import UserProfile, UserProfileResponse
from app.auth.utils import verify_token
from app.database import get_database
from app.config import settings
from app.utils.file_handler import save_uploaded_file
from bson import ObjectId

users_router = APIRouter()
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

@users_router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(current_user=Depends(get_current_user)):
    # Ensure all required fields are present
    user_data = {
        "_id": current_user["user_id"],  # Use user_id as the id
        "name": current_user["name"],
        "email": current_user["email"],
        "phone_no": current_user["phone_no"],
        "profile_pic": current_user.get("profile_pic"),
        "signature_pic": current_user.get("signature_pic"),
        "eye_pic": current_user.get("eye_pic"),
        "fingerprint": current_user.get("fingerprint"),
        "char_id": current_user["char_id"],
        "city": current_user["city"],
        "state": current_user["state"],
        "status": current_user.get("status", "active"),
        "is_active": current_user.get("is_active", True),
        "created_at": current_user["created_at"],
        "updated_at": current_user["updated_at"]
    }
    return UserProfileResponse(**user_data)

@users_router.put("/profile")
async def update_user_profile(
    name: str = Form(...),
    email: str = Form(...),
    mpin: Optional[str] = Form(None),
    govtid_type: Optional[str] = Form(None),
    govtid_number: Optional[str] = Form(None),
    profile_pic: Optional[UploadFile] = File(None),
    signature_pic: Optional[UploadFile] = File(None),
    eye_pic: Optional[UploadFile] = File(None),
    fingerprint: Optional[UploadFile] = File(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    update_data = {
        "name": name,
        "email": email,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if mpin:
        update_data["mpin"] = mpin
    if govtid_type:
        update_data["govtid_type"] = govtid_type
    if govtid_number:
        update_data["govtid_number"] = govtid_number
    
    # Handle file uploads
    if profile_pic:
        filename = await save_uploaded_file(profile_pic, "profile_pics")
        update_data["profile_pic"] = f"/uploads/profile_pics/{filename}"
    
    if signature_pic:
        filename = await save_uploaded_file(signature_pic, "signatures")
        update_data["signature_pic"] = f"/uploads/signatures/{filename}"
    
    if eye_pic:
        filename = await save_uploaded_file(eye_pic, "eye_scans")
        update_data["eye_pic"] = f"/uploads/eye_scans/{filename}"
    
    if fingerprint:
        filename = await save_uploaded_file(fingerprint, "fingerprints")
        update_data["fingerprint"] = f"/uploads/fingerprints/{filename}"
    
    # Update user in database
    result = await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update profile"
        )
    
    return {"message": "Profile updated successfully"}

@users_router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user_by_id(user_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Ensure all required fields are present
    user_data = {
        "_id": user["user_id"],  # Use user_id as the id
        "name": user["name"],
        "email": user["email"],
        "phone_no": user["phone_no"],
        "profile_pic": user.get("profile_pic"),
        "signature_pic": user.get("signature_pic"),
        "eye_pic": user.get("eye_pic"),
        "fingerprint": user.get("fingerprint"),
        "char_id": user["char_id"],
        "city": user["city"],
        "state": user["state"],
        "status": user.get("status", "active"),
        "is_active": user.get("is_active", True),
        "created_at": user["created_at"],
        "updated_at": user["updated_at"]
    }
    return UserProfileResponse(**user_data)