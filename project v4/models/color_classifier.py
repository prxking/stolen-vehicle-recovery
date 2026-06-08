import cv2  # type: ignore
import torch  # type: ignore
import torch.nn as nn  # type: ignore
import torchvision.transforms as T  # type: ignore
import torchvision.models as models  # type: ignore

class ColorClassifier:
    COLOR_CLASSES = [
        "beige", "black", "blue", "brown", "gold", "green", "grey",
        "orange", "pink", "purple", "red", "silver", "tan", "white", "yellow"
    ]

    def __init__(self, model_path: str, device: str = "cpu"):
        """
        Initializes the MobileNetV3 Color Classifier model.
        """
        self.device = device
        num_colors = len(self.COLOR_CLASSES)
        
        # Load MobileNetV3 architecture
        self.model = models.mobilenet_v3_large(weights=None)
        self.model.classifier[3] = nn.Linear(1280, num_colors)
        
        # Load state dictionary from path
        state_dict = torch.load(model_path, map_location=device)
        self.model.load_state_dict(state_dict)
        self.model.to(device)
        self.model.eval()

        # Image transforms matching trained MobileNetV3 pipeline
        self.transform = T.Compose([
            T.ToPILImage(),
            T.Resize((224, 224)),
            T.ToTensor(),
            T.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

    @torch.no_grad()
    def classify(self, vehicle_crop):
        """
        Classifies the color of the vehicle image crop.
        Returns the predicted color string.
        """
        if vehicle_crop is None or vehicle_crop.size == 0:
            return "UNKNOWN"
            
        # Convert OpenCV BGR format to RGB as expected by torchvision transforms
        img_rgb = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2RGB)
        tensor = self.transform(img_rgb).unsqueeze(0).to(self.device)
        
        logits = self.model(tensor)
        idx = torch.argmax(logits, dim=1).item()
        return self.COLOR_CLASSES[idx]
