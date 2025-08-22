import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI } from '../services/api';
import { ArrowLeft, Users, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { checkProfileCompletion } from '../utils/profileCompletion';
import DocumentVerificationModal from '../components/DocumentVerificationModal';

const DocumentJoin: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [documentCode, setDocumentCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  // Check basic profile completion on component mount
  useEffect(() => {
    if (user) {
      const completionStatus = checkProfileCompletion(user);
      if (!completionStatus.isComplete) {
        toast.error('Please complete your basic profile information first');
        navigate('/profile');
        return;
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!documentCode.trim()) {
      toast.error('Please enter a document code');
      return;
    }

    // Check basic profile completion before proceeding
    if (user) {
      const completionStatus = checkProfileCompletion(user);
      if (!completionStatus.isComplete) {
        toast.error('Please complete your basic profile information first');
        navigate('/profile');
        return;
      }
    }

    // Show verification modal to collect fresh verification documents
    setShowVerificationModal(true);
  };

  const handleVerificationComplete = async (verificationData: any) => {
    setShowVerificationModal(false);
    
    // Now proceed with document joining
    await joinDocumentWithVerification(verificationData);
  };

  const joinDocumentWithVerification = async (verificationData: any) => {
    setIsLoading(true);
    try {
      // Create FormData for document joining with verification
      const formDataToSend = new FormData();
      formDataToSend.append('document_code', documentCode);
      
      // Add verification documents
      if (verificationData.profile_pic) {
        formDataToSend.append('profile_pic', verificationData.profile_pic);
      }
      // Send random value for thumb since it's optional
      formDataToSend.append('thumb', 'random_thumb_value');
      if (verificationData.sign) {
        formDataToSend.append('sign', verificationData.sign);
      }
      if (verificationData.eye) {
        formDataToSend.append('eye', verificationData.eye);
      }

      await documentsAPI.joinDocument(formDataToSend);
      toast.success('Join request sent successfully! Waiting for approval.');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Join document error:', error);
      
      // Handle different error response formats
      let errorMessage = 'Failed to join document';
      
      if (error.response?.data) {
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data.map((err: any) => err.msg || err.message).join(', ');
        } else if (typeof error.response.data === 'object') {
          errorMessage = Object.values(error.response.data).join(', ');
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Join Document</h1>
        <p className="mt-2 text-gray-600">
          Enter the document code shared by another user to join their agreement.
        </p>
      </div>

      <div className="card">
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Enter Document Code</h2>
          <p className="text-gray-600 mt-2">
            You'll need the document code from the person who created the agreement.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="documentCode" className="block text-sm font-medium text-gray-700 mb-2">
              Document Code
            </label>
            <div className="relative">
              <input
                type="text"
                id="documentCode"
                value={documentCode}
                onChange={(e) => setDocumentCode(e.target.value.toUpperCase())}
                className="input-field text-center text-lg font-mono tracking-widest"
                placeholder="ABCD1234"
                maxLength={8}
                required
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  type="button"
                  onClick={() => copyToClipboard(documentCode)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Copy to clipboard"
                >
                  {/* <Copy className="h-5 w-5" /> */}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The code is usually 8 characters long (e.g., ABCD1234)
            </p>
          </div>

          <button
            type="submit"
            disabled={isLoading || !documentCode.trim()}
            className="w-full btn-primary inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            {isLoading ? 'Joining...' : 'Join Document'}
          </button>
        </form>

        {/* Help Section */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            {/* <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" /> */}
            How to join a document
          </h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>1. Ask the document creator for their document code</p>
            <p>2. Enter the code in the field above</p>
            <p>3. Click "Join Document" to send a request</p>
            <p>4. Wait for the primary user to approve your request</p>
            <p>5. Once approved, you'll see the document in your dashboard</p>
          </div>
        </div>

        {/* Example Codes */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Example Document Codes:</h4>
          <div className="flex flex-wrap gap-2">
            {['ABCD1234', 'EFGH5678', 'IJKL9012'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setDocumentCode(code)}
                className="px-3 py-1 bg-white border border-gray-300 rounded-md text-sm font-mono text-gray-700 hover:bg-gray-50 hover:border-primary-300 transition-colors"
              >
                {code}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Click any example code to fill it in (for testing purposes)
          </p>
        </div>
      </div>

      {/* Additional Actions */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have a document code?{' '}
          <button
            onClick={() => navigate('/document/create')}
            className="text-primary-600 hover:text-primary-500 font-medium"
          >
            Create your own document
          </button>
        </p>
      </div>

      {/* Document Verification Modal */}
      <DocumentVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onComplete={handleVerificationComplete}
        documentType="join"
      />
    </div>
  );
};

export default DocumentJoin;
