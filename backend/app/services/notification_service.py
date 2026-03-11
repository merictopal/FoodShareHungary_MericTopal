import firebase_admin
from firebase_admin import credentials, messaging
import os

# Initialize Firebase Admin SDK only once
if not firebase_admin._apps:
    # Get the absolute path to the current directory (services folder)
    # Then navigate up to find the JSON key in the root backend folder
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
        """
        Sends a push notification to a specific device using its FCM token.
        """
        if not fcm_token:
            return False

        try:
            # Construct the FCM message payload
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=data_payload if data_payload else {},
                token=fcm_token,
            )
            
            # Send the message to the specific device
            response = messaging.send(message)
            return True
        except Exception as e:
            print(f"Error sending FCM message: {e}")
            return False

    @staticmethod
    def notify_students_new_offer(students, restaurant_name, offer_desc):
        """
        Sends push notifications to a list of students when a new offer is created.
        """
        success_count = 0
        for student in students:
            # Only send if the student has a registered FCM token
            if student.fcm_token:
                sent = NotificationService.send_push_notification(
                    fcm_token=student.fcm_token,
                    title=f"📣 New Offer from {restaurant_name}!",
                    body=f"Check out the new {offer_desc} available now.",
                    data_payload={'type': 'new_offer'}
                )
                if sent:
                    success_count += 1
        return success_count

    @staticmethod
    def notify_restaurant_claim_verified(restaurant_owner, student_name):
        """
        Notifies the restaurant owner that a student successfully verified a claim.
        """
        if restaurant_owner and restaurant_owner.fcm_token:
            return NotificationService.send_push_notification(
                fcm_token=restaurant_owner.fcm_token,
                title="✅ Offer Claimed!",
                body=f"Student {student_name} has successfully claimed an offer.",
                data_payload={'type': 'claim_verified'}
            )
        return False