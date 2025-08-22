import React from 'react';
import { X, AlertCircle, User, Camera, Fingerprint, Eye, FileText } from 'lucide-react';
import { ProfileCompletionStatus, getFieldDisplayName } from '../utils/profileCompletion';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteProfile: () => void;
  completionStatus: ProfileCompletionStatus;
}

const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen,
  onClose,
  onCompleteProfile,
  completionStatus
}) => {
  if (!isOpen) return null;

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'name':
      case 'email':
      case 'phone_no':
      case 'city':
      case 'state':
      case 'govt_id_type':
      case 'govt_id_number':
      case 'govt_id_image':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getFieldCategory = (field: string): string => {
    if (['name', 'email', 'phone_no', 'city', 'state', 'govt_id_type', 'govt_id_number', 'govt_id_image'].includes(field)) {
      return 'Basic Information';
    }
    return 'Other';
  };

  const groupedFields = completionStatus.missingFields.reduce((acc, field) => {
    const category = getFieldCategory(field);
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(field);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-orange-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              Complete Your Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Profile Completion</span>
              <span className="text-sm font-medium text-gray-900">
                {completionStatus.completionPercentage}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-orange-400 to-orange-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${completionStatus.completionPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-orange-800">
                  Basic Profile Information Required
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  You need to complete your basic profile information before you can create or join documents. 
                  Verification documents (photos, signatures, etc.) will be collected fresh for each document operation 
                  to ensure security and authenticity.
                </p>
              </div>
            </div>
          </div>

          {/* Missing Fields */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">
              Missing Information ({completionStatus.missingFields.length} items)
            </h3>
            
            {Object.entries(groupedFields).map(([category, fields]) => (
              <div key={category} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">{category}</h4>
                <div className="space-y-2">
                  {fields.map(field => (
                    <div key={field} className="flex items-center space-x-3 text-sm text-gray-600">
                      {getFieldIcon(field)}
                      <span>{getFieldDisplayName(field)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={onCompleteProfile}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          >
            Complete Profile
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileCompletionModal;
