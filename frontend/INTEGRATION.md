# Frontend-Backend Integration Guide

## 🚀 Overview

This document describes the complete integration between the React TypeScript frontend and the FastAPI Python backend for the ZYGN Document Agreement System.

## 🔗 API Integration

### Base Configuration
- **Backend URL**: `http://localhost:8005/api`
- **Authentication**: Bearer token-based JWT authentication
- **CORS**: Configured for cross-origin requests

### Enhanced API Features

#### 1. **Dual-Search Support**
All endpoints now support both `_id` (ObjectId) and `char_id` (custom codes):

- **Documents**: Can be accessed by `document_id` or `document_code`
- **Users**: Can be accessed by `user_id` or `char_id`
- **Messaging**: Works with both identifier types

#### 2. **Payment Gateway Integration**
New payment system with document-based payment distribution:

- **Calculate Payment**: `GET /api/payments/document/{document_id}/calculate`
- **Setup Distribution**: `POST /api/payments/document/{document_id}/setup-distribution`
- **Payment Status**: `GET /api/payments/document/{document_id}/payment-status`
- **Make Payment**: `POST /api/payments/document/{document_id}/pay`

## 📱 Frontend Components

### 1. **Payment Gateway Page** (`/document/:id/payment`)
- **Location**: `src/pages/PaymentGateway.tsx`
- **Features**:
  - Payment calculation display
  - Payment distribution setup
  - Real-time payment status
  - User-friendly interface with Tailwind CSS

### 2. **Enhanced Document View**
- **Payment Gateway Section**: Added to sidebar
- **Direct Access**: "Manage Payments" button
- **Integration**: Seamless navigation to payment gateway

### 3. **Enhanced Dashboard**
- **Payment Column**: Added to documents table
- **Quick Access**: Direct links to payment management
- **Status Overview**: Payment status for each document

## 🔧 API Service Layer

### Enhanced API Functions (`src/services/api.ts`)

```typescript
// Enhanced with dual-search support
export const documentsAPI = {
  getDocument: (documentId: string) => 
    api.get<Document>(`/documents/${documentId}`), // Works with both document_id and document_code
  
  approveUserJoin: (documentId: string, userId: string) => 
    api.put<{ message: string }>(`/documents/${documentId}/approve/${userId}`), // Works with both document_id and document_code
  
  finalizeDocument: (documentId: string, finalDocuments: FormData) => 
    api.patch<{ message: string }>(`/documents/${documentId}/finalize`, finalDocuments), // Works with both document_id and document_code
};

// Enhanced messaging with dual-search
export const messagingAPI = {
  sendMessage: (data: { receiver_id: string; content: string; attachment?: File }) => 
    api.post<{ message: string; message_id: string }>('/messaging/send', data), // Works with both user_id and char_id
  
  getConversation: (userId: string) => 
    api.get<Message[]>(`/messaging/conversations/${userId}`), // Works with both user_id and char_id
};

// New payment gateway endpoints
export const paymentsAPI = {
  calculateDocumentPayment: (documentId: string) => 
    api.get<PaymentCalculationResponse>(`/payments/document/${documentId}/calculate`),
  
  setupPaymentDistribution: (documentId: string, data: DocumentPaymentSetup) => 
    api.post<{ message: string }>(`/payments/document/${documentId}/setup-distribution`, data),
  
  getDocumentPaymentStatus: (documentId: string) => 
    api.get<any>(`/payments/document/${documentId}/payment-status`),
  
  makeDocumentPayment: (documentId: string) => 
    api.post<{ message: string }>(`/payments/document/${documentId}/pay`),
};
```

## 📊 Type Definitions

### New Payment Types (`src/types/index.ts`)

```typescript
export interface PaymentDistribution {
  user_id: string;
  percentage: number;
  amount: number;
}

export interface DocumentPaymentSetup {
  document_id: string;
  payment_distributions: PaymentDistribution[];
  total_amount: number;
  duration_days: number;
}

export interface PaymentCalculationResponse {
  document_id: string;
  document_code: string;
  document_name: string;
  start_date?: string;
  end_date?: string;
  duration_days: number;
  total_amount: number; // ₹1 per day
  payment_status: string; // "pending", "distributed", "completed"
  payment_distributions?: PaymentDistribution[];
  can_finalize: boolean;
}
```

## 🎯 Key Features

### 1. **Smart Document Identification**
- **Automatic Detection**: Frontend automatically detects if input is ObjectId or custom code
- **Seamless Experience**: Users can use either format without knowing the difference
- **Backward Compatible**: Existing functionality continues to work

### 2. **Payment Workflow Integration**
- **Before Finalization**: Payment gateway must be completed
- **User Distribution**: Primary user sets payment percentages
- **Automatic Calculation**: ₹1 per day based on document duration
- **Status Tracking**: Real-time payment status updates

### 3. **Enhanced User Experience**
- **Intuitive Navigation**: Clear paths to payment management
- **Real-time Updates**: Live payment status and calculations
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Error Handling**: Comprehensive error messages and validation

## 🚀 Getting Started

### 1. **Start Backend**
```bash
cd backend
python -m app.main
```

### 2. **Start Frontend**
```bash
cd frontend
npm run dev
```

### 3. **Access Payment Gateway**
- Navigate to any document
- Click "Manage Payments" in the sidebar
- Or use direct URL: `/document/{document_id}/payment`

## 🔍 Testing the Integration

### 1. **Test Dual-Search**
```bash
# Using ObjectId
GET /api/documents/68a02578990e63da029d6895

# Using document_code
GET /api/documents/AUQHV8H0

# Both should return the same document
```

### 2. **Test Payment Gateway**
```bash
# Calculate payment
GET /api/payments/document/AUQHV8H0/calculate

# Setup distribution
POST /api/payments/document/AUQHV8H0/setup-distribution

# Check status
GET /api/payments/document/AUQHV8H0/payment-status
```

### 3. **Test Messaging**
```bash
# Using user_id
POST /api/messaging/send
{ "receiver_id": "a82876e5767f44f8", "content": "Hello" }

# Using char_id
POST /api/messaging/send
{ "receiver_id": "BaxHtjF6", "content": "Hello" }

# Both should work and send to the same user
```

## 🎉 Benefits

1. **User-Friendly**: Users can use memorable codes instead of long ObjectIds
2. **Flexible**: System works with both identifier types seamlessly
3. **Integrated**: Payment gateway is fully integrated into document workflow
4. **Modern**: Built with React, TypeScript, and Tailwind CSS
5. **Scalable**: Clean architecture for easy maintenance and expansion

## 🔧 Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend CORS is configured for frontend origin
2. **Authentication**: Check if JWT token is properly stored and sent
3. **API Endpoints**: Verify backend endpoints are running and accessible
4. **Type Errors**: Ensure all TypeScript types are properly imported

### Debug Mode

Enable console logging in the browser to see:
- API request/response details
- Dual-search logic execution
- Payment calculation steps
- Error messages and validation

## 📚 Additional Resources

- **Backend API Docs**: Available at `/docs` when backend is running
- **Frontend Components**: Located in `src/pages/` and `src/components/`
- **API Service**: Centralized in `src/services/api.ts`
- **Type Definitions**: Located in `src/types/index.ts`

---

**Integration Status**: ✅ Complete  
**Last Updated**: Current  
**Version**: 1.0.0
