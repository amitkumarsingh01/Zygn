import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, AuthState } from '../types';
import { authAPI, usersAPI } from '../services/api';
import toast from 'react-hot-toast';

interface AuthContextType extends AuthState {
  login: (phoneNo: string, otp: string) => Promise<void>;
  register: (userData: any) => Promise<any>;
  logout: () => void;
  updateUser: (userData: FormData) => Promise<void>;
  updateUserData: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'SET_LOADING' };

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    console.log('🔄 useEffect triggered - token:', !!state.token, 'user:', !!state.user);
    // Check if user is authenticated on app load
    if (state.token && !state.user) {
      console.log('🔍 Token exists but no user, checking localStorage...');
      // Try to get user from localStorage first
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          console.log('📦 Found stored user, parsing...');
          const user = JSON.parse(storedUser);
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: { user, token: state.token! },
          });
          console.log('✅ Stored user loaded successfully');
        } catch (error) {
          console.error('❌ Failed to parse stored user:', error);
          logout();
        }
      } else {
        console.log('📭 No stored user, calling checkAuth...');
        // Only fetch profile if we don't have stored user data
        checkAuth();
      }
    }
  }, [state.token]);

  const checkAuth = async () => {
    try {
      console.log('🔍 checkAuth called - fetching profile...');
      const response = await usersAPI.getProfile();
      console.log('✅ Profile fetched successfully');
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { user: response.data, token: state.token! },
      });
      // Update localStorage with fresh user data
      localStorage.setItem('user', JSON.stringify(response.data));
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      logout();
    }
  };

  const login = async (phoneNo: string, otp: string) => {
    try {
      console.log('🔐 Login started for:', phoneNo);
      const response = await authAPI.login({ phone_no: phoneNo, otp });
      const { access_token, user_id, char_id } = response.data;
      
      console.log('✅ Login successful, fetching full profile...');
      
      // Store token first
      localStorage.setItem('token', access_token);
      
      // Fetch full user profile immediately after login
      try {
        const profileResponse = await usersAPI.getProfile();
        const fullUser = profileResponse.data;
        
        console.log('✅ Full profile fetched:', fullUser);
        
        // Store full user data
        localStorage.setItem('user', JSON.stringify(fullUser));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user: fullUser, token: access_token },
        });
        
        console.log('✅ Login completed with full profile');
        toast.success('Login successful!');
      } catch (profileError) {
        console.error('❌ Failed to fetch profile after login:', profileError);
        
        // Fallback to minimal user object if profile fetch fails
        const user: User = {
          _id: user_id,
          user_id: user_id,
          char_id: char_id,
          name: '',
          email: '',
          phone_no: phoneNo,
          city: '',
          state: '',
          status: 'active',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          profile_pic: null,
          signature_pic: null,
          eye_pic: null,
          fingerprint: null
        };
        
        localStorage.setItem('user', JSON.stringify(user));
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, token: access_token },
        });
        
        console.log('✅ Login completed with minimal profile');
        toast.success('Login successful!');
      }
    } catch (error: any) {
      console.error('❌ Login failed:', error);
      
      // Handle different error response formats
      let errorMessage = 'Login failed';
      
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
      throw error;
    }
  };

  const register = async (userData: any) => {
    try {
      const response = await authAPI.register(userData);
      return response.data;
    } catch (error: any) {
      console.error('Registration error:', error);
      
      // Handle different error response formats
      let errorMessage = 'Registration failed';
      
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
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
    toast.success('Logged out successfully');
  };

  const updateUser = async (userData: FormData) => {
    try {
      await usersAPI.updateProfile(userData);
      const response = await usersAPI.getProfile();
      dispatch({ type: 'UPDATE_USER', payload: response.data });
      toast.success('Profile updated successfully');
    } catch (error: any) {
      console.error('Profile update error:', error);
      
      // Handle different error response formats
      let errorMessage = 'Profile update failed';
      
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
      throw error;
    }
  };

  const updateUserData = (userData: User) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
    // Update localStorage with fresh user data
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    updateUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
