import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, FileText, Eye, AlertCircle, RotateCcw, Check, X as XIcon } from 'lucide-react';

interface DocumentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (verificationData: VerificationData) => void;
  documentType: 'create' | 'join';
}

interface VerificationData {
  profile_pic: File | null;
  sign: File | null;
  eye: File | null;
}

const DocumentVerificationModal: React.FC<DocumentVerificationModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  documentType
}) => {
  const [verificationData, setVerificationData] = useState<VerificationData>({
    profile_pic: null,
    sign: null,
    eye: null
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [activeCamera, setActiveCamera] = useState<'profile' | 'eye' | null>(null);
  const [showSignatureBoard, setShowSignatureBoard] = useState(false);
  
  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Signature board refs
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState<ImageData | null>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setActiveCamera(null);
      setShowSignatureBoard(false);
    }
  }, [isOpen]);

  const startCamera = async (type: 'profile' | 'eye') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: type === 'profile' ? 'user' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setActiveCamera(type);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActiveCamera(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && activeCamera) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `${activeCamera}_capture.jpg`, { type: 'image/jpeg' });
            setVerificationData(prev => ({
              ...prev,
              [activeCamera === 'profile' ? 'profile_pic' : 'eye']: file
            }));
            stopCamera();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const openSignatureBoard = () => {
    setShowSignatureBoard(true);
    setActiveCamera(null);
    stopCamera();
  };

  const closeSignatureBoard = () => {
    setShowSignatureBoard(false);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        context.strokeStyle = '#000000';
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.beginPath();
        context.moveTo(x, y);
      }
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        context.lineTo(x, y);
        context.stroke();
      }
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext('2d');
      if (context) {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const saveSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'signature.png', { type: 'image/png' });
          setVerificationData(prev => ({
            ...prev,
            sign: file
          }));
          closeSignatureBoard();
        }
      }, 'image/png');
    }
  };

  const handleFileChange = (field: keyof VerificationData, file: File | null) => {
    setVerificationData(prev => ({
      ...prev,
      [field]: file
    }));
  };

  const validateFiles = (): boolean => {
    const newErrors: string[] = [];
    
    if (!verificationData.profile_pic) {
      newErrors.push('Profile picture is required');
    }
    if (!verificationData.sign) {
      newErrors.push('Signature is required');
    }
    if (!verificationData.eye) {
      newErrors.push('Eye scan is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = () => {
    if (validateFiles()) {
      onComplete(verificationData);
    }
  };

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'profile_pic':
        return <Camera className="h-5 w-5" />;
      case 'sign':
        return <FileText className="h-5 w-5" />;
      case 'eye':
        return <Eye className="h-5 w-5" />;
      default:
        return <Camera className="h-5 w-5" />;
    }
  };

  const getFieldDisplayName = (field: string): string => {
    const fieldNames: Record<string, string> = {
      profile_pic: 'Profile Picture',
      sign: 'Signature',
      eye: 'Eye Scan'
    };
    return fieldNames[field] || field;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-900">
              Document Verification Required
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Info Message */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-medium text-blue-800">
                  Live Verification Required
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  To ensure security and authenticity, we need live verification for this {documentType === 'create' ? 'document creation' : 'document joining'}.
                  Please use your device camera and signature pad.
                </p>
              </div>
            </div>
          </div>

          {/* Error Messages */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="text-sm text-red-700">
                <h4 className="font-medium mb-2">Please fix the following errors:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Camera View */}
          {activeCamera && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">
                    Capture {activeCamera === 'profile' ? 'Profile Picture' : 'Eye Scan'}
                  </h3>
                  <button
                    onClick={stopCamera}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full rounded-lg"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                    <button
                      onClick={capturePhoto}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center space-x-2"
                    >
                      <Camera className="h-5 w-5" />
                      <span>Capture</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Signature Board */}
          {showSignatureBoard && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Draw Your Signature</h3>
                  <button
                    onClick={closeSignatureBoard}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <XIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                  <canvas
                    ref={signatureCanvasRef}
                    width={600}
                    height={300}
                    className="w-full h-75 border-0 cursor-crosshair"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={(e) => {
                      e.preventDefault();
                      const touch = e.touches[0];
                      const mouseEvent = new MouseEvent('mousedown', {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                      });
                      startDrawing(mouseEvent as any);
                    }}
                    onTouchMove={(e) => {
                      e.preventDefault();
                      const touch = e.touches[0];
                      const mouseEvent = new MouseEvent('mousemove', {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                      });
                      draw(mouseEvent as any);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      stopDrawing();
                    }}
                    style={{ backgroundColor: 'white' }}
                  />
                </div>
                
                <div className="flex justify-between mt-4">
                  <button
                    onClick={clearSignature}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center space-x-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Clear</span>
                  </button>
                  
                  <button
                    onClick={saveSignature}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Signature</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Verification Fields */}
          <div className="space-y-6">
            <h3 className="text-lg font-medium text-gray-900">
              Verification Documents
            </h3>
            
            {Object.entries(verificationData).map(([field, file]) => (
              <div key={field} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  {getFieldIcon(field)}
                  <h4 className="font-medium text-gray-900">
                    {getFieldDisplayName(field)}
                  </h4>
                </div>
                
                <div className="space-y-3">
                  {file ? (
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        {field === 'profile_pic' || field === 'eye' ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt={getFieldDisplayName(field)}
                            className="h-16 w-16 rounded-lg object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-lg border border-gray-200 flex items-center justify-center bg-gray-50">
                            <FileText className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-600">{file.name}</p>
                        <p className="text-xs text-gray-500">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFileChange(field as keyof VerificationData, null)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {field === 'profile_pic' ? (
                        <button
                          onClick={() => startCamera('profile')}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <Camera className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-blue-600 hover:text-blue-500">
                              Click to open camera
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Take a live photo for profile picture
                          </p>
                        </button>
                      ) : field === 'eye' ? (
                        <button
                          onClick={() => startCamera('eye')}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <Eye className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-blue-600 hover:text-blue-500">
                              Click to open camera
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Take a live photo for eye scan
                          </p>
                        </button>
                      ) : field === 'sign' ? (
                        <button
                          onClick={openSignatureBoard}
                          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <div className="text-sm text-gray-600">
                            <span className="font-medium text-blue-600 hover:text-blue-500">
                              Click to open signature board
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Draw your signature on the whiteboard
                          </p>
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Complete Verification
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentVerificationModal;
