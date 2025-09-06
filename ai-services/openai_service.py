import openai
import os
from typing import Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

class OpenAIService:
    def __init__(self):
        self.client = openai.OpenAI(
            api_key=os.getenv('OPENAI_API_KEY')
        )
        self.model = "gpt-3.5-turbo"
    
    async def generate_chat_response(self, message: str, user_context: Dict = None) -> str:
        """
        Generate AI chatbot response using OpenAI GPT
        
        Args:
            message (str): User's message
            user_context (Dict): User's travel preferences and context
        
        Returns:
            str: AI response
        """
        try:
            # Build system prompt based on user context
            system_prompt = self._build_system_prompt(user_context)
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": message}
                ],
                max_tokens=500,
                temperature=0.7
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"Error generating chat response: {e}")
            return "I'm sorry, I'm having trouble responding right now. Please try again later."
    
    async def analyze_travel_dna(self, quiz_answers: Dict) -> Dict:
        """
        Analyze travel DNA from quiz answers using OpenAI
        
        Args:
            quiz_answers (Dict): User's quiz responses
        
        Returns:
            Dict: Travel DNA analysis
        """
        try:
            prompt = f"""
            Analyze the following travel quiz answers and create a comprehensive travel DNA profile:
            
            Quiz Answers: {quiz_answers}
            
            Please provide a JSON response with the following structure:
            {{
                "adventure_level": "low/medium/high",
                "budget_preference": "budget/mid-range/luxury",
                "social_preference": "solo/couple/group/family",
                "activity_types": ["cultural", "adventure", "relaxation", "food", "nightlife", "nature"],
                "travel_style": "planned/spontaneous/mixed",
                "accommodation_preference": "hotel/hostel/airbnb/resort",
                "personality_traits": ["curious", "adventurous", "cautious", "social"],
                "recommendations": {{
                    "destinations": ["destination1", "destination2"],
                    "activities": ["activity1", "activity2"],
                    "tips": ["tip1", "tip2"]
                }}
            }}
            """
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a travel psychology expert. Analyze travel preferences and create detailed profiles."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.3
            )
            
            # Parse JSON response
            import json
            result = json.loads(response.choices[0].message.content)
            return result
            
        except Exception as e:
            print(f"Error analyzing travel DNA: {e}")
            return {
                "adventure_level": "medium",
                "budget_preference": "mid-range",
                "social_preference": "couple",
                "activity_types": ["cultural", "food"],
                "travel_style": "mixed",
                "accommodation_preference": "hotel",
                "personality_traits": ["curious"],
                "recommendations": {
                    "destinations": ["Paris", "Tokyo"],
                    "activities": ["Museums", "Local cuisine"],
                    "tips": ["Try local food", "Learn basic phrases"]
                }
            }
    
    async def generate_recommendations(self, location: str, preferences: Dict, user_dna: Dict = None) -> List[Dict]:
        """
        Generate personalized travel recommendations
        
        Args:
            location (str): Destination location
            preferences (Dict): User preferences
            user_dna (Dict): User's travel DNA profile
        
        Returns:
            List[Dict]: List of recommendations
        """
        try:
            prompt = f"""
            Generate personalized travel recommendations for {location} based on:
            
            User Preferences: {preferences}
            Travel DNA: {user_dna}
            
            Please provide 5 recommendations in JSON format:
            [
                {{
                    "type": "restaurant/activity/attraction/accommodation",
                    "name": "Name",
                    "description": "Description",
                    "rating": 4.5,
                    "price_range": "$/$$/$$$/$$$$",
                    "category": "cultural/adventure/food/nature",
                    "why_recommended": "Reason based on user profile"
                }}
            ]
            """
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a personalized travel recommendation expert. Provide detailed, relevant suggestions."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.5
            )
            
            import json
            recommendations = json.loads(response.choices[0].message.content)
            return recommendations
            
        except Exception as e:
            print(f"Error generating recommendations: {e}")
            return [
                {
                    "type": "restaurant",
                    "name": "Local Favorite Cafe",
                    "description": "Authentic local cuisine loved by locals",
                    "rating": 4.5,
                    "price_range": "$$",
                    "category": "food",
                    "why_recommended": "Matches your preference for authentic experiences"
                }
            ]
    
    def _build_system_prompt(self, user_context: Dict = None) -> str:
        """Build system prompt based on user context"""
        base_prompt = """
        You are an AI travel companion assistant. You are friendly, knowledgeable, and passionate about travel.
        You help users plan trips, discover hidden gems, and make the most of their travel experiences.
        
        Your personality:
        - Enthusiastic and encouraging
        - Knowledgeable about global destinations
        - Practical and helpful
        - Culturally sensitive
        - Safety-conscious
        """
        
        if user_context:
            context_addition = f"""
            
            User's Travel Profile:
            - Adventure Level: {user_context.get('adventure_level', 'unknown')}
            - Budget: {user_context.get('budget_preference', 'unknown')}
            - Travel Style: {user_context.get('travel_style', 'unknown')}
            - Interests: {', '.join(user_context.get('activity_types', []))}
            
            Tailor your responses to match their preferences and communication style.
            """
            base_prompt += context_addition
        
        return base_prompt

# Global instance
openai_service = OpenAIService()
