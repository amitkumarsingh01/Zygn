import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messagingAPI, usersAPI } from '../services/api';
import { Message, User } from '../types';
import { 
  Send, 
  ArrowLeft, 
  User as UserIcon,
  MessageCircle,
  Phone,
  Mail
} from 'lucide-react';
import toast from 'react-hot-toast';

const Chat: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (userId) {
      fetchUserAndMessages();
    }
  }, [userId]);

  // Poll for new messages every second
  useEffect(() => {
    if (!userId) return;
    const intervalId = setInterval(() => {
      fetchMessagesOnly();
    }, 1000);
    return () => clearInterval(intervalId);
  }, [userId]);

  const fetchMessagesOnly = async () => {
    try {
      const messagesResponse = await messagingAPI.getConversation(userId!);
      setMessages(messagesResponse.data);
    } catch (error) {
      // Silently ignore to avoid toast spam during polling
      console.error('Error polling messages:', error);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUserAndMessages = async () => {
    try {
      const [userResponse, messagesResponse] = await Promise.all([
        usersAPI.getUserById(userId!),
        messagingAPI.getConversation(userId!)
      ]);
      setOtherUser(userResponse.data);
      setMessages(messagesResponse.data);
    } catch (error) {
      console.error('Error fetching chat data:', error);
      toast.error('Failed to load chat');
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !userId) return;

    setIsSending(true);
    try {
      const response = await messagingAPI.sendMessage({
        receiver_id: userId,
        content: newMessage.trim()
      });
      
      // Add the new message to the local state
      const myId = (currentUser?.user_id as string) || (currentUser?._id as string) || '';
      const newMessageObj: Message = {
        _id: response.data.message_id,
        sender_id: myId,
        receiver_id: userId,
        content: newMessage.trim(),
        created_at: new Date().toISOString(),
        is_read: false
      };
      
      setMessages(prev => [...prev, newMessageObj]);
      setNewMessage('');
    } catch (error: any) {
      console.error('Send message error:', error);
      
      // Handle different error response formats
      let errorMessage = 'Failed to send message';
      
      if (error.response?.data) {
        if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (Array.isArray(error.response.data)) {
          errorMessage = error.response.data.map((err: any) => err.msg || err.message).join(', ');
        } else if (typeof error.response.data === 'object') {
          errorMessage = Object.values(error.response.data).join(', ');
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Add +05:30 (IST) offset when displaying times
  const toIST = (dateString: string) => {
    const utc = new Date(dateString);
    // Add 330 minutes (5 hours 30 minutes)
    return new Date(utc.getTime() + 330 * 60 * 1000);
  };

  const toISTFromDate = (dateObj: Date) => new Date(dateObj.getTime() + 330 * 60 * 1000);

  const formatTime = (dateString: string) => {
    return toIST(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    const date = toIST(dateString);
    const today = toISTFromDate(new Date());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!otherUser) {
    return (
      <div className="text-center py-12">
        <UserIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">User not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The user you're trying to chat with doesn't exist.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="card mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => window.history.back()}
            className="p-2 text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div className="flex-shrink-0">
            <div className="h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {otherUser.name?.charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-medium text-gray-900">{otherUser.name}</h1>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-1" />
                {otherUser.phone_no}
              </div>
              <div className="flex items-center">
                <Mail className="h-4 w-4 mr-1" />
                {otherUser.email}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="card">
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No messages yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                Start the conversation by sending a message.
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const myId = (currentUser?.user_id as string) || (currentUser?._id as string) || '';
              const isOwnMessage = message.sender_id === myId;
              const showDate = index === 0 || 
                formatDate(message.created_at) !== formatDate(messages[index - 1]?.created_at);

              return (
                <div key={message._id}>
                  {/* Date separator */}
                  {showDate && (
                    <div className="text-center my-4">
                      <span className="inline-block px-3 py-1 text-xs text-gray-500 bg-gray-100 rounded-full">
                        {formatDate(message.created_at)}
                      </span>
                    </div>
                  )}

                  {/* Message */}
                  <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      isOwnMessage
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-primary-100' : 'text-gray-500'
                      }`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <form onSubmit={handleSendMessage} className="flex space-x-3">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 input-field"
              disabled={isSending}
            />
            <button
              type="submit"
              disabled={isSending || !newMessage.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
