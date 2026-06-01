import os
import cv2
import requests
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NEXT_PUBLIC_DIR = os.path.join(BASE_DIR, "dataset", "stolen-vehicle-recovery", "public", "detections")
os.makedirs(NEXT_PUBLIC_DIR, exist_ok=True)

def _send_to_nextjs(payload, api_url):
    try:
        response = requests.post(api_url, json=payload, timeout=30)
        if response.status_code == 200:
            print(f"[SUCCESS] Sent detection to Next.js API: {payload.get('plateNumber')}")
            data = response.json()
            if data.get("matchFound"):
                print(f"    --> MATCH FOUND: Vehicle {payload.get('plateNumber')} flagged as SPOTTED!")
        else:
            print(f"[ERROR] API returned {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[ERROR] Failed to communicate with Next.js API: {e}")

def save_vehicle_event(plate, vclass, color, camera_id, location, frame):
    if plate in ["NOT FOUND", "NOTFOUND"] or len(plate) < 4:
        return

    # 1. Save image to Next.js public directory
    img_name = f"{plate}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
    img_path = os.path.join(NEXT_PUBLIC_DIR, img_name)
    cv2.imwrite(img_path, frame)

    # 2. Construct the URL for the frontend
    image_url = f"/detections/{img_name}"

    # 3. Send POST request to the Next.js API in a background thread
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
    threading.Thread(target=_send_to_nextjs, args=(payload, api_url), daemon=True).start()
