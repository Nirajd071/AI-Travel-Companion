"""
Production AI Travel Companion Service
Real OpenAI integration with proper error handling and production features
"""

import os
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
import asyncio
import json

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import openai
from openai import OpenAI
import httpx
import uvicorn
from dotenv import load_dotenv
from fallback_responses import generate_fallback_response, generate_suggestions

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize NVIDIA NIM API client
NVIDIA_API_KEY = "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"

logger.info("Using NVIDIA NIM API")
openai_client = OpenAI(
    api_key=NVIDIA_API_KEY,
    base_url="https://integrate.api.nvidia.com/v1"
)
AI_MODEL = "openai/gpt-oss-20b"

app = FastAPI(
    title="AI Travel Companion Service",
    description="Production-grade AI service for travel recommendations and chat",
    version="1.0.0"
)

# CORS configuration for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3002",
        "http://localhost:3001", 
        "http://localhost:3000",
        "https://your-domain.com"  # Add your production domain
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Request/Response Models
class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)

class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    user_id: Optional[str] = Field(None, description="Optional user ID for context")
    conversation_history: Optional[List[ChatMessage]] = Field(default=[], description="Previous messages")
    location: Optional[Dict[str, float]] = Field(None, description="User location {lat, lng}")
    preferences: Optional[Dict[str, Any]] = Field(None, description="User travel preferences")

class ChatResponse(BaseModel):
    response: str = Field(..., description="AI response")
    conversation_id: Optional[str] = Field(None, description="Conversation identifier")
    suggestions: Optional[List[str]] = Field(default=[], description="Follow-up suggestions")
    places: Optional[List[Dict[str, Any]]] = Field(default=[], description="Recommended places")

class TravelDNARequest(BaseModel):
    answers: Dict[str, Any] = Field(..., description="Quiz answers")
    user_id: Optional[str] = Field(None, description="User ID")

class TravelDNAResponse(BaseModel):
    dna_type: str = Field(..., description="Travel DNA type")
    description: str = Field(..., description="DNA description")
    recommendations: List[str] = Field(..., description="Personalized recommendations")
    score_breakdown: Dict[str, float] = Field(..., description="Personality scores")

# Travel DNA Analysis System
TRAVEL_DNA_TYPES = {
    "explorer": {
        "name": "The Explorer",
        "description": "You thrive on adventure and discovering hidden gems off the beaten path.",
        "traits": ["adventurous", "curious", "independent", "flexible"]
    },
    "culture_seeker": {
        "name": "The Culture Seeker", 
        "description": "You're passionate about immersing yourself in local cultures and traditions.",
        "traits": ["cultural", "educational", "respectful", "observant"]
    },
    "luxury_traveler": {
        "name": "The Luxury Traveler",
        "description": "You prefer premium experiences with comfort and exceptional service.",
        "traits": ["comfort", "quality", "exclusive", "refined"]
    },
    "budget_backpacker": {
        "name": "The Budget Backpacker",
        "description": "You maximize experiences while minimizing costs through smart travel choices.",
        "traits": ["economical", "resourceful", "social", "adaptable"]
    },
    "relaxation_seeker": {
        "name": "The Relaxation Seeker",
        "description": "You travel to unwind and recharge in peaceful, serene environments.",
        "traits": ["peaceful", "wellness", "slow_travel", "mindful"]
    }
}

