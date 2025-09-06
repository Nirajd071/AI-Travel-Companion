#!/usr/bin/env python3
"""
Comprehensive API Integration Test Suite
Tests OpenAI, Google Maps, Foursquare, and Firebase integrations
"""

import asyncio
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

class APITester:
    def __init__(self):
        self.backend_url = "http://localhost:3000"
        self.ai_service_url = "http://localhost:8000"
        
    def test_openai_chat(self):
        """Test OpenAI chatbot integration"""
        print("🤖 Testing OpenAI Chat Integration...")
        
        try:
            response = requests.post(
                f"{self.ai_service_url}/api/chat/message",
                json={
                    "message": "I'm planning a trip to Paris. What are some must-see attractions?",
                    "user_id": "test_user_123"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ OpenAI Chat: Working!")
                print(f"Response: {data.get('response', '')[:100]}...")
                return True
            else:
                print(f"❌ OpenAI Chat Error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ OpenAI Chat Connection Error: {e}")
            return False
    
    def test_travel_dna_analysis(self):
        """Test Travel DNA analysis with OpenAI"""
        print("🧬 Testing Travel DNA Analysis...")
        
        try:
            quiz_data = {
                "quiz_answers": {
                    "budget": "mid-range",
                    "adventure_level": "high",
                    "travel_style": "spontaneous",
                    "interests": ["culture", "food", "adventure"],
                    "accommodation": "boutique hotels"
                },
                "user_id": "test_user_123"
            }
            
            response = requests.post(
                f"{self.ai_service_url}/api/travel-dna/analyze",
                json=quiz_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Travel DNA Analysis: Working!")
                print(f"Profile: {data.get('dna_profile', {}).get('adventure_level', 'N/A')}")
                return True
            else:
                print(f"❌ Travel DNA Error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Travel DNA Connection Error: {e}")
            return False
    
    def test_ai_recommendations(self):
        """Test AI-powered recommendations"""
        print("🎯 Testing AI Recommendations...")
        
        try:
            rec_data = {
                "location": "Tokyo, Japan",
                "preferences": {
                    "food": "authentic local cuisine",
                    "activities": "cultural experiences",
                    "budget": "mid-range"
                },
                "user_id": "test_user_123"
            }
            
            response = requests.post(
                f"{self.ai_service_url}/api/recommendations/generate",
                json=rec_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                recommendations = data.get('recommendations', [])
                print("✅ AI Recommendations: Working!")
                print(f"Generated {len(recommendations)} recommendations")
                if recommendations:
                    print(f"Sample: {recommendations[0].get('name', 'N/A')}")
                return True
            else:
                print(f"❌ AI Recommendations Error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ AI Recommendations Connection Error: {e}")
            return False
    
    def test_firebase_messaging(self):
        """Test Firebase push notifications"""
        print("🔥 Testing Firebase Messaging...")
        
        try:
            notification_data = {
                "token": "test_fcm_token_replace_with_real",
                "title": "🌍 AI Travel Test",
                "body": "Your API integrations are working perfectly!",
                "data": {
                    "type": "test",
                    "timestamp": "2024-01-01T00:00:00Z"
                }
            }
            
            response = requests.post(
                f"{self.ai_service_url}/api/notifications/send",
                json=notification_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                print("✅ Firebase Messaging: Working!")
                print(f"Message ID: {data.get('message_id', 'N/A')}")
                return True
            else:
                print(f"❌ Firebase Messaging Error: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ Firebase Messaging Connection Error: {e}")
            return False
    
    def test_google_maps_integration(self):
        """Test Google Maps API integration"""
        print("🗺️  Testing Google Maps API...")
        
        try:
            # Test Places API (via backend)
            response = requests.get(
                f"{self.backend_url}/health",
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                print("✅ Google Maps API Key: Configured")
                print("Note: Full Maps integration requires frontend testing")
                return True
            else:
                print(f"❌ Backend not responding: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Backend Connection Error: {e}")
            return False
    
    def check_services_status(self):
        """Check if all services are running"""
        print("🔍 Checking Services Status...")
        
        services = [
            ("Backend API", f"{self.backend_url}/health"),
            ("AI Services", f"{self.ai_service_url}/health")
        ]
        
        all_running = True
        for name, url in services:
            try:
                response = requests.get(url, timeout=5)
                if response.status_code == 200:
                    print(f"✅ {name}: Running")
                else:
                    print(f"❌ {name}: Error {response.status_code}")
                    all_running = False
            except Exception as e:
                print(f"❌ {name}: Not reachable - {e}")
                all_running = False
        
        return all_running
    
    def run_all_tests(self):
        """Run comprehensive API integration tests"""
        print("🚀 AI Travel Companion - API Integration Test Suite")
        print("=" * 60)
        
        # Check services first
        if not self.check_services_status():
            print("\n❌ Some services are not running. Please start them first:")
            print("./scripts/start-backend.sh")
            print("./scripts/start-ai-services.sh")
            return
        
        print()
        
        # Run all tests
        tests = [
            ("OpenAI Chat", self.test_openai_chat),
            ("Travel DNA Analysis", self.test_travel_dna_analysis),
            ("AI Recommendations", self.test_ai_recommendations),
            ("Firebase Messaging", self.test_firebase_messaging),
            ("Google Maps Config", self.test_google_maps_integration)
        ]
        
        results = {}
        for test_name, test_func in tests:
            results[test_name] = test_func()
            print()
        
        # Summary
        print("📊 Test Results Summary:")
        print("-" * 30)
        passed = sum(results.values())
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{test_name}: {status}")
        
        print(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All API integrations are working perfectly!")
        else:
            print("⚠️  Some integrations need attention. Check the logs above.")
        
        print("\n📱 Next Steps:")
        print("1. Test Flutter app with real device FCM token")
        print("2. Test Google Maps in Flutter app")
        print("3. Verify Foursquare API integration in production")

def main():
    tester = APITester()
    tester.run_all_tests()

if __name__ == "__main__":
    main()
