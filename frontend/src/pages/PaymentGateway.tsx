import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI, paymentsAPI, walletAPI } from '../services/api';
import { Document, Payment, PaymentCalculationResponse } from '../types';
import { toast } from 'react-hot-toast';
import { 
  CreditCard, 
  Wallet, 
  FileText, 
  DollarSign, 
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Users
} from 'lucide-react';



const PaymentGateway: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [paymentCalculation, setPaymentCalculation] = useState<PaymentCalculationResponse | null>(null);
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
            fetchPaymentCalculation(),
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
      setDocument(response.data as Document);
    } catch (error: any) {
      console.error('Error fetching document:', error);
      throw error;
    }
  };

  const fetchPaymentCalculation = async () => {
    try {
      console.log('Fetching payment calculation for document:', id);
      const response = await paymentsAPI.calculateDocumentPayment(id!);
      console.log('Payment calculation response:', response.data);
      setPaymentCalculation(response.data);
    } catch (error: any) {
      console.error('Error fetching payment calculation:', error);
      // Don't throw error, just log it
    }
  };

  const fetchPayments = async () => {
    try {
      console.log('Fetching payments for document:', id);
      const response = await paymentsAPI.getDocumentPayments(id!);
      console.log('Payments response:', response.data);
      setPayments(response.data as Payment[]);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
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

  const handlePayment = async () => {
    if (!document || !user || !paymentCalculation) return;

    // Find user's payment distribution
    const userDistribution = paymentCalculation.payment_distributions?.find(
      dist => dist.user_id === user._id
    );

    if (!userDistribution) {
      toast.error('No payment distribution found for you');
      return;
    }

    if (walletBalance < userDistribution.amount) {
      toast.error(`Insufficient wallet balance. Required: ₹${userDistribution.amount.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`);
      return;
    }

    // Show confirmation popup
    const isConfirmed = window.confirm(
      `Are you sure you want to pay ₹${userDistribution.amount.toFixed(2)}?\n\n` +
      `This will deduct the amount from your wallet balance.`
    );

    if (!isConfirmed) {
      return;
    }

    setIsProcessing(true);
    try {
      await paymentsAPI.makeDocumentPayment(id!);
      toast.success('Payment completed successfully!');
      
      // Add a small delay to allow backend processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh data
      await Promise.all([
        fetchDocumentData(),
        fetchPaymentCalculation(),
        fetchPayments(),
        fetchWalletBalance()
      ]);
      
      // Show success message with payment details
      const userDistribution = paymentCalculation.payment_distributions?.find(
        dist => dist.user_id === user._id
      );
      if (userDistribution) {
        toast.success(`Payment of ₹${userDistribution.amount.toFixed(2)} completed successfully!`);
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
    if (!paymentCalculation) return 0;
    const paidAmount = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);
    return Math.max(0, paymentCalculation.total_amount - paidAmount);
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

  const getUserPaymentStatus = (userId: string) => {
    const userPayment = payments.find(p => p.user_id === userId);
    return userPayment ? userPayment.status : 'pending';
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
  const isPrimaryUser = document.primary_user === user?._id;

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
            <p className="text-sm text-gray-500">Document Code: {document.document_code}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Wallet Balance</p>
            <p className="text-2xl font-bold text-green-600">₹{walletBalance.toFixed(2)}</p>
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="text-lg font-semibold text-gray-900">₹{paymentCalculation?.total_amount || document.total_amount}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Duration</p>
                <p className="text-lg font-semibold text-gray-900">{paymentCalculation?.duration_days || 0} days</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Daily Rate</p>
                <p className="text-lg font-semibold text-gray-900">₹1</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="text-lg font-semibold text-gray-900 capitalize">{paymentCalculation?.payment_status || 'pending'}</p>
              </div>
            </div>
          </div>

          {/* Payment Distribution */}
          {paymentCalculation?.payment_distributions && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Payment Distribution
              </h2>
              <div className="space-y-3">
                {paymentCalculation.payment_distributions.map((distribution) => {
                  const paymentStatus = getUserPaymentStatus(distribution.user_id);
                  const isCurrentUser = distribution.user_id === user?._id;
                  
                  return (
                    <div key={distribution.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {isCurrentUser ? 'You' : `User ${distribution.user_id.slice(0, 4)}...`}
                          </p>
                          {isCurrentUser && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">ID: {distribution.user_id}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Percentage</p>
                          <p className="font-medium text-gray-900">{distribution.percentage}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Amount</p>
                          <p className="font-medium text-gray-900">₹{distribution.amount.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-500">Status</p>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(paymentStatus)}`}>
                            {paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Payment Actions */}
          {paymentCalculation && remainingAmount > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                Make Payment
              </h2>
              <div className="space-y-4">
                {paymentCalculation.payment_distributions?.map((distribution) => {
                  const isCurrentUser = distribution.user_id === user?._id;
                  const paymentStatus = getUserPaymentStatus(distribution.user_id);
                  
                  if (!isCurrentUser || paymentStatus === 'completed') return null;
                  
                  return (
                    <div key={distribution.user_id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Your Payment Amount</p>
                        <p className="text-sm text-gray-500">Based on your assigned percentage</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">₹{distribution.amount.toFixed(2)}</p>
                        <button
                          onClick={handlePayment}
                          disabled={isProcessing || walletBalance < distribution.amount}
                          className={`mt-2 px-6 py-2 rounded-md font-medium ${
                            walletBalance >= distribution.amount
                              ? 'bg-primary-600 text-white hover:bg-primary-700'
                              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {isProcessing ? 'Processing...' : 'Pay Your Share'}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {walletBalance < (paymentCalculation.payment_distributions?.find(d => d.user_id === user?._id)?.amount || 0) && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-yellow-800">
                      <strong>Insufficient Balance:</strong> You need more funds in your wallet.
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
                          ₹{payment.amount.toFixed(2)}
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
                <span className="font-medium">₹{paymentCalculation?.total_amount || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Paid:</span>
                <span className="font-medium text-green-600">
                  ₹{((paymentCalculation?.total_amount || 0) - remainingAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining:</span>
                <span className="font-medium text-red-600">₹{remainingAmount.toFixed(2)}</span>
              </div>
              <hr className="my-3" />
              <div className="flex justify-between">
                <span className="text-gray-600">Progress:</span>
                <span className="font-medium">
                  {Math.round((((paymentCalculation?.total_amount || 0) - remainingAmount) / (paymentCalculation?.total_amount || 0)) * 100)}%
                </span>
              </div>
            </div>
          </div>

          {/* User Role Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Role</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Role:</span>
                <span className="font-medium">
                  {isPrimaryUser ? 'Primary User' : 'Involved User'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Permissions:</span>
                <span className="font-medium text-sm">
                  {isPrimaryUser ? 'Manage payments & users' : 'View & make payments'}
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
