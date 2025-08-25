import streamlit as st
import cv2
import numpy as np
from PIL import Image
import tempfile
import os

# Set page configuration
st.set_page_config(
    page_title="Face & Eye Detection App",
    page_icon="👁️",
    layout="wide"
)

# Title and description
st.title("👁️ Face & Eye Detection App")
st.write("Capture an image using your camera and detect human faces and eyes!")

# Initialize session state for captured image
if 'captured_image' not in st.session_state:
    st.session_state.captured_image = None

# Load OpenCV's pre-trained classifiers
@st.cache_resource
def load_detectors():
    try:
        # Load face detector
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        
        # Load eye detector
        eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_eye.xml')
        
        return face_cascade, eye_cascade
    except Exception as e:
        st.error(f"Error loading detectors: {e}")
        return None, None

def detect_faces_and_eyes(image, detection_type="both"):
    """
    Detect faces and/or eyes in the given image
    detection_type: "faces", "eyes", or "both"
    Returns: detection results and image with rectangles drawn
    """
    face_cascade, eye_cascade = load_detectors()
    if face_cascade is None or eye_cascade is None:
        return {"faces": 0, "eyes": 0}, image
    
    # Convert PIL image to OpenCV format
    opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to grayscale for detection
    gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
    
    result_image = opencv_image.copy()
    results = {"faces": 0, "eyes": 0}
    
    # Detect faces
    if detection_type in ["faces", "both"]:
        faces = face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        results["faces"] = len(faces)
        
        # Draw rectangles around faces
        for (x, y, w, h) in faces:
            cv2.rectangle(result_image, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(result_image, 'Face', (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
    
    # Detect eyes
    if detection_type in ["eyes", "both"]:
        eyes = eye_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(10, 10),
            flags=cv2.CASCADE_SCALE_IMAGE
        )
        
        results["eyes"] = len(eyes)
        
        # Draw rectangles around eyes
        for (x, y, w, h) in eyes:
            cv2.rectangle(result_image, (x, y), (x+w, y+h), (255, 0, 0), 2)
            cv2.putText(result_image, 'Eye', (x, y-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
    
    # Convert back to RGB for display
    result_image = cv2.cvtColor(result_image, cv2.COLOR_BGR2RGB)
    result_pil = Image.fromarray(result_image)
    
    return results, result_pil

# Create two columns for layout
col1, col2 = st.columns([1, 1])

with col1:
    st.subheader("📷 Capture Image")
    
    # Camera input
    camera_image = st.camera_input("Take a picture")
    
    if camera_image is not None:
        st.session_state.captured_image = camera_image
        st.success("Image captured successfully!")
    
    # Alternative: File uploader
    st.subheader("📁 Or Upload Image")
    uploaded_file = st.file_uploader(
        "Choose an image file",
        type=['jpg', 'jpeg', 'png', 'bmp'],
        help="Upload an image file to detect faces and eyes"
    )
    
    if uploaded_file is not None:
        st.session_state.captured_image = uploaded_file
        st.success("Image uploaded successfully!")
    
    # Detection options
    st.subheader("🎯 Detection Options")
    detection_mode = st.selectbox(
        "What would you like to detect?",
        ["Both Faces and Eyes", "Only Faces", "Only Eyes"],
        help="Choose what to detect in the image"
    )
    
    # Map selection to detection type
    detection_mapping = {
        "Both Faces and Eyes": "both",
        "Only Faces": "faces",
        "Only Eyes": "eyes"
    }
    detection_type = detection_mapping[detection_mode]

with col2:
    st.subheader("🔍 Detection Results")
    
    if st.session_state.captured_image is not None:
        # Display the original image
        image = Image.open(st.session_state.captured_image)
        
        st.write("**Original Image:**")
        st.image(image, caption="Captured/Uploaded Image", use_container_width=True)
        
        # Perform detection
        with st.spinner("Detecting faces and eyes..."):
            results, result_image = detect_faces_and_eyes(image, detection_type)
        
        # Display results
        st.write("**Detection Results:**")
        
        # Create metrics display
        metric_col1, metric_col2 = st.columns(2)
        
        if detection_type in ["faces", "both"]:
            with metric_col1:
                st.metric("👤 Faces Detected", results["faces"])
        
        if detection_type in ["eyes", "both"]:
            with metric_col2:
                st.metric("👁️ Eyes Detected", results["eyes"])
        
        # Show detection status
        if detection_type == "faces":
            if results["faces"] > 0:
                st.success(f"✅ **{results['faces']} human face(s) detected!**")
            else:
                st.warning("❌ **No human faces detected in the image.**")
                
        elif detection_type == "eyes":
            if results["eyes"] > 0:
                st.success(f"✅ **{results['eyes']} eye(s) detected!**")
            else:
                st.warning("❌ **No eyes detected in the image.**")
                
        else:  # both
            face_detected = results["faces"] > 0
            eyes_detected = results["eyes"] > 0
            
            if face_detected and eyes_detected:
                st.success("✅ **Both faces and eyes detected!**")
            elif face_detected:
                st.success("✅ **Faces detected!**")
                st.info("👁️ No eyes detected separately")
            elif eyes_detected:
                st.success("✅ **Eyes detected!**")
                st.info("👤 No faces detected")
            else:
                st.warning("❌ **No faces or eyes detected in the image.**")
        
        # Display image with detection rectangles
        if results["faces"] > 0 or results["eyes"] > 0:
            st.write("**Image with detections:**")
            caption_parts = []
            if detection_type in ["faces", "both"] and results["faces"] > 0:
                caption_parts.append(f"{results['faces']} face(s)")
            if detection_type in ["eyes", "both"] and results["eyes"] > 0:
                caption_parts.append(f"{results['eyes']} eye(s)")
            
            caption = "Detected: " + " and ".join(caption_parts)
            st.image(result_image, caption=caption, use_container_width=True)
            
            # Color legend
            legend_col1, legend_col2 = st.columns(2)
            if detection_type in ["faces", "both"]:
                with legend_col1:
                    st.markdown("🟢 **Green**: Faces")
            if detection_type in ["eyes", "both"]:
                with legend_col2:
                    st.markdown("🔵 **Blue**: Eyes")
        
        # Additional insights
        if detection_type == "both" and results["faces"] > 0 and results["eyes"] > 0:
            expected_eyes = results["faces"] * 2
            if results["eyes"] < expected_eyes:
                st.info(f"💡 **Note**: Detected {results['eyes']} eyes for {results['faces']} face(s). Some eyes might be hidden, closed, or at angles that make detection difficult.")
            elif results["eyes"] > expected_eyes:
                st.info(f"💡 **Note**: Detected more eyes ({results['eyes']}) than expected for {results['faces']} face(s). This might include false positives or partial face detections.")
    
    else:
        st.info("👆 Please capture an image using the camera or upload an image file to begin detection.")

# Footer
st.markdown("---")
st.markdown("Built with ❤️ using Streamlit and OpenCV • Face & Eye Detection")