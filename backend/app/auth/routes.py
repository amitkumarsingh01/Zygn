from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from datetime import timedelta
from app.auth.models import UserRegistration, UserLogin, UserInDB, Token
from app.auth.utils import get_password_hash, verify_password, create_access_token, verify_otp
from app.database import get_database
from app.config import settings
from app.utils.file_handler import save_uploaded_file
import os

auth_router = APIRouter()

@auth_router.post("/register", response_model=dict)
async def register_user(
    name: str = Form(..., description="User's full name"),
    email: str = Form(..., description="User's email address"),
    phone_no: str = Form(..., description="User's phone number"),
    city: str = Form(..., description="User's city"),
    state: str = Form(..., description="User's state"),
    govt_id_type: str = Form(..., description="Type of government ID (Aadhar, PAN, Passport, etc.)"),
    govt_id_number: str = Form(..., description="Government ID number"),
    govt_id_image: UploadFile = File(..., description="Government ID image file"),
    db=Depends(get_database)
):
    """
    Register a new user with government ID image upload.
    
    This endpoint accepts multipart/form-data with the following fields:
    - name: User's full name
    - email: User's email address
    - phone_no: User's phone number
    - city: User's city
    - state: User's state
    - govt_id_type: Type of government ID
    - govt_id_number: Government ID number
    - govt_id_image: Government ID image file (required)
    """
    # Check if user already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": email},
            {"phone_no": phone_no}
        ]
    })
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or phone number already exists"
        )
    
    # Check if govt_id_number already exists
    existing_govt_id = await db.users.find_one({"govt_id_number": govt_id_number})
    if existing_govt_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this government ID number already exists"
        )
    
    # Save government ID image
    govt_id_filename = None
    if govt_id_image:
        try:
            govt_id_filename = await save_uploaded_file(govt_id_image, "govt_id_images")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to upload government ID image: {str(e)}"
            )
    
    # Create new user with default password "12345678"
    default_password = "12345678"
    user_in_db = UserInDB(
        name=name,
        email=email,
        phone_no=phone_no,
        password_hash=get_password_hash(default_password),
        city=city,
        state=state,
        govt_id_type=govt_id_type,
        govt_id_number=govt_id_number,
        govt_id_image=govt_id_filename
    )
    
    try:
        result = await db.users.insert_one(user_in_db.dict())
        print(f"Insert result: {result}")
        print(f"Inserted ID: {result.inserted_id}")
        
        return {
            "message": "User registered successfully with default password: 12345678. Please login with OTP.",
            "user_id": user_in_db.user_id,
            "char_id": user_in_db.char_id,
            "redirect_to_login": True
        }
    except Exception as e:
        print(f"Database error: {e}")
        # If database insertion fails, delete the uploaded file
        if govt_id_filename:
            try:
                from app.utils.file_handler import delete_file
                await delete_file(os.path.join(settings.upload_dir, "govt_id_images", govt_id_filename))
            except:
                pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error: {str(e)}"
        )

@auth_router.post("/login", response_model=Token)
async def login_user(login_data: UserLogin, db=Depends(get_database)):
    # Verify OTP
    if not verify_otp(login_data.otp):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid OTP"
        )
    
    # Find user by phone number
    user = await db.users.find_one({"phone_no": login_data.phone_no})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={"sub": user["user_id"]}, 
        expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["user_id"],
        "char_id": user["char_id"]
    }