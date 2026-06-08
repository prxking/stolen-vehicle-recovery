import cv2
import torch
import time
import numpy as np
from ultralytics import YOLO

def test():
    model = YOLO("weights/plate_detector.pt")
    model.to('mps')
    
    # Create a small dummy crop (typical vehicle crop size)
    crop = np.random.randint(0, 255, (200, 150, 3), dtype=np.uint8)
    
    print("Testing bare crop (might freeze...)")
    t0 = time.time()
    try:
        model(crop, device='mps', verbose=False)
        print(f"Bare crop took {time.time() - t0:.3f}s")
    except Exception as e:
        print(e)
        
    # Create padded crop
    padded = np.zeros((640, 640, 3), dtype=np.uint8)
    padded[:crop.shape[0], :crop.shape[1]] = crop
    
    print("Testing padded crop (640x640)...")
    t0 = time.time()
    model(padded, device='mps', verbose=False)
    print(f"Padded crop took {time.time() - t0:.3f}s")
    
    print("Testing padded crop again to check cache...")
    t0 = time.time()
    model(padded, device='mps', verbose=False)
    print(f"Padded crop 2 took {time.time() - t0:.3f}s")

if __name__ == "__main__":
    test()
