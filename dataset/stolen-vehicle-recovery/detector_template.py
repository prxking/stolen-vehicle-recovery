"""
Stolen Vehicle Recovery - YOLOv8 API Integration Example

Instructions:
1. Ensure your Next.js server is running locally (npm run dev) on port 3000.
2. Run this python script to simulate a YOLOv8 detection event.
   Command: python3 detector_template.py
"""

import requests
import time
import os
import urllib.request
import uuid

# The URL of your Next.js API
API_URL = "http://localhost:3000/api/detect"

# The local path where Next.js serves public files
# Since you run this script in the root directory, it's just public/detections
PUBLIC_DIR = os.path.join(os.getcwd(), "public", "detections")

def download_mock_car_image(filename):
    """Downloads a placeholder car image to simulate a YOLO crop."""
    if not os.path.exists(PUBLIC_DIR):
        os.makedirs(PUBLIC_DIR)
        
    filepath = os.path.join(PUBLIC_DIR, filename)
    image_url = "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=400&q=80" # A generic car image
    try:
        urllib.request.urlretrieve(image_url, filepath)
        return True
    except Exception as e:
        print(f"Could not download mock image: {e}")
        return False

def send_detection_to_portal(plate_number, make, model, color, confidence, location="Camera 1 - Highway A"):
    """
    Sends the detected vehicle data and the locally saved image URL to the Admin Portal.
    """
    # 1. Simulate saving the cropped image from YOLO to the local public folder
    image_filename = f"{uuid.uuid4().hex[:8]}.jpg"
    success = download_mock_car_image(image_filename)
    
    # The relative URL that Next.js will use to serve the image on the website
    image_url = f"/detections/{image_filename}" if success else ""

    # 2. Build the payload
    payload = {
        "plateNumber": plate_number,
        "location": location,
        "make": make,
        "model": model,
        "color": color,
        "confidence": confidence,
        "imageUrl": image_url
    }
    
    try:
        print(f"Sending payload: {payload}")
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            data = response.json()
            print(f"[SUCCESS] Detection sent!")
            if data.get('matchFound'):
                print(f"🚨🚨 [ALERT] MATCH FOUND! Vehicle {plate_number} has been flagged as RECOVERED! 🚨🚨")
        else:
            print(f"[ERROR] Failed to send data: {response.text}")
    except Exception as e:
        print(f"[ERROR] Could not connect to the portal API: {e}")

if __name__ == "__main__":
    print("Starting YOLO Video Processing Simulation...")
    
    # Simulate processing time...
    time.sleep(2)
    print("Detected a vehicle! Extracting features...")
    
    # Mock data - Set this plate to match the one you report on the website to test auto-recovery!
    detected_plate = "KL 01 AB 1234" 
    detected_make = "Maruti Suzuki"  
    detected_model = "Swift"         
    detected_color = "White"         
    confidence_score = 0.92          
    
    # Send the detection!
    send_detection_to_portal(
        plate_number=detected_plate,
        make=detected_make,
        model=detected_model,
        color=detected_color,
        confidence=confidence_score
    )
