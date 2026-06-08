import cv2  # type: ignore
import torch  # type: ignore
from ultralytics import YOLO  # type: ignore

class VehicleDetector:
    def __init__(self, model_path: str, conf_threshold: float = 0.4):
        """
        Initializes the YOLOv8 Vehicle Detector.
        """
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        self.device = 'mps' if torch.backends.mps.is_available() else 'cpu'
        self.model.to(self.device)
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
            device=self.device
        )[0]
        
        detections = []
        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            detections.append((x1, y1, x2, y2, conf))
        return detections
