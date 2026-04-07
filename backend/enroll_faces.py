"""
Quick Face Enrollment Script
Enrolls student faces from images to enable real face recognition
"""

import sys
import cv2
import sqlite3
from pathlib import Path

# Add parent directory to path to import opencv_face_recognition
sys.path.insert(0, str(Path(__file__).parent))

from opencv_face_recognition import OpenCVFaceRecognizer

# Paths
DATA_DIR = Path(__file__).parent / 'data'
OPENCV_ENCODINGS_FILE = DATA_DIR / 'opencv_face_encodings.pkl'
STUDENTS_FOLDER = DATA_DIR / 'student_images'
DB_FILE = DATA_DIR / 'attendance.db'

def enroll_student_from_image(recognizer, student_id, student_name, image_path):
    """Enroll a student face from an image file"""
    print(f"\nEnrolling {student_name} ({student_id})...")
    
    # Load image
    image = cv2.imread(str(image_path))
    if image is None:
        print(f"  ❌ Failed to load image: {image_path}")
        return False
    
    # Convert BGR to RGB
    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    # Register face
    success = recognizer.register_face(student_id, image_rgb)
    
    if success:
        print(f"  ✅ Successfully enrolled {student_name}")
        
        # Update database
        conn = sqlite3.connect(str(DB_FILE))
        cursor = conn.cursor()
        cursor.execute('''
            UPDATE students 
            SET has_face_encoding = 1, photo_path = ?
            WHERE student_id = ?
        ''', (str(image_path), student_id))
        conn.commit()
        conn.close()
        
        return True
    else:
        print(f"  ❌ Failed to enroll {student_name} - no face detected or multiple faces")
        return False

def main():
    print("=" * 60)
    print("Face Enrollment Script - OpenCV LBPH")
    print("=" * 60)
    
    # Initialize recognizer
    print("\nInitializing OpenCV Face Recognizer...")
    recognizer = OpenCVFaceRecognizer(OPENCV_ENCODINGS_FILE, STUDENTS_FOLDER)
    
    # Get students from database
    conn = sqlite3.connect(str(DB_FILE))
    cursor = conn.cursor()
    cursor.execute('SELECT student_id, name FROM students ORDER BY student_id')
    students = cursor.fetchall()
    conn.close()
    
    if not students:
        print("❌ No students found in database")
        return
    
    print(f"\nFound {len(students)} students in database:")
    for student_id, name in students:
        print(f"  - {name} ({student_id})")
    
    # Enroll each student
    print("\n" + "=" * 60)
    print("Starting enrollment...")
    print("=" * 60)
    
    enrolled_count = 0
    failed_count = 0
    
    for student_id, name in students:
        # Check if image exists
        image_path = STUDENTS_FOLDER / f"{student_id}.jpg"
        
        if not image_path.exists():
            print(f"\n⚠️  Skipping {name} ({student_id}) - no image file found")
            failed_count += 1
            continue
        
        # Enroll student
        if enroll_student_from_image(recognizer, student_id, name, image_path):
            enrolled_count += 1
        else:
            failed_count += 1
    
    # Summary
    print("\n" + "=" * 60)
    print("Enrollment Summary")
    print("=" * 60)
    print(f"✅ Successfully enrolled: {enrolled_count}")
    print(f"❌ Failed: {failed_count}")
    print(f"📊 Total students: {len(students)}")
    
    # Check if model is trained
    stats = recognizer.get_stats()
    print(f"\n📈 Recognizer Stats:")
    print(f"  - Registered students: {stats['registered_students']}")
    print(f"  - Total samples: {stats['total_samples']}")
    print(f"  - Model trained: {stats['model_trained']}")
    print(f"  - Encodings file: {OPENCV_ENCODINGS_FILE}")
    
    if stats['model_trained']:
        print("\n🎉 Face recognition is now ENABLED!")
        print("   The system will exit demo mode and perform real face verification.")
    else:
        print("\n⚠️  Model not trained - system will remain in demo mode")
        print("   Please ensure student images contain clear, detectable faces.")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
