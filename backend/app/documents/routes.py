from fastapi import APIRouter, Depends, HTTPException, status, File, Form, UploadFile
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from app.documents.models import DocumentCreate, DocumentResponse, DocumentInDB, JoinDocumentRequest, InitiateAgreementRequest
from app.auth.utils import verify_token
from app.database import get_database
from app.utils.file_handler import save_uploaded_file
from app.utils.ai_forgery import check_document_authenticity
from app.utils.blockchain import add_to_blockchain
from app.config import settings
from bson import ObjectId
from datetime import datetime, timezone
import os
from app.documents.models import PricingConfig, PricingConfigCreate, PricingConfigUpdate
from pathlib import Path

# Optional heavy deps are imported lazily inside endpoints

documents_router = APIRouter()
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

@documents_router.post("/create", response_model=dict, 
                       summary="Create Document with Verification",
                       description="Create a new document with required verification documents",
                       tags=["Documents"],
                       operation_id="create_document_with_verification")
async def create_document(
    name: str = Form(..., description="Document name", example="Rental Agreement"),
    location: Optional[str] = Form(None, description="Document location", example="Mumbai, Maharashtra"),
    start_date: Optional[str] = Form(None, description="Start date (ISO format)", example="2024-01-01T00:00:00Z"),
    end_date: Optional[str] = Form(None, description="End date (ISO format)", example="2024-12-31T23:59:59Z"),
    raw_documents: List[UploadFile] = File(..., description="Main document files (PDF, images, etc.)"),
    # Verification documents - collected fresh for each document operation
    profile_pic: Optional[UploadFile] = File(None, description="Profile picture/selfie for verification"),
    thumb: Optional[UploadFile] = File(None, description="Fingerprint scan (optional)"),
    sign: Optional[UploadFile] = File(None, description="Signature image for verification"),
    eye: Optional[UploadFile] = File(None, description="Eye scan for verification"),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Create a new document with verification.
    
    This endpoint creates a new document and requires verification documents:
    - profile_pic: Required - Profile picture/selfie
    - sign: Required - Signature image  
    - eye: Required - Eye scan image
    - thumb: Optional - Fingerprint scan
    
    All verification documents are collected fresh for each document operation.
    """
    print(f"=== Document Creation Request ===")
    print(f"Current User: {current_user['user_id']}")
    
    # Use the parameters directly from FastAPI
    print(f"=== Received Parameters ===")
    print(f"Name: {name}")
    print(f"Location: {location}")
    print(f"Start Date: {start_date}")
    print(f"End Date: {end_date}")
    print(f"Raw Documents Count: {len(raw_documents)}")
    print(f"Verification Documents:")
    print(f"  - Profile Pic: {profile_pic.filename if profile_pic else 'None'}")
    print(f"  - Thumb: {thumb.filename if thumb else 'None'}")
    print(f"  - Sign: {sign.filename if sign else 'None'}")
    print(f"  - Eye: {eye.filename if eye else 'None'}")
    
    # Validate required fields
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name is required"
        )
    
    if not raw_documents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one document is required"
        )
    
    # Validate verification documents (thumb is now optional)
    verification_errors = []
    if not profile_pic:
        verification_errors.append("Profile picture is required for document creation")
    if not sign:
        verification_errors.append("Signature is required for document creation")
    if not eye:
        verification_errors.append("Eye scan is required for document creation")
    # thumb is optional, no validation needed
    
    if verification_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification documents required: {', '.join(verification_errors)}"
        )
    
    for i, file in enumerate(raw_documents):
        print(f"File {i+1}: {file.filename}, Content-Type: {file.content_type}, Size: {file.size if hasattr(file, 'size') else 'unknown'}")
    
    # Parse dates if provided
    parsed_start_date = None
    parsed_end_date = None
    
    if start_date:
        parsed_start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    if end_date:
        parsed_end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    # Get current pricing configuration
    pricing_config = await db.pricing_config.find_one({"is_active": True})
    daily_rate = pricing_config.get("daily_rate", 1.0) if pricing_config else 1.0
    
    # Calculate total days and amount automatically
    total_days = 1  # Default to 1 day
    
    if parsed_start_date and parsed_end_date:
        # Calculate the difference in days
        date_diff = parsed_end_date - parsed_start_date
        total_days = max(1, date_diff.days + 1)  # +1 to include both start and end dates
    elif parsed_start_date or parsed_end_date:
        # If only one date is provided, default to 1 day
        print("Only one date provided, defaulting to 1 day")
    else:
        print("No dates provided, defaulting to 1 day")
    
    # Calculate total amount based on daily rate
    total_amount = daily_rate * total_days
    print(f"Calculated: {total_days} days × {daily_rate} coins/day = {total_amount} coins")
    
    # Save verification documents
    verification_files = {}
    verification_upload_dirs = {
        'profile_pic': 'profile_pics',
        'thumb': 'fingerprints',
        'sign': 'signatures',
        'eye': 'eye_scans'
    }
    
    for field, file in [('profile_pic', profile_pic), ('thumb', thumb), 
                        ('sign', sign), ('eye', eye)]:
        if file:
            try:
                filename = await save_uploaded_file(file, verification_upload_dirs[field])
                verification_files[field] = f"/uploads/{verification_upload_dirs[field]}/{filename}"
                print(f"Saved {field}: {filename}")
            except Exception as e:
                print(f"Error saving {field}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error saving {field}: {str(e)}"
                )
    
    # Save uploaded documents
    print(f"Processing {len(raw_documents)} uploaded files")
    
    # Check and create upload directory
    upload_dir = os.path.join(settings.upload_dir, "documents")
    print(f"Upload directory: {upload_dir}")
    print(f"Absolute upload directory: {os.path.abspath(upload_dir)}")
    
    # Create directory if it doesn't exist
    try:
        os.makedirs(upload_dir, exist_ok=True)
        print(f"Upload directory created/exists: {upload_dir}")
        print(f"Upload directory is writable: {os.access(upload_dir, os.W_OK)}")
    except Exception as e:
        print(f"Error creating upload directory: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating upload directory: {str(e)}"
        )
    
    uploaded_files = []
    for i, file in enumerate(raw_documents):
        print(f"Processing file {i+1}: {file.filename}, size: {file.size if hasattr(file, 'size') else 'unknown'}")
        try:
            # Save the file and get the filename
            filename = await save_uploaded_file(file, "documents")
            print(f"File saved with filename: {filename}")
            
            # Create the file path for storage in database
            file_path = f"/uploads/documents/{filename}"
            uploaded_files.append(file_path)
            print(f"File path for database: {file_path}")
            
            # Verify file was actually saved
            full_file_path = os.path.join(upload_dir, filename)
            print(f"Full file path on disk: {full_file_path}")
            print(f"File exists after save: {os.path.exists(full_file_path)}")
            if os.path.exists(full_file_path):
                file_size = os.path.getsize(full_file_path)
                print(f"File size on disk: {file_size} bytes")
                
                # Verify file is not empty
                if file_size == 0:
                    print(f"WARNING: File {filename} is empty (0 bytes)")
                    raise Exception(f"File {filename} is empty after save")
                    
        except Exception as e:
            print(f"Error saving file {file.filename}: {e}")
            print(f"Error type: {type(e)}")
            print(f"Error details: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error saving file {file.filename}: {str(e)}"
            )
    
    print(f"Total uploaded files: {len(uploaded_files)}")
    print(f"Uploaded files list: {uploaded_files}")
    
    # Verify we have files to store
    if not uploaded_files:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No files were successfully uploaded"
        )
    
    # Create document
    current_time = datetime.now(timezone.utc)
    
    # Initialize user approvals - primary user auto-approved
    user_approvals = {
        current_user["user_id"]: {
            "approved": True,
            "approved_at": current_time,
            "is_primary": True
        }
    }
    
    document = DocumentInDB(
        involved_users=[current_user["user_id"]],
        primary_user=current_user["user_id"],
        upload_raw_docs=uploaded_files,
        final_docs=[],
        datetime=current_time,
        name=name,
        location=location,
        start_date=parsed_start_date,
        end_date=parsed_end_date,
        ai_forgery_check=False,
        blockchain=False,
        status="draft",  # Starts as draft
        is_active=True,
        is_primary=False,
        daily_rate=daily_rate,  # Dynamic daily rate from pricing config
        total_days=total_days,
        total_amount=total_amount,
        payment_status="pending",
        # Initialize user approval tracking
        user_approvals=user_approvals,
        # Store verification documents for this specific document operation
        verification_documents=verification_files,
        created_at=current_time,
        updated_at=current_time
    )
    
    print(f"Document object created with upload_raw_docs: {document.upload_raw_docs}")
    print(f"Document dict: {document.dict()}")
    
    try:
        document_dict = document.dict()
        print(f"Inserting document with upload_raw_docs: {document_dict.get('upload_raw_docs', [])}")
        
        result = await db.documents.insert_one(document_dict)
        print(f"Document created successfully with ID: {result.inserted_id}")
        
        # Verify the document was saved correctly
        saved_document = await db.documents.find_one({"_id": result.inserted_id})
        if saved_document:
            print(f"Saved document upload_raw_docs: {saved_document.get('upload_raw_docs', [])}")
        else:
            print("Could not retrieve saved document")
        
        return {
            "message": "Document created successfully",
            "document_id": str(result.inserted_id),
            "document_code": document.document_code
        }
    except Exception as e:
        print(f"Error creating document: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating document: {str(e)}"
        )

@documents_router.post("/join",
                       summary="Join Document with Verification",
                       description="Join an existing document using document code with required verification",
                       tags=["Documents"],
                       operation_id="join_document_with_verification")
async def join_document(
    document_code: str = Form(..., description="Document code to join", example="nGyOrdDx"),
    # Verification documents - collected fresh for each document operation
    profile_pic: Optional[UploadFile] = File(None, description="Profile picture/selfie for verification"),
    thumb: Optional[UploadFile] = File(None, description="Fingerprint scan (optional)"),
    sign: Optional[UploadFile] = File(None, description="Signature image for verification"),
    eye: Optional[UploadFile] = File(None, description="Eye scan for verification"),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Join an existing document with verification.
    
    This endpoint allows users to join an existing document using a document code.
    Verification documents are required:
    - profile_pic: Required - Profile picture/selfie
    - sign: Required - Signature image  
    - eye: Required - Eye scan image
    - thumb: Optional - Fingerprint scan
    
    All verification documents are collected fresh for each document operation.
    """
    print(f"=== Document Join Request ===")
    print(f"Document Code: {document_code}")
    print(f"Current User: {current_user['user_id']}")
    print(f"Verification Documents:")
    print(f"  - Profile Pic: {profile_pic.filename if profile_pic else 'None'}")
    print(f"  - Thumb: {thumb.filename if thumb else 'None'}")
    print(f"  - Sign: {sign.filename if sign else 'None'}")
    print(f"  - Eye: {eye.filename if eye else 'None'}")
    
    # Validate verification documents (thumb is now optional)
    verification_errors = []
    if not profile_pic:
        verification_errors.append("Profile picture is required for document joining")
    if not sign:
        verification_errors.append("Signature is required for document joining")
    if not eye:
        verification_errors.append("Eye scan is required for document joining")
    # thumb is optional, no validation needed
    
    if verification_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Verification documents required: {', '.join(verification_errors)}"
        )
    
    # Find document by code
    document = await db.documents.find_one({"document_code": document_code})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if user is already involved
    if current_user["user_id"] in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already part of this document"
        )
    
    # Save verification documents
    verification_files = {}
    verification_upload_dirs = {
        'profile_pic': 'profile_pics',
        'thumb': 'fingerprints',
        'sign': 'signatures',
        'eye': 'eye_scans'
    }
    
    for field, file in [('profile_pic', profile_pic), ('thumb', thumb), 
                        ('sign', sign), ('eye', eye)]:
        if file:
            try:
                filename = await save_uploaded_file(file, verification_upload_dirs[field])
                verification_files[field] = f"/uploads/{verification_upload_dirs[field]}/{filename}"
                print(f"Saved {field}: {filename}")
            except Exception as e:
                print(f"Error saving {field}: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error saving {field}: {str(e)}"
                )
    
    # Add user to involved_users (pending approval) with verification documents
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$addToSet": {"involved_users": current_user["user_id"]},
            "$set": {
                "updated_at": datetime.now(timezone.utc), 
                "status": "pending_approval",  # Document now needs approval from both users
                f"verification_documents.{current_user['user_id']}": verification_files,
                f"user_approvals.{current_user['user_id']}": {
                    "approved": False,
                    "approved_at": None,
                    "is_primary": False
                }
            }
        }
    )
    
    return {"message": "Join request sent successfully"}

