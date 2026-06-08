import cv2  # type: ignore
import numpy as np  # type: ignore
from paddleocr import PaddleOCR  # type: ignore

ocr = PaddleOCR(lang='en')
img = np.zeros((100, 200, 3), dtype=np.uint8)
try:
    print("Testing .ocr()...")
    res = ocr.ocr(img)
    print("OCR returned:", type(res))
except Exception as e:
    print(".ocr() failed:", type(e).__name__, e)

try:
    print("Testing .predict()...")
    res = ocr.predict(img)
    print("Predict returned:", type(res))
    if isinstance(res, list) and len(res) > 0:
        print("First item dict keys:", res[0].keys() if isinstance(res[0], dict) else dir(res[0]))
except Exception as e:
    print(".predict() failed:", type(e).__name__, e)
