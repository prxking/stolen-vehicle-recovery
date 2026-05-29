import os
import cv2
import requests
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEXT_PUBLIC_DIR = os.path.join(BASE_DIR, "dataset", "stolen-vehicle-recovery", "public", "detections")
os.makedirs(NEXT_PUBLIC_DIR, exist_ok=True)

def save_vehicle_event(plate, vclass, color, camera_id, location, frame):
    if plate == "NOT FOUND" or len(plate) < 6:
        return

    # 1. Save image to Next.js public directory
    img_name = f"{plate}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    img_path = os.path.join(NEXT_PUBLIC_DIR, img_name)
    cv2.imwrite(img_path, frame)

    # 2. Construct the URL for the frontend
    image_url = f"/detections/{img_name}"

    # 3. Send POST request to the Next.js API
    try:
        payload = {
            "plateNumber": plate,
            "location": location,
            "make": vclass.split()[0] if vclass else "Unknown",
            "model": " ".join(vclass.split()[1:]) if vclass and " " in vclass else vclass,
            "color": color,
            "confidence": 0.95, # Mock confidence
            "imageUrl": image_url
        }
        
        api_url = os.environ.get("NEXTJS_API_URL", "http://localhost:3000/api/detect")
        response = requests.post(api_url, json=payload, timeout=5)
        if response.status_code == 200:
            print(f"[SUCCESS] Sent detection to Next.js API: {plate}")
            data = response.json()
            if data.get("matchFound"):
                print(f"    --> MATCH FOUND: Vehicle {plate} flagged as SPOTTED!")
        else:
            print(f"[ERROR] API returned {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[ERROR] Failed to communicate with Next.js API: {e}")