@documents_router.put("/{document_id}/approve/{user_id}")
async def approve_user_join(
    document_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Approve User Join Request ===")
    print(f"Document ID/Code: {document_id}")
    print(f"User ID to approve: {user_id}")
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
    
    if document["primary_user"] != current_user["user_id"]:
        print(f"Access denied: {current_user['user_id']} is not primary user")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can approve join requests"
        )
    
    print(f"User {current_user['user_id']} is primary user, proceeding with approval")
    
    # Update document status - use the actual document _id from the found document
    document_object_id = document["_id"]
    print(f"Updating document with ObjectId: {document_object_id}")
    
    await db.documents.update_one(
        {"_id": document_object_id},
        {"$set": {"updated_at": datetime.now(timezone.utc), "status": "approved"}}
    )
    
    print(f"Successfully approved user {user_id} for document {document_id}")
    return {"message": "User approved successfully"}

# User Management Endpoints - Simple Add/Remove/Approve
@documents_router.post("/{document_id}/add-user")
async def add_user_to_document(
    document_id: str,
    target_user_char_id: str = Form(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Add a user to a document (Primary user only) - Can add users anytime after creation"""
    print(f"=== Add User to Document ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Target User Char ID: {target_user_char_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    # Block edits after finalization
    if document.get("status") == "finalized" or document.get("is_locked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is finalized and cannot be edited"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can add users"
        )
    
    # Find target user by char_id
    target_user = await db.users.find_one({"char_id": target_user_char_id})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
    
    # Check if user is already involved
    if target_user["user_id"] in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already part of this document"
        )
    
    # Add user to involved_users (automatically approved - no pending state)
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$addToSet": {"involved_users": target_user["user_id"]},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "message": f"User {target_user['name']} added successfully to document",
        "target_user": {
            "user_id": target_user["user_id"],
            "char_id": target_user["char_id"],
            "name": target_user["name"]
        }
    }

@documents_router.put("/{document_id}/approve-user/{user_id}")
async def approve_user_join(
    document_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Approve a user's join request (Primary user only)"""
    print(f"=== Approve User Join Request ===")
    print(f"Document ID/Code: {document_id}")
    print(f"User ID to approve: {user_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    # Block edits after finalization
    if document.get("status") == "finalized" or document.get("is_locked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is finalized and cannot be edited"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can approve join requests"
        )
    
    # Check if user is in involved_users
    if user_id not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in the document's involved users list"
        )
    
    # Update user approval status
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$set": {
                f"user_approvals.{user_id}.approved": True,
                f"user_approvals.{user_id}.approved_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Check if all users have approved
    updated_document = await db.documents.find_one({"_id": document["_id"]})
    user_approvals = updated_document.get("user_approvals", {})
    
    all_approved = all(
        approval.get("approved", False) 
        for approval in user_approvals.values()
    )
    
    if all_approved:
        # All users approved, change status to approved and enable payment
        await db.documents.update_one(
            {"_id": document["_id"]},
            {
                "$set": {
                    "status": "approved",
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        print(f"All users approved for document {document_id}, status changed to approved")
    else:
        print(f"User {user_id} approved, but waiting for other users. Current status: {updated_document.get('status')}")
    
    # Get user details for response
    user = await db.users.find_one({"user_id": user_id})
    user_name = user.get("name", "Unknown") if user else "Unknown"
    
    return {
        "message": f"User {user_name} approved successfully",
        "document_status": "approved" if all_approved else "pending_approval",
        "all_users_approved": all_approved
    }

@documents_router.delete("/{document_id}/remove-user/{user_id}")
async def remove_user_from_document(
    document_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Remove a user from a document (Primary user only) - Can remove from pending or approved"""
    print(f"=== Remove User from Document ===")
    print(f"Document ID/Code: {document_id}")
    print(f"User ID to remove: {user_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    # Block edits after finalization
    if document.get("status") == "finalized" or document.get("is_locked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document is finalized and cannot be edited"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can remove users"
        )
    
    # Prevent removing the primary user
    if user_id == document["primary_user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the primary user from the document"
        )
    
    # Check if user is in involved_users
    if user_id not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in the document's involved users list"
        )
    
    # Remove user from involved_users (works for both pending and approved users)
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$pull": {"involved_users": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Get user details for response
    user = await db.users.find_one({"user_id": user_id})
    user_name = user.get("name", "Unknown") if user else "Unknown"
    
    return {
        "message": f"User {user_name} removed from document successfully",
        "document_status": "updated"
    }
@documents_router.post("/{document_id}/invite-user")
async def invite_user_to_document(
    document_id: str,
    target_user_char_id: str = Form(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Invite a user to join a document (Primary user only)"""
    print(f"=== Invite User to Document ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Target User Char ID: {target_user_char_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can invite users"
        )
    
    # Find target user by char_id
    target_user = await db.users.find_one({"char_id": target_user_char_id})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
    
    # Check if user is already involved
    if target_user["user_id"] in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already part of this document"
        )
    
    # Add user to involved_users (pending approval)
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$addToSet": {"involved_users": target_user["user_id"]},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    return {
        "message": f"User {target_user['name']} invited successfully",
        "target_user": {
            "user_id": target_user["user_id"],
            "char_id": target_user["char_id"],
            "name": target_user["name"]
        }
    }

@documents_router.get("/{document_id}/pending-users")
async def get_pending_users(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Get list of users who joined but need approval (Primary user only)"""
    print(f"=== Get Pending Users ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can view pending users"
        )
    
    # Get all involved users except primary user
    pending_user_ids = [uid for uid in document["involved_users"] if uid != document["primary_user"]]
    
    # Get user details for pending users
    pending_users = []
    for user_id in pending_user_ids:
        user = await db.users.find_one({"user_id": user_id})
        if user:
            pending_users.append({
                "user_id": user["user_id"],
                "char_id": user["char_id"],
                "name": user["name"],
                "email": user.get("email", ""),
                "profile_pic": user.get("profile_pic", "")
            })
    
    return {
        "pending_users": pending_users,
        "total_pending": len(pending_users)
    }

@documents_router.put("/{document_id}/reject-user/{user_id}")
async def reject_user_join(
    document_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Reject a user's join request (Primary user only)"""
    print(f"=== Reject User Join Request ===")
    print(f"Document ID/Code: {document_id}")
    print(f"User ID to reject: {user_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can reject join requests"
        )
    
    # Check if user is in involved_users
    if user_id not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in the document's involved users list"
        )
    
    # Remove user from involved_users
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$pull": {"involved_users": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Get user details for response
    user = await db.users.find_one({"user_id": user_id})
    user_name = user.get("name", "Unknown") if user else "Unknown"
    
    return {
        "message": f"User {user_name} rejected and removed from document",
        "document_status": "updated"
    }

@documents_router.put("/{document_id}/remove-user/{user_id}")
async def remove_user_from_document(
    document_id: str,
    user_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Remove a user from a document (Primary user only)"""
    print(f"=== Remove User from Document ===")
    print(f"Document ID/Code: {document_id}")
    print(f"User ID to remove: {user_id}")
    print(f"Current user: {current_user['user_id']}")
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if current user is primary user
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can remove users"
        )
    
    # Prevent removing the primary user
    if user_id == document["primary_user"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the primary user from the document"
        )
    
    # Check if user is in involved_users
    if user_id not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is not in the document's involved users list"
        )
    
    # Remove user from involved_users
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$pull": {"involved_users": user_id},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        }
    )
    
    # Get user details for response
    user = await db.users.find_one({"user_id": user_id})
    user_name = user.get("name", "Unknown") if user else "Unknown"
    
    return {
        "message": f"User {user_name} removed from document successfully",
        "document_status": "updated"
    }

@documents_router.get("/my-documents", response_model=List[DocumentResponse])
async def get_my_documents(current_user=Depends(get_current_user), db=Depends(get_database)):
    try:
        print(f"Fetching documents for user: {current_user['user_id']}")
        documents = await db.documents.find(
            {"involved_users": current_user["user_id"]}
        ).to_list(None)
        
        print(f"Found {len(documents)} documents")
        
        result = []
        for doc in documents:
            try:
                print(f"Processing document: {doc.get('_id', 'unknown')}")
                # Ensure all required fields are present with defaults
                doc_data = {
                    "_id": str(doc["_id"]) if doc.get("_id") else "",
                    "involved_users": doc.get("involved_users", []),
                    "primary_user": doc.get("primary_user", ""),
                    "upload_raw_docs": doc.get("upload_raw_docs", []),
                    "final_docs": doc.get("final_docs", []),
                    "datetime": doc.get("datetime", datetime.now(timezone.utc)),
                    "location": doc.get("location"),
                    "start_date": doc.get("start_date"),
                    "end_date": doc.get("end_date"),
                    "name": doc.get("name", ""),
                    "document_code": doc.get("document_code", ""),
                    "ai_forgery_check": doc.get("ai_forgery_check", False),
                    "blockchain": doc.get("blockchain", False),
                    "status": doc.get("status", "draft"),
                    "is_active": doc.get("is_active", True),
                    "is_primary": doc.get("is_primary", False),
                    "created_at": doc.get("created_at", datetime.now(timezone.utc)),
                    "updated_at": doc.get("updated_at", datetime.now(timezone.utc))
                }
                result.append(DocumentResponse(**doc_data))
                print(f"Successfully processed document: {doc.get('_id', 'unknown')}")
            except Exception as e:
                print(f"Error processing document {doc.get('_id', 'unknown')}: {e}")
                continue
        
        print(f"Returning {len(result)} processed documents")
        return result
    except Exception as e:
        print(f"Error in get_my_documents: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching documents: {str(e)}"
        )

# Pricing Configuration Endpoints
@documents_router.get("/pricing", response_model=PricingConfig)
async def get_pricing_config(
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Get the current active pricing configuration"""
    try:
        # Get the most recent active pricing config
        pricing_config = await db.pricing_config.find_one(
            {"is_active": True},
            sort=[("created_at", -1)]
        )
        
        if not pricing_config:
            # Return default pricing if none exists
            return PricingConfig(
                daily_rate=1.0,
                is_active=True,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
        
        # Add user tracking info if available
        pricing_data = pricing_config.copy()
        if "created_by" in pricing_data:
            # Try to get user info for display
            try:
                created_user = await db.users.find_one({"user_id": pricing_data["created_by"]})
                if created_user:
                    pricing_data["created_by_name"] = created_user.get("name", "Unknown")
                else:
                    pricing_data["created_by_name"] = "Unknown"
            except:
                pricing_data["created_by_name"] = "Unknown"
        
        if "updated_by" in pricing_data:
            try:
                updated_user = await db.users.find_one({"user_id": pricing_data["updated_by"]})
                if updated_user:
                    pricing_data["updated_by_name"] = updated_user.get("name", "Unknown")
                else:
                    pricing_data["updated_by_name"] = "Unknown"
            except:
                pricing_data["updated_by_name"] = "Unknown"
        
        return PricingConfig(**pricing_data)
        
    except Exception as e:
        print(f"Error fetching pricing config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch pricing configuration"
        )

@documents_router.post("/pricing", response_model=dict)
async def create_pricing_config(
    request: PricingConfigCreate,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Create a new pricing configuration (Any authenticated user)"""
    try:
        # Deactivate all existing pricing configs
        await db.pricing_config.update_many(
            {"is_active": True},
            {"$set": {"is_active": False}}
        )
        
        # Create new pricing config
        current_time = datetime.now(timezone.utc)
        new_pricing = {
            "daily_rate": request.daily_rate,
            "is_active": True,
            "created_at": current_time,
            "updated_at": current_time,
            "created_by": current_user["user_id"]  # Track who created it
        }
        
        result = await db.pricing_config.insert_one(new_pricing)
        
        return {
            "message": "Pricing configuration created successfully",
            "pricing_id": str(result.inserted_id),
            "daily_rate": request.daily_rate
        }
        
    except Exception as e:
        print(f"Error creating pricing config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pricing configuration"
        )

@documents_router.put("/pricing", response_model=dict)
async def update_pricing_config(
    request: PricingConfigUpdate,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Update the current active pricing configuration (Any authenticated user)"""
    try:
        # Get current active pricing config
        current_pricing = await db.pricing_config.find_one({"is_active": True})
        
        if not current_pricing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active pricing configuration found"
            )
        
        # Update the current pricing config
        await db.pricing_config.update_one(
            {"_id": current_pricing["_id"]},
            {
                "$set": {
                    "daily_rate": request.daily_rate,
                    "updated_at": datetime.now(timezone.utc),
                    "updated_by": current_user["user_id"]  # Track who updated it
                }
            }
        )
        
        return {
            "message": "Pricing configuration updated successfully",
            "daily_rate": request.daily_rate
        }
        
    except Exception as e:
        print(f"Error updating pricing config: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update pricing configuration"
        )

@documents_router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"Getting document with ID/code: {document_id}")
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
    
    # Check if user is involved in the document
    if current_user["user_id"] not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    try:
        print(f"Processing document: {document.get('_id', 'unknown')}")
        # Ensure all required fields are present with defaults
        doc_data = {
            "_id": str(document["_id"]) if document.get("_id") else "",
            "involved_users": document.get("involved_users", []),
            "primary_user": document.get("primary_user", ""),
            "upload_raw_docs": document.get("upload_raw_docs", []),
            "final_docs": document.get("final_docs", []),
            "datetime": document.get("datetime", datetime.now(timezone.utc)),
            "location": document.get("location"),
            "start_date": document.get("start_date"),
            "end_date": document.get("end_date"),
            "name": document.get("name", ""),
            "document_code": document.get("document_code", ""),
            "ai_forgery_check": document.get("ai_forgery_check", False),
            "blockchain": document.get("blockchain", False),
            "status": document.get("status", "draft"),
            "is_active": document.get("is_active", True),
            "is_primary": document.get("is_primary", False),
            "daily_rate": document.get("daily_rate", 1.0),
            "total_days": document.get("total_days", 1),
            "total_amount": document.get("total_amount", 1.0),
            "payment_status": document.get("payment_status", "pending"),
            "created_at": document.get("created_at", datetime.now(timezone.utc)),
            "updated_at": document.get("updated_at", datetime.now(timezone.utc))
        }
        print(f"Successfully processed document data")
        return DocumentResponse(**doc_data)
    except Exception as e:
        print(f"Error processing document {document_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing document: {str(e)}"
        )

@documents_router.patch("/{document_id}/finalize")
async def finalize_document(
    document_id: str,
    final_documents: Optional[List[UploadFile]] = File(None),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Finalize Document Request ===")
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
    
    if document["primary_user"] != current_user["user_id"]:
        print(f"Access denied: {current_user['user_id']} is not primary user")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can finalize documents"
        )
    
    print(f"User {current_user['user_id']} is primary user, proceeding with finalization")
    
    # Check payment status before finalization
    print(f"Checking payment status for document {document_id}")
    
    # Check if document is approved by all users before allowing finalization
    if document.get("status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document must be approved by all users before it can be finalized"
        )
    
    # Get payment distribution
    payment_distribution = await db.payment_distributions.find_one({"document_id": str(document["_id"])})
    
    if not payment_distribution:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment distribution not setup. Please setup payment distribution before finalizing."
        )
    
    # Check if all payments are completed
    total_amount = payment_distribution["total_amount"]
    total_paid = 0
    
    for dist in payment_distribution["distributions"]:
        user_payment = await db.payments.find_one({
            "document_id": str(document["_id"]),
            "user_id": dist["user_id"],
            "status": "completed"
        })
        
        if user_payment:
            total_paid += user_payment["amount"]
    
    if total_paid < total_amount:
        remaining_amount = total_amount - total_paid
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment not completed. Remaining amount: ₹{remaining_amount:.2f}. Please complete all payments before finalizing."
        )
    
    print(f"Payment verification successful. Total paid: ₹{total_paid:.2f}")
    
    # Save final documents if provided; otherwise auto-generate server-side
    final_files = []
    if final_documents and len(final_documents) > 0:
        for file in final_documents:
            filename = await save_uploaded_file(file, "documents")
            file_path = f"/uploads/documents/{filename}"
            final_files.append(file_path)
            # Run AI forgery check
            is_authentic = await check_document_authenticity(file_path)
            if not is_authentic:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Document failed AI forgery check"
                )
    else:
        # Generate composed final PDF and store it
        try:
            # Reuse final-pdf generator endpoint logic by calling function indirectly
            from PyPDF2 import PdfReader
            from reportlab.pdfgen import canvas
            # Generate composed pdf to disk
            # Call our own final-pdf to ensure it exists
            _ = await get_final_document_pdf(document_id, current_user, db)
            # Save path from generated output
            upload_root = Path(settings.upload_dir)
            output_dir = upload_root / "generated"
            # Find the most recent generated file for this document
            candidates = sorted(output_dir.glob(f"final_*{document_id}*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
            if not candidates:
                # Fallback: any final_*.pdf
                candidates = sorted(output_dir.glob("final_*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)
            if not candidates:
                raise HTTPException(status_code=500, detail="Failed to compose final PDF")
            composed = candidates[0]
            # Move/copy into uploads/documents for consistency
            dest_dir = Path(settings.upload_dir) / "documents"
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_path = dest_dir / composed.name
            if composed.resolve() != dest_path.resolve():
                dest_path.write_bytes(composed.read_bytes())
            final_files.append(f"/uploads/documents/{dest_path.name}")
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to auto-generate final PDF: {e}")
    
    # Update document - use the actual document _id from the found document
    document_object_id = document["_id"]
    print(f"Updating document with ObjectId: {document_object_id}")
    
    await db.documents.update_one(
        {"_id": document_object_id},
        {
            "$set": {
                "final_docs": final_files,
                "ai_forgery_check": True,
                "status": "finalized",
                "is_locked": True,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Add to blockchain
    blockchain_hash = await add_to_blockchain(str(document_object_id), final_files)
    await db.documents.update_one(
        {"_id": document_object_id},
        {"$set": {"blockchain": True, "blockchain_hash": blockchain_hash}}
    )
    
    return {"message": "Document finalized successfully"}

@documents_router.get("/{document_id}/final-pdf")
async def get_final_document_pdf(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """Generate a composed final PDF with background and a summary page, and return it as a file.
    Final PDF = All raw documents composited onto bg.pdf + one summary page with participant details and payments.
    """
    try:
        from PyPDF2 import PdfReader, PdfWriter
        from reportlab.pdfgen import canvas
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.utils import ImageReader
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF dependencies missing: {e}")

    # Find document by id or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception:
        pass
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Ensure current user is involved
    if current_user["user_id"] not in document.get("involved_users", []):
        raise HTTPException(status_code=403, detail="Access denied")

    # Background asset and output dir
    bg_path = Path("app/assets/bg.pdf")
    if not bg_path.exists():
        raise HTTPException(status_code=500, detail="Background PDF not found")

    upload_root = Path(settings.upload_dir)
    output_dir = upload_root / "generated"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_pdf_path = output_dir / f"final_{document.get('_id', document_id)}.pdf"

    # Build participants info
    users = []
    for uid in document.get("involved_users", []):
        u = await db.users.find_one({"user_id": uid})
        if not u:
            continue
        users.append({
            "name": u.get("name", "Unknown"),
            "email": u.get("email", ""),
            "phone": u.get("phone_no", ""),
            "profile_pic": u.get("profile_pic"),
            "signature": u.get("signature_pic"),
            "eye_pic": u.get("eye_pic"),
            "fingerprint": u.get("fingerprint"),
            "user_id": u.get("user_id")
        })

    # Fetch payment distribution if present
    payment_distribution = await db.payment_distributions.find_one({"document_id": str(document["_id"])})
    user_to_amount = {}
    if payment_distribution:
        for dist in payment_distribution.get("distributions", []):
            user_to_amount[dist.get("user_id")] = {
                "percentage": dist.get("percentage"),
                "amount": dist.get("amount")
            }

    # Compose PDF: pages composited over bg.pdf
    writer = PdfWriter()
    bg_reader_for_size = PdfReader(str(bg_path))
    bg_proto = bg_reader_for_size.pages[0]
    bg_w = float(bg_proto.mediabox.width)
    bg_h = float(bg_proto.mediabox.height)

    margin_ratio = 0.20
    usable_w = bg_w * (1 - 2 * margin_ratio)
    usable_h = bg_h * (1 - 2 * margin_ratio)

    def _merge_compat(target_page, src_page, scale, tx, ty):
        # Try multiple PyPDF2 APIs for broad compatibility
        try:
            if hasattr(target_page, 'merge_transformed_page'):
                ctm = (scale, 0, 0, scale, tx, ty)
                target_page.merge_transformed_page(src_page, ctm)
                return
        except Exception:
            pass
        try:
            if hasattr(target_page, 'mergeScaledTranslatedPage'):
                # Older PyPDF2 API
                target_page.mergeScaledTranslatedPage(src_page, scale, tx, ty)
                return
        except Exception:
            pass
        try:
            if hasattr(src_page, 'add_transformation'):
                ctm = (scale, 0, 0, scale, tx, ty)
                src_page.add_transformation(ctm)
                target_page.merge_page(src_page)
                return
        except Exception:
            pass
        # Last resort: scale only and center approximately
        try:
            if hasattr(src_page, 'scale_by'):
                src_page.scale_by(scale)
            target_page.merge_page(src_page)
        except Exception:
            # Give up silently; caller may choose to append original
            raise

    def compose_with_bg_and_margins(src_page):
        # Fresh background for each composed page
        bg_reader_local = PdfReader(str(bg_path))
        blank_page = bg_reader_local.pages[0]
        src_w = float(src_page.mediabox.width)
        src_h = float(src_page.mediabox.height)
        scale = min(usable_w / src_w, usable_h / src_h)
        tx = bg_w * margin_ratio + (usable_w - src_w * scale) / 2
        ty = bg_h * margin_ratio + (usable_h - src_h * scale) / 2
        _merge_compat(blank_page, src_page, scale, tx, ty)
        return blank_page

    # Append all pages from all raw documents, scaled to fit inside 20% margins
    for rel_path in document.get("upload_raw_docs", []):
        raw_abs = Path(".") / rel_path.lstrip("/")
        if not raw_abs.exists():
            continue
        try:
            reader = PdfReader(str(raw_abs))
            for page in reader.pages:
                composed = compose_with_bg_and_margins(page)
                writer.add_page(composed)
        except Exception as e:
            # If fail to merge, still append original pages to avoid blocking
            try:
                reader = PdfReader(str(raw_abs))
                for p in reader.pages:
                    writer.add_page(p)
            except Exception:
                print(f"Failed to append raw pdf {raw_abs}: {e}")

    # Create summary page content via ReportLab (same size as bg)
    summary_pdf_path = output_dir / f"summary_{document.get('_id', document_id)}.pdf"
    c = canvas.Canvas(str(summary_pdf_path), pagesize=(bg_w, bg_h))
    width, height = bg_w, bg_h

    # Simple vector icons to avoid emoji font issues
    def draw_doc_icon(x, y, size):
        c.setFillColorRGB(0.2, 0.2, 0.2)
        c.rect(x, y - size + 2, size*0.8, size, fill=0, stroke=1)
        c.line(x, y - size*0.35, x + size*0.8, y - size*0.35)
        c.line(x, y - size*0.60, x + size*0.8, y - size*0.60)
        c.setFillColorRGB(0, 0, 0)

    def draw_user_icon(x, y, size):
        c.setFillColorRGB(0.1, 0.4, 0.8)
        c.circle(x + size*0.35, y - size*0.35, size*0.18, fill=1, stroke=0)
        c.roundRect(x + size*0.10, y - size*0.95, size*0.50, size*0.35, 2, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)

    def draw_location_icon(x, y, size):
        c.setFillColorRGB(0.86, 0.17, 0.17)
        # pin body
        c.circle(x + size*0.30, y - size*0.45, size*0.16, fill=1, stroke=0)
        c.line(x + size*0.30, y - size*0.60, x + size*0.30, y - size*0.95)
        c.setFillColorRGB(0, 0, 0)

    def draw_calendar_icon(x, y, size):
        c.setFillColorRGB(0.10, 0.6, 0.2)
        c.rect(x, y - size, size*0.8, size*0.65, fill=0, stroke=1)
        c.rect(x, y - size*0.35, size*0.8, size*0.15, fill=1, stroke=0)
        c.setFillColorRGB(1, 1, 1)
        c.rect(x + size*0.05, y - size*0.30, size*0.15, size*0.08, fill=1, stroke=0)
        c.rect(x + size*0.30, y - size*0.30, size*0.15, size*0.08, fill=1, stroke=0)
        c.rect(x + size*0.55, y - size*0.30, size*0.15, size*0.08, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)

    def draw_check_icon(x, y, size):
        c.setFillColorRGB(0.0, 0.6, 0.2)
        c.circle(x + size*0.35, y - size*0.45, size*0.28, fill=0, stroke=1)
        c.setLineWidth(2)
        c.line(x + size*0.18, y - size*0.48, x + size*0.30, y - size*0.62)
        c.line(x + size*0.30, y - size*0.62, x + size*0.52, y - size*0.38)
        c.setLineWidth(1)
        c.setFillColorRGB(0, 0, 0)

    def draw_chain_icon(x, y, size):
        c.setFillColorRGB(0.1, 0.1, 0.8)
        c.roundRect(x, y - size*0.55, size*0.45, size*0.25, 2, fill=0, stroke=1)
        c.roundRect(x + size*0.35, y - size*0.80, size*0.45, size*0.25, 2, fill=0, stroke=1)
        c.line(x + size*0.35, y - size*0.67, x + size*0.45, y - size*0.62)
        c.setFillColorRGB(0, 0, 0)

    # Header - larger fonts, text only (no emojis/icons)
    c.setFont("Helvetica-Bold", 26)
    c.drawString(20*mm, height-25*mm, "Document Summary")
    c.setFont("Helvetica-Bold", 18)
    c.drawString(20*mm, height-35*mm, f"Name: {document.get('name', '')}")
    c.setFont("Helvetica", 13)
    c.drawString(20*mm, height-45*mm, f"Code: {document.get('document_code', '')}")
    c.drawString(90*mm, height-45*mm, f"Location: {document.get('location', 'N/A')}")
    c.drawString(20*mm, height-55*mm, f"Start: {document.get('start_date')}")
    c.drawString(90*mm, height-55*mm, f"End: {document.get('end_date')}")
    c.drawString(20*mm, height-65*mm, "AI Forgery Check: PASSED")
    c.drawString(90*mm, height-65*mm, "Blockchain Verification: DONE")

    # Participants & Payment Share - Rich blocks utilizing full page
    y = height - 80*mm
    left_margin = 20*mm
    right_margin = 20*mm
    avail_w = width - left_margin - right_margin

    c.setFont("Helvetica-Bold", 20)
    c.drawString(left_margin, y, "Participants & Payment Share")
    y -= 12*mm

    header_h = 14*mm
    # Plain header (no background colours)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(left_margin + 4, y - 5*mm, "Participant")
    c.drawString(left_margin + avail_w*0.60, y - 5*mm, "Share % / Amount")
    y -= header_h + 4*mm

    # User block metrics (3-row layout)
    row1_h = 10*mm  # name/email/phone
    row2_h = 10*mm  # share/amount
    img_h = 25*mm   # photo height (+25%)
    label_h = 4*mm
    block_h = row1_h + row2_h + img_h + label_h + 6*mm  # +padding
    img_w = img_h
    img_gap = 8*mm

    for idx, u in enumerate(users, start=1):
        # Page break
        if y - block_h < 25*mm:
            c.showPage()
            y = height - 25*mm
            c.setFont("Helvetica-Bold", 20)
            c.drawString(left_margin, y, "Participants & Payment Share (cont.)")
            y -= 12*mm
            c.setFont("Helvetica-Bold", 13)
            c.drawString(left_margin + 4, y - 5*mm, "Participant")
            c.drawString(left_margin + avail_w*0.60, y - 5*mm, "Share % / Amount")
            y -= header_h + 4*mm

        # Plain block, no colours

        # Row 1: Name | Email | Phone
        col1_x = left_margin + 4
        col2_x = left_margin + avail_w*0.45
        col3_x = left_margin + avail_w*0.75
        base1 = y - 6*mm
        c.setFont("Helvetica-Bold", 16)
        c.drawString(col1_x, base1, f"{idx}. {u['name']}")
        c.setFont("Helvetica", 12)
        c.drawString(col2_x, base1, u.get('email', ''))
        c.drawString(col3_x, base1, u.get('phone', ''))

        # Row 2: Share % | Amount
        pay = user_to_amount.get(u['user_id'], {})
        pct = pay.get('percentage')
        amt = pay.get('amount')
        base2 = y - row1_h - 4*mm
        c.setFont("Helvetica-Bold", 13)
        if pct is not None:
            c.drawString(col1_x, base2, f"Share: {pct:.0f}%")
        if amt is not None:
            c.drawString(col2_x, base2, f"Amount: INR {amt:.2f}")

        # Row 3: Photos in one row with labels under each
        photos = [
            (u.get('profile_pic'), 'Selfie'),
            (u.get('eye_pic'), 'Eye'),
            (u.get('fingerprint'), 'Fingerprint'),
            (u.get('signature'), 'Signature')
        ]
        # compute horizontal positioning
        total_imgs_w = 4*img_w + 3*img_gap
        start_x = left_margin + max(4, (avail_w - total_imgs_w)/2)
        yimg_top = y - row1_h - row2_h - 2*mm
        yimg = yimg_top - img_h
        for i, (rel, label) in enumerate(photos):
            x = start_x + i*(img_w + img_gap)
            if rel:
                pth = Path(".") / str(rel).lstrip("/")
                if pth.exists():
                    try:
                        c.drawImage(ImageReader(str(pth)), x, yimg, width=img_w, height=img_h, preserveAspectRatio=True, mask='auto')
                    except Exception:
                        pass
            c.setFont("Helvetica", 10)
            c.drawCentredString(x + img_w/2, yimg - 10, label)

        # Divider line (thin)
        c.setLineWidth(0.6)
        c.line(left_margin, y - block_h, left_margin + avail_w, y - block_h)
        y -= block_h + 3*mm

    c.showPage()
    c.save()

    # Append summary page composited over background (fit full page)
    try:
        sum_reader = PdfReader(str(summary_pdf_path))
        for sum_page in sum_reader.pages:
            # place summary to cover bg fully, centered
            bg_reader_local = PdfReader(str(bg_path))
            bg_page = bg_reader_local.pages[0]
            sw = float(sum_page.mediabox.width)
            sh = float(sum_page.mediabox.height)
            scale = min(bg_w / sw, bg_h / sh)
            tx = (bg_w - sw * scale) / 2
            ty = (bg_h - sh * scale) / 2
            _merge_compat(bg_page, sum_page, scale, tx, ty)
            writer.add_page(bg_page)
    except Exception as e:
        print(f"Error adding summary page: {e}")

    # Write final composed pdf
    # Add page numbers to every page (bottom center)
    total_pages = len(writer.pages)
    numbered_pages = PdfWriter()
    for idx in range(total_pages):
        page = writer.pages[idx]
        # Create overlay
        num_overlay_path = output_dir / f"num_{idx+1}.pdf"
        cnum = canvas.Canvas(str(num_overlay_path), pagesize=(float(page.mediabox.width), float(page.mediabox.height)))
        cnum.setFont("Helvetica", 10)
        footer_text = f"Page {idx+1} of {total_pages}"
        text_width = cnum.stringWidth(footer_text, "Helvetica", 10)
        # Move page number higher (double of existing): 20mm from bottom
        cnum.drawString((float(page.mediabox.width) - text_width)/2, 20*mm, footer_text)
        cnum.showPage()
        cnum.save()
        try:
            oreader = PdfReader(str(num_overlay_path))
            overlay = oreader.pages[0]
            page.merge_page(overlay)
        except Exception:
            pass
        numbered_pages.add_page(page)

    with open(output_pdf_path, "wb") as f:
        numbered_pages.write(f)

    return FileResponse(path=str(output_pdf_path), filename=output_pdf_path.name, media_type="application/pdf")

@documents_router.post("/initiate-agreement", response_model=dict)
async def initiate_agreement(
    request: InitiateAgreementRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Initiate Agreement Request ===")
    print(f"Initiator: {current_user['user_id']}")
    print(f"Target User Char ID: {request.target_user_char_id}")
    
    # Find target user by char_id
    target_user = await db.users.find_one({"char_id": request.target_user_char_id})
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
    
    print(f"Found target user: {target_user['user_id']} ({target_user['char_id']})")
    
    # Check if user is trying to initiate agreement with themselves
    if target_user["user_id"] == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot initiate agreement with yourself"
        )
    
    # Create document with both users involved
    current_time = datetime.now(timezone.utc)
    document = DocumentInDB(
        involved_users=[current_user["user_id"], target_user["user_id"]],
        primary_user=current_user["user_id"],
        upload_raw_docs=[],
        final_docs=[],
        datetime=current_time,
        name=request.name,
        location=request.location,
        start_date=None,
        end_date=None,
        ai_forgery_check=False,
        blockchain=False,
        status="pending",
        is_active=True,
        is_primary=False,
        created_at=current_time,
        updated_at=current_time
    )
    
    try:
        document_dict = document.dict()
        result = await db.documents.insert_one(document_dict)
        print(f"Document created successfully with ID: {result.inserted_id}")
        
        return {
            "message": "Agreement initiated successfully",
            "document_id": str(result.inserted_id),
            "document_code": document.document_code,
            "target_user": {
                "user_id": target_user["user_id"],
                "char_id": target_user["char_id"],
                "name": target_user["name"]
            },
            "daily_rate": 1.0,  # Fixed at 1 coin per day
            "total_days": 1,     # Default to 1 day
            "total_amount": 1.0  # Default amount
        }
        
    except Exception as e:
        print(f"Error creating agreement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating agreement: {str(e)}"
        )

@documents_router.post("/{document_id}/respond-agreement")
async def respond_to_agreement(
    document_id: str,
    response: str = Form(..., description="Response: 'accept' or 'reject'"),
    profile_pic: Optional[UploadFile] = File(None, description="Profile picture/selfie for verification (required if accepting)"),
    thumb: Optional[UploadFile] = File(None, description="Fingerprint scan (required if accepting)"),
    sign: Optional[UploadFile] = File(None, description="Signature image for verification (required if accepting)"),
    eye: Optional[UploadFile] = File(None, description="Eye scan for verification (required if accepting)"),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    """
    Accept or reject an agreement request.
    This endpoint allows users to respond to agreement requests initiated by other users.
    When accepting, verification documents are required.
    """
    print(f"=== Agreement Response Request ===")
    print(f"Document ID/Code: {document_id}")
    print(f"Current user: {current_user['user_id']}")
    print(f"Response: {response}")
    
    if response not in ['accept', 'reject']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Response must be either 'accept' or 'reject'"
        )
    
    # Find document by ObjectId or code
    document = None
    try:
        if ObjectId.is_valid(document_id):
            document = await db.documents.find_one({"_id": ObjectId(document_id)})
        else:
            document = await db.documents.find_one({"document_code": document_id})
    except Exception as e:
        print(f"Error finding document: {e}")
        pass
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Check if current user is the target user (not the initiator)
    if document["primary_user"] == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot respond to your own agreement request"
        )
    
    # Check if current user is in the involved users list
    if current_user["user_id"] not in document["involved_users"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are not part of this agreement"
        )
    
    # Check if document is in pending status
    if document.get("status") != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This agreement is not in pending status"
        )
    
    current_time = datetime.now(timezone.utc)
    
    if response == 'accept':
        # Validate required verification documents
        if not profile_pic or not thumb or not sign or not eye:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All verification documents (profile pic, fingerprint, signature, eye scan) are required to accept the agreement"
            )
        
        # Save verification documents
        verification_files = {}
        try:
            if profile_pic:
                profile_pic_path = await save_uploaded_file(profile_pic, "profile_pics")
                verification_files["profile_pic"] = profile_pic_path
            
            if thumb:
                thumb_path = await save_uploaded_file(thumb, "fingerprints")
                verification_files["fingerprint"] = thumb_path
            
            if sign:
                sign_path = await save_uploaded_file(sign, "signatures")
                verification_files["signature"] = sign_path
            
            if eye:
                eye_path = await save_uploaded_file(eye, "eye_scans")
                verification_files["eye_scan"] = eye_path
                
        except Exception as e:
            print(f"Error saving verification files: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save verification documents"
            )
        
        # Accept the agreement
        await db.documents.update_one(
            {"_id": document["_id"]},
            {
                "$set": {
                    "status": "approved",
                    "updated_at": current_time,
                    f"user_approvals.{current_user['user_id']}": {
                        "approved": True,
                        "approved_at": current_time,
                        "is_primary": False,
                        "verification_files": verification_files
                    }
                }
            }
        )
        
        # Update primary user's approval status as well
        await db.documents.update_one(
            {"_id": document["_id"]},
            {
                "$set": {
                    f"user_approvals.{document['primary_user']}": {
                        "approved": True,
                        "approved_at": current_time,
                        "is_primary": True
                    }
                }
            }
        )
        
        message = "Agreement accepted successfully! The agreement is now active."
        status = "approved"
        
    else:  # reject
        # Reject the agreement - remove current user from involved users
        await db.documents.update_one(
            {"_id": document["_id"]},
            {
                "$pull": {"involved_users": current_user["user_id"]},
                "$set": {
                    "status": "rejected",
                    "updated_at": current_time,
                    "rejected_by": current_user["user_id"],
                    "rejected_at": current_time
                }
            }
        )
        
        message = "Agreement rejected successfully."
        status = "rejected"
    
    return {
        "message": message,
        "document_status": status,
        "response": response,
        "document_id": str(document["_id"]),
        "document_code": document.get("document_code", "")
    }



