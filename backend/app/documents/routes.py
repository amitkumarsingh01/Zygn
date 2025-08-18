from fastapi import APIRouter, Depends, HTTPException, status, File, Form, Request, UploadFile
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

@documents_router.post("/create", response_model=dict)
async def create_document(
    request: Request,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    print(f"=== Document Creation Request ===")
    print(f"Current User: {current_user['user_id']}")
    
    # Parse FormData manually
    try:
        form_data = await request.form()
        print(f"Form data keys: {list(form_data.keys())}")
        
        # ULTRA-SIMPLE DEBUGGING: Just dump everything
        print("=== ULTRA-SIMPLE FORM DATA DUMP ===")
        print(f"Total form data items: {len(form_data)}")
        print(f"Form data keys: {list(form_data.keys())}")
        
        # Dump each item completely
        for i, (key, value) in enumerate(form_data.items()):
            print(f"Item {i}: Key='{key}'")
            print(f"  Type: {type(value)}")
            print(f"  Value: {value}")
            print(f"  Dir: {[attr for attr in dir(value) if not attr.startswith('_')][:10]}")  # First 10 public attributes
            print(f"  Has filename: {hasattr(value, 'filename')}")
            print(f"  Has read: {hasattr(value, 'read')}")
            print(f"  Has size: {hasattr(value, 'size')}")
            if hasattr(value, 'filename'):
                print(f"  Filename: {value.filename}")
            if hasattr(value, 'size'):
                print(f"  Size: {value.size}")
            print("  ---")
        
        # Debug: Print all form data values
        print("=== Form Data Values ===")
        for key, value in form_data.items():
            # Use hasattr checks instead of isinstance for more robust type checking
            if hasattr(value, 'filename') and hasattr(value, 'read'):
                print(f"{key}: UploadFile - {value.filename}, size: {value.size if hasattr(value, 'size') else 'unknown'}")
            else:
                print(f"{key}: {value} (type: {type(value)})")
        
        # Check if we got any data at all
        if not form_data:
            print("WARNING: FormData is empty!")
            raise Exception("FormData is empty")
            
    except Exception as e:
        print(f"Error parsing FormData: {e}")
        print("Trying alternative method...")
        
        # Try to get the raw request body
        try:
            body = await request.body()
            print(f"Raw request body length: {len(body)}")
            print(f"Raw request body preview: {body[:200] if len(body) > 200 else body}")
        except Exception as body_error:
            print(f"Error reading raw body: {body_error}")
        
        # Try to get headers
        print("Request headers:")
        for key, value in request.headers.items():
            print(f"  {key}: {value}")
        
        # Try to get content type
        content_type = request.headers.get('content-type', '')
        print(f"Content-Type: {content_type}")
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Error parsing form data: {str(e)}"
        )
    
    # Extract text fields
    name = form_data.get('name')
    location = form_data.get('location')
    start_date = form_data.get('start_date')
    end_date = form_data.get('end_date')
    
    print(f"=== Extracted Fields ===")
    print(f"Name: {name} (type: {type(name)})")
    print(f"Location: {location} (type: {type(location)})")
    print(f"Start Date: {start_date} (type: {type(start_date)})")
    print(f"End Date: {end_date} (type: {type(end_date)})")
    
    # ULTRA-SIMPLE FILE EXTRACTION - This WILL work
    raw_documents = []
    
    print("=== ULTRA-SIMPLE FILE EXTRACTION ===")
    
    # Method 1: Try getlist first (most reliable)
    try:
        all_files = form_data.getlist('raw_documents')
        print(f"getlist('raw_documents') returned {len(all_files)} items")
        
        for file in all_files:
            print(f"File: {file} (type: {type(file)})")
            raw_documents.append(file)
            
    except Exception as e:
        print(f"getlist failed: {e}")
        
        # Method 2: Try direct access
        try:
            single_file = form_data.get('raw_documents')
            print(f"Direct get('raw_documents'): {single_file} (type: {type(single_file)})")
            
            if single_file:
                raw_documents.append(single_file)
                
        except Exception as e2:
            print(f"Direct get failed: {e2}")
    
    # Method 3: Last resort - find ANY file-like objects
    if not raw_documents:
        print("Last resort: searching for any file-like objects")
        for key, value in form_data.items():
            print(f"Checking key '{key}': {type(value)}")
            if hasattr(value, 'filename'):
                print(f"Found file-like object with key '{key}': {value.filename}")
                raw_documents.append(value)
    
    # Method 4: Check if files are stored under a different key
    if not raw_documents:
        print("Method 4: Checking for alternative field names")
        possible_keys = ['files', 'documents', 'file', 'document', 'upload', 'uploads']
        for key in possible_keys:
            try:
                files = form_data.getlist(key) if hasattr(form_data, 'getlist') else [form_data.get(key)]
                for file in files:
                    if file and hasattr(file, 'filename'):
                        print(f"Found files under key '{key}': {file.filename}")
                        raw_documents.append(file)
            except Exception as e:
                print(f"Key '{key}' failed: {e}")
    
    # Method 5: Check if files are stored as a single item that needs to be split
    if not raw_documents:
        print("Method 5: Checking for single file item that might be multiple")
        for key, value in form_data.items():
            if hasattr(value, 'filename') and isinstance(value, list):
                print(f"Found list of files under key '{key}': {len(value)} files")
                raw_documents.extend(value)
    
    print(f"Total files found: {len(raw_documents)}")
    
    # Debug: Show what we found
    for i, file in enumerate(raw_documents):
        print(f"File {i}: {file}")
        if hasattr(file, 'filename'):
            print(f"  -> Filename: {file.filename}")
        if hasattr(file, 'size'):
            print(f"  -> Size: {file.size}")
    
    print(f"=== File Extraction Results ===")
    print(f"Raw Documents Count: {len(raw_documents)}")
    
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
        status="draft",
        is_active=True,
        is_primary=False,
        daily_rate=daily_rate,  # Dynamic daily rate from pricing config
        total_days=total_days,
        total_amount=total_amount,
        payment_status="pending",
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

@documents_router.post("/join")
async def join_document(
    join_request: JoinDocumentRequest,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Find document by code
    document = await db.documents.find_one({"document_code": join_request.document_code})
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
    
    # Add user to involved_users (pending approval)
    await db.documents.update_one(
        {"_id": document["_id"]},
        {
            "$addToSet": {"involved_users": current_user["user_id"]},
            "$set": {"updated_at": datetime.now(timezone.utc), "status": "pending"}
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
    final_documents: List[UploadFile] = File(...),
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
    
    # Save final documents
    final_files = []
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

