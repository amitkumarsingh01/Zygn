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
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showCameraPrompt, setShowCameraPrompt] = useState(false);
  const [pendingCameraType, setPendingCameraType] = useState<'profile' | 'eye' | null>(null);
  
  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const openCameraPrompt = (type: 'profile' | 'eye') => {
    setPendingCameraType(type);
    setShowCameraPrompt(true);
  };
  
  // Signature board refs
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setActiveCamera(null);
      setShowSignatureBoard(false);
      setCapturedImage(null);
      setIsPreviewMode(false);
    }
  }, [isOpen]);

  const startCamera = async (type: 'profile' | 'eye') => {
    try {
      console.log('Starting camera for:', type);
      setCameraLoading(true);
      setCameraError(null);
      setCapturedImage(null);
      setIsPreviewMode(false);
      setActiveCamera(type);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: false,
        video: { 
          facingMode: type === 'profile' ? 'user' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      console.log('Camera stream obtained:', stream);
      streamRef.current = stream;
      
      if (videoRef.current) {
        console.log('Setting video srcObject');
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        
        // Add event listeners for debugging
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, dimensions:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
        };
        
        videoRef.current.oncanplay = () => {
          console.log('Video can play');
        };
        
        videoRef.current.onplay = () => {
          console.log('Video started playing');
        };
        
        videoRef.current.onerror = (e) => {
          console.error('Video error:', e);
        };
        
        // Force play the video
        try {
          await videoRef.current.play();
          console.log('Video play successful');
          setCameraLoading(false);
        } catch (playError) {
          console.error('Video play failed:', playError);
          // Even if play fails, try to show the video
          setCameraLoading(false);
        }
      } else {
        console.log('Video ref not available');
        setCameraLoading(false);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraLoading(false);
      setCameraError('Unable to access camera. Please check permissions and try again.');
      
      if (error instanceof Error) {
        if ((error as any).name === 'NotAllowedError') {
          setCameraError('Camera access denied. Please allow camera permissions and try again.');
        } else if ((error as any).name === 'NotFoundError') {
          setCameraError('No camera found on your device. Please connect a camera and try again.');
        } else if ((error as any).name === 'NotReadableError') {
          setCameraError('Camera is already in use by another application. Please close other camera apps and try again.');
        } else {
          setCameraError('Camera error: ' + error.message);
        }
      }
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
        // Fallback sizes if metadata not ready
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        canvas.width = vw;
        canvas.height = vh;
        context.drawImage(video, 0, 0, vw, vh);
        
        canvas.toBlob((blob) => {
          if (blob) {
            // Create preview URL
            const imageUrl = URL.createObjectURL(blob);
            setCapturedImage(imageUrl);
            setIsPreviewMode(true);
            
            // Stop camera stream but keep modal open for preview
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
              streamRef.current = null;
            }
            if (videoRef.current) {
              videoRef.current.srcObject = null;
            }
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

  const retakePhoto = () => {
    setCapturedImage(null);
    setIsPreviewMode(false);
    startCamera(activeCamera!);
  };

  const submitPhoto = () => {
    if (capturedImage && activeCamera) {
      // Convert the captured image URL back to a File object
      fetch(capturedImage)
        .then(res => res.blob())
        .then(blob => {
          const file = new File([blob], `${activeCamera}_capture.jpg`, { type: 'image/jpeg' });
          setVerificationData(prev => ({
            ...prev,
            [activeCamera === 'profile' ? 'profile_pic' : 'eye']: file
          }));
          
          // Clean up and close camera
          setCapturedImage(null);
          setIsPreviewMode(false);
          stopCamera();
        });
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
            <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4">
              <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Capture {activeCamera === 'profile' ? 'Profile Picture' : 'Eye Scan'}
                  </h3>
                  <button
                    onClick={stopCamera}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                  >
                    <XIcon className="h-6 w-6" />
                  </button>
                </div>
                
                {/* Camera Loading State */}
                {cameraLoading && (
                  <div className="flex items-center justify-center py-16">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                      <p className="text-gray-600">Starting camera...</p>
                    </div>
                  </div>
                )}
                
                {/* Camera Error State */}
                {cameraError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <div className="text-red-600 mb-4">
                      <AlertCircle className="h-12 w-12 mx-auto" />
                    </div>
                    <h4 className="text-lg font-medium text-red-800 mb-2">Camera Error</h4>
                    <p className="text-red-700 mb-4">{cameraError}</p>
                    <div className="flex space-x-3 justify-center">
                      <button
                        onClick={() => {
                          setCameraError(null);
                          startCamera(activeCamera);
                        }}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Try Again
                      </button>
                      <button
                        onClick={stopCamera}
                        className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Compact Camera Frame */}
                {!cameraLoading && !cameraError && !isPreviewMode && (
                  <div className="space-y-4">
                    {/* Camera Preview Frame */}
                    <div className="relative mx-auto w-80 h-80 bg-black rounded-lg overflow-hidden border-4 border-gray-300 shadow-lg">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                        style={{ transform: 'scaleX(-1)' }} // Mirror the camera
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      
                      {/* Camera Instructions Overlay */}
                      <div className="absolute top-2 left-2 right-2 bg-black/70 text-white px-3 py-2 rounded-lg text-sm text-center">
                        <p>Position yourself in the frame</p>
                      </div>
                      
                      {/* Capture Frame Guide */}
                      <div className="absolute inset-4 border-2 border-white border-dashed rounded-lg pointer-events-none">
                        <div className="absolute top-2 left-2 bg-white/80 text-black px-2 py-1 rounded text-xs font-medium">
                          {activeCamera === 'profile' ? 'FACE' : 'EYE'}
                        </div>
                      </div>
                      
                      {/* Debug Info */}
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                        {videoRef.current?.readyState || '0'} | {videoRef.current?.videoWidth || '0'}x{videoRef.current?.videoHeight || '0'}
                      </div>
                    </div>
                    
                    {/* Camera Controls */}
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        onClick={stopCamera}
                        className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 flex items-center space-x-2 transition-colors"
                      >
                        <XIcon className="h-4 w-4" />
                        <span>Cancel</span>
                      </button>
                      
                      <button
                        onClick={capturePhoto}
                        className="bg-blue-600 text-white px-8 py-3 rounded-full hover:bg-blue-700 flex items-center space-x-2 shadow-lg transition-all transform hover:scale-105"
                      >
                        <Camera className="h-6 w-6" />
                        <span className="font-medium">Capture</span>
                      </button>
                    </div>
                    
                    {/* Helpful Tips */}
                    <div className="text-center text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      <p className="font-medium mb-1">Tips for better {activeCamera === 'profile' ? 'profile picture' : 'eye scan'}:</p>
                      <ul className="text-xs space-y-1">
                        <li>• Ensure good lighting</li>
                        <li>• Keep your face steady</li>
                        {activeCamera === 'eye' && <li>• Focus on one eye</li>}
                        <li>• Stay within the frame</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Photo Preview Mode */}
                {!cameraLoading && !cameraError && isPreviewMode && capturedImage && (
                  <div className="space-y-4">
                    {/* Captured Image Preview */}
                    <div className="relative mx-auto w-80 h-80 bg-gray-100 rounded-lg overflow-hidden border-4 border-gray-300 shadow-lg">
                      <img
                        src={capturedImage}
                        alt="Captured photo"
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Preview Label */}
                      <div className="absolute top-2 left-2 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium">
                        PREVIEW
                      </div>
                    </div>
                    
                    {/* Preview Controls */}
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        onClick={retakePhoto}
                        className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 flex items-center space-x-2 transition-colors"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Retake</span>
                      </button>
                      
                      <button
                        onClick={submitPhoto}
                        className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 flex items-center space-x-2 shadow-lg transition-all transform hover:scale-105"
                      >
                        <Check className="h-4 w-4" />
                        <span className="font-medium">Submit Photo</span>
                      </button>
                    </div>
                    
                    {/* Preview Info */}
                    <div className="text-center text-sm text-gray-600 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="font-medium text-green-800 mb-1">Photo Captured Successfully!</p>
                      <p className="text-green-700">Review your {activeCamera === 'profile' ? 'profile picture' : 'eye scan'} above</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Signature Board */}
          {showSignatureBoard && (
            <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999] p-4">
              <div className="bg-white rounded-lg p-6 max-w-3xl w-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Draw Your Signature</h3>
                  <button
                    onClick={closeSignatureBoard}
                    className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100"
                  >
                    <XIcon className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="border-2 border-gray-300 rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={signatureCanvasRef}
                    width={600}
                    height={300}
                    className="w-full h-75 border-0 cursor-crosshair block"
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
                
                {/* Signature Instructions */}
                <div className="mt-3 text-center text-sm text-gray-600">
                  <p>Use your mouse or finger to draw your signature above</p>
                </div>
                
                <div className="flex justify-between mt-6">
                  <button
                    onClick={clearSignature}
                    className="bg-gray-500 text-white px-6 py-3 rounded-lg hover:bg-gray-600 flex items-center space-x-2 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Clear Signature</span>
                  </button>
                  
                  <button
                    onClick={saveSignature}
                    className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 flex items-center space-x-2 transition-colors shadow-lg"
                  >
                    <Check className="h-4 w-4" />
                    <span className="font-medium">Save Signature</span>
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
                          onClick={() => openCameraPrompt('profile')}
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
                          onClick={() => openCameraPrompt('eye')}
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

        {/* Camera Permission Prompt */}
        {showCameraPrompt && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4">
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-900">Open Camera?</h4>
                <button onClick={() => setShowCameraPrompt(false)} className="text-gray-500 hover:text-gray-700">
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-4 space-y-3">
                <p className="text-sm text-gray-700">
                  We need to access your device camera to capture your {pendingCameraType === 'profile' ? 'profile photo' : 'eye scan'}. You can revoke access anytime from your browser settings.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-xs text-blue-800">
                  Tip: If prompted by the browser, click Allow to grant camera permission.
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button onClick={() => setShowCameraPrompt(false)} className="px-4 py-2 rounded bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
                <button onClick={() => {
                  setShowCameraPrompt(false);
                  startCamera(pendingCameraType!);
                }} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Continue</button>
              </div>
            </div>
          </div>
        )}

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
