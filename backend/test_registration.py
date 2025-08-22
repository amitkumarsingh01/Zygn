#!/usr/bin/env python3
"""
Test script for the registration endpoint with government ID image upload
"""

import requests
import os

# Test data
test_data = {
    'name': 'Test User',
    'email': 'test@example.com',
    'phone_no': '+919876543210',
    'city': 'Test City',
    'state': 'Test State',
    'govt_id_type': 'Aadhar',
    'govt_id_number': '123456789012'
}

# Test image file (create a simple test image)
test_image_path = 'test_image.jpg'

def create_test_image():
    """Create a simple test image file"""
    try:
        # Create a simple 1x1 pixel JPEG image
        with open(test_image_path, 'wb') as f:
            # Minimal JPEG header
            f.write(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00\x3f\x00\xaa\xff\xd9')
        print(f"Created test image: {test_image_path}")
        return True
    except Exception as e:
        print(f"Failed to create test image: {e}")
        return False

def test_registration():
    """Test the registration endpoint"""
    url = "http://localhost:8005/api/auth/register"
    
    # Prepare the multipart form data
    files = {
        'govt_id_image': ('test_image.jpg', open(test_image_path, 'rb'), 'image/jpeg')
    }
    
    try:
        print("Testing registration endpoint...")
        response = requests.post(url, data=test_data, files=files)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Registration successful!")
        else:
            print("❌ Registration failed!")
            
    except requests.exceptions.RequestException as e:
        print(f"Request failed: {e}")
    finally:
        # Clean up
        if os.path.exists(test_image_path):
            os.remove(test_image_path)
            print(f"Cleaned up test image: {test_image_path}")

if __name__ == "__main__":
    print("🧪 Testing Registration Endpoint with Government ID Image Upload")
    print("=" * 60)
    
    if create_test_image():
        test_registration()
    else:
        print("❌ Cannot proceed without test image")
