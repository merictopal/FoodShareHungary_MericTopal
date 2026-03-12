from app import create_app
from app.extensions import db
from sqlalchemy import text
from app.services.notification_service import NotificationService

# Initialize the Flask application context
app = create_app()

with app.app_context():
    print(f"🔍 [DEBUG] Connected Database: {db.engine.url}")
    
    # We know from the logs that User ID 5 saved the token. Let's interrogate User 5 directly!
    # Try 'users' table first. If your table is named differently, we'll see an error.
    try:
        query = text("SELECT email, fcm_token FROM users WHERE id = 5")
        result = db.session.execute(query).fetchone()
        
        if not result:
            print("❌ [DEBUG] User ID 5 doesn't even exist in this database! We are definitely reading the wrong DB file.")
        else:
            email = result[0]
            token = result[1]
            
            print(f"👤 User Email: {email}")
            print(f"🔑 Token in DB: {'[EMPTY/NULL]' if not token else token[:20] + '... (truncated)'}")
            
            if not token:
                print("❌ [DEBUG] The user exists, but the token is NULL. The commit failed silently.")
            else:
                print("🚀 Token found! Firing Firebase notification...")
                success = NotificationService.send_push_notification(
                    fcm_token=token,
                    title="🔔 FoodShare Test",
                    body="If you see this, we finally defeated the Ghost in the Database! 👻",
                    data_payload={'type': 'test_notification'}
                )
                
                if success:
                    print("✅ Notification sent successfully! Check your screen.")
                else:
                    print("❌ Firebase failed to send the message.")
                    
    except Exception as e:
        print(f"❌ [CRITICAL ERROR] Database query failed: {str(e)}")
        print("💡 Hint: Maybe your table is named 'user' instead of 'users'?")