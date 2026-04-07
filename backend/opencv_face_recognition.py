"""
opencv_face_recognition.py - Complete OpenCV Face Recognition System

This module implements face recognition using only OpenCV without external dependencies.
Uses LBPH (Local Binary Patterns Histograms) face recognizer.
"""

import cv2
import numpy as np
import json
import pickle
from pathlib import Path
from typing import List, Tuple, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class OpenCVFaceRecognizer:
    """
    OpenCV-based face recognition system using LBPH (Local Binary Patterns Histograms)
    """
    
    def __init__(self, encodings_file: Path, students_folder: Path):
        self.encodings_file = encodings_file
        self.students_folder = students_folder
        self.face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        self.recognizer = cv2.face.LBPHFaceRecognizer_create()
        self.known_encodings = {}
        self.label_map = {}
        self.next_label = 0
        self.model_trained = False
        
        # Load existing encodings if available
        self.load_encodings()
    
    def load_encodings(self) -> bool:
        """Load face encodings from file"""
        try:
            if self.encodings_file.exists():
                with open(self.encodings_file, 'rb') as f:
                    data = pickle.load(f)
                    self.known_encodings = data.get('encodings', {})
                    self.label_map = data.get('label_map', {})
                    self.next_label = data.get('next_label', 0)
                    
                    # Train the recognizer if we have data
                    if self.known_encodings:
                        self._train_recognizer()
                    
                logger.info(f"Loaded {len(self.known_encodings)} face encodings")
                return True
        except Exception as e:
            logger.error(f"Error loading encodings: {e}")
        
        return False
    
    def save_encodings(self) -> bool:
        """Save face encodings to file"""
        try:
            data = {
                'encodings': self.known_encodings,
                'label_map': self.label_map,
                'next_label': self.next_label
            }
            
            # Ensure directory exists
            self.encodings_file.parent.mkdir(parents=True, exist_ok=True)
            
            with open(self.encodings_file, 'wb') as f:
                pickle.dump(data, f)
            
            logger.info(f"Saved {len(self.known_encodings)} face encodings")
            return True
        except Exception as e:
            logger.error(f"Error saving encodings: {e}")
            return False
    
    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        Detect faces in an image using OpenCV Haar Cascade
        
        Args:
            image: RGB image as numpy array
            
        Returns:
            List of face bounding boxes (top, right, bottom, left)
        """
        try:
            # Convert to grayscale for face detection
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
            
            # Detect faces
            faces = self.face_cascade.detectMultiScale(
                gray,
                scaleFactor=1.1,
                minNeighbors=5,
                minSize=(30, 30),
                flags=cv2.CASCADE_SCALE_IMAGE
            )
            
            # Convert to (top, right, bottom, left) format
            face_boxes = []
            for (x, y, w, h) in faces:
                face_boxes.append((y, x + w, y + h, x))
            
            return face_boxes
            
        except Exception as e:
            logger.error(f"Error detecting faces: {e}")
            return []
    
    def extract_face_features(self, image: np.ndarray, face_box: Tuple[int, int, int, int]) -> Optional[np.ndarray]:
        """
        Extract face features for recognition
        
        Args:
            image: RGB image as numpy array
            face_box: Face bounding box (top, right, bottom, left)
            
        Returns:
            Face features as numpy array or None if extraction fails
        """
        try:
            top, right, bottom, left = face_box
            
            # Extract face region
            face_image = image[top:bottom, left:right]
            
            if face_image.size == 0:
                return None
            
            # Convert to grayscale
            face_gray = cv2.cvtColor(face_image, cv2.COLOR_RGB2GRAY)
            
            # Resize to standard size (better for LBPH)
            face_resized = cv2.resize(face_gray, (100, 100))
            
            # Apply histogram equalization for better recognition
            face_equalized = cv2.equalizeHist(face_resized)
            
            return face_equalized
            
        except Exception as e:
            logger.error(f"Error extracting face features: {e}")
            return None
    
    def register_face(self, student_id: str, image: np.ndarray) -> bool:
        """
        Register a new face for a student
        
        Args:
            student_id: Student ID
            image: RGB image containing the face
            
        Returns:
            True if registration successful, False otherwise
        """
        try:
            # Detect faces
            faces = self.detect_faces(image)
            
            if len(faces) == 0:
                logger.warning(f"No face detected for student {student_id}")
                return False
            
            if len(faces) > 1:
                logger.warning(f"Multiple faces detected for student {student_id}")
                return False
            
            # Extract face features
            face_features = self.extract_face_features(image, faces[0])
            
            if face_features is None:
                logger.error(f"Failed to extract features for student {student_id}")
                return False
            
            # Assign label
            if student_id not in self.label_map:
                self.label_map[student_id] = self.next_label
                self.next_label += 1
            
            label = self.label_map[student_id]
            
            # Store multiple samples per student for better accuracy
            if student_id not in self.known_encodings:
                self.known_encodings[student_id] = []
            
            self.known_encodings[student_id].append(face_features)
            
            # Limit to 5 samples per student to avoid overfitting
            if len(self.known_encodings[student_id]) > 5:
                self.known_encodings[student_id] = self.known_encodings[student_id][-5:]
            
            # Retrain the recognizer
            self._train_recognizer()
            
            # Save encodings
            self.save_encodings()
            
            logger.info(f"Successfully registered face for student {student_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error registering face for student {student_id}: {e}")
            return False
    
    def _train_recognizer(self) -> bool:
        """Train the LBPH face recognizer"""
        try:
            if not self.known_encodings:
                return False
            
            # Prepare training data
            faces = []
            labels = []
            
            for student_id, face_samples in self.known_encodings.items():
                label = self.label_map[student_id]
                for face_sample in face_samples:
                    faces.append(face_sample)
                    labels.append(label)
            
            if not faces:
                return False
            
            # Train the recognizer
            self.recognizer.train(faces, np.array(labels))
            self.model_trained = True
            
            logger.info(f"Trained face recognizer with {len(faces)} samples from {len(self.known_encodings)} students")
            return True
            
        except Exception as e:
            logger.error(f"Error training recognizer: {e}")
            return False
    
    def recognize_face(self, image: np.ndarray, confidence_threshold: float = 35.0) -> Dict:
        """
        Recognize face in an image
        
        Args:
            image: RGB image as numpy array
            confidence_threshold: Minimum confidence for recognition (0-100)
            
        Returns:
            Recognition result with match status and details
        """
        try:
            if not self.model_trained:
                return {
                    "match": False,
                    "message": "No faces registered in the system",
                    "confidence": 0.0
                }
            
            # Detect faces
            faces = self.detect_faces(image)
            
            if len(faces) == 0:
                return {
                    "match": False,
                    "message": "No face detected in image",
                    "confidence": 0.0
                }
            
            if len(faces) > 1:
                return {
                    "match": False,
                    "message": "Multiple faces detected",
                    "confidence": 0.0
                }
            
            # Extract face features
            face_features = self.extract_face_features(image, faces[0])
            
            if face_features is None:
                return {
                    "match": False,
                    "message": "Could not extract face features",
                    "confidence": 0.0
                }
            
            # Predict face
            label, distance = self.recognizer.predict(face_features)
            
            # Convert LBPH distance to confidence percentage (0-100)
            # LBPH distance: 0 = perfect match, typical range 0-300+
            # Good match: < 50, Acceptable: 50-80, Poor: 80-120, No match: > 120
            # Use a scaling formula that maps this range to 0-100% confidence
            if distance <= 0:
                confidence_score = 100.0
            else:
                confidence_score = max(0.0, min(100.0, 100.0 * (1.0 - distance / 200.0)))
            
            logger.info(f"LBPH predict: label={label}, distance={distance:.2f}, confidence={confidence_score:.1f}%")
            
            # Find student ID from label
            student_id = None
            for sid, lbl in self.label_map.items():
                if lbl == label:
                    student_id = sid
                    break
            
            if student_id is None:
                return {
                    "match": False,
                    "message": "Face recognized but student not found",
                    "confidence": confidence_score
                }
            
            # Check confidence threshold
            if confidence_score < confidence_threshold:
                return {
                    "match": False,
                    "message": f"Face recognized but confidence too low: {confidence_score:.1f}%",
                    "confidence": confidence_score,
                    "student_id": student_id
                }
            
            return {
                "match": True,
                "message": f"Face recognized with {confidence_score:.1f}% confidence",
                "confidence": confidence_score,
                "student_id": student_id
            }
            
        except Exception as e:
            logger.error(f"Error recognizing face: {e}")
            return {
                "match": False,
                "message": f"Face recognition error: {str(e)}",
                "confidence": 0.0
            }
    
    def get_registered_students(self) -> List[str]:
        """Get list of registered student IDs"""
        return list(self.known_encodings.keys())
    
    def remove_student(self, student_id: str) -> bool:
        """Remove a student's face data"""
        try:
            if student_id in self.known_encodings:
                del self.known_encodings[student_id]
            
            if student_id in self.label_map:
                del self.label_map[student_id]
            
            # Retrain the recognizer
            self._train_recognizer()
            
            # Save encodings
            self.save_encodings()
            
            logger.info(f"Removed face data for student {student_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error removing student {student_id}: {e}")
            return False
    
    def get_stats(self) -> Dict:
        """Get system statistics"""
        return {
            "registered_students": len(self.known_encodings),
            "total_samples": sum(len(samples) for samples in self.known_encodings.values()),
            "model_trained": self.model_trained,
            "face_cascade_loaded": not self.face_cascade.empty()
        }
