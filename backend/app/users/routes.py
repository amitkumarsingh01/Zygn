from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import os
import uuid
from datetime import datetime, timezone
from app.users.models import UserProfile, UserProfileResponse, UserListResponse
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
    print(f"=== Get Profile Request ===")
    print(f"Current user: {current_user['user_id']}")
    print(f"User data from DB:")
    print(f"  name: {current_user.get('name')}")
    print(f"  email: {current_user.get('email')}")
    print(f"  phone_no: {current_user.get('phone_no')}")
    print(f"  city: {current_user.get('city')}")
    print(f"  state: {current_user.get('state')}")
    print(f"  govt_id_type: {current_user.get('govt_id_type')}")
    print(f"  govt_id_number: {current_user.get('govt_id_number')}")
    
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
        "govt_id_type": current_user.get("govt_id_type"),
        "govt_id_number": current_user.get("govt_id_number"),
        "status": current_user.get("status", "active"),
        "is_active": current_user.get("is_active", True),
        "created_at": current_user["created_at"],
        "updated_at": current_user["updated_at"]
    }
    
    print(f"=== Response Data ===")
    print(f"Response user_data: {user_data}")
    
    return UserProfileResponse(**user_data)

@users_router.put("/profile")
async def update_user_profile(
    name: str = Form(...),
    email: str = Form(...),
    phone_no: Optional[str] = Form(None),
    city: Optional[str] = Form(None),
    state: Optional[str] = Form(None),
    govt_id_type: Optional[str] = Form(None),
    govt_id_number: Optional[str] = Form(None),
    profile_pic: UploadFile = File(None),
    signature_pic: UploadFile = File(None),
    eye_pic: UploadFile = File(None),
    fingerprint: UploadFile = File(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Update Profile Request ===")
    print(f"Current user: {current_user['user_id']}")
    print(f"Received fields:")
    print(f"  name: {name}")
    print(f"  email: {email}")
    print(f"  phone_no: {phone_no}")
    print(f"  city: {city}")
    print(f"  state: {state}")
    print(f"  govt_id_type: {govt_id_type}")
    print(f"  govt_id_number: {govt_id_number}")
    
    update_data = {
        "name": name,
        "email": email,
        "updated_at": datetime.now(timezone.utc)
    }
    
    if phone_no:
        update_data["phone_no"] = phone_no
        print(f"Adding phone_no: {phone_no}")
    if city:
        update_data["city"] = city
        print(f"Adding city: {city}")
    if state:
        update_data["state"] = state
        print(f"Adding state: {state}")
    if govt_id_type:
        update_data["govt_id_type"] = govt_id_type
        print(f"Adding govt_id_type: {govt_id_type}")
    if govt_id_number:
        update_data["govt_id_number"] = govt_id_number
        print(f"Adding govt_id_number: {govt_id_number}")
    
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
    
    print(f"=== Database Update ===")
    print(f"Update query: {{'user_id': '{current_user['user_id']}'}}")
    print(f"Update data: {update_data}")
    
    # Update user in database
    result = await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": update_data}
    )
    
    print(f"Update result: {result.modified_count} documents modified")
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update profile"
        )
    
    print("Profile updated successfully")
    return {"message": "Profile updated successfully"}

@users_router.get("/all", response_model=list[UserListResponse])
async def get_all_users(
    current_user=Depends(get_current_user), 
    db=Depends(get_database),
    limit: Optional[int] = 100,
    skip: Optional[int] = 0,
    status: Optional[str] = None
):
    """
    Get all registered users (basic information only)
    
    Parameters:
    - limit: Maximum number of users to return (default: 100, max: 1000)
    - skip: Number of users to skip for pagination (default: 0)
    - status: Filter by user status (e.g., 'active', 'pending', 'suspended')
    """
    print(f"=== Get All Users Request ===")
    print(f"Current user: {current_user['user_id']}")
    print(f"Limit: {limit}, Skip: {skip}, Status filter: {status}")
    
    # Validate parameters
    if limit and (limit < 1 or limit > 1000):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 1000"
        )
    
    if skip and skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skip must be non-negative"
        )
    
    try:
        # Build query filter
        query_filter = {"is_active": True}
        if status:
            query_filter["status"] = status
        
        # Find users with pagination and filtering
        cursor = db.users.find(
            query_filter,
            {
                "user_id": 1,
                "char_id": 1,
                "name": 1,
                "email": 1,
                "phone_no": 1,
                "city": 1,
                "state": 1,
                "status": 1,
                "is_active": 1,
                "created_at": 1,
                "_id": 0  # Exclude MongoDB _id
            }
        ).sort("created_at", -1)  # Sort by creation date, newest first
        
        # Apply pagination
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
        
        users = await cursor.to_list(length=None)
        
        print(f"Found {len(users)} users (filter: {query_filter})")
        
        # Transform the data to match the response model
        user_list = []
        for user in users:
            user_data = {
                "user_id": user["user_id"],
                "char_id": user["char_id"],
                "name": user["name"],
                "email": user["email"],
                "phone_no": user["phone_no"],
                "city": user["city"],
                "state": user["state"],
                "status": user.get("status", "active"),
                "is_active": user.get("is_active", True),
                "created_at": user["created_at"]
            }
            user_list.append(user_data)
        
        return user_list
        
    except Exception as e:
        print(f"Error fetching all users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch users"
        )

