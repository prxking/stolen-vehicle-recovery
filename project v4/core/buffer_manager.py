import time
import cv2
import numpy as np

class VehicleBuffer:
    def __init__(self, track_id: int):
        """
        Initializes a sliding buffer queue for a specific vehicle track ID.
        """
        self.track_id = track_id
        self.frames = []  # List of dictionaries, maintaining at most 10 vehicle crops
        self.processed = False  # Track if this vehicle has been evaluated

    def add_frame(self, frame_num: int, vehicle_crop, bbox, timestamp: float = None):
        """
        Appends a vehicle frame crop, bounding box, timestamp, area, and sharpness to the sliding buffer.
        Maintains a maximum buffer size of 10 vehicle frames (sliding window).
        """
        if timestamp is None:
            timestamp = time.time()

        if vehicle_crop is None or vehicle_crop.size == 0:
            return

        # Calculate sharpness using Laplacian variance
        gray = cv2.cvtColor(vehicle_crop, cv2.COLOR_BGR2GRAY)
        sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        x1, y1, x2, y2 = bbox
        area = (x2 - x1) * (y2 - y1)

        self.frames.append({
            'frame_num': frame_num,
            'crop': vehicle_crop.copy(),
            'area': area,
            'sharpness': sharpness,
            'bbox': bbox,
            'timestamp': timestamp
        })

        # Queue behavior: keep maximum 10 oldest frames
        if len(self.frames) > 10:
            self.frames.pop(0)


class BufferManager:
    def __init__(self):
        """
        Manages sliding buffers for all tracked vehicles.
        """
        self.buffers = {}  # {track_id: VehicleBuffer}

    def get_buffer(self, track_id: int) -> VehicleBuffer:
        """
        Retrieves or initializes a VehicleBuffer for a given track ID.
        """
        if track_id not in self.buffers:
            self.buffers[track_id] = VehicleBuffer(track_id)
        return self.buffers[track_id]

    def remove_buffer(self, track_id: int):
        """
        Removes the vehicle buffer when it's no longer needed.
        """
        if track_id in self.buffers:
            del self.buffers[track_id]
