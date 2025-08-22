export interface User {
  _id: string;
  user_id: string;
  name: string;
  email: string;
  phone_no: string;
  city: string;
  state: string;
  char_id: string;
  profile_pic?: string;
  signature_pic?: string;
  eye_pic?: string;
  fingerprint?: string;
  govt_id_type?: string;
  govt_id_number?: string;
  govt_id_image?: string;
  status: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  _id: string;
  name: string;
  document_code: string;
  involved_users: string[];
  primary_user: string;
  upload_raw_docs: string[];
  final_docs?: string[];
  location?: string;
  start_date?: string;
  end_date?: string;
  status: 'draft' | 'pending' | 'approved' | 'finalized';
  ai_forgery_check: boolean;
  blockchain: boolean;
  is_active: boolean;
  is_primary: boolean;
  total_amount?: number;
  payment_status?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  _id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  attachment?: string;
  created_at: string;
  is_read: boolean;
}

export interface Wallet {
  _id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  _id: string;
  user_id: string;
  type: 'credit' | 'debit' | 'payment' | 'refund';
  amount: number;
  description: string;
  payment_id?: string;
  payment_receipt?: string;
  created_at: string;
}

export interface Payment {
  _id: string;
  user_id: string;
  document_id: string;
  amount: number;
  duration_days: number;
  split_percentage?: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method?: string;
  transaction_id?: string;
  document_name?: string;
  created_at: string;
  updated_at: string;
}

// New Payment Gateway Types
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

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface DocumentFormData {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  raw_documents: File[];
}

export interface JoinDocumentData {
  document_code: string;
}

export interface LoginData {
  phone_no: string;
  otp: string;
}

export interface RegisterData {
  name: string;
  email: string;
  phone_no: string;
  city: string;
  state: string;
  govt_id_type: string;
  govt_id_number: string;
  govt_id_image?: File;
}

export interface ChatMessage {
  type: 'new_message';
  message_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  attachment?: string;
  created_at: string;
}
