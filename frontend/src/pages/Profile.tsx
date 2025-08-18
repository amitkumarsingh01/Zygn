import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usersAPI } from '../services/api';
import { 
  User, 
  Camera, 
  Upload, 
  Save,
  X,
  Eye,
  Fingerprint
} from 'lucide-react';
import toast from 'react-hot-toast';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_no: '',
    city: '',
    state: '',
    govt_id_type: '',
    govt_id_number: ''
  });
  const [uploadedFiles, setUploadedFiles] = useState<{
    profile_pic?: File;
    signature_pic?: File;
    eye_pic?: File;
    fingerprint?: File;
  }>({});

  useEffect(() => {
    if (user) {
      // If user has empty name/email, fetch full profile
      if (!user.name || !user.email) {
        fetchFullProfile();
      } else {
        setFormData({
          name: user.name || '',
          email: user.email || '',
          phone_no: user.phone_no || '',
          city: user.city || '',
          state: user.state || '',
          govt_id_type: user.govt_id_type || '',
          govt_id_number: user.govt_id_number || ''
        });
      }
    }
  }, [user]);

  // Update form data whenever user data changes (e.g., from sidebar refresh)
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone_no: user.phone_no || '',
        city: user.city || '',
        state: user.state || '',
        govt_id_type: user.govt_id_type || '',
        govt_id_number: user.govt_id_number || ''
      });
    }
  }, [user]);



  const fetchFullProfile = async () => {
    setIsFetchingProfile(true);
    try {
      const response = await usersAPI.getProfile();
      const fullUser = response.data;
      
      console.log('=== Full Profile Data Received ===');
      console.log('Full user data:', fullUser);
      console.log('govt_id_type:', fullUser.govt_id_type);
      console.log('govt_id_number:', fullUser.govt_id_number);
      
      // Update form data with full profile
      setFormData({
        name: fullUser.name || '',
        email: fullUser.email || '',
        phone_no: fullUser.phone_no || '',
        city: fullUser.city || '',
        state: fullUser.state || '',
        govt_id_type: fullUser.govt_id_type || '',
        govt_id_number: fullUser.govt_id_number || ''
      });
      
      console.log('=== Form Data Updated ===');
      console.log('Updated formData:', {
        name: fullUser.name || '',
        email: fullUser.email || '',
        phone_no: fullUser.phone_no || '',
        city: fullUser.city || '',
        state: fullUser.state || '',
        govt_id_type: fullUser.govt_id_type || '',
        govt_id_number: fullUser.govt_id_number || ''
      });
      
      toast.success('Profile refreshed successfully!');
    } catch (error: any) {
      console.error('Failed to fetch full profile:', error);
      let errorMessage = 'Failed to fetch profile';
      if (error.response?.data) {
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsFetchingProfile(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (field: string, file: File) => {
    setUploadedFiles(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const removeFile = (field: string) => {
    setUploadedFiles(prev => {
      const newFiles = { ...prev };
      delete newFiles[field as keyof typeof newFiles];
      return newFiles;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formDataToSend = new FormData();
      
      // Add text fields
      Object.entries(formData).forEach(([key, value]) => {
        formDataToSend.append(key, value);
        console.log(`Adding field: ${key} = ${value}`);
      });

      // Add files
      Object.entries(uploadedFiles).forEach(([key, file]) => {
        if (file) {
          formDataToSend.append(key, file);
          console.log(`Adding file: ${key} = ${file.name}`);
        }
      });

      console.log('=== FormData being sent ===');
      console.log('FormData entries:', Array.from(formDataToSend.entries()));
      
      await updateUser(formDataToSend);
      setIsEditing(false);
      setUploadedFiles({});
      
      // Refresh the profile data after update
      fetchFullProfile();
    } catch (error) {
      console.error('Profile update error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilePreview = (field: string) => {
    const file = uploadedFiles[field as keyof typeof uploadedFiles];
    if (file) {
      console.log(`getFilePreview: Using uploaded file for ${field}:`, file.name);
      return URL.createObjectURL(file);
    }
    
    // If user has a stored image path, construct the full backend URL
    const imagePath = user?.[field as keyof typeof user] as string;
    console.log(`getFilePreview: Checking ${field}, imagePath:`, imagePath);
    console.log(`getFilePreview: user object:`, user);
    
    if (imagePath && imagePath.startsWith('/uploads/')) {
      const fullUrl = `https://zygn.iaks.site${imagePath}`;
      console.log(`getFilePreview: Constructed full URL for ${field}:`, fullUrl);
      return fullUrl;
    }
    
    console.log(`getFilePreview: No valid image path for ${field}, returning:`, imagePath);
    return imagePath;
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
            <p className="mt-2 text-gray-600">
              Manage your personal information and verification documents.
            </p>
          </div>
          {isFetchingProfile && (
            <div className="flex items-center text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600 mr-2"></div>
              Refreshing profile...
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900 flex items-center">
              <User className="h-5 w-5 mr-2 text-primary-600" />
              Basic Information
            </h2>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={fetchFullProfile}
                disabled={isFetchingProfile}
                className="btn-secondary"
                title="Refresh profile data"
              >
                {isFetchingProfile ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="btn-secondary"
              >
                {isEditing ? 'Cancel' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="phone_no" className="block text-sm font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone_no"
                name="phone_no"
                value={formData.phone_no}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                City
              </label>
              <input
                type="text"
                id="city"
                name="city"
                value={formData.city}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                State
              </label>
              <input
                type="text"
                id="state"
                name="state"
                value={formData.state}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="govt_id_type" className="block text-sm font-medium text-gray-700">
                Government ID Type
              </label>
              <select
                id="govt_id_type"
                name="govt_id_type"
                value={formData.govt_id_type}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">Select ID Type</option>
                <option value="Aadhar">Aadhar Card</option>
                <option value="PAN">PAN Card</option>
                <option value="Passport">Passport</option>
                <option value="Driving License">Driving License</option>
                <option value="Voter ID">Voter ID</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="govt_id_number" className="block text-sm font-medium text-gray-700">
                Government ID Number
              </label>
              <input
                type="text"
                id="govt_id_number"
                name="govt_id_number"
                value={formData.govt_id_number}
                onChange={handleChange}
                disabled={!isEditing}
                className="input-field mt-1 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>
        </div>

        {/* Verification Documents */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <Camera className="h-5 w-5 mr-2 text-primary-600" />
            Verification Documents
          </h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Profile Picture */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Profile Picture
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <img
                    src={getFilePreview('profile_pic') || '/default-avatar.png'}
                    alt="Profile"
                    className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                  />
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-1 cursor-pointer hover:bg-primary-700">
                      <Camera className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileChange('profile_pic', e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1">
                  {uploadedFiles.profile_pic && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{uploadedFiles.profile_pic.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile('profile_pic')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  {isEditing && (
                    <p className="text-xs text-gray-500">Click the camera icon to upload</p>
                  )}
                </div>
              </div>
            </div>

            {/* Signature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Signature
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {getFilePreview('signature_pic') ? (
                    <img
                      src={getFilePreview('signature_pic')}
                      alt="Signature"
                      className="h-20 w-32 object-contain border-2 border-gray-200 rounded"
                    />
                  ) : (
                    <div className="h-20 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <span className="text-gray-400 text-xs">No signature</span>
                    </div>
                  )}
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-1 cursor-pointer hover:bg-primary-700">
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileChange('signature_pic', e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1">
                  {uploadedFiles.signature_pic && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{uploadedFiles.signature_pic.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile('signature_pic')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Eye Scan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Eye Scan
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {getFilePreview('eye_pic') ? (
                    <img
                      src={getFilePreview('eye_pic')}
                      alt="Eye Scan"
                      className="h-20 w-20 object-cover border-2 border-gray-200 rounded"
                    />
                  ) : (
                    <div className="h-20 w-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <Eye className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-1 cursor-pointer hover:bg-primary-700">
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileChange('eye_pic', e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1">
                  {uploadedFiles.eye_pic && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{uploadedFiles.eye_pic.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile('eye_pic')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Fingerprint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fingerprint
              </label>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {getFilePreview('fingerprint') ? (
                    <img
                      src={getFilePreview('fingerprint')}
                      alt="Fingerprint"
                      className="h-20 w-20 object-cover border-2 border-gray-200 rounded"
                    />
                  ) : (
                    <div className="h-20 w-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
                      <Fingerprint className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  {isEditing && (
                    <label className="absolute bottom-0 right-0 bg-primary-600 text-white rounded-full p-1 cursor-pointer hover:bg-primary-700">
                      <Upload className="h-4 w-4" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleFileChange('fingerprint', e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <div className="flex-1">
                  {uploadedFiles.fingerprint && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">{uploadedFiles.fingerprint.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFile('fingerprint')}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        {isEditing && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary inline-flex items-center"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              ) : (
                <Save className="h-5 w-5 mr-2" />
              )}
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default Profile;
