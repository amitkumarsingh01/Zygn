import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle, UserMinus, Users, CreditCard, Calculator, DollarSign, Percent } from 'lucide-react';
import { documentUsersAPI, paymentsAPI } from '../services/api';
import toast from 'react-hot-toast';

interface User {
  user_id: string;
  char_id: string;
  name: string;
  email: string;
  profile_pic?: string;
}

interface PaymentDistribution {
  user_id: string;
  percentage: number;
  amount: number;
}

interface PaymentCalculationResponse {
  document_id: string;
  document_code: string;
  document_name: string;
  start_date?: string;
  end_date?: string;
  duration_days: number;
  total_amount: number;
  payment_status: string;
  payment_distributions?: PaymentDistribution[];
  can_finalize: boolean;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentCode: string;
  isPrimaryUser: boolean;
  currentUsers: User[];
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  documentId,
  documentCode,
  isPrimaryUser,
  currentUsers
}) => {
  const [inviteCharId, setInviteCharId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [paymentData, setPaymentData] = useState<PaymentCalculationResponse | null>(null);
  const [isLoadingPayment, setIsLoadingPayment] = useState(false);
  const [showPaymentSection, setShowPaymentSection] = useState(false);
  const [paymentDistributions, setPaymentDistributions] = useState<PaymentDistribution[]>([]);

  // Load payment data when modal opens
  useEffect(() => {
    if (isOpen && isPrimaryUser) {
      loadPaymentData();
    }
  }, [isOpen, isPrimaryUser, documentId]);

  const loadPaymentData = async () => {
    setIsLoadingPayment(true);
    try {
      const response = await paymentsAPI.calculateDocumentPayment(documentId);
      setPaymentData(response.data);
      
      // Initialize payment distributions if not set
      if (response.data.payment_distributions && response.data.payment_distributions.length > 0) {
        setPaymentDistributions(response.data.payment_distributions);
      } else {
        // Create default distribution
        const defaultDistribution = currentUsers.map(user => ({
          user_id: user.user_id,
          percentage: 100 / currentUsers.length,
          amount: (response.data.total_amount * (100 / currentUsers.length)) / 100
        }));
        setPaymentDistributions(defaultDistribution);
      }
    } catch (error: any) {
      console.error('Error loading payment data:', error);
      toast.error('Failed to load payment information');
    } finally {
      setIsLoadingPayment(false);
    }
  };

  const handleAddUser = async () => {
    if (!inviteCharId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setIsAdding(true);
    try {
      const response = await documentUsersAPI.addUserToDocument(documentId, inviteCharId.trim());
      toast.success(response.data.message);
      setInviteCharId('');
      // Refresh payment data after adding user
      await loadPaymentData();
    } catch (error: any) {
      console.error('Error adding user:', error);
      const rawDetail = error.response?.data?.detail;
      const errorMessage = Array.isArray(rawDetail)
        ? rawDetail.map((e: any) => e?.msg).join(', ')
        : (typeof rawDetail === 'string' ? rawDetail : 'Failed to add user');
      toast.error(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleApproveUser = async (userId: string, userName: string) => {
    try {
      const response = await documentUsersAPI.approveUserJoin(documentId, userId);
      toast.success(response.data.message);
      // Refresh payment data after approving user
      await loadPaymentData();
    } catch (error: any) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user');
    }
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to remove ${userName} from this document?`)) {
      return;
    }

    try {
      const response = await documentUsersAPI.removeUserFromDocument(documentId, userId);
      toast.success(response.data.message);
      // Refresh payment data after removing user
      await loadPaymentData();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error('Failed to remove user');
    }
  };

  const handlePaymentDistributionChange = (userId: string, percentage: number) => {
    if (percentage < 0 || percentage > 100) return;

    const updatedDistributions = paymentDistributions.map(dist => {
      if (dist.user_id === userId) {
        return { ...dist, percentage, amount: (paymentData!.total_amount * percentage) / 100 };
      }
      return dist;
    });

    // Recalculate remaining percentages
    const totalAssigned = updatedDistributions.reduce((sum, dist) => sum + dist.percentage, 0);
    if (totalAssigned > 100) {
      toast.error('Total percentage cannot exceed 100%');
      return;
    }

    setPaymentDistributions(updatedDistributions);
  };

  const handleSetupPaymentDistribution = async () => {
    try {
      const totalPercentage = paymentDistributions.reduce((sum, dist) => sum + dist.percentage, 0);
      if (Math.abs(totalPercentage - 100) > 0.01) {
        toast.error('Total percentage must equal 100%');
        return;
      }

      await paymentsAPI.setupPaymentDistribution(documentId, {
        document_id: documentId,
        payment_distributions: paymentDistributions,
        total_amount: paymentData!.total_amount,
        duration_days: paymentData!.duration_days
      });

      toast.success('Payment distribution setup successfully!');
      await loadPaymentData(); // Refresh data
    } catch (error: any) {
      console.error('Error setting up payment distribution:', error);
      toast.error('Failed to setup payment distribution');
    }
  };

  const handleMakePayment = async () => {
    try {
      await paymentsAPI.makeDocumentPayment(documentId);
      toast.success('Payment processed successfully!');
      await loadPaymentData(); // Refresh data
    } catch (error: any) {
      console.error('Error making payment:', error);
      toast.error('Failed to process payment');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Manage Document Users & Payments</h2>
            <p className="text-sm text-gray-600 mt-1">Document Code: {documentCode}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* ADD USER SECTION - Primary User Only */}
        {isPrimaryUser && (
          <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <UserPlus className="h-5 w-5 mr-2 text-blue-600" />
              Add New User (Can add anytime after document creation)
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={inviteCharId}
                onChange={(e) => setInviteCharId(e.target.value)}
                placeholder="Enter 8-character User ID (e.g., nGyOrdDx)"
                className="flex-1 input-field"
                maxLength={8}
              />
              <button
                onClick={handleAddUser}
                disabled={isAdding || !inviteCharId.trim()}
                className="btn-primary px-6 disabled:opacity-50"
              >
                {isAdding ? 'Adding...' : 'Add User'}
              </button>
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Enter the 8-character User ID of the person you want to add to this document
            </p>
          </div>
        )}

        {/* PAYMENT GATEWAY SECTION - Primary User Only */}
        {isPrimaryUser && paymentData && (
          <div className="mb-8 p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <CreditCard className="h-5 w-5 mr-2 text-green-600" />
                Payment Gateway & Distribution
              </h3>
              <button
                onClick={() => setShowPaymentSection(!showPaymentSection)}
                className="text-green-600 hover:text-green-700 text-sm font-medium"
              >
                {showPaymentSection ? 'Hide Details' : 'Show Details'}
              </button>
            </div>

            {/* Payment Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center">
                  <Calculator className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Total Amount</span>
                </div>
                <p className="text-lg font-bold text-gray-900">₹{paymentData.total_amount}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center">
                  <DollarSign className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Duration</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{paymentData.duration_days} days</p>
              </div>
              <div className="bg-white p-3 rounded-lg border">
                <div className="flex items-center">
                  <Percent className="h-4 w-4 text-gray-500 mr-2" />
                  <span className="text-sm text-gray-600">Status</span>
                </div>
                <p className="text-lg font-bold text-gray-900 capitalize">{paymentData.payment_status}</p>
              </div>
            </div>

            {/* Payment Distribution Details */}
            {showPaymentSection && (
              <div className="bg-white p-4 rounded-lg border">
                <h4 className="font-medium text-gray-900 mb-3">Payment Distribution</h4>
                <div className="space-y-3">
                  {paymentDistributions.map((distribution) => {
                    const user = currentUsers.find(u => u.user_id === distribution.user_id);
                    return (
                      <div key={distribution.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{user?.name || `User ${distribution.user_id.slice(0, 4)}...`}</p>
                          <p className="text-sm text-gray-600">ID: {user?.char_id || distribution.user_id}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={distribution.percentage}
                              onChange={(e) => handlePaymentDistributionChange(distribution.user_id, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-sm border rounded"
                            />
                            <span className="text-sm text-gray-600">%</span>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">₹{distribution.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Payment Actions */}
                <div className="flex gap-3 mt-4 pt-4 border-t">
                  <button
                    onClick={handleSetupPaymentDistribution}
                    className="btn-primary"
                  >
                    Setup Distribution
                  </button>
                  {paymentData.payment_status === 'pending' && (
                    <button
                      onClick={handleMakePayment}
                      className="btn-secondary"
                    >
                      Make Payment
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* CURRENT USERS SECTION - Show all users with actions */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-green-600" />
            Current Users ({currentUsers.length})
          </h3>
          <div className="space-y-3">
            {currentUsers.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center">
                  <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center mr-3">
                    <span className="text-gray-600 font-medium">
                      {user.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-600">ID: {user.char_id}</p>
                    {user.email && (
                      <p className="text-xs text-gray-500">{user.email}</p>
                    )}
                  </div>
                </div>
                
                {/* ACTION BUTTONS - Primary User Only */}
                {isPrimaryUser && (
                  <div className="flex gap-2">
                    {/* APPROVE BUTTON */}
                    <button
                      onClick={() => handleApproveUser(user.user_id, user.name)}
                      className="text-green-500 hover:text-green-700 p-2 bg-green-50 rounded-lg"
                      title="Approve user"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                    
                    {/* REMOVE BUTTON - Don't show for primary user */}
                    {user.user_id !== currentUsers.find(u => u.user_id === user.user_id)?.user_id && (
                      <button
                        onClick={() => handleRemoveUser(user.user_id, user.name)}
                        className="text-red-500 hover:text-red-700 p-2 bg-red-50 rounded-lg"
                        title="Remove user"
                      >
                        <UserMinus className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                )}
                
                {/* STATUS FOR SECONDARY USERS */}
                {!isPrimaryUser && (
                  <span className="text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full">
                    Active Participant
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* INFO FOR SECONDARY USERS */}
        {!isPrimaryUser && (
          <div className="mb-8 p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Read-Only Access
            </h3>
            <p className="text-sm text-gray-700">
              You can view all users in this document but cannot add, remove, or approve users. 
              Only the primary user can manage document participants and payment distribution.
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-6 border-t">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagementModal;
