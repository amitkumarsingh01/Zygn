import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Phone, Lock, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [phoneNo, setPhoneNo] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNo || !otp) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      // Concatenate country code with phone number
      const fullPhoneNumber = `+91${phoneNo}`;
      await login(fullPhoneNumber, otp);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-3xl">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-8 py-6">
            <div className="flex items-center justify-center">
              <img 
                src="/public/assets/logo.png" 
                alt="Zygn Logo" 
                className="h-16 w-16 object-contain"
              />
            </div>
            <h2 className="mt-4 text-center text-2xl font-bold text-white">
              Welcome Back
            </h2>
            <p className="mt-2 text-center text-sm text-primary-100">
              Sign in to your account to continue
            </p>
          </div>

          {/* Card Body */}
          <div className="px-8 py-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="flex gap-2">
                    {/* Country Code */}
                    <div className="relative group flex-shrink-0">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                      </div>
                      <input
                        type="text"
                        value="+91"
                        disabled
                        className="w-20 pl-10 pr-2 py-3 border border-gray-200 rounded-xl bg-gray-100 text-gray-600 font-medium text-center"
                      />
                    </div>
                    
                    {/* Phone Number */}
                    <div className="relative group flex-1">
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        required
                        value={phoneNo}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 10) {
                            setPhoneNo(value);
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="9876543210"
                        maxLength={10}
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter 10-digit mobile number
                  </p>
                </div>
                
                <div>
                  <label htmlFor="otp" className="block text-sm font-semibold text-gray-700 mb-2">
                    OTP Code
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      id="otp"
                      name="otp"
                      type="text"
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="123456"
                      maxLength={6}
                    />
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transform transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                >
                  {isLoading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      Sign in
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="font-semibold text-primary-600 hover:text-primary-700 transition-colors duration-200"
                  >
                    Sign up here
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
