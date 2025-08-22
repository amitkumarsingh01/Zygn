import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI } from '../services/api';
import { 
  Upload, 
  X, 
  FileText, 
  MapPin, 
  Calendar,
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

  // Debug: Monitor files state changes
  useEffect(() => {
    console.log('Files state changed:', files);
    console.log('Files types:', files.map(f => typeof f));
    console.log('Files constructors:', files.map(f => f.constructor.name));
    console.log('Files are File instances:', files.map(f => f instanceof File));
  }, [files]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    onDrop: (acceptedFiles) => {
      console.log('=== Dropzone onDrop Debug ===');
      console.log('Accepted files:', acceptedFiles);
      console.log('Accepted files length:', acceptedFiles.length);
      console.log('File types:', acceptedFiles.map(f => typeof f));
      console.log('File constructors:', acceptedFiles.map(f => f.constructor.name));
      
      // Ensure we're getting actual File objects and not dropzone file objects
      const validFiles = acceptedFiles.filter(file => {
        console.log('Checking dropzone file:', file);
        console.log('Dropzone file type:', typeof file);
        console.log('Dropzone file constructor:', file.constructor.name);
        console.log('Dropzone file is File instance:', file instanceof File);
        console.log('Dropzone file size:', file.size);
        
        // Check if it's a proper File object
        return file instanceof File && file.size > 0;
      }).map(file => {
        console.log('Processing dropzone file:', file);
        // Create a new File object to ensure it's a proper File instance
        // This handles cases where dropzone might wrap the file
        if (file instanceof File) {
          const newFile = new File([file], file.name, { 
            type: file.type,
            lastModified: file.lastModified 
          });
          console.log('Created new File object:', newFile);
          return newFile;
        }
        return file;
      });

      console.log('Valid dropzone files:', validFiles);
      console.log('Valid dropzone files length:', validFiles.length);

      if (validFiles.length !== acceptedFiles.length) {
        console.warn('Some files were not valid File objects');
        console.warn('Invalid files:', acceptedFiles.filter(f => !(f instanceof File)));
      }
      
      setFiles(prev => {
        const newFiles = [...prev, ...validFiles];
        console.log('Updated files state from dropzone:', newFiles);
        console.log('Updated files state length from dropzone:', newFiles.length);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      console.log('=== File Input Change Debug ===');
      console.log('FileList length:', e.target.files.length);
      console.log('FileList files:', fileList);
      
      // Ensure these are proper File objects
      const validFiles = fileList.filter(file => {
        console.log('Checking input file:', file);
        console.log('Input file type:', typeof file);
        console.log('Input file constructor:', file.constructor.name);
        console.log('Input file is File instance:', file instanceof File);
        console.log('Input file size:', file.size);
        
        const isValid = file instanceof File && file.size > 0;
        if (!isValid) {
          console.warn('Invalid input file found:', file);
        }
        return isValid;
      });
      
      console.log('Valid input files:', validFiles);
      console.log('Valid input files length:', validFiles.length);
      
      setFiles(prev => {
        const newFiles = [...prev, ...validFiles];
        console.log('Updated files state:', newFiles);
        console.log('Updated files state length:', newFiles.length);
        return newFiles;
      });
      
      // Clear the input
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Please enter a document name');
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
      // Send random value for thumb since it's optional
      formDataToSend.append('thumb', 'random_thumb_value');
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Create New Document</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          Upload your documents and set up the agreement details. Share the generated code with other parties to join.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
        {/* Basic Information */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <FileText className="h-5 w-5 mr-2 text-primary-600" />
            Basic Information
          </h2>
          
          <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Document Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="input-field mt-1"
                placeholder="e.g., Rental Agreement, Business Contract"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="e.g., New York, NY"
                />
              </div>
            </div>

            <div>
              <label htmlFor="start_date" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="start_date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleChange}
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="end_date" className="block text-sm font-medium text-gray-700">
                End Date
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="date"
                  id="end_date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleChange}
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Agreement with User Section */}
            <div className="col-span-1 sm:col-span-2 border-t pt-6 mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-4">Start Agreement with Another User (Optional)</h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="target_user_char_id" className="block text-medium text-gray-700">
                    8-Character User ID
                  </label>
                  <input
                    type="text"
                    id="target_user_char_id"
                    name="target_user_char_id"
                    value={formData.target_user_char_id}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="e.g., nGyOrdDx"
                    maxLength={8}
                  />
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-md">
                    <strong>Note:</strong> Daily rate is automatically set to <span className="font-semibold">1 coin per day</span>. 
                    Total days and amount will be calculated automatically based on your start and end dates.
                    <br />
                    <span className="text-xs text-gray-500 mt-1">
                      Example: 7-day agreement = 7 coins, 30-day agreement = 30 coins
                    </span>
                  </p>
                </div>
              </div>

              {formData.target_user_char_id && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Daily rate is automatically set to 1 coin per day. 
                    Total amount will be calculated automatically based on your start and end dates.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <Upload className="h-5 w-5 mr-2 text-primary-600" />
            Upload Documents
          </h2>

          {/* Simple file input as primary method */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Files
            </label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
              onChange={handleFileInputChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>

          {/* Drag and drop area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 sm:p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
            <div className="mt-4">
              <p className="text-base sm:text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop files here' : 'Or drag & drop files here'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Alternative upload method
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Supported formats: PDF, DOC, DOCX, PNG, JPG, JPEG
              </p>
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Uploaded Files ({files.length}):
              </h3>
              
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center min-w-0 flex-1">
                      <FileText className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="text-red-500 hover:text-red-700 ml-2 flex-shrink-0"
                      title="Remove file"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading || files.length === 0 || !formData.name.trim()}
            className="btn-primary inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <CheckCircle className="h-5 w-5 mr-2" />
            )}
            {isLoading ? 'Creating...' : 'Create Document'}
          </button>
        </div>
      </form>

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