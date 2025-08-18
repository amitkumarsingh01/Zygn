import { User } from '../types';

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
}

export const checkProfileCompletion = (user: User): ProfileCompletionStatus => {
  const requiredFields = [
    'name',
    'email', 
    'phone_no',
    'city',
    'state',
    'govt_id_type',
    'govt_id_number',
    'profile_pic',
    'signature_pic',
    'eye_pic',
    'fingerprint'
  ];

  const missingFields: string[] = [];
  
  requiredFields.forEach(field => {
    const value = user[field as keyof User];
    if (!value || value === '' || value === null || value === undefined) {
      missingFields.push(field);
    }
  });

  const completionPercentage = Math.round(((requiredFields.length - missingFields.length) / requiredFields.length) * 100);
  const isComplete = missingFields.length === 0;

  return {
    isComplete,
    missingFields,
    completionPercentage
  };
};

export const getFieldDisplayName = (field: string): string => {
  const fieldNames: Record<string, string> = {
    name: 'Full Name',
    email: 'Email Address',
    phone_no: 'Phone Number',
    city: 'City',
    state: 'State',
    govt_id_type: 'Government ID Type',
    govt_id_number: 'Government ID Number',
    profile_pic: 'Profile Picture',
    signature_pic: 'Signature',
    eye_pic: 'Eye Scan',
    fingerprint: 'Fingerprint'
  };
  
  return fieldNames[field] || field;
};
