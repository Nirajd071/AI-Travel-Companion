#!/usr/bin/env python3
"""
Test script for Firebase Cloud Messaging integration
"""

import asyncio
import requests
import json

# Test data
TEST_TOKEN = "test_device_token_here"  # Replace with actual FCM token from your app
TEST_NOTIFICATION = {
    "token": TEST_TOKEN,
    "title": "🌍 AI Travel Companion",
    "body": "Firebase integration is working! Your travel notifications are ready.",
    "data": {
        "type": "welcome",
        "action": "open_app"
    }
}

async def test_backend_notification():
    """Test notification via Node.js backend"""
    try:
        print("🔧 Testing Backend Notification Service...")
        
        response = requests.post(
            "http://localhost:3000/api/notifications/send",
            json=TEST_NOTIFICATION,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Backend notification service working!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Backend error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Backend connection error: {e}")

async def test_ai_service_notification():
    """Test notification via Python AI service"""
    try:
        print("🤖 Testing AI Service Notification...")
        
        response = requests.post(
            "http://localhost:8000/api/notifications/send",
            json=TEST_NOTIFICATION,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ AI Service notification working!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ AI Service error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ AI Service connection error: {e}")

async def test_multicast_notification():
    """Test multicast notification to multiple devices"""
    try:
        print("📱 Testing Multicast Notification...")
        
        multicast_data = {
            "tokens": [TEST_TOKEN, "another_test_token"],
            "title": "🎯 Travel Update",
            "body": "Your itinerary has been updated with new recommendations!",
            "data": {
                "type": "itinerary_update",
                "trip_id": "12345"
            }
        }
        
        response = requests.post(
            "http://localhost:8000/api/notifications/send-multiple",
            json=multicast_data,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Multicast notification working!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Multicast error: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Multicast connection error: {e}")

def check_services():
    """Check if services are running"""
    services = [
        ("Backend API", "http://localhost:3000/health"),
        ("AI Services", "http://localhost:8000/health")
    ]
    
    print("🔍 Checking service status...")
    
    for name, url in services:
        try:
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                print(f"✅ {name}: Running")
            else:
                print(f"❌ {name}: Error {response.status_code}")
        except Exception as e:
            print(f"❌ {name}: Not reachable - {e}")

async def main():
    """Main test function"""
    print("🔥 Firebase Cloud Messaging Test Suite")
    print("=" * 50)
    
    # Check if services are running
    check_services()
    print()
    
    # Test notifications
    await test_backend_notification()
    print()
    
    await test_ai_service_notification()
    print()
    
    await test_multicast_notification()
    print()
    
    print("📋 Test Instructions:")
    print("1. Replace TEST_TOKEN with a real FCM token from your Flutter app")
    print("2. Make sure both backend and AI services are running")
    print("3. Check Firebase Console for message delivery status")
    print("4. Enable FCM in Firebase Console → Cloud Messaging")

if __name__ == "__main__":
    asyncio.run(main())
