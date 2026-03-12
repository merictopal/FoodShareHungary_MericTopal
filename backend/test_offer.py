from app import create_app
from app.extensions import db
from sqlalchemy import text
from firebase_admin import messaging
import firebase_admin

# 1. Start the app to load config
app = create_app()

def send_direct_push(token, title, body):
    """Sends notification using Firebase Admin SDK directly"""
    try:
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            token=token,
            data={'type': 'test_offer'}
        )
        response = messaging.send(message)
        return True
    except Exception as e:
        print(f"❌ Firebase Error: {e}")
        return False

with app.app_context():
    print("🔍 Fetching student tokens directly from database...")
    
    # 2. Get all students who have a token using Raw SQL (No Models involved!)
    query = text("SELECT id, email, fcm_token FROM users WHERE role = 'student' AND fcm_token IS NOT NULL")
    students = db.session.execute(query).fetchall()

    if not students:
        print("❌ No students with FCM tokens found in DB. (Make sure you are logged in on the app!)")
    else:
        print(f"📣 Found {len(students)} students. Sending test notifications...")
        
        for student in students:
            student_id, email, token = student
            print(f"🚀 Sending to: {email} (ID: {student_id})")
            
            success = send_direct_push(
                token=token,
                title="🍔 New Offer: Test Burger!",
                body="A new test offer has been created just for you."
            )
            
            if success:
                print(f"✅ Successfully sent to {email}")
            else:
                print(f"❌ Failed to send to {email}")

    print("\n🏁 Test run finished. Check your emulator!")