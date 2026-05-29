import cv2
import numpy as np
from paddleocr import PaddleOCR
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
