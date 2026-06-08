import sys  # type: ignore
import os  # type: ignore
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

os.environ["FLAGS_log_level"] = "3"

# ===================== IMPORTS =====================
import cv2  # type: ignore
import torch  # type: ignore
import torch.nn as nn  # type: ignore
import torchvision.transforms as T  # type: ignore
import torchvision.models as models  # type: ignore
import numpy as np  # type: ignore
from ultralytics import YOLO  # type: ignore
from collections import defaultdict  # type: ignore
import re  # type: ignore
from paddleocr import PaddleOCR  # type: ignore
import requests  # type: ignore
import uuid  # type: ignore

# =====================================================
# NEXT.JS PORTAL CONFIGURATION
# =====================================================
API_URL = "http://localhost:3000/api/detect"
# Path to save extracted vehicle images so the Next.js server can serve them
PUBLIC_DIR = os.path.join(os.getcwd(), "public", "detections")

# Ensure the detections directory exists
if not os.path.exists(PUBLIC_DIR):
    os.makedirs(PUBLIC_DIR)

def send_to_portal(plate, vclass, color, frame):
    """
    Saves the extracted vehicle frame and sends the data to the Next.js Stolen Vehicle Portal.
    """
    try:
        # 1. Save the image
        img_filename = f"{uuid.uuid4().hex[:8]}.jpg"
        img_path = os.path.join(PUBLIC_DIR, img_filename)
        cv2.imwrite(img_path, frame)
        
        # 2. Prepare payload
        payload = {
            "plateNumber": plate,
            "location": "Camera 1 - Highway A",
            "make": vclass.split(" ")[0] if vclass else "Unknown", # Attempt to parse Make
            "model": vclass, 
            "color": color,
            "confidence": 0.95, # Mock confidence or extract if available
            "imageUrl": f"/detections/{img_filename}"
        }
        
        # 3. Send POST request
        print(f"📡 Sending detection to portal: {plate}...")
        res = requests.post(API_URL, json=payload)
        
        if res.status_code == 200:
            data = res.json()
            if data.get('matchFound'):
                print(f"\n🚨🚨 [ALERT] MATCH FOUND! Vehicle {plate} has been flagged as RECOVERED! 🚨🚨\n")
            else:
                print(f"✅ Successfully logged {plate} to database.")
        else:
            print(f"❌ Failed to send data: {res.text}")
            
    except Exception as e:
        print(f"⚠️ Error communicating with portal: {e}")

# =====================================================
# PATHS
# =====================================================
BASE_DIR = "/Users/prasanth/Downloads/project v1"
VEHICLE_MODEL_PATH = os.path.join(BASE_DIR, "anpr_pipeline/models/train1/weights/best.pt")
PLATE_MODEL_PATH   = os.path.join(BASE_DIR, "anpr_pipeline/models/train2/weights/best.pt")
CLASS_MODEL_PATH   = os.path.join(BASE_DIR, "anpr_pipeline/models/train3/weights/best.pt")
COLOR_MODEL_PATH   = os.path.join(BASE_DIR, "anpr_pipeline/models/colour_detection/mobilenetv3_vehicle_color.pth")
VIDEO_PATH         = os.path.join(BASE_DIR, "lulu2.mp4")

# =====================================================
# DISPLAY
# =====================================================
VIDEO_W, VIDEO_H = 960, 540
CANVAS_W, CANVAS_H = 1200, 800
SLOW_MS = 35

# =====================================================
# DEVICE
# =====================================================
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# =====================================================
# LOAD YOLO MODELS
# =====================================================
try:
    vehicle_model = YOLO(VEHICLE_MODEL_PATH)
    plate_model   = YOLO(PLATE_MODEL_PATH)
    class_model   = YOLO(CLASS_MODEL_PATH)
except Exception as e:
    print(f"Warning: Could not load YOLO models. Please verify paths. {e}")

# =====================================================
# OCR
# =====================================================
try:
    ocr = PaddleOCR(lang='en')
except Exception as e:
    print(f"Warning: Could not load PaddleOCR. {e}")

