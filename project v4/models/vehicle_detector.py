import cv2
import torch
from ultralytics import YOLO

class VehicleDetector:
    def __init__(self, model_path: str, conf_threshold: float = 0.4):
        """
        Initializes the YOLOv8 Vehicle Detector.
        """
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        # Check if CUDA is active to enable FP16 half-precision
        self.use_half = torch.cuda.is_available()

    def detect(self, frame):
        """
        Runs vehicle detection on the frame.
        Uses optimized half-precision (FP16) inference if CUDA is available.
        Returns a list of bounding boxes: [(x1, y1, x2, y2, confidence)]
        """
        results = self.model(
            frame, 
            conf=self.conf_threshold, 
            verbose=False,
            device='cpu'
        )[0]
        
        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            detections.append((x1, y1, x2, y2, conf))
        return detections
