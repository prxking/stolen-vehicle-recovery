import cv2  # type: ignore
import numpy as np  # type: ignore
from paddleocr import PaddleOCR  # type: ignore
ocr = PaddleOCR(lang='en')
img = np.zeros((64, 200, 3), dtype=np.uint8)
res = ocr.predict(img)
for r in res:
    print(type(r))
    try:
        print(r.keys())
    except:
        pass
    print(r)
