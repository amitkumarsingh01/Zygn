import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI, usersAPI } from '../services/api';
import { Document, User } from '../types';
import { 
  MessageCircle, 
  Plus, 
  Search,
  User as UserIcon,
  FileText,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';

const ChatList: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    
    try {
      const [documentsResponse, usersResponse] = await Promise.all([
        documentsAPI.getMyDocuments(),
        usersAPI.getAllUsers()
      ]);
      
      // Filter out current user and get users from documents
      const documentUsers = documentsResponse.data.flatMap(doc => 
        doc.involved_users.filter(userId => userId !== currentUser?.user_id)
      );
      
      // Get unique users from documents
      const uniqueUserIds = [...new Set(documentUsers)];
      const documentUsersData = usersResponse.data.filter(user => 
        uniqueUserIds.includes(user.user_id)
      );
      
      setDocuments(documentsResponse.data);
      setUsers(documentUsersData);
      
      if (isRefresh) {
        toast.success('Chats refreshed successfully');
      }
    } catch (error) {
      console.error('Error fetching chat data:', error);
      toast.error('Failed to load chats');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const startChat = (userId: string) => {
    navigate(`/chat/${userId}`);
  };

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone_no?.includes(searchTerm)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Chats</h1>
        <p className="mt-2 text-gray-600">
          Connect with other users involved in your documents.
        </p>
      </div>

      {/* Search and Refresh */}
      <div className="mb-6 flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={isRefreshing}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh chats"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Start New Chat */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/document/join')}
          className="btn-primary inline-flex items-center"
        >
          <Plus className="h-4 w-4 mr-2" />
          Start New Chat
        </button>
        <p className="text-sm text-gray-500 mt-2">
          Join a document to start chatting with other users.
        </p>
      </div>

      {/* Chat List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No chats available</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'No users found matching your search.' : 'You need to be involved in documents with other users to start chatting.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => navigate('/document/join')}
                className="mt-4 btn-primary inline-flex items-center"
              >
                <Plus className="h-4 w-4 mr-2" />
                Join a Document
              </button>
            )}
          </div>
        ) : (
          filteredUsers.map((user) => {
            // Find documents where both users are involved
            const sharedDocuments = documents.filter(doc => 
              doc.involved_users.includes(user.user_id) && 
              doc.involved_users.includes(currentUser?.user_id || '')
            );

            return (
              <div
                key={user.user_id}
                className="card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => startChat(user.user_id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-primary-600">
                        {user.name?.charAt(0).toUpperCase() || user.char_id?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">
                        {user.name || `User ${user.char_id}`}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {user.email || user.phone_no}
                      </p>
                      {sharedDocuments.length > 0 && (
                        <div className="flex items-center mt-1">
                          <FileText className="h-4 w-4 text-gray-400 mr-1" />
                          <span className="text-xs text-gray-500">
                            {sharedDocuments.length} shared document{sharedDocuments.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
        <div className="flex space-x-4">
          <button
            onClick={() => navigate('/document/create')}
            className="btn-secondary inline-flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New Document
          </button>
          <button
            onClick={() => navigate('/document/join')}
            className="btn-secondary inline-flex items-center"
          >
            <UserIcon className="h-4 w-4 mr-2" />
            Join Document
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatList;
