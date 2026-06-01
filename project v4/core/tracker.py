import numpy as np
from scipy.optimize import linear_sum_assignment

class KalmanBoxTracker:
    count = 0
    def __init__(self, bbox):
        """
        Initializes a tracker using a bounding box.
        bbox is [x1, y1, x2, y2]
        """
        # State vector: [u, v, s, r, u_dot, v_dot, s_dot]^T
        # u, v: center coordinates
        # s: scale (area)
        # r: aspect ratio (width / height)
        # u_dot, v_dot, s_dot: velocities
        self.x = np.zeros((7, 1))
        self.x[0:4] = self.bbox_to_z(bbox)
        
        # State transition matrix F
        self.F = np.array([
            [1, 0, 0, 0, 1, 0, 0],
            [0, 1, 0, 0, 0, 1, 0],
            [0, 0, 1, 0, 0, 0, 1],
            [0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0, 1, 0],
            [0, 0, 0, 0, 0, 0, 1]
        ], dtype=np.float32)
        
        # Measurement matrix H
        self.H = np.array([
            [1, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0]
        ], dtype=np.float32)
        
        # Covariance matrix P
        self.P = np.eye(7) * 10.0
        self.P[4:, 4:] *= 1000.0  # High initial uncertainty for velocities
        
        # Process noise covariance matrix Q
        self.Q = np.eye(7)
        self.Q[4:, 4:] *= 0.01
        
        # Measurement noise covariance matrix R
        self.R = np.eye(4)
        self.R[2:, 2:] *= 10.0
        
        self.id = KalmanBoxTracker.count
        KalmanBoxTracker.count += 1
        
        self.bbox = bbox
        self.time_since_update = 0
        self.history = []
        self.hits = 0
        self.age = 0

    def predict(self):
        """
        Advances the Kalman filter state vector using the transition matrix.
        """
        self.x = np.dot(self.F, self.x)
        # Prevent scale and aspect ratio from becoming negative
        self.x[2, 0] = max(1e-3, self.x[2, 0])
        self.x[3, 0] = max(1e-3, self.x[3, 0])
        
        self.P = np.dot(np.dot(self.F, self.P), self.F.T) + self.Q
        self.age += 1
        if self.time_since_update > 0:
            self.hits = 0
        self.time_since_update += 1
        
        self.bbox = self.z_to_bbox(self.x[0:4])
        self.history.append(self.bbox)
        return self.bbox

    def update(self, bbox):
        """
        Updates the Kalman filter state vector with the observed bbox.
        """
        self.time_since_update = 0
        self.history = []
        self.hits += 1
        
        z = self.bbox_to_z(bbox)
        y = z - np.dot(self.H, self.x)
        S = np.dot(np.dot(self.H, self.P), self.H.T) + self.R
        K = np.dot(np.dot(self.P, self.H.T), np.linalg.inv(S))
        
        self.x = self.x + np.dot(K, y)
        # Prevent scale and aspect ratio from becoming negative
        self.x[2, 0] = max(1e-3, self.x[2, 0])
        self.x[3, 0] = max(1e-3, self.x[3, 0])
        
        self.P = np.dot(np.eye(7) - np.dot(K, self.H), self.P)
        self.bbox = bbox

    def bbox_to_z(self, bbox):
        """
        Converts bbox [x1, y1, x2, y2] to measurement vector z = [u, v, s, r]^T.
        """
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        u = bbox[0] + w / 2.0
        v = bbox[1] + h / 2.0
        s = w * h
        r = w / (h + 1e-6)
        return np.array([[u], [v], [s], [r]])

    def z_to_bbox(self, z):
        """
        Converts measurement vector z = [u, v, s, r]^T to bbox [x1, y1, x2, y2].
        """
        u, v, s, r = z[0, 0], z[1, 0], z[2, 0], z[3, 0]
        # Prevent negative scale and aspect ratio to avoid NaN inside sqrt
        s = max(1e-3, s)
        r = max(1e-3, r)
        w = np.sqrt(s * r)
        h = s / (w + 1e-6)
        x1 = u - w / 2.0
        y1 = v - h / 2.0
        x2 = u + w / 2.0
        y2 = v + h / 2.0
        return [x1, y1, x2, y2]


class IOUTracker:
    def __init__(self, iou_threshold: float = 0.3, max_age: int = 3):
        """
        Initializes the SORT Kalman Box tracker.
        Names kept drop-in compatible with the existing ANPR pipeline.
        """
        self.iou_threshold = iou_threshold
        self.max_age = max_age
        self.trackers = []
        self.tracks = {}  # Active tracks dictionary: {track_id: (x1, y1, x2, y2)}

    def _iou(self, a, b):
        """
        Computes standard Intersection over Union (IoU) between bounding boxes a and b.
        """
        xA, yA = max(a[0], b[0]), max(a[1], b[1])
        xB, yB = min(a[2], b[2]), min(a[3], b[3])
        
        inter = max(0, xB - xA) * max(0, yB - yA)
        areaA = (a[2] - a[0]) * (a[3] - a[1])
        areaB = (b[2] - b[0]) * (b[3] - b[1])
        
        return inter / (areaA + areaB - inter + 1e-6)

    def update(self, detections):
        """
        Updates trackers with current frame detections using Hungarian linear sum assignment.
        detections: list of bounding boxes [(x1, y1, x2, y2)]
        Returns a dictionary of active matched tracks: {track_id: (x1, y1, x2, y2)}
        """
        # 1. Get predictions from existing trackers
        predictions = []
        for t in self.trackers:
            predictions.append(t.predict())
            
        # 2. Compute the Cost Matrix (1 - IoU)
        iou_matrix = np.zeros((len(detections), len(predictions)), dtype=np.float32)
        for d_idx, d_box in enumerate(detections):
            for p_idx, p_box in enumerate(predictions):
                iou_matrix[d_idx, p_idx] = self._iou(d_box, p_box)
                
        # 3. Hungarian Association (Linear Sum Assignment)
        cost_matrix = -iou_matrix
        row_ind, col_ind = linear_sum_assignment(cost_matrix)
        
        matched_indices = []
        for r, c in zip(row_ind, col_ind):
            if iou_matrix[r, c] >= self.iou_threshold:
                matched_indices.append((r, c))
                
        unmatched_detections = [d for d in range(len(detections)) if d not in [m[0] for m in matched_indices]]
        
        # 4. Update matched trackers with detections
        for d_idx, t_idx in matched_indices:
            self.trackers[t_idx].update(detections[d_idx])
            
        # 5. Spawn new trackers for unmatched detections
        for d_idx in unmatched_detections:
            self.trackers.append(KalmanBoxTracker(detections[d_idx]))
            
        # 6. Filter active trackers and populate the dynamic dictionary
        ret_tracks = {}
        active_trackers = []
        for t in self.trackers:
            if t.time_since_update <= self.max_age:
                active_trackers.append(t)
                
                # Only expose to visual output if updated in this frame (matches standard SORT logic)
                if t.time_since_update == 0:
                    ret_tracks[t.id] = tuple(t.bbox)
            
        self.trackers = active_trackers
        self.tracks = ret_tracks
        return ret_tracks
