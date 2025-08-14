from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import List, Optional
from app.documents.models import DocumentCreate, DocumentResponse, DocumentInDB, JoinDocumentRequest
from app.auth.utils import verify_token
from app.database import get_database
from app.utils.file_handler import save_uploaded_file
from app.utils.ai_forgery import check_document_authenticity
from app.utils.blockchain import add_to_blockchain
from bson import ObjectId
from datetime import datetime, timezone

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
    name: str = Form(...),
    location: Optional[str] = Form(None),
    start_date: Optional[str] = Form(None),
    end_date: Optional[str] = Form(None),
    raw_documents: List[UploadFile] = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Parse dates if provided
    parsed_start_date = None
    parsed_end_date = None
    
    if start_date:
        parsed_start_date = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
    if end_date:
        parsed_end_date = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
    
    # Save uploaded documents
    uploaded_files = []
    for file in raw_documents:
        filename = await save_uploaded_file(file, "documents")
        uploaded_files.append(f"/uploads/documents/{filename}")
    
    # Create document
    document = DocumentInDB(
        involved_users=[current_user["user_id"]],
        primary_user=current_user["user_id"],
        upload_raw_docs=uploaded_files,
        name=name,
        location=location,
        start_date=parsed_start_date,
        end_date=parsed_end_date
    )
    
    result = await db.documents.insert_one(document.dict())
    
    return {
        "message": "Document created successfully",
        "document_id": str(result.inserted_id),
        "document_code": document.document_code
    }

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
    # Find document and verify current user is primary
    document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can approve join requests"
        )
    
    # Update document status
    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {"updated_at": datetime.now(timezone.utc), "status": "approved"}}
    )
    
    return {"message": "User approved successfully"}

@documents_router.get("/my-documents", response_model=List[DocumentResponse])
async def get_my_documents(current_user=Depends(get_current_user), db=Depends(get_database)):
    documents = await db.documents.find(
        {"involved_users": current_user["user_id"]}
    ).to_list(None)
    
    return [DocumentResponse(**doc, id=str(doc["_id"])) for doc in documents]

@documents_router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not document:
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
    
    return DocumentResponse(**document, id=str(document["_id"]))

@documents_router.patch("/{document_id}/finalize")
async def finalize_document(
    document_id: str,
    final_documents: List[UploadFile] = File(...),
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
    # Find document and verify current user is primary
    document = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    if document["primary_user"] != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only primary user can finalize documents"
        )
    
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
    
    # Update document
    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
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
    blockchain_hash = await add_to_blockchain(document_id, final_files)
    await db.documents.update_one(
        {"_id": ObjectId(document_id)},
        {"$set": {"blockchain": True, "blockchain_hash": blockchain_hash}}
    )
    
    return {"message": "Document finalized successfully"}