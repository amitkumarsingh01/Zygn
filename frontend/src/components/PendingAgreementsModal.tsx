import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, FileText, User, Clock, AlertCircle, Camera, Fingerprint, PenTool, Eye } from 'lucide-react';
import { documentsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

interface PendingAgreement {
  _id: string;
  document_code: string;
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  primary_user: string;
  created_at: string;
  status: string;
}

interface PendingAgreementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgreementResponded: () => void;
}

const PendingAgreementsModal: React.FC<PendingAgreementsModalProps> = ({
  isOpen,
  onClose,
  onAgreementResponded
}) => {
  const [pendingAgreements, setPendingAgreements] = useState<PendingAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [respondingAgreements, setRespondingAgreements] = useState<Set<string>>(new Set());
  const [showAcceptForm, setShowAcceptForm] = useState<string | null>(null);
  const [verificationFiles, setVerificationFiles] = useState<{
    profile_pic?: File;
    thumb?: File;
    sign?: File;
    eye?: File;
  }>({});
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      fetchPendingAgreements();
    }
  }, [isOpen]);

  const fetchPendingAgreements = async () => {
    try {
      setIsLoading(true);
      const response = await documentsAPI.getMyDocuments();
      // Filter for pending agreements where current user is NOT the primary user (i.e., they are the target user)
      const pending = response.data.filter((doc: any) => 
        doc.status === 'pending' && 
        user?.user_id && 
        doc.primary_user !== user.user_id && 
        doc.involved_users.includes(user.user_id)
      );
      setPendingAgreements(pending);
    } catch (error: any) {
      console.error('Error fetching pending agreements:', error);
      toast.error('Failed to fetch pending agreements');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgreementResponse = async (documentId: string, response: 'accept' | 'reject') => {
    try {
      if (response === 'accept') {
        // Show accept form for verification documents
        setShowAcceptForm(documentId);
        return;
      }
      
      // Handle reject immediately
      await processAgreementResponse(documentId, 'reject');
    } catch (error: any) {
      console.error('Error responding to agreement:', error);
      let errorMessage = 'Failed to respond to agreement';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      toast.error(errorMessage);
    }
  };

  const handleFileChange = (field: string, file: File | null) => {
    if (file) {
      setVerificationFiles(prev => ({
        ...prev,
        [field]: file
      }));
    } else {
      setVerificationFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[field as keyof typeof newFiles];
        return newFiles;
      });
    }
  };

  const handleAcceptSubmit = async (documentId: string) => {
    try {
      // Validate all required files are present
      if (!verificationFiles.profile_pic || !verificationFiles.thumb || !verificationFiles.sign || !verificationFiles.eye) {
        toast.error('Please upload all required verification documents');
        return;
      }

      setRespondingAgreements(prev => new Set(prev).add(documentId));
      
      // Create FormData with response and files
      const formData = new FormData();
      formData.append('response', 'accept');
      formData.append('profile_pic', verificationFiles.profile_pic);
      formData.append('thumb', verificationFiles.thumb);
      formData.append('sign', verificationFiles.sign);
      formData.append('eye', verificationFiles.eye);
      
      await processAgreementResponse(documentId, 'accept', formData);
      
      // Reset form
      setShowAcceptForm(null);
      setVerificationFiles({});
      
    } catch (error: any) {
      console.error('Error accepting agreement:', error);
      let errorMessage = 'Failed to accept agreement';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      toast.error(errorMessage);
    } finally {
      setRespondingAgreements(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };

  const processAgreementResponse = async (documentId: string, response: 'accept' | 'reject', verificationFiles?: FormData) => {
    try {
      const result = await documentsAPI.respondToAgreement(documentId, response, verificationFiles);
      
      toast.success(result.data.message);
      
      // Remove the responded agreement from the list
      setPendingAgreements(prev => prev.filter(agreement => agreement._id !== documentId));
      
      // Notify parent component
      onAgreementResponded();
      
    } catch (error: any) {
      console.error('Error processing agreement response:', error);
      let errorMessage = 'Failed to process agreement response';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      toast.error(errorMessage);
      throw error; // Re-throw to be handled by caller
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'approved':
        return 'text-green-600 bg-green-100';
      case 'rejected':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'approved':
        return <CheckCircle className="h-4 w-4" />;
      case 'rejected':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pending Agreement Requests</h2>
            <p className="text-sm text-gray-600 mt-1">
              Review and respond to agreement requests from other users. 
              <span className="text-blue-600 font-medium"> Verification documents are required to accept agreements.</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : pendingAgreements.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending Agreements</h3>
            <p className="text-gray-500">
              You don't have any pending agreement requests at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingAgreements.map((agreement) => (
              <div key={agreement._id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="text-lg font-medium text-gray-900">{agreement.name}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agreement.status)}`}>
                        {getStatusIcon(agreement.status)}
                        <span className="ml-1 capitalize">{agreement.status}</span>
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span>Code: <span className="font-mono font-medium">{agreement.document_code}</span></span>
                      </div>
                      
                      {agreement.location && (
                        <div className="flex items-center space-x-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <span>Location: {agreement.location}</span>
                        </div>
                      )}
                      
                      {agreement.start_date && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>Start: {formatDate(agreement.start_date)}</span>
                        </div>
                      )}
                      
                      {agreement.end_date && (
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span>End: {formatDate(agreement.end_date)}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-3 text-xs text-gray-500">
                      Requested on: {formatDate(agreement.created_at)}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex flex-col space-y-2 ml-4">
                    <button
                      onClick={() => handleAgreementResponse(agreement._id, 'accept')}
                      disabled={respondingAgreements.has(agreement._id)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {respondingAgreements.has(agreement._id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Accept
                    </button>
                    
                    <button
                      onClick={() => handleAgreementResponse(agreement._id, 'reject')}
                      disabled={respondingAgreements.has(agreement._id)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {respondingAgreements.has(agreement._id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <XCircle className="h-4 w-4 mr-2" />
                      )}
                      Reject
                    </button>
                  </div>
                </div>

                {/* Verification Documents Upload Form */}
                {showAcceptForm === agreement._id && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-3">
                      Upload Verification Documents to Accept Agreement
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Profile Picture */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Camera className="inline h-4 w-4 mr-1" />
                          Profile Picture/Selfie *
                          {verificationFiles.profile_pic && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Uploaded
                            </span>
                          )}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange('profile_pic', e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>

                      {/* Fingerprint */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Fingerprint className="inline h-4 w-4 mr-1" />
                          Fingerprint Scan *
                          {verificationFiles.thumb && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Uploaded
                            </span>
                          )}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange('thumb', e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>

                      {/* Signature */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <PenTool className="inline h-4 w-4 mr-1" />
                          Signature Image *
                          {verificationFiles.sign && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Uploaded
                            </span>
                          )}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange('sign', e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>

                      {/* Eye Scan */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <Eye className="inline h-4 w-4 mr-1" />
                          Eye Scan *
                          {verificationFiles.eye && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              ✓ Uploaded
                            </span>
                          )}
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange('eye', e.target.files?.[0] || null)}
                          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => handleAcceptSubmit(agreement._id)}
                        disabled={respondingAgreements.has(agreement._id)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {respondingAgreements.has(agreement._id) ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        ) : (
                          <CheckCircle className="h-4 w-4 mr-2" />
                        )}
                        Submit & Accept
                      </button>
                      
                      <button
                        onClick={() => {
                          setShowAcceptForm(null);
                          setVerificationFiles({});
                        }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-6 border-t mt-6">
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

export default PendingAgreementsModal;
