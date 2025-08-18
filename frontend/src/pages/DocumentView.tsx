import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI, usersAPI } from '../services/api';
import { Document } from '../types';
import UserManagementModal from '../components/UserManagementModal';
import { 
  ArrowLeft, 
  FileText, 
  Users, 
  MapPin, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Eye,
  MessageCircle,
  Upload,
  Lock,
  Copy,
  ExternalLink,
  CreditCard,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';

// User Display Component
const UserDisplay: React.FC<{
  userId: string;
  isPrimary: boolean;
  isCurrentUser: boolean;
  onChatClick: () => void;
}> = ({ userId, isPrimary, isCurrentUser, onChatClick }) => {
  const [userName, setUserName] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUserName = async () => {
      try {
        console.log('[UserDisplay] start', { userId, isCurrentUser, isPrimary });
        // Try cache first
        const cacheKey = `user_${userId}`;
        const cachedUser = localStorage.getItem(cacheKey);
        if (cachedUser) {
          const userData = JSON.parse(cachedUser);
          if (userData?.name) {
            console.log('[UserDisplay] cache hit', { cacheKey, userData });
            setUserName(isCurrentUser ? 'You' : userData.name);
            // Do not return here; still fetch from API to ensure freshness
            setIsLoading(false);
          }
        }

        // Fetch actual user from API (supports user_id or char_id)
        console.log('[UserDisplay] fetching from API', { userId });
        const resp = await usersAPI.getUserById(userId);
        console.log('[UserDisplay] API response', resp.data);
        const name = resp.data.name || 'Unknown User';
        setUserName(isCurrentUser ? 'You' : name);
        setIsLoading(false);
        // Cache minimal info
        localStorage.setItem(cacheKey, JSON.stringify({ name }));
        console.log('[UserDisplay] resolved name', { userId, resolvedName: isCurrentUser ? 'You' : name });
      } catch (error) {
        console.error('Error fetching user name:', error);
        setUserName(isCurrentUser ? 'You' : 'Unknown User');
        setIsLoading(false);
      }
    };

    fetchUserName();
  }, [userId, isCurrentUser]);

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="h-8 w-8 bg-primary-100 rounded-full flex items-center justify-center mr-2">
          <span className="text-xs font-medium text-primary-600">
            {isPrimary ? 'P' : 'U'}
          </span>
        </div>
        <span className="text-sm text-gray-900">
          {isLoading ? 'Loading...' : userName}
          {isPrimary && ' (Primary)'}
        </span>
      </div>
      {!isCurrentUser && (
        <button
          onClick={onChatClick}
          className="text-primary-600 hover:text-primary-700"
          title="Send message"
        >
          <MessageCircle className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const DocumentView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);


  const [isAutoFinalizing, setIsAutoFinalizing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);

  useEffect(() => {
    if (id) {
      fetchDocument();
    }
  }, [id]);

  const fetchDocument = async () => {
    try {
      const response = await documentsAPI.getDocument(id!);
      console.log('Document data:', response.data);
      console.log('Current user:', currentUser);
      console.log('Primary user from document:', response.data.primary_user);
             console.log('Current user ID:', currentUser?._id);
       console.log('Is primary user?', currentUser?._id === response.data.primary_user);
      setDocument(response.data);
    } catch (error) {
      console.error('Error fetching document:', error);
      toast.error('Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };



  // Auto-generate composed final PDF from backend and upload it
  const handleAutoFinalize = async () => {
    if (!id) return;
    setIsAutoFinalizing(true);
    try {
      // 1) Fetch composed PDF
      const resp = await documentsAPI.getFinalPdf(id);
      const blob = resp.data as unknown as Blob;
      const file = new File([blob], `final_${id}.pdf`, { type: 'application/pdf' });

      // 2) Upload via PATCH /finalize
      const formData = new FormData();
      formData.append('final_documents', file);
      await documentsAPI.finalizeDocument(id, formData);

      toast.success('Final PDF generated and uploaded. Document finalized.');
      await fetchDocument();
    } catch (error: any) {
      console.error('Auto finalize error:', error);
      let errorMessage = 'Failed to finalize document';
      if (error.response?.data?.detail) errorMessage = error.response.data.detail;
      toast.error(errorMessage);
    } finally {
      setIsAutoFinalizing(false);
    }
  };

  // Preview composed final PDF without uploading
  const handlePreviewFinalPdf = async () => {
    if (!id) return;
    setIsPreviewing(true);
    try {
      const resp = await documentsAPI.getFinalPdf(id);
      const blob = resp.data as unknown as Blob;
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error: any) {
      console.error('Preview final PDF error:', error);
      let errorMessage = 'Failed to load final PDF';
      if (error.response?.data?.detail) errorMessage = error.response.data.detail;
      toast.error(errorMessage);
    } finally {
      setIsPreviewing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  const handleApproveDocument = async () => {
    if (!id || !currentUser?._id) return;
    setIsApproving(true);
    try {
      await documentsAPI.approveUserJoin(id, currentUser._id);
      toast.success('Document approved');
      await fetchDocument();
    } catch (error: any) {
      console.error('Approve document error:', error);
      let msg = 'Failed to approve document';
      if (error.response?.data?.detail) msg = error.response.data.detail;
      toast.error(msg);
    } finally {
      setIsApproving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'finalized':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      case 'finalized':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isPrimaryUser = document?.primary_user === currentUser?._id;
  const canFinalize = isPrimaryUser && document?.status === 'approved';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Document not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The document you're looking for doesn't exist.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{document.name}</h1>
            <p className="mt-2 text-gray-600">
              Document Code: <span className="font-mono">{document.document_code}</span>
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(document.status)}`}>
              {getStatusIcon(document.status)}
              <span className="ml-1 capitalize">{document.status}</span>
            </span>
            {document.blockchain && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-blue-600 bg-blue-100">
                <Lock className="h-4 w-4 mr-1" />
                Blockchain
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Document Details */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-primary-600" />
              Document Details
            </h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Location</label>
                <p className="mt-1 text-sm text-gray-900 flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                  {document.location || 'Not specified'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <p className="mt-1 text-sm text-gray-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {document.start_date ? formatDate(document.start_date) : 'Not specified'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <p className="mt-1 text-sm text-gray-900 flex items-center">
                  <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                  {document.end_date ? formatDate(document.end_date) : 'Not specified'}
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <p className="mt-1 text-sm text-gray-900">
                  {formatDate(document.created_at)}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <button
                onClick={handlePreviewFinalPdf}
                disabled={isPreviewing}
                className="btn-secondary inline-flex items-center justify-center disabled:opacity-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                {isPreviewing ? 'Opening...' : 'See Final PDF (Preview)'}
              </button>
            </div>
          </div>

          {/* Raw Documents */}
          <div className="card">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Raw Documents</h2>
            <div className="space-y-3">
              {document.upload_raw_docs.map((doc, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-sm text-gray-900">{doc.split('/').pop()}</span>
                  </div>
                                     <button
                     onClick={() => window.open(`https://zygn.iaks.site${doc}`, '_blank')}
                     className="text-primary-600 hover:text-primary-700"
                   >
                     <Eye className="h-4 w-4" />
                   </button>
                </div>
              ))}
            </div>
          </div>

          {/* Final Documents */}
          {document.final_docs && document.final_docs.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Final Documents</h2>
              <div className="space-y-3">
                {document.final_docs.map((doc, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                      <span className="text-sm text-gray-900">{doc.split('/').pop()}</span>
                    </div>
                                         <button
                       onClick={() => window.open(`https://zygn.iaks.site${doc}`, '_blank')}
                       className="text-green-600 hover:text-green-700"
                     >
                       <Eye className="h-4 w-4" />
                     </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Finalize Document */}
          {canFinalize && (
            <div className="card">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Upload className="h-5 w-5 mr-2 text-primary-600" />
                Finalize Document
              </h2>
              <div className="space-y-3">
                <button
                  onClick={handleAutoFinalize}
                  disabled={isAutoFinalizing}
                  className="btn-primary disabled:opacity-50"
                >
                  {isAutoFinalizing ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {isAutoFinalizing ? 'Finalizing...' : 'Generate Final PDF & Finalize'}
                </button>

                <div className="text-xs text-gray-500">
                  This will generate the composed final PDF (with participants page) and upload it automatically.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Document Code */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Document Code</h3>
            <div className="flex items-center space-x-2">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded text-sm font-mono">
                {document.document_code}
              </code>
              <button
                onClick={() => copyToClipboard(document.document_code)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Copy to clipboard"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Share this code with others to join the document.
            </p>
          </div>

          {/* Involved Users */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Users className="h-4 w-4 mr-2" />
              Involved Users
            </h3>
            <div className="space-y-2">
              {document.involved_users.map((userId) => (
                <UserDisplay 
                  key={userId} 
                  userId={userId} 
                  isPrimary={userId === document.primary_user}
                                     isCurrentUser={userId === currentUser?._id}
                  onChatClick={() => navigate(`/chat/${userId}`)}
                />
              ))}
            </div>
          </div>

          {/* Payment Gateway & User Management */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Gateway & Users
            </h3>
            <div className="space-y-2">
                             {/* Primary User Actions */}
               {currentUser?._id === document.primary_user && (
                <>
                  <button
                    onClick={() => setShowUserManagement(true)}
                    className="w-full btn-primary inline-flex items-center justify-center"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Manage Users
                  </button>
                  
                  <button
                    onClick={() => navigate(`/document/${id}/payment`)}
                    className="w-full btn-secondary inline-flex items-center justify-center"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Manage Payments
                  </button>
                  {currentUser?._id === document.primary_user && document.status !== 'approved' && document.status !== 'finalized' && (
                    <button
                      onClick={handleApproveDocument}
                      disabled={isApproving}
                      className="w-full btn-secondary inline-flex items-center justify-center disabled:opacity-50 mt-2"
                    >
                      {isApproving ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {isApproving ? 'Approving...' : 'Approve Document'}
                    </button>
                  )}
                  {currentUser?._id === document.primary_user && (
                    <button
                      onClick={() => {
                        if (document.status !== 'approved') {
                          toast.error('Finalize is available after the document is approved.');
                          return;
                        }
                        if (window.confirm('Once finalized, you will not be able to edit this document anymore. Continue?')) {
                          handleAutoFinalize();
                        }
                      }}
                      disabled={isAutoFinalizing || document.status === 'finalized'}
                      className="w-full btn-primary inline-flex items-center justify-center disabled:opacity-50 mt-2"
                    >
                      {isAutoFinalizing ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      {document.status === 'finalized' ? 'Finalized' : (isAutoFinalizing ? 'Finalizing...' : 'Finalize Document')}
                    </button>
                  )}
                </>
              )}
              
                             {/* Secondary User Actions */}
               {currentUser?._id !== document.primary_user && document.involved_users.includes(currentUser?._id || '') && (
                <>
                  <button
                    onClick={() => navigate(`/document/${id}/payment`)}
                    className="w-full btn-primary inline-flex items-center justify-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Verify Payments
                  </button>
                  
                  <button
                    onClick={() => setShowUserManagement(true)}
                    className="w-full btn-secondary inline-flex items-center justify-center"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    View Users
                  </button>
                </>
              )}
              
                             {/* Join Document Button - Only for users not yet involved */}
               {!document.involved_users.includes(currentUser?._id || '') && (
                <button
                  onClick={() => navigate(`/join-document?code=${document.document_code}`)}
                  className="w-full btn-primary inline-flex items-center justify-center"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Join Document
                </button>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                                 {currentUser?._id === document.primary_user 
                   ? "Manage users and payment distribution for this document."
                   : "Verify payments and view document participants."
                 }
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="card">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={handlePreviewFinalPdf}
                disabled={isPreviewing}
                className="w-full btn-secondary inline-flex items-center justify-center disabled:opacity-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                {isPreviewing ? 'Opening...' : 'See Final PDF (Preview)'}
              </button>

              {document.involved_users.length > 1 && (
                <button
                  onClick={() => {
                                         const otherUserId = document.involved_users.find(id => id !== currentUser?._id);
                    if (otherUserId) navigate(`/chat/${otherUserId}`);
                  }}
                  className="w-full btn-secondary inline-flex items-center justify-center"
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat with Users
                </button>
              )}
              
              {document.status === 'finalized' && (
                <button
                  onClick={() => navigate('/wallet')}
                  className="w-full btn-primary inline-flex items-center justify-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Make Payment
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
              {/* User Management Modal */}
        {document && (
          <UserManagementModal
            isOpen={showUserManagement}
            onClose={() => setShowUserManagement(false)}
            documentId={id!}
            documentCode={document.document_code}
                         isPrimaryUser={currentUser?._id === document.primary_user}
            currentUsers={document.involved_users.map(userId => ({
              user_id: userId,
              char_id: userId, // We'll need to fetch actual char_id from users table
                             name: userId === currentUser?._id ? 'You' : `User ${userId.slice(0, 4)}...`,
              email: ''
            }))}
          />
        )}
    </div>
  );
};

export default DocumentView;
