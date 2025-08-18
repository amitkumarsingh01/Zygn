import axios from 'axios';
import { 
  User, 
  Document, 
  Message, 
  Wallet, 
  Transaction, 
  Payment,
  LoginData, 
  RegisterData,
  DocumentFormData,
  JoinDocumentData,
  PaymentDistribution,
  DocumentPaymentSetup,
  PaymentCalculationResponse
} from '../types';

const API_BASE_URL = 'http://localhost:8005/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  // Remove default Content-Type header - let browser set it for FormData
});

// Request interceptor to add auth token and handle Content-Type
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Handle Content-Type for different data types
  if (config.data instanceof FormData) {
    // For FormData, let browser set Content-Type with boundary
    delete config.headers['Content-Type'];
  } else {
    // For JSON data, set application/json
    config.headers['Content-Type'] = 'application/json';
  }
  
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: RegisterData) => 
    api.post<{ message: string; user_id: string; char_id: string; redirect_to_login: boolean }>('/auth/register', data),
  
  login: (data: LoginData) => 
    api.post<{ access_token: string; token_type: string; user_id: string; char_id: string }>('/auth/login', data),
};

// Users API
export const usersAPI = {
  getProfile: () => 
    api.get<User>('/users/profile'),
  
  updateProfile: (data: FormData) => 
    api.put<{ message: string }>('/users/profile', data),
  
  getUserById: (userId: string) => 
    api.get<User>(`/users/${userId}`), // Works with both user_id and char_id
  
  getAllUsers: () => 
    api.get<User[]>('/users/all'),
};

// Documents API
export const documentsAPI = {
  createDocument: (data: FormData) => 
    api.post<{ message: string; document_id: string; document_code: string }>('/documents/create', data),
  
  joinDocument: (data: JoinDocumentData) => 
    api.post<{ message: string }>('/documents/join', data),
  
  approveUserJoin: (documentId: string, userId: string) => 
    api.put<{ message: string }>(`/documents/${documentId}/approve/${userId}`), // Works with both document_id and document_code
  
  getMyDocuments: () => 
    api.get<Document[]>('/documents/my-documents'),
  
  getDocument: (documentId: string) => 
    api.get<Document>(`/documents/${documentId}`), // Works with both document_id and document_code
  
  finalizeDocument: (documentId: string, finalDocuments: FormData) => 
    api.patch<{ message: string }>(`/documents/${documentId}/finalize`, finalDocuments), // Works with both document_id and document_code
  
  // Simple agreement initiation
  initiateAgreement: (data: { target_user_char_id: string; name: string; location?: string }) => 
    api.post<{ message: string; document_id: string; document_code: string; target_user: any; daily_rate: number; total_days: number; total_amount: number }>('/documents/initiate-agreement', data),
  
  // Pricing Configuration
  getPricing: () => 
    api.get<{ daily_rate: number; is_active: boolean; created_at: string; updated_at: string }>('/documents/pricing'),
  
  createPricing: (data: { daily_rate: number }) => 
    api.post<{ message: string; pricing_id: string; daily_rate: number }>('/documents/pricing', data),
  
  updatePricing: (data: { daily_rate: number }) => 
    api.put<{ message: string; daily_rate: number }>('/documents/pricing', data),
};

// Messaging API
export const messagingAPI = {
  sendMessage: (data: { receiver_id: string; content: string; attachment?: File }) => 
    api.post<{ message: string; message_id: string }>('/messaging/send', data), // Works with both user_id and char_id
  
  getConversation: (userId: string) => 
    api.get<Message[]>(`/messaging/conversations/${userId}`), // Works with both user_id and char_id
  
  getUnreadCount: () => 
    api.get<{ unread_count: number }>('/messaging/unread-count'),
};

// Wallet API
export const walletAPI = {
  getBalance: () => 
    api.get<Wallet>('/wallet/balance'),
  
  addFunds: (data: FormData) => 
    api.post<{ message: string; amount: number }>('/wallet/add-funds', data),
  
  getTransactions: () => 
    api.get<Transaction[]>('/wallet/transactions'),
};

// Enhanced Payments API with Payment Gateway
export const paymentsAPI = {
  // Legacy payment endpoints
  createPayment: (data: { document_id: string; amount: number; duration_days: number; split_percentage?: number }) => 
    api.post<{ message: string; payment_id: string; transaction_id: string }>('/payments/create', data),
  
  confirmPayment: (paymentId: string) => 
    api.put<{ message: string }>(`/payments/${paymentId}/confirm`),
  
  getMyPayments: () => 
    api.get<Payment[]>('/payments/my-payments'),
  
  // Document-specific payment endpoints
  getDocumentPayments: (documentId: string) => 
    api.get<Payment[]>(`/payments/document/${documentId}/payments`), // Works with both document_id and document_code
  
  // New Payment Gateway endpoints
  calculateDocumentPayment: (documentId: string) => 
    api.get<PaymentCalculationResponse>(`/payments/document/${documentId}/calculate`), // Works with both document_id and document_code
  
  setupPaymentDistribution: (documentId: string, data: DocumentPaymentSetup) => 
    api.post<{ message: string }>(`/payments/document/${documentId}/setup-distribution`, data), // Works with both document_id and document_code
  
  getDocumentPaymentStatus: (documentId: string) => 
    api.get<any>(`/payments/document/${documentId}/payment-status`), // Works with both document_id and document_code
  
  makeDocumentPayment: (documentId: string) => 
    api.post<{ message: string }>(`/payments/document/${documentId}/pay`), // Works with both document_id and document_code
};

export default api;
