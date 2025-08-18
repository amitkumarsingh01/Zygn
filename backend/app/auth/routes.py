from fastapi import APIRouter, HTTPException, status, Depends
from datetime import timedelta
from app.auth.models import UserRegistration, UserLogin, UserInDB, Token
from app.auth.utils import get_password_hash, verify_password, create_access_token, verify_otp
from app.database import get_database
from app.config import settings

auth_router = APIRouter()

@auth_router.post("/register", response_model=dict)
async def register_user(user_data: UserRegistration, db=Depends(get_database)):
    # Check if user already exists
    existing_user = await db.users.find_one({
        "$or": [
            {"email": user_data.email},
            {"phone_no": user_data.phone_no}
        ]
    })
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email or phone number already exists"
        )
    
    # Check if govt_id_number already exists
    existing_govt_id = await db.users.find_one({"govt_id_number": user_data.govt_id_number})
    if existing_govt_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this government ID number already exists"
        )
    
    # Create new user with default password "12345678"
    default_password = "12345678"
    user_in_db = UserInDB(
        name=user_data.name,
        email=user_data.email,
        phone_no=user_data.phone_no,
        password_hash=get_password_hash(default_password),
        city=user_data.city,
        state=user_data.state,
        govt_id_type=user_data.govt_id_type,
        govt_id_number=user_data.govt_id_number
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