import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messagingAPI, walletAPI, usersAPI } from '../services/api';
import { 
  Home, 
  Plus, 
  Users, 
  Wallet, 
  MessageCircle, 
  User, 
  LogOut,
  Menu,
  X,
  Bell,
  AlertTriangle
} from 'lucide-react';
import { checkProfileCompletion } from '../utils/profileCompletion';
import toast from 'react-hot-toast';

const Layout: React.FC = () => {
  const { user, logout, updateUserData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [profileRefreshTrigger, setProfileRefreshTrigger] = useState(0);
  const [isRefreshingProfile, setIsRefreshingProfile] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);

  // Backend URL for profile images
  const BACKEND_URL = 'https://zygn.iaks.site';

  useEffect(() => {
    fetchUnreadCount();
    fetchWalletBalance();
    fetchProfileImage();
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchWalletBalance();
      fetchProfileImage();
    }, 30000);
    return () => clearInterval(interval);
  }, [profileRefreshTrigger]);

  const fetchUnreadCount = async () => {
    try {
      const response = await messagingAPI.getUnreadCount();
      setUnreadCount(response.data.unread_count);
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const response = await walletAPI.getBalance();
      setWalletBalance(response.data.balance);
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
    }
  };

  const fetchProfileImage = async () => {
    try {
      const response = await usersAPI.getProfile();
      if (response.data?.profile_pic) {
        // Construct full URL with backend URL + profile pic path
        const fullImageUrl = `${BACKEND_URL}${response.data.profile_pic}`;
        setProfileImage(fullImageUrl);
      }
    } catch (error) {
      console.error('Failed to fetch profile image:', error);
    }
  };

  const refreshProfile = async () => {
    setIsRefreshingProfile(true);
    try {
      const response = await usersAPI.getProfile();
      console.log('Profile refreshed from sidebar');
      
      // Update the user context with fresh profile data
      // This will trigger a re-render and update profile completion status
      if (response.data) {
        updateUserData(response.data);
        if (response.data.profile_pic) {
          // Construct full URL with backend URL + profile pic path
          const fullImageUrl = `${BACKEND_URL}${response.data.profile_pic}`;
          setProfileImage(fullImageUrl);
        }
        toast.success('Profile refreshed successfully!');
      }
      
      // Force a re-render by updating the profile refresh trigger
      // This will refresh the profile completion status
      setProfileRefreshTrigger(prev => prev + 1);
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      toast.error('Failed to refresh profile');
    } finally {
      setIsRefreshingProfile(false);
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    // { name: 'My Documents', href: '/dashboard', icon: FileText },
    { name: 'Create Document', href: '/document/create', icon: Plus },
    { name: 'Join Document', href: '/document/join', icon: Users },
    { name: 'Chat', href: '/chat', icon: MessageCircle },
    { name: 'Wallet', href: '/wallet', icon: Wallet },
    // { name: 'Payment Gateway', href: '/dashboard', icon: CreditCard },
    // { name: 'Pricing Management', href: '/pricing', icon: DollarSign },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
        <div className={`fixed inset-y-0 left-0 flex w-72 flex-col bg-white shadow-2xl transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Mobile Header */}
          <div className="flex h-20 items-center justify-between px-6 bg-gradient-to-r from-primary-600 to-primary-700">
            <div className="flex items-center space-x-3">
              <img 
                src="/assets/logo.png" 
                alt="Zygn Logo" 
                className="h-10 w-10 object-contain"
              />
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-white">Zygn Verify</h1>
                {user?.char_id && (
                  <span className="text-xs font-mono text-primary-100">
                    ID: {user.char_id}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full shadow-lg">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
              <button 
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-white hover:bg-white/10 rounded-lg transition-colors duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Wallet Balance Card */}
          {/* {walletBalance !== null && (
            <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">Wallet Balance</span>
                </div>
                <span className="text-lg font-bold text-green-700">{walletBalance.toFixed(2)} Coins</span>
              </div>
            </div>
          )} */}

          {/* Mobile Navigation */}
          <nav className="flex-1 space-y-2 px-4 py-6">
            {navigation.map((item) => {
              // Special handling for Profile item to refresh data
              if (item.name === 'Profile') {
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => {
                      setSidebarOpen(false);
                      refreshProfile();
                    }}
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-primary-100 text-primary-900 shadow-md'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                    {isRefreshingProfile && (
                      <div className="ml-auto animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    )}
                  </Link>
                );
              }
             
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-900 shadow-md'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                  {item.name === 'Chat' && unreadCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  {item.name === 'Wallet' && walletBalance !== null && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-500 rounded-full shadow-sm">
                      {walletBalance.toFixed(2)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 shadow-xl">
          {/* Desktop Header */}
          <div className="flex items-center justify-between h-20 px-6 bg-gradient-to-r from-primary-600 to-primary-700">
            <div className="flex items-center space-x-3">
              <img 
                src="/assets/logo.png" 
                alt="Zygn Logo" 
                className="h-10 w-10 object-contain"
              />
              <div className="flex flex-col">
                <h1 className="text-lg font-bold text-white">Zygn Verify</h1>
                {user?.char_id && (
                  <span className="text-xs font-mono text-primary-100">
                    ID: {user.char_id}
                  </span>
                )}
              </div>
            </div>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>

          {/* Wallet Balance Card */}
          {/* {walletBalance !== null && (
            <div className="mx-4 mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">Wallet Balance</span>
                </div>
                <span className="text-lg font-bold text-green-700">{walletBalance.toFixed(2)} Coins</span>
              </div>
            </div>
          )} */}

          {/* Desktop Navigation */}
          <nav className="flex-1 space-y-2 px-4 py-6">
            {navigation.map((item) => {
              // Special handling for Profile item to refresh data
              if (item.name === 'Profile') {
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={refreshProfile}
                    className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-primary-100 text-primary-900 shadow-md'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                    }`}
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                    {isRefreshingProfile && (
                      <div className="ml-auto animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                    )}
                  </Link>
                );
              }
             
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive(item.href)
                      ? 'bg-primary-100 text-primary-900 shadow-md'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:shadow-sm'
                  }`}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                  {item.name === 'Chat' && unreadCount > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full shadow-sm">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  {item.name === 'Wallet' && walletBalance !== null && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-500 rounded-full shadow-sm">
                      {walletBalance.toFixed(2)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white/80 backdrop-blur-md px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden relative hover:bg-gray-100 rounded-lg transition-colors duration-200"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full shadow-lg">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Welcome Message - Only on Desktop */}
          <div className="hidden lg:flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">👋</span>
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-gray-900">Welcome, {user?.name}</h2>
                <p className="text-sm text-gray-600">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Profile Completion Indicator */}
          {user && (() => {
            const completionStatus = checkProfileCompletion(user);
            if (!completionStatus.isComplete) {
              return (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-full shadow-sm">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-800">
                    Profile {completionStatus.completionPercentage}% Complete
                  </span>
                  <Link
                    to="/profile"
                    className="text-xs text-orange-700 hover:text-orange-800 underline font-medium"
                  >
                    Complete
                  </Link>
                </div>
              );
            }
            return null;
          })()}

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1" />
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              {/* User ID */}
              {user?.char_id && (
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-gray-100 rounded-full">
                  <span className="text-xs font-mono text-gray-600">ID:</span>
                  <span className="text-xs font-bold text-gray-800">{user.char_id}</span>
                </div>
              )}

              {/* Wallet Balance */}
              {walletBalance !== null && (
                <div className="hidden sm:flex items-center space-x-2 px-3 py-1 bg-green-100 rounded-full">
                  <Wallet className="h-4 w-4 text-green-600" />
                  <span className="text-xs font-bold text-green-800">{walletBalance.toFixed(2)} Coins</span>
                </div>
              )}

              {/* Notification Button */}
              <button 
                onClick={() => navigate('/chat')}
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-all duration-200 relative"
                title={`${unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'No unread messages'}`}
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-500 rounded-full shadow-lg">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {/* Profile Picture */}
              <div className="flex items-center">
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt="Profile" 
                    className="h-10 w-10 rounded-full object-cover border-2 border-gray-200 shadow-md"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 flex items-center justify-center shadow-md">
                    <span className="text-sm font-bold text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 rounded-lg transition-all duration-200"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
