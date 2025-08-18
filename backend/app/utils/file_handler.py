import os
import uuid
import aiofiles
from fastapi import UploadFile, HTTPException
from app.config import settings
from pathlib import Path

async def save_uploaded_file(file: UploadFile, subfolder: str) -> str:
    """Save uploaded file to designated folder and return filename"""
    
    try:
        print(f"Starting file save for: {file.filename}")
        print(f"File size: {file.size if hasattr(file, 'size') else 'unknown'}")
        print(f"File content type: {file.content_type}")
        
        # Validate file size
        content = await file.read()
        print(f"Read content length: {len(content)} bytes")
        
        if len(content) > settings.max_file_size:
            raise HTTPException(status_code=413, detail="File too large")
        
        if len(content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")
        
        # Reset file pointer
        await file.seek(0)
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        print(f"Generated filename: {unique_filename}")
        
        # Create file path
        file_path = os.path.join(settings.upload_dir, subfolder, unique_filename)
        print(f"File path: {file_path}")
        print(f"Absolute file path: {os.path.abspath(file_path)}")
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Save file
        async with aiofiles.open(file_path, 'wb') as f:
            await f.write(content)
        
        # Verify file was saved
        if os.path.exists(file_path):
            saved_size = os.path.getsize(file_path)
            print(f"File saved successfully. Size on disk: {saved_size} bytes")
            
            if saved_size != len(content):
                raise Exception(f"File size mismatch: expected {len(content)}, got {saved_size}")
        else:
            raise Exception("File was not created on disk")
        
        return unique_filename
        
    except Exception as e:
        print(f"Error in save_uploaded_file: {e}")
        print(f"Error type: {type(e)}")
        raise e

async def delete_file(file_path: str) -> bool:
    """Delete file from filesystem"""
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False
    except Exception:
        return False