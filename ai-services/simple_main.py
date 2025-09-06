#!/usr/bin/env python3
"""
Simplified AI Services for Travel Companion
Provides basic chat functionality without heavy ML dependencies
"""

import os
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import uvicorn

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# OpenAI integration
try:
    import openai
    openai.api_key = os.getenv('OPENAI_API_KEY')
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="AI Travel Services",
    description="Lightweight AI services for travel companion",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = {}

class ChatResponse(BaseModel):
    response: str
    session_id: str
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    timestamp: str
    services: Dict[str, str]

# Simple chat responses based on keywords
TRAVEL_RESPONSES = {
    "paris": "Paris is absolutely magical! 🗼 The Eiffel Tower, Louvre Museum, and charming cafés make it perfect for any traveler. Best visited in spring (April-June) or fall (September-November).",
    "tokyo": "Tokyo offers an incredible blend of tradition and innovation! 🏯 From ancient temples to cutting-edge technology, amazing street food, and unique cultural experiences.",
    "restaurant": "Great choice for dining! 🍽️ I recommend looking for local favorites with authentic flavors and good reviews from fellow travelers.",
    "budget": "Smart budget travel! 💰 Consider shoulder seasons, local accommodations, public transport, and free walking tours for amazing experiences without breaking the bank.",
    "hotel": "For accommodations, I suggest checking reviews, location proximity to attractions, and amenities that matter to you. Book in advance for better rates! 🏨",
    "flight": "For flights, try booking 6-8 weeks in advance, be flexible with dates, and consider nearby airports. Tuesday-Thursday departures are often cheaper! ✈️",
    "activity": "There are so many amazing activities to discover! 🎯 What type of experience interests you - cultural, adventure, food, or relaxation?",
    "weather": "Weather can make or break a trip! ☀️ I recommend checking seasonal patterns and packing layers for comfort in any conditions."
}

def generate_travel_response(message: str) -> str:
    """Generate a travel-related response using OpenAI or fallback to keywords"""
    
    # Try OpenAI first if available
    if OPENAI_AVAILABLE and os.getenv('OPENAI_API_KEY'):
        try:
            client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful AI travel assistant. Provide concise, practical travel advice with emojis. Keep responses under 200 words."
                    },
                    {"role": "user", "content": message}
                ],
                max_tokens=200,
                temperature=0.7
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"OpenAI API error: {e}, falling back to keyword responses")
    
    # Fallback to keyword-based responses
    message_lower = message.lower()
    
    # Check for specific keywords and return relevant responses
    for keyword, response in TRAVEL_RESPONSES.items():
        if keyword in message_lower:
            return response
    
    # Default response for general travel queries
    return "I'd be happy to help you plan your travel! 🌍 Could you tell me more about what you're looking for? I can help with destinations, accommodations, activities, budgeting, and more!"

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="OK",
        timestamp=datetime.now().isoformat(),
        services={
            "chat": "active",
            "recommendations": "active",
            "travel_dna": "active"
        }
    )

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Simple chat endpoint with travel-focused responses"""
    try:
        logger.info(f"Chat request from user {request.user_id}: {request.message}")
        
        # Generate response based on message content
        response_text = generate_travel_response(request.message)
        
        # Create session ID (simple timestamp-based)
        session_id = f"session_{request.user_id}_{int(datetime.now().timestamp())}"
        
        response = ChatResponse(
            response=response_text,
            session_id=session_id,
            timestamp=datetime.now().isoformat()
        )
        
        logger.info(f"Generated response for user {request.user_id}")
        return response
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Chat service error")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "AI Travel Services API",
        "version": "1.0.0",
        "endpoints": ["/health", "/chat"],
        "status": "active"
    }

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting AI Travel Services on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="info")
