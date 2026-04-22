import requests
import random

# --- CONFIGURATION ---
# The local address where your Flask backend is running
BASE_URL = "http://127.0.0.1:5000/api/auth"

# Generate a random email for the bot to avoid "email already exists" conflicts during multiple tests
BOT_EMAIL = f"testbot_{random.randint(10000, 99999)}@student.hu"
BOT_PASSWORD = "SecureBotPass123!"

# --- TEST 1: REGISTRATION FLOW ---
def test_bot_can_register():
    """
    Simulates a new user filling out the registration form.
    Checks if the backend successfully creates the account and returns status 201.
    """
    payload = {
        "name": "Auto Test Bot",
        "email": BOT_EMAIL,
        "password": BOT_PASSWORD,
        "role": "student",
        "date_of_birth": "15/08/2002"
    }
    
    # Send POST request to the register endpoint
    response = requests.post(f"{BASE_URL}/register", json=payload)
    data = response.json()

    # --- ASSERTIONS (The Bot's Checkpoints) ---
    # 1. Did the server respond with 'Created' (201)?
    assert response.status_code == 201
    # 2. Did our API return success=True?
    assert data.get("success") == True
    # 3. Did it return a valid user_id?
    assert "user_id" in data

# --- TEST 2: LOGIN FLOW & TOKEN GENERATION ---
def test_bot_can_login():
    """
    Simulates the previously registered bot trying to log in.
    Checks if the backend verifies credentials and returns valid JWT tokens.
    """
    payload = {
        "email": BOT_EMAIL,
        "password": BOT_PASSWORD
    }
    
    # Send POST request to the login endpoint
    response = requests.post(f"{BASE_URL}/login", json=payload)
    data = response.json()

    # --- ASSERTIONS (The Bot's Checkpoints) ---
    # 1. Did the server respond with 'OK' (200)?
    assert response.status_code == 200
    # 2. Did our API return success=True?
    assert data.get("success") == True
    # 3. Did the dual-token system work? (Are both tokens present?)
    assert "token" in data
    assert "refresh_token" in data
    # 4. Did the user profile come back correctly?
    assert data["user"]["email"] == BOT_EMAIL