import sys
import os
import time
import cv2
from collections import defaultdict
import subprocess
import socket
import webbrowser
import threading
import tkinter as tk

from flask import Flask, Response, jsonify
from flask_cors import CORS

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
sys.path.append(BASE_DIR)
sys.path.append(os.path.abspath(os.path.join(BASE_DIR, "..")))

os.environ["FLAGS_log_level"] = "3"

from models.vehicle_detector import VehicleDetector
from models.plate_detector import PlateDetector
from models.vehicle_classifier import VehicleClassifier
from models.color_classifier import ColorClassifier
from core.preprocessing import PlatePreprocessor
from ui.tactical_display import TacticalDisplay
from backend.services import save_vehicle_event

# =====================================================
# GLOBAL STATE FOR FLASK
# =====================================================
latest_frame_for_web = None

app = Flask(__name__)
CORS(app)

def generate_frames():
    global latest_frame_for_web
    while True:
        if latest_frame_for_web is None:
            time.sleep(0.05)
            continue
        # Use high quality JPEG encoding for the web feed
        ret, buffer = cv2.imencode('.jpg', latest_frame_for_web, [cv2.IMWRITE_JPEG_QUALITY, 85])
        if not ret: continue
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        time.sleep(0.03)

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/ping')
def ping():
    return jsonify({"status": "ok"})

def run_flask():
    app.run(host='0.0.0.0', port=5001, debug=False, use_reloader=False)

# =====================================================
# UTILS
# =====================================================
def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def ensure_nextjs_running():
    if not is_port_in_use(3000):
        print("[INFO] Starting Next.js development server...")
        nextjs_dir = os.path.join(BASE_DIR, "..", "dataset", "stolen-vehicle-recovery")
        subprocess.Popen(["npm", "run", "dev"], cwd=nextjs_dir, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(30):
            if is_port_in_use(3000):
                print("[INFO] Next.js is up!")
                time.sleep(2)
                break
            time.sleep(1)

def sharp(img):
    return cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()

def iou(a, b):
    xA, yA = max(a[0], b[0]), max(a[1], b[1])
    xB, yB = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, xB-xA) * max(0, yB-yA)
    areaA = (a[2]-a[0])*(a[3]-a[1])
    areaB = (b[2]-b[0])*(b[3]-b[1])
    return inter / (areaA+areaB-inter+1e-6)

