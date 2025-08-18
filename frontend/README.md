# Document Agreement System - Frontend

A modern React TypeScript frontend for the Document Agreement System, built with Vite and Tailwind CSS.

## Features

- **User Authentication**: Phone number + OTP login system
- **Document Management**: Create, join, and manage agreements
- **Real-time Chat**: Communicate with other users involved in documents
- **File Upload**: Support for multiple document formats
- **Wallet System**: Manage funds and make payments
- **Profile Management**: Update personal information and verification documents
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **React Router** - Client-side routing
- **Axios** - HTTP client for API calls
- **React Hook Form** - Form handling
- **React Hot Toast** - Toast notifications
- **Lucide React** - Beautiful icons
- **React Dropzone** - File upload handling

## Prerequisites

- Node.js 16+ 
- npm or yarn
- Backend server running on port 8005

## Installation

1. **Clone the repository and navigate to frontend:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to `http://localhost:3000`

## Project Structure

```
src/
├── components/          # Reusable UI components
│   └── Layout.tsx     # Main layout with navigation
├── contexts/           # React contexts
│   └── AuthContext.tsx # Authentication state management
├── pages/              # Page components
│   ├── Login.tsx      # User login
│   ├── Register.tsx   # User registration
│   ├── Dashboard.tsx  # Main dashboard
│   ├── DocumentCreate.tsx # Create new documents
│   ├── DocumentView.tsx   # View document details
│   ├── DocumentJoin.tsx   # Join existing documents
│   ├── Profile.tsx    # User profile management
│   ├── Wallet.tsx     # Wallet and transactions
│   └── Chat.tsx       # Real-time messaging
├── services/           # API services
│   └── api.ts         # HTTP client and API endpoints
├── types/              # TypeScript type definitions
│   └── index.ts       # All interfaces and types
├── App.tsx            # Main app component with routing
├── main.tsx           # Application entry point
└── index.css          # Global styles and Tailwind imports
```

## Key Features Implementation

### 1. Authentication Flow
- Phone number + OTP authentication
- JWT token management
- Protected routes
- Automatic token refresh

### 2. Document Workflow
- **Create**: Upload documents and generate unique codes
- **Join**: Enter document codes to join agreements
- **Approve**: Primary users approve join requests
- **Finalize**: Upload final documents and add to blockchain
- **Payment**: Pay using wallet coins (1 coin per day)

### 3. Real-time Communication
- Chat between document participants
- Message history
- Read status tracking

### 4. Wallet System
- Add funds to wallet
- Transaction history
- Payment processing
- Balance management

### 5. Profile Management
- Personal information updates
- Document uploads (profile pic, signature, eye scan, fingerprint)
- Verification document management

## API Integration

The frontend communicates with the backend through RESTful APIs:

- **Auth**: `/api/auth/*` - Login, registration
- **Users**: `/api/users/*` - Profile management
- **Documents**: `/api/documents/*` - Document CRUD operations
- **Messaging**: `/api/messaging/*` - Chat functionality
- **Wallet**: `/api/wallet/*` - Financial operations
- **Payments**: `/api/payments/*` - Payment processing

## Configuration

### Environment Variables
Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8005/
VITE_WS_URL=ws://localhost:8005/
```

### Direct API Configuration
The frontend directly connects to the backend API:

```typescript
// services/api.ts
const API_BASE_URL = 'http://localhost:8005/api';
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Building for Production

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Preview the build:**
   ```bash
   npm run preview
   ```

3. **Deploy the `dist` folder** to your hosting service

## Development Guidelines

### Code Style
- Use TypeScript for all components
- Follow React hooks best practices
- Use Tailwind CSS utility classes
- Implement proper error handling
- Add loading states for async operations

### Component Structure
- Functional components with hooks
- Props interface definitions
- Proper TypeScript typing
- Responsive design considerations

### State Management
- Use React Context for global state
- Local state with useState for component-specific data
- Proper state updates and immutability

## Troubleshooting

### Common Issues

1. **Backend Connection Error**
   - Ensure backend is running on port 8005
   - Check CORS configuration
   - Verify API endpoints

2. **Build Errors**
   - Clear node_modules and reinstall
   - Check TypeScript configuration
   - Verify all dependencies are installed

3. **Styling Issues**
   - Ensure Tailwind CSS is properly configured
   - Check PostCSS configuration
   - Verify CSS imports

## Contributing

1. Follow the existing code structure
2. Add proper TypeScript types
3. Implement responsive design
4. Add error handling
5. Test on multiple devices
6. Update documentation

## License

This project is part of the Document Agreement System.
