import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI } from '../services/api';
import { 
  Upload, 
  X, 
  FileText, 
  ArrowLeft,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { checkProfileCompletion } from '../utils/profileCompletion';
import DocumentVerificationModal from '../components/DocumentVerificationModal';

const DocumentCreate: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    start_date: '',
    end_date: '',
    target_user_char_id: ''
  });
  const [files, setFiles] = useState<File[]>([]);

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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    onDrop: (acceptedFiles) => {
      // Ensure we're getting actual File objects and not dropzone file objects
      const validFiles = acceptedFiles.filter(file => {
        // Check if it's a proper File object
        return file instanceof File && file.size > 0;
      }).map(file => {
        // Create a new File object to ensure it's a proper File instance
        // This handles cases where dropzone might wrap the file
        if (file instanceof File) {
          const newFile = new File([file], file.name, { 
            type: file.type,
            lastModified: file.lastModified 
          });
          return newFile;
        }
        return file;
      });
      
      setFiles(prev => {
        const newFiles = [...prev, ...validFiles];
        return newFiles;
      });
    },
    noClick: false,
    noDrag: false,
    multiple: true
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter a document name');
      return;
    }
    
    if (!formData.target_user_char_id.trim()) {
      toast.error('Please enter a target user ID to create an agreement');
      return;
    }
    
    if (files.length === 0) {
      toast.error('Please upload at least one document');
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
    
    // Now proceed with document creation
    await createDocumentWithVerification(verificationData);
  };

  const createDocumentWithVerification = async (verificationData: any) => {
    setIsLoading(true);
    try {
      // Create FormData for document creation
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name.trim());
      if (formData.location.trim()) {
        formDataToSend.append('location', formData.location.trim());
      }
      if (formData.start_date) {
        formDataToSend.append('start_date', formData.start_date);
      }
      if (formData.end_date) {
        formDataToSend.append('end_date', formData.end_date);
      }
      
      // Add verification documents
      if (verificationData.profile_pic) {
        formDataToSend.append('profile_pic', verificationData.profile_pic);
      }
      // thumb is optional and not required, so we don't send it
      if (verificationData.sign) {
        formDataToSend.append('sign', verificationData.sign);
      }
      if (verificationData.eye) {
        formDataToSend.append('eye', verificationData.eye);
      }
      
      // Add document files
      files.forEach((file) => {
        formDataToSend.append('raw_documents', file);
      });

      let response;
      
      // Check if this is an agreement initiation
      if (formData.target_user_char_id.trim()) {
        // Call the agreement initiation API
        response = await documentsAPI.initiateAgreement({
          target_user_char_id: formData.target_user_char_id.trim(),
          name: formData.name.trim(),
          location: formData.location.trim() || undefined
        });
        
        toast.success('Agreement initiated successfully!');
        toast.success(`Document Code: ${response.data.document_code}`, {
          duration: 6000,
          icon: '🤝',
        });
        
        // Navigate to the created document
        navigate(`/document/${response.data.document_id}`);
      } else {
        // Regular document creation
        response = await documentsAPI.createDocument(formDataToSend);
        toast.success('Document created successfully!');
        
        // Show success message with document code
        toast.success(`Document Code: ${response.data.document_code}`, {
          duration: 6000,
          icon: '📄',
        });
        
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Document creation error:', error);
      
      // Handle different error response formats
      let errorMessage = 'Failed to create document';
      
      if (error.response?.data) {
        if (error.response.data.detail) {
          if (Array.isArray(error.response.data.detail)) {
            // Handle pydantic validation errors
            errorMessage = error.response.data.detail
              .map((err: any) => `${err.loc?.join('.')}: ${err.msg}`)
              .join(', ');
          } else {
            errorMessage = error.response.data.detail;
          }
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (Array.isArray(error.response.data)) {
          // Handle validation errors array
          errorMessage = error.response.data.map((err: any) => err.msg || err.message).join(', ');
        } else if (typeof error.response.data === 'object') {
          // Handle object error responses
          errorMessage = Object.values(error.response.data).join(', ');
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-10">
          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800 mb-6 transition-colors duration-200"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </button>
          
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Create New Agreement
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Create an agreement with another user by uploading your documents and specifying their user ID.
            </p>
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Document Details Section */}
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-primary-600" />
                  Document Details
                </h2>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700">
                    Document Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                    placeholder="e.g., Rental Agreement, Service Contract"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="location" className="block text-sm font-semibold text-gray-700">
                    Location <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="location"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                    placeholder="e.g., Mumbai, Maharashtra"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="start_date" className="block text-sm font-semibold text-gray-700">
                    Start Date <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    id="start_date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="end_date" className="block text-sm font-semibold text-gray-700">
                    End Date <span className="text-gray-400 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    id="end_date"
                    name="end_date"
                    value={formData.end_date}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200"
                  />
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <Upload className="h-5 w-5 mr-2 text-primary-600" />
                  Upload Documents <span className="text-red-500">*</span>
                </h2>
              </div>

              {/* Enhanced Drag and Drop Area */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-primary-400 bg-primary-50 scale-105'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50 hover:scale-[1.02]'
                }`}
              >
                <input {...getInputProps()} />
                <div className="space-y-4">
                  <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-200 ${
                    isDragActive ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <Upload className={`h-8 w-8 transition-colors duration-200 ${
                      isDragActive ? 'text-primary-600' : 'text-gray-400'
                    }`} />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-gray-900">
                      {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                    </p>
                    <p className="text-gray-600">
                      Or click to browse files
                    </p>
                    <p className="text-sm text-gray-500">
                      Supported: PDF, DOC, DOCX, PNG, JPG, JPEG
                    </p>
                  </div>
                </div>
              </div>

              {/* Enhanced File List */}
              {files.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-primary-600" />
                    Uploaded Files ({files.length})
                  </h3>
                  
                  <div className="space-y-3">
                    {files.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 hover:border-primary-300 transition-all duration-200"
                      >
                        <div className="flex items-center min-w-0 flex-1">
                          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                            <FileText className="h-5 w-5 text-primary-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="ml-4 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 flex-shrink-0"
                          title="Remove file"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Agreement Section */}
            <div className="space-y-6">
              <div className="border-b border-gray-200 pb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <CheckCircle className="h-5 w-5 mr-2 text-primary-600" />
                  Agreement Details
                </h2>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="target_user_char_id" className="block text-sm font-semibold text-gray-700">
                    8-Character User ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="target_user_char_id"
                    name="target_user_char_id"
                    value={formData.target_user_char_id}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 font-mono text-lg"
                    placeholder="e.g., nGyOrdDx"
                    maxLength={8}
                    required
                  />
                  <p className="text-sm text-gray-600">
                    Enter the 8-character user ID of the person you want to create an agreement with
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isLoading || files.length === 0 || !formData.name.trim() || !formData.target_user_char_id.trim()}
                className="px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-primary-800 focus:ring-4 focus:ring-primary-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:transform-none inline-flex items-center"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                ) : (
                  <CheckCircle className="h-5 w-5 mr-3" />
                )}
                {isLoading ? 'Creating Agreement...' : 'Create Agreement'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Document Verification Modal */}
      <DocumentVerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onComplete={handleVerificationComplete}
        documentType="create"
      />
    </div>
  );
};

export default DocumentCreate;