import cv2  # type: ignore
import numpy as np  # type: ignore
import time  # type: ignore

class TacticalDisplay:
    """
    OpenCV-based implementation of TacticalDisplay that generates a NumPy array
    for seamless streaming to the web app without popping up a Tkinter window.
    """
    def __init__(self, canvas_w=1200, canvas_h=800, video_w=692, video_h=480):
        self.canvas_w = canvas_w
        self.canvas_h = canvas_h
        self.video_w = video_w
        self.video_h = video_h

        # State variables
        self.canvas = np.zeros((self.canvas_h, self.canvas_w, 3), dtype=np.uint8)
        self.ai_fps = 0.0
        self.gui_fps = 0.0
        
        self.last_detection = {
            "plate": "WAITING...",
            "make_model": "WAITING...",
            "color": "WAITING...",
            "time": "--:--:--",
            "confidence": 0.0
        }
        
        self.video_frame = np.zeros((self.video_h, self.video_w, 3), dtype=np.uint8)
        self.crops = {
            "DET. VEHICLE": None,
            "DET. PLATE": None,
            "GRAYSCALE CROP": None,
            "CLAHE ENHANCED": None
        }

        self._draw_static_layout()

    def _draw_static_layout(self):
        self.canvas.fill(16) # Dark background #101010
        
        # Draw outlines
        cv2.rectangle(self.canvas, (10, 10), (10 + self.video_w, 10 + self.video_h), (50, 50, 50), 2)
        cv2.rectangle(self.canvas, (720, 10), (1190, 500), (50, 50, 50), 2)
        
        for i in range(4):
            cv2.rectangle(self.canvas, (10 + i * 200, 510), (190 + i * 200, 780), (50, 50, 50), 2)

        # Right Panel Stat labels
        labels = [
            "SYSTEM STATUS",
            "OCR VOTING CONFIDENCE",
            "NUMBER PLATE",
            "MAKE",
            "COLOR",
            "FRAME RATE"
        ]
        
        y_offset = 50
        for lbl in labels:
            cv2.putText(self.canvas, lbl, (740, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
            cv2.rectangle(self.canvas, (740, y_offset + 10), (1170, y_offset + 40), (30, 30, 30), -1)
            cv2.rectangle(self.canvas, (740, y_offset + 10), (1170, y_offset + 40), (100, 100, 100), 1)
            y_offset += 75

        # Target Dossier
        cv2.putText(self.canvas, "[ TARGET DOSSIER ]", (900, 530), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)
        
        # Header OCR cell
        cv2.putText(self.canvas, "FINAL OCR ELECT", (920, 600), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)
        
    def _paste_crop(self, title, img, idx, bottom_label=None):
        if img is None or img.size == 0:
            return
            
        w, h = 180, 230
        cell_x = 10 + idx * 200
        bottom_y = 510
        
        if len(img.shape) == 2:
            img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

        ih, iw = img.shape[:2]
        margin_bottom = 28 if bottom_label else 5
        avail_h = h - margin_bottom - 5
        
        scale = min(w / iw, avail_h / ih)
        nw, nh = int(iw * scale), int(ih * scale)
        
        if nw > 0 and nh > 0:
            resized = cv2.resize(img, (nw, nh))
            dx = cell_x + (w - nw) // 2
            dy = bottom_y + 5 + (avail_h - nh) // 2
            
            self.canvas[bottom_y+5:bottom_y+5+avail_h, cell_x:cell_x+w] = 12
            self.canvas[dy:dy+nh, dx:dx+nw] = resized

        if bottom_label:
            cv2.putText(self.canvas, bottom_label, (cell_x + 10, bottom_y + h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (150, 150, 150), 1)
            
        cv2.putText(self.canvas, title, (cell_x + 10, bottom_y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

    def update_metrics(self, ai_fps, gui_fps):
        self.ai_fps = ai_fps
        self.gui_fps = gui_fps

    def update_video_frame(self, bgr_frame):
        if bgr_frame is not None and bgr_frame.size > 0:
            resized = cv2.resize(bgr_frame, (self.video_w, self.video_h))
            self.video_frame = resized

    def update_detection_panel(self, plate, make_model, color, confidence):
        self.last_detection = {
            "plate": plate.upper(),
            "make_model": make_model.upper(),
            "color": color.upper(),
            "time": time.strftime("%H:%M:%S"),
            "confidence": confidence
        }

    def update_preprocessing_crops(self, vehicle_crop, plate_crop, ocr_steps):
        self.crops["DET. VEHICLE"] = vehicle_crop
        self.crops["DET. PLATE"] = plate_crop
        if ocr_steps:
            self.crops["GRAYSCALE CROP"] = ocr_steps.get('grayscale')
            self.crops["CLAHE ENHANCED"] = ocr_steps.get('clahe')

    def render(self):
        # Refresh dynamic text
        self._draw_static_layout()
        
        # 1. Video Frame
        self.canvas[10:10+self.video_h, 10:10+self.video_w] = self.video_frame
        
        # 2. Right Panel Metrics
        det = self.last_detection
        y_offset = 50
        
        cv2.putText(self.canvas, "RUNNING", (750, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        y_offset += 75
        cv2.putText(self.canvas, f"{det['confidence']*100:.1f} %", (750, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
        y_offset += 75
        cv2.putText(self.canvas, det['plate'], (750, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        y_offset += 75
        cv2.putText(self.canvas, det['make_model'], (750, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        y_offset += 75
        cv2.putText(self.canvas, det['color'], (750, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        y_offset += 75
        cv2.putText(self.canvas, f"AI: {self.ai_fps:.1f} | GUI: {self.gui_fps:.1f} FPS", (750, y_offset + 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

        # 3. Target Dossier (Bottom Right)
        cv2.putText(self.canvas, f"PLATE: {det['plate']}", (900, 560), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        cv2.putText(self.canvas, f"SCORE: {det['confidence']*100:.1f} %", (900, 580), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        cv2.putText(self.canvas, f"TIME: {det['time']}", (900, 540), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
        
        cv2.rectangle(self.canvas, (900, 610), (1150, 710), (255, 255, 255), -1)
        
        plate_text = det['plate']
        font_scale = 1.5
        font_thickness = 4
        text_size, _ = cv2.getTextSize(plate_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
        
        max_width = 230
        if text_size[0] > max_width:
            font_scale = font_scale * (max_width / text_size[0])
            font_thickness = max(1, int(font_thickness * (max_width / text_size[0])))
            text_size, _ = cv2.getTextSize(plate_text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness)
            
        box_w = 250
        box_h = 100
        text_x = 900 + int((box_w - text_size[0]) / 2)
        text_y = 610 + int((box_h + text_size[1]) / 2)
        
        cv2.putText(self.canvas, plate_text, (text_x, text_y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), font_thickness)

        # 4. Crops
        if self.crops["DET. VEHICLE"] is not None:
            c = self.crops["DET. VEHICLE"]
            self._paste_crop("DET. VEHICLE", c, 0, f"SIZE:{c.shape[1]}x{c.shape[0]}")
        if self.crops["DET. PLATE"] is not None:
            c = self.crops["DET. PLATE"]
            self._paste_crop("DET. PLATE", c, 1, f"SIZE:{c.shape[1]}x{c.shape[0]}")
        if self.crops["GRAYSCALE CROP"] is not None:
            c = self.crops["GRAYSCALE CROP"]
            self._paste_crop("GRAYSCALE CROP", c, 2, f"SIZE:{c.shape[1]}x{c.shape[0]}")
        if self.crops["CLAHE ENHANCED"] is not None:
            c = self.crops["CLAHE ENHANCED"]
            self._paste_crop("CLAHE ENHANCED", c, 3, "CLAH COMPLIANT")

        return self.canvas
