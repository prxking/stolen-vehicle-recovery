import cv2  # type: ignore
import numpy as np  # type: ignore
import re  # type: ignore
import torch  # type: ignore
from paddleocr import PaddleOCR  # type: ignore

# Automatically configure hardware acceleration device
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

class PlatePreprocessor:
    def __init__(self, ocr_lang: str = 'en'):
        """
        Initializes the Plate Preprocessor and the PaddleOCR engine.
        Optimized for high-speed CPU/GPU execution.
        """
        self.ocr = PaddleOCR(lang=ocr_lang, use_angle_cls=True)
        self.clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        
        # Soft sharpening kernel to highlight character strokes (e.g. diagonals of M/Z, tail of Q)
        self.sharpen_kernel = np.array([
            [0, -0.2, 0],
            [-0.2, 1.8, -0.2],
            [0, -0.2, 0]
        ], dtype=np.float32)

    def preprocess(self, plate_bgr):
        """
        Executes the exact requested preprocessing pipeline:
        Detected Plate -> Aspect Resize (96px) -> Border Padding (15px) -> Grayscale -> CLAHE
        Generates the 4 highly optimized multi-version OCR testing candidates.
        """
        steps = {}
        
        if plate_bgr is None or plate_bgr.size == 0:
            return None

        # Step 1: Aspect Ratio Preserving Resize
        # Scale to a standard height (96 pixels) preserving width aspect ratio
        h, w = plate_bgr.shape[:2]
        target_h = 96
        scale = target_h / h
        target_w = int(w * scale)
        target_w = max(1, target_w)
        resized = cv2.resize(plate_bgr, (target_w, target_h), interpolation=cv2.INTER_CUBIC)
        steps['resized'] = resized.copy()

        # Step 2: Border Padding
        # Add 15px black border on all sides to prevent text clipping
        padded = cv2.copyMakeBorder(resized, 15, 15, 15, 15, cv2.BORDER_CONSTANT, value=[0, 0, 0])
        steps['padded'] = padded.copy()

        # Step 3: Grayscale conversion
        grayscale = cv2.cvtColor(padded, cv2.COLOR_BGR2GRAY)
        steps['grayscale'] = grayscale.copy()

        # Step 4: CLAHE Contrast Enhancement
        clahe = self.clahe.apply(grayscale)
        steps['clahe'] = clahe.copy()

        # Generate 4 advanced, highly tuned preprocessing variants for multiversion testing:
        
        # Candidate 1: CLAHE + Morphological Top-Hat + 3x Upscaling
        # Exceptionally good at preserving internal diagonals of M/Z and details of Q
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        tophat = cv2.morphologyEx(clahe, cv2.MORPH_TOPHAT, kernel)
        combined = cv2.add(clahe, tophat)
        steps['candidate_1'] = cv2.resize(combined, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
        
        # Candidate 2: CLAHE + Bilateral Filter + Unsharp Masking + 3x Upscaling
        # Edge-preserving texture smoothing followed by unsharp masking
        bilateral = cv2.bilateralFilter(clahe, 5, 50, 50)
        blurred = cv2.GaussianBlur(bilateral, (3, 3), 0)
        unsharp = cv2.addWeighted(bilateral, 1.8, blurred, -0.8, 0)
        unsharp = np.clip(unsharp, 0, 255).astype(np.uint8)
        steps['candidate_2'] = cv2.resize(unsharp, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
        
        # Candidate 3: CLAHE + Soft Sharpening + 3x Upscaling
        clahe_sharpened = cv2.filter2D(clahe, -1, self.sharpen_kernel)
        clahe_sharpened = np.clip(clahe_sharpened, 0, 255).astype(np.uint8)
        steps['candidate_3'] = cv2.resize(clahe_sharpened, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)
        
        # Candidate 4: CLAHE + Denoise + Soft Sharpen + 3x Upscaling
        # Ultimate multi-stage pipeline: Denoise -> Sharpen -> Upscale
        denoised = cv2.fastNlMeansDenoising(clahe, None, h=8, templateWindowSize=7, searchWindowSize=21)
        sharpened_denoised = cv2.filter2D(denoised, -1, self.sharpen_kernel)
        sharpened_denoised = np.clip(sharpened_denoised, 0, 255).astype(np.uint8)
        steps['candidate_4'] = cv2.resize(sharpened_denoised, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)

        return steps

    def clean_text(self, text):
        """
        Cleans and standardizes the OCR plate text using Indian plate syntax.
        Forces letters/digits in respective positions to correct common OCR confusions.
        Matches standard Indian formats:
        - 2 letters (state code, e.g. KL, DL)
        - 2 digits (district code, e.g. 01, 16, 81)
        - Optional 1-2 letters (series code, e.g. A, CM, Z, CQ)
        - 4 digits (unique plate number, e.g. 8731, 5472)
        """
        # Keep only alphanumeric characters and uppercase
        text = ''.join(c for c in text.upper() if c.isalnum())
        
        char_list = list(text)
        n = len(char_list)
        if n < 4:
            return text
        
        letter_to_digit = {
            'O': '0', 'Q': '0', 'D': '0',
            'I': '1', 'T': '1', 'L': '1', 'J': '1',
            'Z': '2',
            'S': '5',
            'G': '6',
            'A': '4',
            'B': '8'
        }
        
        digit_to_letter = {
            '0': 'O',
            '1': 'I',
            '2': 'Z',
            '3': 'J',
            '4': 'A',
            '5': 'S',
            '6': 'G',
            '7': 'Z',
            '8': 'B',
            '9': 'P'
        }
        
        def force_letter(idx):
            if idx < n and char_list[idx].isdigit():
                char_list[idx] = digit_to_letter.get(char_list[idx], char_list[idx])
                
        def force_digit(idx):
            if idx < n and char_list[idx].isalpha():
                char_list[idx] = letter_to_digit.get(char_list[idx], char_list[idx])

        # Force state code (index 0, 1) to be letters
        force_letter(0)
        force_letter(1)
        
        # State-level corrections for common visual confusions (e.g. X/K, O/0/Q/D)
        if n >= 2:
            state_code = ''.join(char_list[:2])
            if state_code == "XL":
                char_list[0] = 'K'
            elif state_code in ["OL", "0L", "QL"]:
                char_list[0] = 'D'
                char_list[1] = 'L'
        
        # Force district code (index 2, 3) to be digits
        force_digit(2)
        force_digit(3)
        
        # Force last 4 characters to be digits
        for i in range(max(4, n - 4), n):
            force_digit(i)
            
        # Force series characters to be letters and resolve RTO 'O'/'I' middle alphabet exclusions
        if n == 9:
            # Format: LL DD L DDDD (e.g. KL 16 Z 3942)
            force_letter(4)
            if char_list[4] in ['O', '0']:
                char_list[4] = 'Q'
        elif n == 10:
            # Format: LL DD LL DDDD (e.g. DL 12 CQ 9923)
            force_letter(4)
            force_letter(5)
            if char_list[4] in ['O', '0']:
                char_list[4] = 'Q'
            if char_list[5] in ['O', '0']:
                char_list[5] = 'Q'
            
        return ''.join(char_list)[:10]

    def run_ocr(self, preprocessed_gray):
        """
        Runs PaddleOCR on the preprocessed plate image.
        """
        if preprocessed_gray is None:
            return "NOTFOUND", 0.0

        # PaddleOCR expects 3 channels
        ocr_input = cv2.cvtColor(preprocessed_gray, cv2.COLOR_GRAY2BGR)
        results = self.ocr.predict(ocr_input)

        best_text = "NOTFOUND"
        best_score = 0.0

        if results:
            for res in results:
                if res is None: continue
                if 'rec_texts' in res and 'rec_scores' in res:
                    texts = res['rec_texts']
                    scores = res['rec_scores']
                    if texts and scores:
                        # Combine all detected lines (useful for two-line Indian license plates)
                        combined_text = ""
                        min_score = 1.0
                        for text, score in zip(texts, scores):
                            cleaned_text = text.replace(" ", "").replace("-", "")
                            if len(cleaned_text) > 0:
                                combined_text += cleaned_text
                                min_score = min(min_score, score)
                                
                        if len(combined_text) >= 4 and min_score > 0:
                            best_text = combined_text
                            best_score = min_score

        return self.clean_text(best_text), best_score

    def run_ocr_multiversion(self, steps):
        """
        Runs PaddleOCR on all 4 preprocessed candidates.
        Logs the results for each variant, and returns:
        (best_text, best_score, best_variant_name)
        """
        variants = {
            'CLAHE_MORPH_TOPHAT_3X': steps.get('candidate_1'),
            'CLAHE_BILATERAL_UNSHARP_3X': steps.get('candidate_2'),
            'CLAHE_SHARPENED_3X': steps.get('candidate_3'),
            'CLAHE_DENOISED_SHARPENED_3X': steps.get('candidate_4')
        }
        
        best_text = "NOTFOUND"
        best_score = 0.0
        best_variant = 'CLAHE_SHARPENED'
        
        for name, img in variants.items():
            if img is None:
                continue
            text, score = self.run_ocr(img)
            print(f"OCR Variant: {name} | Text: {text} | Confidence: {score:.4f}")
            
            if score > best_score and len(text) >= 4:
                best_score = score
                best_text = text
                best_variant = name
                
            # EARLY-EXIT LOGIC:
            # If the candidate detects an extremely high confidence and syntactically valid RTO plate,
            # we can early-exit immediately to save massive processing time!
            valid_states = {"AN", "AP", "AR", "AS", "BR", "CH", "CG", "DD", "DL", "DN", "GA", "GJ", "HR", "HP", "JK", "JH", "KA", "KL", "LA", "LD", "MP", "MH", "MN", "ML", "MZ", "NL", "OD", "PY", "PB", "RJ", "SK", "TN", "TS", "TR", "UP", "UK", "UA", "WB"}
            if score >= 0.95 and len(text) >= 8 and text[:2] in valid_states and text[2:4].isdigit():
                print(f"  [OCR Early-Exit triggered for {name} with high confidence: {score:.4f}]")
                break
                
        return best_text, best_score, best_variant
