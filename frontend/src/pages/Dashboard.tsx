import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI } from '../services/api';
import { Document } from '../types';
import { 
  Plus, 
  Users, 
  FileText, 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Eye,
  MessageCircle,
  CreditCard,
  User,
  DollarSign,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { checkProfileCompletion } from '../utils/profileCompletion';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const response = await documentsAPI.getMyDocuments();
      setDocuments(response.data);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Completion Banner */}
      {user && (() => {
        const completionStatus = checkProfileCompletion(user);
        if (!completionStatus.isComplete) {
          return (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-orange-800">
                    Complete Your Profile
                  </h3>
                  <p className="text-sm text-orange-700 mt-1">
                    Your profile is {completionStatus.completionPercentage}% complete. 
                    You need to complete your profile before creating or joining documents.
                  </p>
                  <div className="mt-3">
                    <Link
                      to="/profile"
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                    >
                      Complete Profile
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Welcome back, {user?.name}! Here's an overview of your documents and agreements.
          </p>
        </div>
                 <div className="mt-4 sm:mt-0 flex space-x-3">
           {/* <button
             onClick={fetchDocuments}
             disabled={isLoading}
             className="btn-secondary inline-flex items-center"
           >
             {isLoading ? (
               <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
             ) : (
               <FileText className="h-4 w-4 mr-2" />
             )}
             {isLoading ? 'Refreshing...' : 'Refresh'}
           </button> */}
           
           <Link
             to="/document/create"
             className="btn-primary inline-flex items-center"
           >
             <Plus className="h-4 w-4 mr-2" />
             Create Document
           </Link>
           
           <Link
             to="/document/join"
             className="btn-secondary inline-flex items-center"
           >
             <Users className="h-4 w-4 mr-2" />
             Join Document
           </Link>
         </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Documents</p>
              <p className="text-2xl font-semibold text-gray-900">{documents.length}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Approved</p>
              <p className="text-2xl font-semibold text-gray-900">
                {documents.filter(doc => doc.status === 'approved').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-semibold text-gray-900">
                {documents.filter(doc => doc.status === 'pending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Finalized</p>
              <p className="text-2xl font-semibold text-gray-900">
                {documents.filter(doc => doc.status === 'finalized').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/chat"
          className="card hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
              <MessageCircle className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Chats</h3>
            <p className="text-xs text-gray-500 mt-1">Connect with other users</p>
          </div>
        </Link>

        <Link
          to="/wallet"
          className="card hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
              <CreditCard className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Wallet</h3>
            <p className="text-xs text-gray-500 mt-1">Manage your funds</p>
          </div>
        </Link>

        <Link
          to="/profile"
          className="card hover:shadow-md transition-shadow cursor-pointer group"
        >
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-200 transition-colors">
              <User className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Profile</h3>
            <p className="text-xs text-gray-500 mt-1">Update your information</p>
          </div>
        </Link>



        <div className="card hover:shadow-md transition-shadow cursor-pointer group">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900">Payment Gateway</h3>
            <p className="text-xs text-gray-500 mt-1">Manage document payments</p>
            <p className="text-xs text-gray-400 mt-1">Click on any document</p>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="card">
                 <div className="flex items-center justify-between mb-6">
           <h2 className="text-lg font-medium text-gray-900">All Documents</h2>
           <div className="text-sm text-gray-500">
             Showing {documents.length} document{documents.length !== 1 ? 's' : ''}
           </div>
         </div>

        {documents.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first document or joining an existing one.
            </p>
            <div className="mt-6">
              <Link
                to="/document/create"
                className="btn-primary inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Document
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                                 {documents.map((document) => (
                  <tr key={document._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {document.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          Code: {document.document_code}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(document.status)}`}>
                        {getStatusIcon(document.status)}
                        <span className="ml-1 capitalize">{document.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/document/${document._id}/payment`}
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-blue-600 bg-blue-100 hover:bg-blue-200"
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Manage
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {document.location || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(document.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link
                          to={`/document/${document._id}`}
                          className="text-primary-600 hover:text-primary-900"
                          title="View Document"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {document.involved_users.length > 1 && (
                          <Link
                            to={`/chat/${document.involved_users.find(id => id !== user?.user_id)}`}
                            className="text-primary-600 hover:text-primary-900"
                            title="Chat"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
