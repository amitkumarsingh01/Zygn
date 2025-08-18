import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI, paymentsAPI, walletAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  CreditCard, 
  Wallet, 
  FileText, 
  DollarSign, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft
} from 'lucide-react';

interface Document {
  _id: string;
  name: string;
  description: string;
  primary_user: string;
  involved_users: string[];
  status: string;
  created_at: string;
  final_approval_date?: string;
  payment_status: string;
  total_amount: number;
}

interface Payment {
  _id: string;
  document_id: string;
  user_id: string;
  amount: number;
  status: string;
  payment_method: string;
  created_at: string;
  document_name?: string;
}

const PaymentGateway: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      const loadData = async () => {
        try {
          setIsLoading(true);
          // Fetch all data in parallel
          await Promise.all([
            fetchDocumentData(),
            fetchPayments(),
            fetchWalletBalance()
          ]);
        } catch (error: any) {
          console.error('Error loading data:', error);
          // Show error message for document not found
          if (error.response?.status === 404) {
            toast.error('Document not found');
          } else {
            toast.error('Failed to load document data');
          }
        } finally {
          setIsLoading(false);
        }
      };
      
      loadData();
    }
  }, [id]);

  const fetchDocumentData = async () => {
    try {
      console.log('Fetching document with ID:', id);
      const response = await documentsAPI.getDocument(id!);
      console.log('Document response:', response.data);
      setDocument(response.data);
    } catch (error: any) {
      console.error('Error fetching document:', error);
      // Don't show toast during initial load, let the component handle it
      throw error; // Re-throw to be caught by the main loading function
    }
  };

  const fetchPayments = async () => {
    try {
      console.log('Fetching payments for document:', id);
      const response = await paymentsAPI.getDocumentPayments(id!);
      console.log('Payments response:', response.data);
      setPayments(response.data);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      // Don't show toast during initial load, let the component handle it
      // Set empty array as fallback
      setPayments([]);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      console.log('Fetching wallet balance');
      const response = await walletAPI.getBalance();
      console.log('Wallet balance response:', response.data);
      setWalletBalance(response.data.balance);
    } catch (error: any) {
      console.error('Error fetching wallet balance:', error);
      // Set default balance as fallback
      setWalletBalance(0);
    }
  };

  const handlePayment = async (amount: number) => {
    if (!document || !user) return;

    if (walletBalance < amount) {
      toast.error('Insufficient wallet balance. Please add funds first.');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await paymentsAPI.createPayment({
        document_id: document._id,
        amount: amount,
        payment_method: 'wallet',
        user_id: user.user_id
      });

      if (response.data.status === 'completed') {
        toast.success('Payment completed successfully!');
        // Refresh data
        fetchDocumentData();
        fetchPayments();
        fetchWalletBalance();
      } else {
        toast.error('Payment failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      let errorMessage = 'Payment failed';
      if (error.response?.data) {
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const calculateRemainingAmount = () => {
    if (!document) return 0;
    const paidAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, document.total_amount - paidAmount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'failed':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-gray-900">Document not found</h2>
        <p className="text-gray-600 mt-2">The document you're looking for doesn't exist.</p>
      </div>
    );
  }

  const remainingAmount = calculateRemainingAmount();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Gateway</h1>
            <p className="text-gray-600 mt-2">Manage payments for: {document.name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Wallet Balance</p>
            <p className="text-2xl font-bold text-green-600">{walletBalance.toFixed(2)} Coins</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Document Details */}
        <div className="lg:col-span-2 space-y-6">
                     {/* Document Summary */}
           <div className="bg-white rounded-lg shadow p-6">
             <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
               <FileText className="h-5 w-5 mr-2" />
               Document Summary
             </h2>
             <div className="grid grid-cols-2 gap-4">
               <div>
                 <p className="text-sm text-gray-500">Total Amount</p>
                 <p className="text-lg font-semibold text-gray-900">{document.total_amount} Coins</p>
               </div>
               <div>
                 <p className="text-sm text-gray-500">Remaining</p>
                 <p className="text-lg font-semibold text-red-600">{remainingAmount} Coins</p>
               </div>
             </div>
           </div>

          {/* Payment Actions */}
          {remainingAmount > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Make Payment
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Remaining Amount</p>
                    <p className="text-sm text-gray-500">Pay the remaining balance</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600">{remainingAmount} Coins</p>
                    <button
                      onClick={() => handlePayment(remainingAmount)}
                      disabled={isProcessing || walletBalance < remainingAmount}
                      className={`mt-2 px-6 py-2 rounded-md font-medium ${
                        walletBalance >= remainingAmount
                          ? 'bg-primary-600 text-white hover:bg-primary-700'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isProcessing ? 'Processing...' : 'Pay Full Amount'}
                    </button>
                  </div>
                </div>

                {walletBalance < remainingAmount && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">
                      <strong>Insufficient Balance:</strong> You need {remainingAmount - walletBalance} more coins.
                      <button
                        onClick={() => navigate('/wallet')}
                        className="ml-2 text-yellow-800 underline hover:text-yellow-900"
                      >
                        Add Funds
                      </button>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment History */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Payment History
            </h2>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No payments found for this document.</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div key={payment._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(payment.status)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {payment.amount} Coins
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(payment.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {payment.payment_method}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/wallet')}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Add Funds to Wallet
              </button>
              <button
                onClick={() => navigate(`/document/${id}`)}
                className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <FileText className="h-4 w-4 mr-2" />
                View Document
              </button>
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-medium">{document.total_amount} Coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid:</span>
                <span className="font-medium text-green-600">
                  {(document.total_amount - remainingAmount).toFixed(2)} Coins
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-medium text-red-600">{remainingAmount.toFixed(2)} Coins</span>
              </div>
              <hr className="my-3" />
              <div className="flex justify-between">
                <span className="text-gray-600">Progress:</span>
                <span className="font-medium">
                  {Math.round(((document.total_amount - remainingAmount) / document.total_amount) * 100)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGateway;
