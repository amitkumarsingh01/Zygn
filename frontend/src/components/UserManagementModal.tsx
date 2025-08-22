import React, { useState, useEffect } from 'react';
import { X, UserPlus, CheckCircle, Users, CreditCard, Calculator, User } from 'lucide-react';
import { documentUsersAPI, paymentsAPI, documentsAPI } from '../services/api';
import toast from 'react-hot-toast';

interface User {
  user_id: string;
  char_id: string;
  name: string;
  email: string;
  profile_pic?: string;
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
  const [isAdding, setIsAdding] = useState(false);
  const [newUserCharId, setNewUserCharId] = useState('');
  const [paymentData, setPaymentData] = useState<any>(null);
  const [paymentDistributions, setPaymentDistributions] = useState<any[]>([]);
  const [documentStatus, setDocumentStatus] = useState<string>('draft');
  const [userApprovals, setUserApprovals] = useState<any>({});

  // Load payment data when modal opens
  useEffect(() => {
    if (isOpen && isPrimaryUser) {
      loadPaymentData();
      loadDocumentStatus();
    }
  }, [isOpen, isPrimaryUser, documentId]);

  // Initialize user approvals from currentUsers
  useEffect(() => {
    if (currentUsers.length > 0) {
      const approvals: any = {};
      currentUsers.forEach(user => {
        approvals[user.user_id] = {
          approved: user.user_id === currentUsers[0]?.user_id, // First user is primary
          approved_at: null,
          is_primary: user.user_id === currentUsers[0]?.user_id
        };
      });
      setUserApprovals(approvals);
    }
  }, [currentUsers]);

  const loadDocumentStatus = async () => {
    try {
      // Load document details to get current status and user approvals
      const response = await documentsAPI.getDocument(documentId);
      const documentData = response.data;
      
      setDocumentStatus(documentData.status || 'draft');
      
      // Load user approvals from document data
      if ((documentData as any).user_approvals) {
        setUserApprovals((documentData as any).user_approvals);
      }
    } catch (error: any) {
      console.error('Error loading document status:', error);
      // Fallback to default status
      setDocumentStatus('draft');
    }
  };

  const loadPaymentData = async () => {
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
    }
  };

  const handleAddUser = async () => {
    if (!newUserCharId.trim()) {
      toast.error('Please enter a user ID');
      return;
    }

    setIsAdding(true);
    try {
      const response = await documentUsersAPI.addUserToDocument(documentId, newUserCharId.trim());
      toast.success(response.data.message);
      setNewUserCharId('');
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

  const handleApproveUser = async (userId: string) => {
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
                value={newUserCharId}
                onChange={(e) => setNewUserCharId(e.target.value)}
                placeholder="Enter 8-character User ID (e.g., nGyOrdDx)"
                className="flex-1 input-field"
                maxLength={8}
              />
              <button
                onClick={handleAddUser}
                disabled={isAdding || !newUserCharId.trim()}
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

        {/* CURRENT USERS SECTION - Show all users with actions */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Users className="h-5 w-5 mr-2 text-green-600" />
            Current Users ({currentUsers.length})
          </h3>
          {/* User List */}
          <div className="space-y-3">
            {currentUsers.map((user) => (
              <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {user.profile_pic ? (
                      <img
                        src={`https://zygn.iaks.site${user.profile_pic}`}
                        alt={user.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{user.name}</p>
                    <p className="text-sm text-gray-500">ID: {user.user_id}</p>
                    {/* Approval Status */}
                    <div className="flex items-center space-x-2 mt-1">
                      {userApprovals[user.user_id]?.approved ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✓ Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          ⏳ Pending Approval
                        </span>
                      )}
                      {userApprovals[user.user_id]?.is_primary && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Primary User
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Only show approve button for non-primary users who haven't been approved */}
                  {!userApprovals[user.user_id]?.is_primary && !userApprovals[user.user_id]?.approved && (
                    <button
                      onClick={() => handleApproveUser(user.user_id)}
                      className="btn-secondary px-3 py-1 text-sm"
                      title="Approve user"
                    >
                      Approve
                    </button>
                  )}
                  
                  {/* Only show remove button for non-primary users */}
                  {!userApprovals[user.user_id]?.is_primary && (
                    <button
                      onClick={() => handleRemoveUser(user.user_id, user.name)}
                      className="btn-danger px-3 py-1 text-sm"
                      title="Remove user"
                    >
                      Remove
                    </button>
                  )}
                </div>
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

        {/* Payment Section - Always show (actions gated by approval) */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-primary-600" />
            Payment Management
          </h3>

          {documentStatus !== 'approved' && (
            <div className="mb-4 p-4 bg-yellow-50 rounded-lg border border-yellow-200 text-sm text-yellow-800">
              Document is not approved yet. All participants must approve before payments can be processed. You can review or plan the split now; actions will be enabled after approval.
            </div>
          )}

          {paymentData ? (
            <div className="space-y-4">
              {/* Payment calculation display */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Payment Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-blue-700">Total Amount:</span>
                    <span className="ml-2 font-medium">₹{paymentData.total_amount}</span>
                  </div>
                  <div>
                    <span className="text-blue-700">Duration:</span>
                    <span className="ml-2 font-medium">{paymentData.duration_days} days</span>
                  </div>
                </div>
              </div>

              {/* Payment distribution setup */}
              {paymentData.payment_status === 'not_setup' && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900">Setup Payment Distribution</h4>
                  {paymentDistributions.map((dist) => (
                    <div key={dist.user_id} className="flex items-center space-x-3">
                      <span className="text-sm text-gray-600 w-24">
                        {currentUsers.find(u => u.user_id === dist.user_id)?.name || dist.user_id}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={dist.percentage}
                        onChange={(e) => handlePaymentDistributionChange(dist.user_id, parseFloat(e.target.value))}
                        className="input-field w-20 text-center"
                      />
                      <span className="text-sm text-gray-500">%</span>
                      <span className="text-sm text-gray-600">
                        ₹{dist.amount}
                      </span>
                    </div>
                  ))}
                  <button
                    onClick={handleSetupPaymentDistribution}
                    disabled={documentStatus !== 'approved'}
                    className={`btn-primary ${documentStatus !== 'approved' ? 'disabled:opacity-50' : ''}`}
                  >
                    {documentStatus !== 'approved' ? 'Setup after approval' : 'Setup Payment Distribution'}
                  </button>
                </div>
              )}

              {/* Make payment button */}
              {paymentData.payment_status === 'distributed' && (
                <button
                  onClick={handleMakePayment}
                  disabled={documentStatus !== 'approved'}
                  className={`btn-primary w-full ${documentStatus !== 'approved' ? 'disabled:opacity-50' : ''}`}
                >
                  {documentStatus !== 'approved' ? 'Make Payment (after approval)' : 'Make Payment'}
                </button>
              )}

              {/* Payment status display */}
              {paymentData.payment_status === 'completed' && (
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-green-800 font-medium">Payment Completed!</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Payment data not available</p>
            </div>
          )}
        </div>

        {/* Approval Required Message */}
        {documentStatus === 'pending_approval' && (
          <div className="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <h3 className="text-lg font-medium text-yellow-900 mb-2 flex items-center">
              ⏳ Approval Required
            </h3>
            <p className="text-sm text-yellow-700">
              All users must approve this document before payment can be processed. 
              Please wait for all participants to approve.
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
