import React, { useState, useEffect } from 'react';
import { walletAPI } from '../services/api';
import { Wallet, Transaction } from '../types';
import { 
  Plus, 
  Minus, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownLeft,
  RefreshCw,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

const WalletPage: React.FC = () => {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [amount, setAmount] = useState('');
  const [isAddingFunds, setIsAddingFunds] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [walletResponse, transactionsResponse] = await Promise.all([
        walletAPI.getBalance(),
        walletAPI.getTransactions()
      ]);
      setWallet(walletResponse.data);
      setTransactions(transactionsResponse.data);
    } catch (error) {
      console.error('Error fetching wallet data:', error);
      toast.error('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsAddingFunds(true);
    try {
      await walletAPI.addFunds({ amount: parseFloat(amount) });
      toast.success('Funds added successfully!');
      setAmount('');
      setShowAddFunds(false);
      fetchWalletData(); // Refresh data
    } catch (error: any) {
      console.error('Add funds error:', error);
      
      // Handle different error response formats
      let errorMessage = 'Failed to add funds';
      
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
      setIsAddingFunds(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'credit':
        return <ArrowDownLeft className="h-5 w-5 text-green-600" />;
      case 'debit':
        return <ArrowUpRight className="h-5 w-5 text-red-600" />;
      case 'payment':
        return <CreditCard className="h-5 w-5 text-blue-600" />;
      case 'refund':
        return <RefreshCw className="h-5 w-5 text-yellow-600" />;
      default:
        return <DollarSign className="h-5 w-5 text-gray-600" />;
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'credit':
        return 'text-green-600 bg-green-100';
      case 'debit':
        return 'text-red-600 bg-red-100';
      case 'payment':
        return 'text-blue-600 bg-blue-100';
      case 'refund':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage your funds and view transaction history.
          </p>
        </div>
        <button
          onClick={() => setShowAddFunds(true)}
          className="btn-primary inline-flex items-center mt-4 sm:mt-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Funds
        </button>
      </div>

      {/* Wallet Balance */}
      <div className="card">
        <div className="text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Current Balance</h2>
          <div className="text-4xl font-bold text-primary-600 mb-2">
            {wallet?.balance?.toFixed(2) || '0.00'} Coins
          </div>
          <p className="text-sm text-gray-500">
            Last updated: {wallet?.updated_at ? formatDate(wallet.updated_at) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card text-center">
          <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <Plus className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">Add Funds</h3>
          <p className="text-xs text-gray-500 mt-1">Top up your wallet</p>
        </div>

        <div className="card text-center">
          <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <CreditCard className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">Make Payment</h3>
          <p className="text-xs text-gray-500 mt-1">Pay for agreements</p>
        </div>

        <div className="card text-center">
          <div className="mx-auto h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
            <RefreshCw className="h-6 w-6 text-purple-600" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">History</h3>
          <p className="text-xs text-gray-500 mt-1">View transactions</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-gray-900">Transaction History</h2>
          <button
            onClick={fetchWalletData}
            className="text-sm text-primary-600 hover:text-primary-500"
          >
            Refresh
          </button>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions</h3>
            <p className="mt-1 text-sm text-gray-500">
              Your transaction history will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div
                key={transaction._id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getTransactionIcon(transaction.type)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(transaction.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionColor(transaction.type)}`}>
                    {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                  </span>
                  <span className={`text-sm font-medium ${
                    transaction.type === 'credit' || transaction.type === 'refund'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {transaction.type === 'credit' || transaction.type === 'refund' ? '+' : '-'}
                    {Math.abs(transaction.amount).toFixed(2)} Coins
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Funds Modal */}
      {showAddFunds && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add Funds to Wallet</h3>
              <form onSubmit={handleAddFunds} className="space-y-4">
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                    Amount (Coins)
                  </label>
                  <input
                    type="number"
                    id="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field mt-1"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    max="10000"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum amount: 10,000 Coins
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    type="submit"
                    disabled={isAddingFunds}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    {isAddingFunds ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                    ) : (
                      'Add Funds'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddFunds(false)}
                    className="flex-1 btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
