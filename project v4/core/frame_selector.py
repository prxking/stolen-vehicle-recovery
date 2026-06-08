import numpy as np  # type: ignore

class FrameSelector:
    @staticmethod
    def select_best_vehicle(candidate_frames):
        """
        Selects the best vehicle frame crop from the sliding buffer.
        Uses a weighted ranking of bounding box area and Laplacian sharpness.
        """
        if not candidate_frames:
            return None
        
        # Find maximum values for normalization
        areas = [f['area'] for f in candidate_frames]
        sharpnesses = [f['sharpness'] for f in candidate_frames]
        
        max_area = max(areas) if areas else 1.0
        max_sharp = max(sharpnesses) if sharpnesses else 1.0
        
        best_frame = None
        best_score = -1.0
        
        for f in candidate_frames:
            norm_area = f['area'] / (max_area + 1e-6)
            norm_sharp = f['sharpness'] / (max_sharp + 1e-6)
            
            # Weighted scoring: 60% size, 40% sharpness
            score = 0.6 * norm_area + 0.4 * norm_sharp
            if score > best_score:
                best_score = score
                best_frame = f
                
        return best_frame

    @staticmethod
    def select_best_plates(plate_candidates, top_k=3):
        """
        Scores plate candidates using plate_area and plate_sharpness.
        Ranks them and returns the Top K.
        Each candidate is a dictionary: {'crop': crop, 'area': area, 'sharpness': sharpness, ...}
        """
        if not plate_candidates:
            return []
            
        # Find maximum values for normalization
        areas = [p['area'] for p in plate_candidates]
        sharpnesses = [p['sharpness'] for p in plate_candidates]
        
        max_area = max(areas) if areas else 1.0
        max_sharp = max(sharpnesses) if sharpnesses else 1.0
        
        scored_plates = []
        for p in plate_candidates:
            norm_area = p['area'] / (max_area + 1e-6)
            norm_sharp = p['sharpness'] / (max_sharp + 1e-6)
            
            # Combine size and sharpness
            score = 0.6 * norm_area + 0.4 * norm_sharp
            scored_plates.append((score, p))
            
        # Sort in descending order of score
        scored_plates.sort(key=lambda x: x[0], reverse=True)
        
        # Return the Top K license plate candidates
        return [item[1] for item in scored_plates[:top_k]]
