import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException
from app.config import settings
from pathlib import Path

async def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    """Save uploaded file to designated folder and return filename"""
    
    # Validate file size
    content = await file.read()
    if len(content) > settings.max_file_size:
        raise HTTPException(status_code=413, detail="File too large")
    
    # Reset file pointer
    await file.seek(0)
    
    # Generate unique filename
    file_extension = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    
    # Create file path
    file_path = os.path.join(settings.upload_dir, subfolder, unique_filename)
    
    # Save file
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    return unique_filename

async def delete_file(file_path: str) -> bool:
    """Delete file from filesystem"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False