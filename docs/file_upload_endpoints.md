# File Upload Endpoints Documentation

This document outlines all the endpoints that have been updated to support file uploads using multipart/form-data.

## User Management

### PUT /api/users/profile
**Purpose**: Update user profile with optional file uploads
**File Uploads**:
- `profile_pic`: Profile picture (optional)
- `signature_pic`: Signature image (optional)
- `eye_pic`: Eye scan image (optional)
- `fingerprint`: Fingerprint image (optional)

**Form Fields**:
- `name`: User's name (required)
- `email`: User's email (required)
- `mpin`: MPIN (optional)
- `govtid_type`: Government ID type (optional)
- `govtid_number`: Government ID number (optional)

**Upload Directories**:
- Profile pictures: `/uploads/profile_pics/`
- Signatures: `/uploads/signatures/`
- Eye scans: `/uploads/eye_scans/`
- Fingerprints: `/uploads/fingerprints/`

## Document Management

### POST /api/documents/create
**Purpose**: Create a new document with file uploads
**File Uploads**:
- `raw_documents`: List of raw document files (required)

**Form Fields**:
- `name`: Document name (required)
- `location`: Document location (optional)
- `start_date`: Start date (optional)
- `end_date`: End date (optional)

**Upload Directory**: `/uploads/documents/`

### PATCH /api/documents/{document_id}/finalize
**Purpose**: Finalize a document with final versions and AI forgery check
**File Uploads**:
- `final_documents`: List of final document files (required)

**Features**:
- AI forgery detection
- Blockchain integration
- Document verification

**Upload Directory**: `/uploads/documents/`

## Messaging

### POST /api/messaging/send
**Purpose**: Send a message with optional file attachment
**File Uploads**:
- `attachment`: File attachment (optional)

**Form Fields**:
- `receiver_id`: Recipient user ID (required)
- `content`: Message content (required)

**Upload Directory**: `/uploads/message_attachments/`

## Payments

### POST /api/payments/create
**Purpose**: Create a payment with optional proof document
**File Uploads**:
- `payment_proof`: Payment proof document (optional)

**Form Fields**:
- `document_id`: Document ID (required)
- `amount`: Payment amount (required)
- `duration_days`: Duration in days (required)
- `split_percentage`: Split percentage (required)

**Upload Directory**: `/uploads/payment_proofs/`

## Wallet Management

### POST /api/wallet/add-funds
**Purpose**: Add funds to wallet with optional payment receipt
**File Uploads**:
- `payment_receipt`: Payment receipt document (optional)

**Form Fields**:
- `amount`: Amount to add (required)

**Upload Directory**: `/uploads/payment_receipts/`

## Technical Details

### FastAPI Configuration
All endpoints use proper FastAPI file upload handling:
- `UploadFile = File(...)` for required files
- `Optional[UploadFile] = File(None)` for optional files
- `Form(...)` for form fields
- Automatic multipart/form-data detection

### File Handler
All file uploads use the centralized `save_uploaded_file` utility:
- Automatic file naming with UUID
- Organized directory structure
- File type validation
- Secure file handling

### Swagger UI Integration
- File upload buttons automatically appear in Swagger UI
- Proper media type detection
- Form field validation
- File size and type restrictions

## Upload Directory Structure
```
backend/uploads/
├── profile_pics/          # User profile pictures
├── signatures/            # User signatures
├── eye_scans/            # Eye scan images
├── fingerprints/          # Fingerprint images
├── documents/             # Document files
├── message_attachments/   # Message attachments
├── payment_proofs/        # Payment proof documents
├── payment_receipts/      # Payment receipts
└── wallet_docs/           # Wallet-related documents
```

## Security Features
- File type validation
- Secure file naming with UUIDs
- Organized directory structure
- User authentication required for all uploads
- File size limits (configurable)
- Path traversal protection





