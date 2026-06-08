import sys  # type: ignore
import os  # type: ignore
import cv2  # type: ignore
import json  # type: ignore
import torch  # type: ignore
import torchvision.transforms as T  # type: ignore
import torchvision.models as models  # type: ignore
import torch.nn as nn  # type: ignore
from ultralytics import YOLO  # type: ignore
from paddleocr import PaddleOCR  # type: ignore
from collections import defaultdict  # type: ignore
import re  # type: ignore

os.environ["FLAGS_log_level"] = "3"

BASE_DIR = "/Users/prasanth/Documents/project v1"
VEHICLE_MODEL_PATH = os.path.join(BASE_DIR, "anpr_pipeline/models/train1/weights/best.pt")
PLATE_MODEL_PATH   = os.path.join(BASE_DIR, "anpr_pipeline/models/train2/weights/best.pt")
CLASS_MODEL_PATH   = os.path.join(BASE_DIR, "anpr_pipeline/models/train3/weights/best.pt")
COLOR_MODEL_PATH   = os.path.join(BASE_DIR, "anpr_pipeline/models/colour_detection/mobilenetv3_vehicle_color.pth")
VIDEO_PATH         = os.path.join(BASE_DIR, "lulu2.mp4")

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

try:
    vehicle_model = YOLO(VEHICLE_MODEL_PATH)
    plate_model   = YOLO(PLATE_MODEL_PATH)
    class_model   = YOLO(CLASS_MODEL_PATH)
except Exception as e:
    print(f"Failed to load YOLO models: {e}")
    sys.exit(1)

ocr = PaddleOCR(lang='en', use_angle_cls=False)

COLOR_CLASSES = [
    "beige","black","blue","brown","gold","green","grey",
    "orange","pink","purple","red","silver","tan","white","yellow"
]
NUM_COLORS = len(COLOR_CLASSES)

try:
    color_model = models.mobilenet_v3_large(weights=None)
    color_model.classifier[3] = nn.Linear(1280, NUM_COLORS)
    color_model.load_state_dict(torch.load(COLOR_MODEL_PATH, map_location=DEVICE))
    color_model.to(DEVICE)
    color_model.eval()
except Exception as e:
    print(f"Failed to load color model: {e}")

color_tf = T.Compose([
    T.ToPILImage(),
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

VEHICLE_BUF = 18
PLATE_BUF   = 6
IOU_THRESH  = 0.4
MIN_ROI_FRAMES = 12
TARGET_OCR_H = 64
SIZE_WEIGHT = 0.15

def sharp(img):
    return cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()

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
    resized_bgr = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
    result = ocr.ocr(resized_bgr)
    best, conf = "NOT FOUND", 0
    if result and result[0]:
        for r in result[0]:
            txt, c = r[1]
            txt = txt.replace(" ", "").replace("-", "")
            if c > conf and len(txt) >= 6:
                best, conf = txt, c
    return postprocess_plate(best)

@torch.no_grad()
def predict_color(vehicle_img):
    img = cv2.cvtColor(vehicle_img, cv2.COLOR_BGR2RGB)
    img = color_tf(img).unsqueeze(0).to(DEVICE)
    logits = color_model(img)
    idx = torch.argmax(logits, dim=1).item()
    return COLOR_CLASSES[idx]

cap = cv2.VideoCapture(VIDEO_PATH)
tracks, next_id = {}, 0
vehicle_buf = defaultdict(list)
plate_buf = defaultdict(list)
roi_frames = defaultdict(int)
processed = set()

extracted_data = []

print("Extracting plates from video...")
frame_idx = 0
# Process max 500 frames to save time, adjust if needed
MAX_FRAMES = 500

while cap.isOpened() and frame_idx < MAX_FRAMES:
    ret, frame = cap.read()
    if not ret: break
    frame_idx += 1
    if frame_idx % 50 == 0:
        print(f"Processed {frame_idx} frames...")
        
    h, w = frame.shape[:2]
    ROI = (int(0.18*w), int(0.35*h), int(0.80*w), int(0.98*h))
    dets = vehicle_model(frame, conf=0.4, verbose=False)[0]
    current = {}
    for b in dets.boxes:
        current[tuple(map(int, b.xyxy[0]))] = None
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
        if vid in processed: continue
        x1,y1,x2,y2 = box
        crop = frame[y1:y2, x1:x2]
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        if ROI[0] < cx < ROI[2] and ROI[1] < cy < ROI[3]:
            roi_frames[vid] += 1
            if roi_frames[vid] >= MIN_ROI_FRAMES:
                vehicle_buf[vid].append((sharp(crop), crop))
                if len(vehicle_buf[vid]) > VEHICLE_BUF: vehicle_buf[vid].pop(0)
                plates = plate_model(crop, conf=0.4, verbose=False)[0]
                for pb in plates.boxes:
                    px1,py1,px2,py2 = map(int, pb.xyxy[0])
                    p = crop[py1:py2, px1:px2]
                    score = sharp(p) + p.shape[1]*SIZE_WEIGHT
                    plate_buf[vid].append((score, p))
                    if len(plate_buf[vid]) > PLATE_BUF: plate_buf[vid].pop(0)
        
        if len(vehicle_buf[vid]) >= VEHICLE_BUF and len(plate_buf[vid]) >= PLATE_BUF:
            best_vehicle = max(vehicle_buf[vid], key=lambda x:x[0])[1]
            best_plate = max(plate_buf[vid], key=lambda x:x[0])[1]
            plate_text = read_plate(best_plate)
            cls = class_model(best_vehicle, verbose=False)[0]
            cname = cls.names[cls.probs.top1]
            color = predict_color(best_vehicle)
            if plate_text != "NOT FOUND" and len(plate_text) >= 6:
                extracted_data.append({
                    "plateNumber": plate_text,
                    "make": cname.split(" ")[0] if cname else "Unknown",
                    "model": cname,
                    "color": color
                })
                print(f"Extracted: {plate_text} {cname} {color}")
            processed.add(vid)

cap.release()

# Save extracted plates
out_path = os.path.join(os.path.dirname(__file__), "extracted_plates.json")
with open(out_path, "w") as f:
    json.dump(extracted_data, f, indent=2)

print(f"Extraction complete! Saved {len(extracted_data)} plates to {out_path}")
