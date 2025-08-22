import { User } from '../types';

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  completionPercentage: number;
}

export const checkProfileCompletion = (user: User): ProfileCompletionStatus => {
  // Only check basic information fields, not verification documents
  // Verification documents should be provided fresh for each document operation
  const requiredFields = [
    'name',
    'email', 
    'phone_no',
    'city',
    'state',
    'govt_id_type',
    'govt_id_number',
    'govt_id_image'
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
    govt_id_image: 'Government ID Image'
  };
  
  return fieldNames[field] || field;
};
