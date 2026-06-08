import cv2  # type: ignore
from ultralytics import YOLO  # type: ignore

class VehicleClassifier:
    def __init__(self, model_path: str):
        """
        Initializes the YOLOv8 Vehicle Classifier.
        """
        self.model = YOLO(model_path)
        import torch  # type: ignore
        self.device = 'mps' if torch.backends.mps.is_available() else 'cpu'
        self.model.to(self.device)

    def classify(self, vehicle_crop):
        """
        Classifies the make/model of the vehicle crop.
        Returns a tuple: (class_name, confidence)
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return "UNKNOWN", 0.0
        results = self.model(vehicle_crop, verbose=False, device=self.device)[0]
        if results.probs is not None:
            top1_idx = results.probs.top1
            class_name = results.names[top1_idx]
            confidence = float(results.probs.top1conf)
            return class_name, confidence
        return "UNKNOWN", 0.0
