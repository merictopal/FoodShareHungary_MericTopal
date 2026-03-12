import firebase_admin
from firebase_admin import credentials, messaging
import os
from app.extensions import db
from sqlalchemy import text

# Initialize Firebase Admin SDK only once
if not firebase_admin._apps:
    basedir = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    cred_path = os.path.join(basedir, 'firebase-service-account.json')
    
    try:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        print("✅ Firebase Admin SDK initialized successfully.")
    except Exception as e:
        print(f"⚠️ Firebase initialization error: {e}")

class NotificationService:

    @staticmethod
    def send_push_notification(fcm_token, title, body, data_payload=None):
        if not fcm_token:
            return False

        try:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data_payload if data_payload else {},
                token=fcm_token,
            )
            response = messaging.send(message)
            return True
        except Exception as e:
            print(f"Error sending FCM message: {e}")
            return False

    @staticmethod
    def notify_students_new_offer(offer_data):
        # We must import User here to avoid circular imports
        from app.models.user import User
        
        try:
            # 1. Extract data safely from the payload
            restaurant_id = offer_data.get('restaurant_id')
            offer_title = offer_data.get('title', 'Delicious Meal')
            
            # Fetch restaurant name
            restaurant = User.query.get(restaurant_id)
            restaurant_name = restaurant.name if restaurant else "A Local Restaurant"
            
            # 2. Get all active students from the database
            students = User.query.filter_by(role='student').all()
            success_count = 0
            
            print(f"🚀 Found {len(students)} students. Sending notifications...")

            for student in students:
                title = f"📣 New Offer from {restaurant_name}!"
                body = f"Check out the new {offer_title} available now."
                
                # --- A. PUSH NOTIFICATION (FIREBASE) ---
                token = getattr(student, 'fcm_token', None)
                if token:
                    sent = NotificationService.send_push_notification(
                        fcm_token=token,
                        title=title,
                        body=body,
                        data_payload={'type': 'new_offer'}
                    )
                    if sent:
                        success_count += 1
                        
                # --- B. IN-APP NOTIFICATION (SAVE TO DATABASE FOR PROFILE SCREEN) ---
                # Using Raw SQL to ensure it works regardless of ORM schema complexities
                try:
                    # NOTE: Assuming you have a table named 'notifications'. 
                    # If not, this will catch the error and continue without crashing.
                    query = text("""
                        INSERT INTO notifications (user_id, title, message, is_read, created_at) 
                        VALUES (:uid, :title, :msg, false, CURRENT_TIMESTAMP)
                    """)
                    db.session.execute(query, {'uid': student.id, 'title': title, 'msg': body})
                except Exception as db_err:
                    print(f"⚠️ Note: Could not save in-app notification to DB (Table might not exist yet): {db_err}")
            
            # Commit all database insertions
            db.session.commit()
            print(f"✅ Successfully sent push notifications to {success_count} students and updated DB.")
            return success_count
            
        except Exception as e:
            print(f"❌ Error in notify_students_new_offer: {str(e)}")
            return 0

    @staticmethod
    def notify_restaurant_claim_verified(restaurant_owner, student_name):
        if restaurant_owner:
            token = getattr(restaurant_owner, 'fcm_token', None)
            
            if token:
                return NotificationService.send_push_notification(
                    fcm_token=token,
                    title="✅ Offer Claimed!",
                    body=f"Student {student_name} has successfully claimed an offer.",
                    data_payload={'type': 'claim_verified'}
                )
        return False