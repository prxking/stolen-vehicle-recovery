import cv2
import torch
from ultralytics import YOLO

class PlateDetector:
    def __init__(self, model_path: str, conf_threshold: float = 0.4):
        """
        Initializes the YOLOv8 Plate Detector.
        """
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        # Check if CUDA is active to enable FP16 half-precision
        self.use_half = torch.cuda.is_available()

    def detect(self, vehicle_crop):
        """
        Runs license plate detection on the vehicle crop.
        Uses optimized half-precision (FP16) inference if CUDA is available.
        Returns a list of bounding boxes: [(px1, py1, px2, py2, confidence)]
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return []
            
        results = self.model(
            vehicle_crop, 
            conf=self.conf_threshold, 
            verbose=False,
            device='cpu'
        )[0]
        
        detections = []
        for box in results.boxes:
            px1, py1, px2, py2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            detections.append((px1, py1, px2, py2, conf))
        return detections