def analyze_travel_dna(answers: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze user answers to determine travel DNA type"""
    scores = {dna_type: 0 for dna_type in TRAVEL_DNA_TYPES.keys()}
    
    # Scoring logic based on answers
    for question, answer in answers.items():
        if question == "budget_preference":
            if answer == "luxury": scores["luxury_traveler"] += 3
            elif answer == "budget": scores["budget_backpacker"] += 3
            elif answer == "mid_range": 
                scores["culture_seeker"] += 1
                scores["explorer"] += 1
                
        elif question == "activity_preference":
            if answer == "adventure": scores["explorer"] += 3
            elif answer == "cultural": scores["culture_seeker"] += 3
            elif answer == "relaxation": scores["relaxation_seeker"] += 3
            elif answer == "luxury": scores["luxury_traveler"] += 2
            
        elif question == "accommodation_style":
            if answer == "luxury_hotel": scores["luxury_traveler"] += 2
            elif answer == "boutique": scores["culture_seeker"] += 2
            elif answer == "hostel": scores["budget_backpacker"] += 2
            elif answer == "unique": scores["explorer"] += 2
            
        elif question == "planning_style":
            if answer == "detailed": scores["luxury_traveler"] += 1
            elif answer == "flexible": scores["explorer"] += 2
            elif answer == "spontaneous": scores["budget_backpacker"] += 1
    
    # Determine primary DNA type
    primary_dna = max(scores, key=scores.get)
    
    return {
        "dna_type": primary_dna,
        "scores": scores,
        "confidence": scores[primary_dna] / sum(scores.values()) if sum(scores.values()) > 0 else 0
    }

def get_travel_system_prompt(context=None):
    """Generate system prompt for travel assistant"""
    base_prompt = """You are an expert AI travel companion with deep knowledge of global destinations, local cultures, and travel logistics. You provide personalized, practical, and engaging travel advice.

CRITICAL FORMATTING RULES:
- Use simple, clean formatting that renders well in web interfaces
- Use standard markdown: **bold**, *italic*, bullet points with -
- Avoid complex tables, special characters, or excessive symbols
- Keep line breaks simple and readable
- Use clear section headers with ##
- Limit use of emojis to 1-2 per response maximum
- Write in clear, conversational paragraphs
- Use bullet points for lists, not complex formatting

Key guidelines:
- Be enthusiastic but practical
- Provide specific, actionable recommendations
- Include local insights and cultural tips
- Consider budget, time, and travel style
- Suggest alternatives when appropriate
- Be concise but comprehensive
- Format responses for easy reading on mobile and web

Always structure your responses with clear sections and simple formatting.
    
    Your capabilities include:
    - Destination recommendations based on preferences and budget
    - Detailed itinerary planning with activities, restaurants, and accommodations
    - Real-time travel tips and local insights
    - Cultural etiquette and safety advice
    - Transportation and logistics guidance
    
    Always be helpful, accurate, and considerate of budget constraints and personal preferences.
    Provide specific, actionable recommendations with practical details like addresses, prices, and timing.
"""
    
    if context:
        if context.get("location"):
            lat, lng = context["location"].get("lat"), context["location"].get("lng")
            base_prompt += f"\n\nUser's current location: {lat}, {lng}"
            
        if context.get("preferences"):
            prefs = context["preferences"]
            base_prompt += f"\n\nUser preferences: {json.dumps(prefs, indent=2)}"
    
    return base_prompt

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "AI Travel Companion",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "ai_configured": True,
        "ai_provider": "NVIDIA NIM",
        "ai_model": AI_MODEL
    }

@app.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """Real-time chat with AI travel assistant"""
    try:
        # NVIDIA NIM API is always available now
        
        # Build conversation context
        messages = [
            {"role": "system", "content": get_travel_system_prompt({
                "location": request.location,
                "preferences": request.preferences
            })}
        ]
        
        # Add conversation history
        for msg in request.conversation_history[-10:]:  # Keep last 10 messages
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        
        # Add current user message
        messages.append({
            "role": "user", 
            "content": request.message
        })
        
        # Call NVIDIA NIM API
        logger.info(f"Making NVIDIA NIM API call for user: {request.user_id}")
        
        response = openai_client.chat.completions.create(
            model=AI_MODEL,
            messages=messages,
            max_tokens=1000,
            temperature=1,
            top_p=1
        )
        
        ai_response = response.choices[0].message.content
        
        # Generate follow-up suggestions
        suggestions = []
        if "destination" in request.message.lower():
            suggestions = [
                "Tell me more about the local cuisine",
                "What's the best time to visit?",
                "Suggest a 3-day itinerary",
                "What's the budget for this trip?"
            ]
        elif "itinerary" in request.message.lower():
            suggestions = [
                "Add restaurant recommendations",
                "Include transportation details", 
                "Suggest alternative activities",
                "What about shopping areas?"
            ]
        
        return ChatResponse(
            response=ai_response,
            conversation_id=request.user_id,
            suggestions=suggestions,
            places=[]  # TODO: Extract places from AI response
        )
        
    except openai.RateLimitError:
        logger.error("OpenAI rate limit exceeded")
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Please try again later.")
    
    except openai.AuthenticationError:
        logger.error("OpenAI authentication failed")
        raise HTTPException(status_code=500, detail="AI service authentication failed")
    
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        # Return fallback response instead of error
        return ChatResponse(
            response=generate_fallback_response(request.message),
            session_id=f"fallback_{datetime.now().timestamp()}",
            suggestions=generate_suggestions(request.message)
        )

@app.post("/travel-dna/analyze", response_model=TravelDNAResponse)
async def analyze_user_travel_dna(request: TravelDNARequest):
    """Analyze user's travel DNA based on quiz responses"""
    try:
        # Analyze travel DNA
        analysis = analyze_travel_dna(request.answers)
        dna_type = analysis["dna_type"]
        dna_info = TRAVEL_DNA_TYPES[dna_type]
        
        # Generate personalized recommendations using AI
        prompt = f"""Based on the travel DNA type '{dna_info['name']}' with traits {dna_info['traits']}, 
        generate 5 specific, actionable travel recommendations. Include destinations, activities, and tips 
        that match this personality type. Be specific and practical."""
        
        # NVIDIA NIM API is always available
        try:
            response = openai_client.chat.completions.create(
                model=AI_MODEL,
                messages=[
                    {"role": "system", "content": "You are a travel expert providing personalized recommendations."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.8
            )
            
            ai_recommendations = response.choices[0].message.content.split('\n')
            recommendations = [rec.strip() for rec in ai_recommendations if rec.strip()]
            
        except Exception as e:
            logger.warning(f"AI recommendation generation failed: {e}")
            recommendations = [
                f"Explore destinations that match your {dna_info['name']} personality",
                f"Focus on {', '.join(dna_info['traits'])} experiences",
                "Join travel communities with similar interests",
                "Plan trips that align with your natural preferences",
                "Document your travels to track personal growth"
            ]
        
        return TravelDNAResponse(
            dna_type=dna_info["name"],
            description=dna_info["description"],
            recommendations=recommendations[:5],
            score_breakdown=analysis["scores"]
        )
        
    except Exception as e:
        logger.error(f"Travel DNA analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/destinations/recommendations")
async def get_destination_recommendations(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    budget: Optional[str] = None,
    interests: Optional[str] = None,
    duration: Optional[int] = None
):
    """Get AI-powered destination recommendations"""
    try:
        # NVIDIA NIM API is always configured
        
        # Build recommendation prompt
        prompt = "Recommend 5 travel destinations based on the following criteria:\n"
        
        if lat and lng:
            prompt += f"- Current location: {lat}, {lng}\n"
        if budget:
            prompt += f"- Budget: {budget}\n"
        if interests:
            prompt += f"- Interests: {interests}\n"
        if duration:
            prompt += f"- Trip duration: {duration} days\n"
            
        prompt += "\nFor each destination, provide: name, country, brief description, estimated budget, and top 3 activities."
        
        response = openai_client.chat.completions.create(
            model=AI_MODEL,
            messages=[
                {"role": "system", "content": "You are a travel expert providing destination recommendations."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=800,
            temperature=0.7
        )
        
        return {
            "recommendations": response.choices[0].message.content,
            "criteria": {
                "location": f"{lat}, {lng}" if lat and lng else None,
                "budget": budget,
                "interests": interests,
                "duration": duration
            }
        }
        
    except Exception as e:
        logger.error(f"Destination recommendation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Recommendation service error: {str(e)}")

if __name__ == "__main__":
    # Production server configuration
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting AI Travel Companion Service on {host}:{port}")
    logger.info(f"AI API configured: True - Provider: NVIDIA NIM - Model: {AI_MODEL}")
    
    uvicorn.run(
        "production_main:app",
        host=host,
        port=port,
        reload=False,  # Disable reload in production
        log_level="info",
        access_log=True
    )