# =====================================================
# COLOR CLASSES
# =====================================================
COLOR_CLASSES = [
    "beige","black","blue","brown","gold","green","grey",
    "orange","pink","purple","red","silver","tan","white","yellow"
]
NUM_COLORS = len(COLOR_CLASSES)

# =====================================================
# LOAD COLOR MODEL
# =====================================================
try:
    color_model = models.mobilenet_v3_large(weights=None)
    color_model.classifier[3] = nn.Linear(1280, NUM_COLORS)
    color_model.load_state_dict(torch.load(COLOR_MODEL_PATH, map_location=DEVICE))
    color_model.to(DEVICE)
    color_model.eval()
except Exception as e:
    print(f"Warning: Could not load Color Model. {e}")

# =====================================================
# COLOR TRANSFORM
# =====================================================
color_tf = T.Compose([
    T.ToPILImage(),
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# =====================================================
# PARAMETERS
# =====================================================
VEHICLE_BUF = 18
PLATE_BUF   = 6
MIN_PLATE_W = 130
IOU_THRESH  = 0.4
MIN_ROI_FRAMES = 12
TARGET_OCR_H = 64
SIZE_WEIGHT = 0.15

# =====================================================
# HELPERS
# =====================================================
def sharp(img):
    return cv2.Laplacian(
        cv2.cvtColor(img, cv2.COLOR_BGR2GRAY),
        cv2.CV_64F
    ).var()

def iou(a, b):
    xA, yA = max(a[0], b[0]), max(a[1], b[1])
    xB, yB = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, xB-xA) * max(0, yB-yA)
    areaA = (a[2]-a[0])*(a[3]-a[1])
    areaB = (b[2]-b[0])*(b[3]-b[1])
    return inter / (areaA+areaB-inter+1e-6)

def postprocess_plate(text):
    text = ''.join(c for c in text.upper() if c.isalnum())
    if re.match(r'^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{1,4}$', text):
        return text
    return text[:10]

# =====================================================
# OCR
# =====================================================
def read_plate(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    if h < TARGET_OCR_H:
        scale = TARGET_OCR_H / h
        new_w = int(w * scale)
        resized = cv2.resize(gray, (new_w, TARGET_OCR_H))
    else:
        resized = gray

    resized = cv2.bilateralFilter(resized, 9, 75, 75)
    binary = cv2.adaptiveThreshold(
        resized, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        21, 3
    )

    result = ocr.ocr(resized)
    best, conf = "NOT FOUND", 0

    if result and result[0]:
        for r in result[0]:
            txt, c = r[1]
            txt = txt.replace(" ", "").replace("-", "")
            if c > conf and len(txt) >= 6:
                best, conf = txt, c

    return postprocess_plate(best), gray, resized, binary

# =====================================================
# COLOR PREDICTION
# =====================================================
@torch.no_grad()
def predict_color(vehicle_img):
    img = cv2.cvtColor(vehicle_img, cv2.COLOR_BGR2RGB)
    img = color_tf(img).unsqueeze(0).to(DEVICE)
    logits = color_model(img)
    idx = torch.argmax(logits, dim=1).item()
    return COLOR_CLASSES[idx]

# =====================================================
# MAIN
# =====================================================
if __name__ == "__main__":
    try:
        cap = cv2.VideoCapture(VIDEO_PATH)
        cv2.namedWindow("ANPR SYSTEM", cv2.WINDOW_NORMAL)
        cv2.resizeWindow("ANPR SYSTEM", CANVAS_W, CANVAS_H)

        tracks, next_id = {}, 0
        vehicle_buf = defaultdict(list)
        plate_buf = defaultdict(list)
        roi_frames = defaultdict(int)
        processed = set()

        best_vehicle = best_plate = None
        gray_p = ocr_p = bin_p = None
        info_text = "Waiting for vehicle..."

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            h, w = frame.shape[:2]
            ROI = (int(0.18*w), int(0.35*h), int(0.80*w), int(0.98*h))
            cv2.rectangle(frame, ROI[:2], ROI[2:], (0,0,255), 2)

            dets = vehicle_model(frame, conf=0.4, verbose=False)[0]
            current = {}

            for b in dets.boxes:
                current[tuple(map(int, b.xyxy[0]))] = None
                x1, y1, x2, y2 = map(int, b.xyxy[0])
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, "Vehicle", (x1, y1 - 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

            for c in current:
                best, bid = 0, None
                for tid, t in tracks.items():
                    v = iou(c, t)
                    if v > best:
                        best, bid = v, tid
                if best > IOU_THRESH:
                    current[c] = bid
                    tracks[bid] = c
                else:
                    current[c] = next_id
                    tracks[next_id] = c
                    next_id += 1

            for box, vid in current.items():
                if vid in processed:
                    continue

                x1,y1,x2,y2 = box
                crop = frame[y1:y2, x1:x2]

                cx = (x1 + x2) // 2
                cy = (y1 + y2) // 2

                if ROI[0] < cx < ROI[2] and ROI[1] < cy < ROI[3]:
                    roi_frames[vid] += 1

                    if roi_frames[vid] >= MIN_ROI_FRAMES:
                        vehicle_buf[vid].append((sharp(crop), crop))
                        if len(vehicle_buf[vid]) > VEHICLE_BUF:
                            vehicle_buf[vid].pop(0)

                        plates = plate_model(crop, conf=0.4, verbose=False)[0]
                        for pb in plates.boxes:
                            px1,py1,px2,py2 = map(int, pb.xyxy[0])
                            cv2.rectangle(crop, (px1, py1), (px2, py2), (0, 0, 255), 2)
                            cv2.putText(crop, "Plate", (px1, py1 - 5),
                                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)

                            p = crop[py1:py2, px1:px2]
                            score = sharp(p) + p.shape[1]*SIZE_WEIGHT
                            plate_buf[vid].append((score, p))
                            if len(plate_buf[vid]) > PLATE_BUF:
                                plate_buf[vid].pop(0)

                if len(vehicle_buf[vid]) >= VEHICLE_BUF and len(plate_buf[vid]) >= PLATE_BUF:
                    best_vehicle = max(vehicle_buf[vid], key=lambda x:x[0])[1]
                    best_plate = max(plate_buf[vid], key=lambda x:x[0])[1]

                    plate_text, gray_p, ocr_p, bin_p = read_plate(best_plate)
                    cls = class_model(best_vehicle, verbose=False)[0]
                    cname = cls.names[cls.probs.top1]
                    color = predict_color(best_vehicle)

                    info_text = f"Plate: {plate_text} | Class: {cname} | Color: {color}"

                    if plate_text != "NOT FOUND" and len(plate_text) >= 6:
                        # ===== SEND TO NEXT.JS PORTAL =====
                        send_to_portal(
                            plate=plate_text,
                            vclass=cname,
                            color=color,
                            frame=best_vehicle
                        )

                    processed.add(vid)

            # ================= UI =================
            canvas = np.zeros((CANVAS_H, CANVAS_W, 3), np.uint8)
            canvas[10:10+VIDEO_H, 10:10+VIDEO_W] = cv2.resize(frame,(VIDEO_W,VIDEO_H))

            if best_vehicle is not None:
                canvas[560:760, 10:310] = cv2.resize(best_vehicle,(300,200))

            if best_plate is not None:
                canvas[560:680, 330:630] = cv2.resize(best_plate,(300,120))
                canvas[560:680, 650:770] = cv2.resize(cv2.cvtColor(gray_p,cv2.COLOR_GRAY2BGR),(120,120))
                canvas[560:680, 780:960] = cv2.resize(cv2.cvtColor(ocr_p,cv2.COLOR_GRAY2BGR),(180,120))
                canvas[560:680, 970:1150] = cv2.resize(cv2.cvtColor(bin_p,cv2.COLOR_GRAY2BGR),(180,120))

                labels = ["ORIGINAL", "GRAYSCALE", "RESIZED", "BINARY"]
                xs = [330, 650, 780, 970]
                for i, l in enumerate(labels):
                    cv2.putText(canvas, l, (xs[i], 705),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)

            cv2.putText(canvas, info_text, (330,520),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

            cv2.imshow("ANPR SYSTEM", canvas)
            if cv2.waitKey(SLOW_MS) & 0xFF == 27:
                break

        cap.release()
        cv2.destroyAllWindows()
    except Exception as e:
        print(f"Error running YOLO script: {e}")
