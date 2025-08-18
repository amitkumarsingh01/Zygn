# Document Creation Fix - FormData Parsing Issue

## 🐛 **Problem Identified**

The document creation was failing with the following error:
```json
{
    "detail": [
        {
            "type": "missing",
            "loc": ["body", "name"],
            "msg": "Field required",
            "input": null
        },
        {
            "type": "missing",
            "loc": ["body", "raw_documents"],
            "msg": "Field required",
            "input": null
        }
    ]
}
```

## 🔍 **Root Cause**

The issue was in the backend's handling of FormData with multiple files. The original approach using FastAPI's automatic FormData parsing with `List[UploadFile] = File(...)` was not properly receiving the data from the frontend.

### **Frontend Issue:**
- FormData was being constructed correctly
- Multiple files were being appended with the same field name (`raw_documents`)
- Files were being sent properly

### **Backend Issue:**
- FastAPI's automatic FormData parsing was not handling multiple files with the same field name correctly
- The `raw_documents: List[UploadFile] = File(...)` parameter was not receiving the files
- Text fields like `name` were also not being received

## ✅ **Solution Implemented**

### **1. Backend Changes (`backend/app/documents/routes.py`)**

#### **Updated Function Signature:**
```python
@documents_router.post("/create", response_model=dict)
async def create_document(
    request: Request,  # Changed from individual Form parameters
    current_user=Depends(get_current_user),
    db=Depends(get_database)
):
```

#### **Manual FormData Parsing:**
```python
# Parse FormData manually
form_data = await request.form()
print(f"Form data keys: {list(form_data.keys())}")

# Extract text fields
name = form_data.get('name')
location = form_data.get('location')
start_date = form_data.get('start_date')
end_date = form_data.get('end_date')

# Extract files - handle multiple files with same field name
raw_documents = []
for key, value in form_data.items():
    if key == 'raw_documents':
        if isinstance(value, UploadFile):
            raw_documents.append(value)
        elif isinstance(value, list):
            # Handle case where multiple files might be grouped
            for item in value:
                if isinstance(item, UploadFile):
                    raw_documents.append(item)

# Alternative method: get all values for raw_documents field
if not raw_documents:
    raw_documents = form_data.getlist('raw_documents')
    # Filter to ensure we only have UploadFile objects
    raw_documents = [item for item in raw_documents if isinstance(item, UploadFile)]
```

#### **Added Validation:**
```python
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
```

### **2. Frontend Changes (`frontend/src/pages/DocumentCreate.tsx`)**

#### **Simplified File Appending:**
```typescript
// Add files - IMPORTANT: Use the exact field name expected by backend
validFiles.forEach((file, index) => {
  console.log(`Appending file ${index}:`, {
    name: file.name,
    size: file.size,
    type: file.type,
    constructor: file.constructor.name,
    isFile: file instanceof File
  });
  // The backend expects 'raw_documents' as the field name
  // For multiple files, append each with the same field name
  formDataToSend.append('raw_documents', file);
});
```

#### **Enhanced Debugging:**
```typescript
// Additional debugging
console.log('FormData keys:');
console.log('name field:', formDataToSend.get('name'));
console.log('location field:', formDataToSend.get('location'));
console.log('start_date field:', formDataToSend.get('start_date'));
console.log('end_date field:', formDataToSend.get('end_date'));
console.log('raw_documents count:', formDataToSend.getAll('raw_documents').length);
console.log('raw_documents files:', formDataToSend.getAll('raw_documents'));
```

## 🔧 **How the Fix Works**

### **1. Manual FormData Parsing**
- Instead of relying on FastAPI's automatic FormData parsing, we manually parse the request
- This gives us full control over how multiple files are handled
- We can properly extract both text fields and file fields

### **2. Multiple File Handling**
- The `form_data.getlist('raw_documents')` method properly retrieves all files with the same field name
- We filter to ensure only valid UploadFile objects are processed
- This handles the case where multiple files are sent with the same field name

### **3. Enhanced Validation**
- We now explicitly validate that required fields are present
- Better error messages for debugging
- Proper handling of missing files or text fields

## 🧪 **Testing the Fix**

### **1. Backend Testing**
```bash
# Test documents routes
python -c "from app.documents import routes; print('✓ Documents routes imported')"

# Test main app
python -c "from app.main import app; print('✓ Main app imported')"
```

### **2. Frontend Testing**
- Create a new document with multiple files
- Check browser console for FormData debugging information
- Verify files are being sent correctly

## 📋 **Expected Behavior After Fix**

### **1. FormData Construction**
```
FormData entries:
name: Rental Agreement
location: Bangalore
start_date: 2025-08-22T00:00:00.000Z
end_date: 2025-08-30T00:00:00.000Z
raw_documents: File - document1.pdf, size: 12345, type: application/pdf
raw_documents: File - document2.docx, size: 67890, type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

### **2. Backend Processing**
```
Form data keys: ['name', 'location', 'start_date', 'end_date', 'raw_documents', 'raw_documents']
Name: Rental Agreement
Location: Bangalore
Start Date: 2025-08-22T00:00:00.000Z
End Date: 2025-08-30T00:00:00.000Z
Raw Documents Count: 2
```

### **3. File Upload Success**
- Files are properly saved to the uploads directory
- Document is created with correct file paths
- Success response with document code

## 🚀 **Benefits of the Fix**

1. **Reliable File Upload**: Multiple files are now properly handled
2. **Better Error Handling**: Clear validation and error messages
3. **Enhanced Debugging**: Detailed logging for troubleshooting
4. **Flexible Architecture**: Manual parsing allows for custom handling
5. **Consistent Behavior**: Files are processed reliably every time

## 🔍 **Troubleshooting Tips**

### **If Issues Persist:**

1. **Check Browser Console**: Look for FormData debugging information
2. **Verify File Selection**: Ensure files are actually selected before submission
3. **Check Network Tab**: Verify the request payload in browser dev tools
4. **Backend Logs**: Check the detailed logging in the backend console
5. **File Types**: Ensure uploaded files match accepted formats

### **Common Issues:**

- **Empty FormData**: Check if files are being appended correctly
- **Missing Fields**: Verify all required fields are filled
- **File Size**: Ensure files are not too large
- **File Types**: Confirm files match accepted MIME types

---

**Fix Status**: ✅ Implemented  
**Last Updated**: Current  
**Version**: 1.0.0
