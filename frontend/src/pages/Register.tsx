import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Mail, Phone, MapPin, ArrowRight, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_no: '',
    city: '',
    state: '',
    govt_id_type: '',
    govt_id_number: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    if (value.length <= 10) {
      setFormData({
        ...formData,
        phone_no: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsLoading(true);
    try {
      // Create a copy of formData with the full phone number including country code
      const registrationData = {
        ...formData,
        phone_no: `+91${formData.phone_no}`
      };
      
      const response = await register(registrationData);
      if (response.redirect_to_login) {
        toast.success('Registration successful! Please login with OTP.');
        navigate('/login');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.detail || 'Registration failed';
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 via-blue-50 to-cyan-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
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
              Create Account
            </h2>
            <p className="mt-2 text-center text-sm text-primary-100">
              Join us and start your journey
            </p>
          </div>

          {/* Card Body */}
          <div className="px-8 py-8">
            {/* Demo Info Card */}
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-5">
                {/* Row 1: Name and Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Name
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                      </div>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter your full name"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                      </div>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Enter your email address"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Phone Number and City */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone_no" className="block text-sm font-semibold text-gray-700 mb-2">
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
                          id="phone_no"
                          name="phone_no"
                          type="tel"
                          required
                          value={formData.phone_no}
                          onChange={handlePhoneChange}
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
                    <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
                      City
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                      </div>
                      <input
                        id="city"
                        name="city"
                        type="text"
                        required
                        value={formData.city}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Bangalore"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: State and Government ID Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
                      State
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <MapPin className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                      </div>
                      <input
                        id="state"
                        name="state"
                        type="text"
                        required
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                        placeholder="Karnataka"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="govt_id_type" className="block text-sm font-semibold text-gray-700 mb-2">
                      Government ID Type
                    </label>
                    <div className="relative group">
                      <select
                        id="govt_id_type"
                        name="govt_id_type"
                        required
                        value={formData.govt_id_type}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white appearance-none cursor-pointer"
                      >
                        <option value="">Select ID Type</option>
                        <option value="Aadhar">Aadhar Card</option>
                        <option value="PAN">PAN Card</option>
                        <option value="Passport">Passport</option>
                        <option value="Driving License">Driving License</option>
                        <option value="Voter ID">Voter ID</option>
                        <option value="Other">Other</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 4: Government ID Number (Full Width) */}
                <div>
                  <label htmlFor="govt_id_number" className="block text-sm font-semibold text-gray-700 mb-2">
                    Government ID Number
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <CreditCard className="h-5 w-5 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
                    </div>
                    <input
                      id="govt_id_number"
                      name="govt_id_number"
                      type="text"
                      required
                      value={formData.govt_id_number}
                      onChange={handleChange}
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 bg-gray-50 focus:bg-white"
                      placeholder="Enter your ID number"
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
                      Create Account
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link
                    to="/login"
                    className="font-semibold text-primary-600 hover:text-primary-700 transition-colors duration-200"
                  >
                    Sign in here
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

export default Register;
