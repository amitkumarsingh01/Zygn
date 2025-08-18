import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  DollarSign, 
  Settings, 
  ArrowLeft,
  Edit,
  Save,
  X
} from 'lucide-react';

interface PricingConfig {
  daily_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  created_by_name?: string;
  updated_by_name?: string;
}

const PricingManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [newDailyRate, setNewDailyRate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPricing();
  }, []);

  const fetchPricing = async () => {
    try {
      setIsLoading(true);
      const response = await documentsAPI.getPricing();
      setPricing(response.data);
      setNewDailyRate(response.data.daily_rate.toString());
    } catch (error: any) {
      console.error('Error fetching pricing:', error);
      toast.error('Failed to fetch pricing configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!newDailyRate || parseFloat(newDailyRate) <= 0) {
      toast.error('Please enter a valid daily rate');
      return;
    }

    setIsSaving(true);
    try {
      const dailyRate = parseFloat(newDailyRate);
      
      if (pricing) {
        // Update existing pricing
        await documentsAPI.updatePricing({ daily_rate: dailyRate });
        toast.success('Pricing updated successfully');
      } else {
        // Create new pricing
        await documentsAPI.createPricing({ daily_rate: dailyRate });
        toast.success('Pricing created successfully');
      }
      
      setIsEditing(false);
      fetchPricing();
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      let errorMessage = 'Failed to save pricing';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setNewDailyRate(pricing?.daily_rate.toString() || '');
  };

  // No admin check needed - any authenticated user can access

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Pricing Management</h1>
        <p className="mt-2 text-gray-600">
          Manage the daily rate for document agreements. This rate will be applied to all new documents. Any authenticated user can modify these settings.
        </p>
      </div>

      {/* Current Pricing */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-primary-600" />
            Current Pricing Configuration
          </h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </button>
          )}
        </div>

                 {!isEditing ? (
           <div className="space-y-4">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div>
                 <p className="text-sm font-medium text-gray-500">Daily Rate</p>
                 <p className="text-2xl font-bold text-gray-900">{pricing?.daily_rate || 1.0} Coins</p>
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500">Status</p>
                 <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                   pricing?.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                 }`}>
                   {pricing?.is_active ? 'Active' : 'Inactive'}
                 </span>
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500">Last Updated</p>
                 <p className="text-sm text-gray-900">
                   {pricing?.updated_at ? new Date(pricing.updated_at).toLocaleDateString() : 'Never'}
                 </p>
               </div>
             </div>
             
             {/* User tracking information */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
               <div>
                 <p className="text-sm font-medium text-gray-500">Created By</p>
                 <p className="text-sm text-gray-900">
                   {pricing?.created_by_name || 'Unknown'} 
                   <span className="text-xs text-gray-500 ml-2">
                     {pricing?.created_at ? new Date(pricing.created_at).toLocaleDateString() : ''}
                   </span>
                 </p>
               </div>
               <div>
                 <p className="text-sm font-medium text-gray-500">Last Updated By</p>
                 <p className="text-sm text-gray-900">
                   {pricing?.updated_by_name || 'Unknown'}
                   <span className="text-xs text-gray-500 ml-2">
                     {pricing?.updated_at ? new Date(pricing.updated_at).toLocaleDateString() : ''}
                   </span>
                 </p>
               </div>
             </div>
           </div>
         ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="daily_rate" className="block text-sm font-medium text-gray-700 mb-2">
                Daily Rate (Coins per day)
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  id="daily_rate"
                  value={newDailyRate}
                  onChange={(e) => setNewDailyRate(e.target.value)}
                  className="flex-1 input-field"
                  min="0.01"
                  step="0.01"
                  placeholder="Enter daily rate"
                />
                <span className="text-gray-500">coins/day</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                This rate will be applied to all new document agreements.
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pricing Examples */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Examples</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">1 Day Agreement</p>
            <p className="text-2xl font-bold text-primary-600">
              {(pricing?.daily_rate || 1.0) * 1} Coins
            </p>
            <p className="text-xs text-gray-500">1 day × {(pricing?.daily_rate || 1.0)} coins/day</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">7 Day Agreement</p>
            <p className="text-2xl font-bold text-primary-600">
              {(pricing?.daily_rate || 1.0) * 7} Coins
            </p>
            <p className="text-xs text-gray-500">7 days × {(pricing?.daily_rate || 1.0)} coins/day</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-900">30 Day Agreement</p>
            <p className="text-2xl font-bold text-primary-600">
              {(pricing?.daily_rate || 1.0) * 30} Coins
            </p>
            <p className="text-xs text-gray-500">30 days × {(pricing?.daily_rate || 1.0)} coins/day</p>
          </div>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <Settings className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How it works</h3>
                         <div className="mt-2 text-sm text-blue-700">
               <p>• The daily rate is automatically applied to all new document agreements</p>
               <p>• Total amount is calculated as: Daily Rate × Number of Days</p>
               <p>• Changes only affect new documents, existing documents remain unchanged</p>
               <p>• Any authenticated user can modify pricing settings</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingManagement;