# =====================================================
# MAIN PIPELINE
# =====================================================
if __name__ == "__main__":
    ensure_nextjs_running()
    webbrowser.open('http://localhost:3000/admin')
    
    # Start Flask Server
    threading.Thread(target=run_flask, daemon=True).start()

    print("[INFO] Initializing Models (from project v4)...")
    vehicle_detector = VehicleDetector(os.path.join(BASE_DIR, "weights", "vehicle_detector.pt"), conf_threshold=0.4)
    plate_detector = PlateDetector(os.path.join(BASE_DIR, "weights", "plate_detector.pt"), conf_threshold=0.4)
    vehicle_classifier = VehicleClassifier(os.path.join(BASE_DIR, "weights", "vehicle_classifier.pt"))
    color_classifier = ColorClassifier(os.path.join(BASE_DIR, "weights", "color_classifier.pth"), device="cpu")
    ocr_preprocessor = PlatePreprocessor(ocr_lang='en')

    # Initialize Tactical Display UI (from project v4)
    hud = TacticalDisplay()

    VIDEO_PATHS = [os.path.join(BASE_DIR, "..", "lulu2.mp4")]
    current_video_idx = 0
    cap = cv2.VideoCapture(VIDEO_PATHS[current_video_idx])

    VEHICLE_BUF, PLATE_BUF, MIN_ROI_FRAMES, IOU_THRESH, SIZE_WEIGHT = 18, 6, 12, 0.4, 0.15
    tracks, next_id = {}, 0
    vehicle_buf = defaultdict(list)
    plate_buf = defaultdict(list)
    roi_frames = defaultdict(int)
    processed = set()

    t0 = time.time()
    frame_count = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                current_video_idx += 1
                if current_video_idx >= len(VIDEO_PATHS):
                    print("DATA SENT! Video processing completed.")
                    break
                cap.release()
                cap = cv2.VideoCapture(VIDEO_PATHS[current_video_idx])
                tracks, next_id = {}, 0
                vehicle_buf.clear(); plate_buf.clear(); roi_frames.clear(); processed.clear()
                continue
            
            frame_count += 1
            h, w = frame.shape[:2]
            
            # Create a copy for the web stream annotations to keep it clean
            web_frame = frame.copy()
            
            ROI = (int(0.18*w), int(0.35*h), int(0.80*w), int(0.98*h))
            cv2.rectangle(web_frame, ROI[:2], ROI[2:], (0,0,255), 2)

            detections = vehicle_detector.detect(frame)
            current = {}

            for x1, y1, x2, y2, conf in detections:
                current[(x1, y1, x2, y2)] = None
                cv2.rectangle(web_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            for c in current:
                best, bid = 0, None
                for tid, t in tracks.items():
                    v = iou(c, t)
                    if v > best: best, bid = v, tid
                if best > IOU_THRESH:
                    current[c] = bid; tracks[bid] = c
                else:
                    current[c] = next_id; tracks[next_id] = c; next_id += 1

            for box, vid in current.items():
                if vid in processed: continue
                x1, y1, x2, y2 = box
                crop = frame[y1:y2, x1:x2]
                cx, cy = (x1 + x2) // 2, (y1 + y2) // 2

                if ROI[0] < cx < ROI[2] and ROI[1] < cy < ROI[3]:
                    roi_frames[vid] += 1
                    if roi_frames[vid] >= MIN_ROI_FRAMES:
                        vehicle_buf[vid].append((sharp(crop), crop))
                        if len(vehicle_buf[vid]) > VEHICLE_BUF: vehicle_buf[vid].pop(0)

                        plates = plate_detector.detect(crop)
                        for px1, py1, px2, py2, pconf in plates:
                            # Add horizontal padding to ensure full plate width is captured
                            pw = px2 - px1
                            ph = py2 - py1
                            pad_w = int(pw * 0.15)  # 15% horizontal padding
                            pad_h = int(ph * 0.05)  # 5% vertical padding
                            
                            px1_pad = max(0, px1 - pad_w)
                            px2_pad = min(crop.shape[1], px2 + pad_w)
                            py1_pad = max(0, py1 - pad_h)
                            py2_pad = min(crop.shape[0], py2 + pad_h)
                            
                            p = crop[py1_pad:py2_pad, px1_pad:px2_pad]
                            if p.size > 0:
                                score = sharp(p) + p.shape[1]*SIZE_WEIGHT
                                plate_buf[vid].append((score, p))
                                if len(plate_buf[vid]) > PLATE_BUF: plate_buf[vid].pop(0)

                if len(vehicle_buf[vid]) >= VEHICLE_BUF and len(plate_buf[vid]) >= PLATE_BUF:
                    best_vehicle = max(vehicle_buf[vid], key=lambda x:x[0])[1]
                    best_plate = max(plate_buf[vid], key=lambda x:x[0])[1]

                    steps = ocr_preprocessor.preprocess(best_plate)
                    if steps:
                        plate_text, score, variant = ocr_preprocessor.run_ocr_multiversion(steps)
                    else:
                        plate_text, score = "NOTFOUND", 0.0

                    cname, cconf = vehicle_classifier.classify(best_vehicle)
                    color = color_classifier.classify(best_vehicle)

                    if plate_text not in ["NOT FOUND", "NOTFOUND"] and len(plate_text) >= 4:
                        save_vehicle_event(
                            plate=plate_text, vclass=cname, color=color,
                            camera_id="CAM_01", location="Main Road", frame=best_vehicle
                        )
                        # Update Tkinter HUD Data
                        hud.update_detection_panel(plate_text, cname, color, score)
                        hud.update_preprocessing_crops(best_vehicle, best_plate, steps)
                        
                    processed.add(vid)

            # Update UI state
            elapsed = time.time() - t0
            hud.update_metrics(ai_fps=(frame_count / elapsed), gui_fps=60.0)
            hud.update_video_frame(web_frame)

            # Generate the unified HUD canvas for the web app
            latest_frame_for_web = hud.render().copy()

    except Exception as e:
        print(f"Interrupted or errored: {e}")
    finally:
        cap.release()