@users_router.get("/count")
async def get_users_count(
    current_user=Depends(get_current_user), 
    db=Depends(get_database),
    status: Optional[str] = None
):
    """
    Get total count of users (for pagination)
    
    Parameters:
    - status: Filter by user status (e.g., 'active', 'pending', 'suspended')
    """
    print(f"=== Get Users Count Request ===")
    print(f"Current user: {current_user['user_id']}")
    print(f"Status filter: {status}")
    
    try:
        # Build query filter
        query_filter = {"is_active": True}
        if status:
            query_filter["status"] = status
        
        # Count users
        count = await db.users.count_documents(query_filter)
        
        print(f"Total users count: {count} (filter: {query_filter})")
        
        return {
            "total_users": count,
            "filter": query_filter
        }
        
    except Exception as e:
        print(f"Error counting users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to count users"
        )

@users_router.get("/search", response_model=list[UserListResponse])
async def search_users(
    current_user=Depends(get_current_user), 
    db=Depends(get_database),
    q: str = None,
    limit: Optional[int] = 50,
    skip: Optional[int] = 0
):
    """
    Search users by name, email, or char_id
    
    Parameters:
    - q: Search query (name, email, or char_id)
    - limit: Maximum number of users to return (default: 50, max: 100)
    - skip: Number of users to skip for pagination (default: 0)
    """
    print(f"=== Search Users Request ===")
    print(f"Current user: {current_user['user_id']}")
    print(f"Search query: {q}, Limit: {limit}, Skip: {skip}")
    
    if not q or not q.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query is required"
        )
    
    # Validate parameters
    if limit and (limit < 1 or limit > 100):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Limit must be between 1 and 100"
        )
    
    if skip and skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Skip must be non-negative"
        )
    
    try:
        # Clean search query
        search_query = q.strip()
        
        # Build search filter using regex for partial matching
        search_filter = {
            "is_active": True,
            "$or": [
                {"name": {"$regex": search_query, "$options": "i"}},  # Case-insensitive name search
                {"email": {"$regex": search_query, "$options": "i"}},  # Case-insensitive email search
                {"char_id": {"$regex": f"^{search_query}$", "$options": "i"}},  # Exact char_id match
                {"user_id": {"$regex": f"^{search_query}$", "$options": "i"}}   # Exact user_id match
            ]
        }
        
        # Find users with search filter
        cursor = db.users.find(
            search_filter,
            {
                "user_id": 1,
                "char_id": 1,
                "name": 1,
                "email": 1,
                "phone_no": 1,
                "city": 1,
                "state": 1,
                "status": 1,
                "is_active": 1,
                "created_at": 1,
                "_id": 0  # Exclude MongoDB _id
            }
        ).sort("created_at", -1)  # Sort by creation date, newest first
        
        # Apply pagination
        if skip:
            cursor = cursor.skip(skip)
        if limit:
            cursor = cursor.limit(limit)
        
        users = await cursor.to_list(length=None)
        
        print(f"Found {len(users)} users matching search query: {search_query}")
        
        # Transform the data to match the response model
        user_list = []
        for user in users:
            user_data = {
                "user_id": user["user_id"],
                "char_id": user["char_id"],
                "name": user["name"],
                "email": user["email"],
                "phone_no": user["phone_no"],
                "city": user["city"],
                "state": user["state"],
                "status": user.get("status", "active"),
                "is_active": user.get("is_active", True),
                "created_at": user["created_at"]
            }
            user_list.append(user_data)
        
        return user_list
        
    except Exception as e:
        print(f"Error searching users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to search users"
        )

@users_router.get("/{user_id}", response_model=UserProfileResponse)
async def get_user_by_id(user_id: str, current_user=Depends(get_current_user), db=Depends(get_database)):
    """
    Get user by user_id or char_id
    Supports both 16-character user_id and 8-character char_id
    """
    print(f"=== Get User by ID Request ===")
    print(f"User ID/Char ID: {user_id}")
    print(f"Current user: {current_user['user_id']}")
    
    if not user_id or not user_id.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID or Char ID is required"
        )
    
    # Clean the input
    user_id = user_id.strip()
    
    # Try to find user by user_id first, then by char_id
    user = None
    
    # Check if user_id is a valid user_id (16-character hex string)
    try:
        if len(user_id) == 16 and all(c in '0123456789abcdefABCDEF' for c in user_id):
            print(f"Searching by user_id: {user_id}")
            user = await db.users.find_one({"user_id": user_id})
            if user:
                print(f"Found user by user_id: {user.get('user_id')}")
        else:
            print(f"Not a valid user_id, searching by char_id: {user_id}")
    except Exception as e:
        print(f"Error checking user_id validity: {e}")
        pass
    
    # If not found by user_id, try to find by char_id
    if not user:
        print(f"Searching by char_id: {user_id}")
        user = await db.users.find_one({"char_id": user_id})
        if user:
            print(f"Found user by char_id: {user.get('char_id')}")
    
    if not user:
        print(f"User not found with ID/char_id: {user_id}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User not found with ID or Char ID: {user_id}"
        )
    
    # Check if user is active
    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User account is deactivated"
        )
    
    print(f"Found user: {user.get('user_id')} with char_id: {user.get('char_id')}")
    
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
        "govt_id_type": user.get("govt_id_type"),
        "govt_id_number": user.get("govt_id_number"),
        "status": user.get("status", "active"),
        "is_active": user.get("is_active", True),
        "created_at": user["created_at"],
        "updated_at": user["updated_at"]
    }
    return UserProfileResponse(**user_data)

