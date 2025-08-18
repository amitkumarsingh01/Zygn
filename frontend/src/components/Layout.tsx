import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { messagingAPI, walletAPI, usersAPI } from '../services/api';
import { 
  Home, 
  FileText, 
  Plus, 
  Users, 
  Wallet, 
  MessageCircle, 
  User, 
  LogOut,
  Menu,
  X,
  Bell,
  CreditCard,
  AlertTriangle,
  DollarSign
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

  useEffect(() => {
    fetchUnreadCount();
    fetchWalletBalance();
    // Refresh data every 30 seconds
    const interval = setInterval(() => {
      fetchUnreadCount();
      fetchWalletBalance();
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

  const refreshProfile = async () => {
    setIsRefreshingProfile(true);
    try {
      const response = await usersAPI.getProfile();
      console.log('Profile refreshed from sidebar');
      
      // Update the user context with fresh profile data
      // This will trigger a re-render and update profile completion status
      if (response.data) {
        updateUserData(response.data);
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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white">
                     <div className="flex h-16 items-center justify-between px-4">
             <div className="flex flex-col">
               <h1 className="text-xl font-semibold text-gray-900">Zygn Verify</h1>
               {user?.char_id && (
                 <span className="text-xs font-mono text-gray-500">
                   ID: {user.char_id}
                 </span>
               )}
               {walletBalance !== null && (
                 <span className="text-xs font-medium text-green-600">
                   Balance: {walletBalance.toFixed(2)} Coins
                 </span>
               )}
             </div>
             <div className="flex items-center space-x-2">
               {unreadCount > 0 && (
                 <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                   {unreadCount > 99 ? '99+' : unreadCount}
                 </span>
               )}
               <button onClick={() => setSidebarOpen(false)}>
                 <X className="h-6 w-6 text-gray-500" />
               </button>
             </div>
           </div>
                     <nav className="flex-1 space-y-1 px-2 py-4">
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
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive(item.href)
                          ? 'bg-primary-100 text-primary-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                   className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                     isActive(item.href)
                       ? 'bg-primary-100 text-primary-900'
                       : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                   }`}
                 >
                   <item.icon className="mr-3 h-5 w-5" />
                   {item.name}
                   {item.name === 'Chat' && unreadCount > 0 && (
                     <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                       {unreadCount > 99 ? '99+' : unreadCount}
                     </span>
                   )}
                   {item.name === 'Wallet' && walletBalance !== null && (
                     <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-600 rounded-full">
                       {walletBalance.toFixed(2)}
                     </span>
                   )}
                   {item.name === 'Payment Gateway' && (
                     <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-orange-100 bg-orange-600 rounded-full">
                       Docs
                     </span>
                   )}
                 </Link>
               );
             })}
           </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
                     <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
             <div className="flex flex-col">
               <h1 className="text-xl font-semibold text-gray-900">Zygn Verify</h1>
               {user?.char_id && (
                 <span className="text-xs font-mono text-gray-500">
                   ID: {user.char_id}
                 </span>
               )}
               {walletBalance !== null && (
                 <span className="text-xs font-medium text-green-600">
                   Balance: {walletBalance.toFixed(2)} Coins
                 </span>
               )}
             </div>
             {unreadCount > 0 && (
               <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                 {unreadCount > 99 ? '99+' : unreadCount}
               </span>
             )}
           </div>
                     <nav className="flex-1 space-y-1 px-2 py-4">
             {navigation.map((item) => {
                               // Special handling for Profile item to refresh data
                if (item.name === 'Profile') {
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={refreshProfile}
                      className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                        isActive(item.href)
                          ? 'bg-primary-100 text-primary-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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
                   className={`group flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                     isActive(item.href)
                       ? 'bg-primary-100 text-primary-900'
                       : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                   }`}
                 >
                   <item.icon className="mr-3 h-5 w-5" />
                   {item.name}
                   {item.name === 'Chat' && unreadCount > 0 && (
                     <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                       {unreadCount > 99 ? '99+' : unreadCount}
                     </span>
                   )}
                   {item.name === 'Wallet' && walletBalance !== null && (
                     <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-600 rounded-full">
                       {walletBalance.toFixed(2)}
                     </span>
                   )}
                   {item.name === 'Payment Gateway' && (
                     <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-orange-100 bg-orange-600 rounded-full">
                       Docs
                     </span>
                   )}
                 </Link>
               );
             })}
           </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
          <button
            type="button"
            className="-m-2.5 p-2.5 text-gray-700 lg:hidden relative"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Profile Completion Indicator */}
          {user && (() => {
            const completionStatus = checkProfileCompletion(user);
            if (!completionStatus.isComplete) {
              return (
                <div className="flex items-center space-x-2 px-3 py-1 bg-orange-100 border border-orange-200 rounded-full">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-medium text-orange-800">
                    Profile {completionStatus.completionPercentage}% Complete
                  </span>
                  <Link
                    to="/profile"
                    className="text-xs text-orange-700 hover:text-orange-800 underline"
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
              <button 
                onClick={() => navigate('/chat')}
                className="p-2 text-gray-400 hover:text-gray-500 relative"
                title={`${unreadCount > 0 ? `${unreadCount} unread message${unreadCount !== 1 ? 's' : ''}` : 'No unread messages'}`}
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              
              {/* User menu */}
              <div className="flex items-center gap-x-4">
                                               <div className="hidden sm:flex sm:flex-col sm:items-end">
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-xs text-gray-500">{user?.email}</p>
                    {user?.char_id && (
                      <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
                        {user.char_id}
                      </span>
                    )}
                  </div>
                  {walletBalance !== null && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs font-medium text-green-600">
                        Balance: {walletBalance.toFixed(2)} Coins
                      </span>
                    </div>
                  )}
                </div>
                <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                  <span className="text-sm font-medium text-white">
                    {user?.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-gray-500"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
