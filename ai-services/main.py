from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import os
from dotenv import load_dotenv
from firebase_messaging import firebase_messaging
from openai_service import openai_service
from chatbot_service import chatbot

load_dotenv()

app = FastAPI(
    title="AI Travel Services",
    description="AI/ML services for travel recommendations and chatbot",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatMessage(BaseModel):
    user_id: int
    message: str
    context: dict = {}

class TravelDNARequest(BaseModel):
    quiz_answers: dict
    user_id: str

class RecommendationRequest(BaseModel):
    location: str
    preferences: dict
    user_id: str

class NotificationRequest(BaseModel):
    token: str
    title: str
    body: str
    data: dict = {}

class MulticastNotificationRequest(BaseModel):
    tokens: list[str]
    title: str
    body: str
    data: dict = {}

# Health check
@app.get("/health")
async def health_check():
    return {
        "status": "OK",
        "service": "AI Travel Services",
        "version": "1.0.0"
    }

# Travel DNA Analysis
@app.post("/api/travel-dna/analyze")
async def analyze_travel_dna(request: TravelDNARequest):
    try:
        dna_profile = await openai_service.analyze_travel_dna(request.quiz_answers)
        return {
            "success": True,
            "user_id": request.user_id,
            "dna_profile": dna_profile,
            "message": "Travel DNA analysis completed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# AI Chat with AI Twin
@app.post("/chat")
async def chat_with_ai_twin(request: ChatMessage):
    try:
        response = await chatbot.chat(
            user_id=request.user_id,
            message=request.message,
            context=request.context
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/history")
async def get_chat_history(user_id: int, session_id: str = None, limit: int = 20):
    try:
        history = await chatbot.get_conversation_history(user_id, limit)
        return {
            "success": True,
            "history": history
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chat/session")
async def clear_chat_session(user_id: int, session_id: str):
    try:
        # Clear conversation memory for session
        await chatbot.cleanup_old_memories(max_age_hours=0)  # Immediate cleanup
        return {
            "success": True,
            "message": "Session cleared"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/knowledge/poi")
async def add_poi_knowledge(poi_id: int, poi_name: str, description: str, tips: str = ""):
    try:
        await chatbot.add_poi_knowledge(poi_id, poi_name, description, tips)
        return {
            "success": True,
            "message": "POI knowledge added"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/stats/user/{user_id}")
async def get_user_stats(user_id: int):
    try:
        # Basic stats - would be enhanced with actual database queries
        return {
            "totalConversations": 0,
            "totalMessages": 0,
            "averageResponseTime": 1.2,
            "topTopics": ["restaurants", "attractions", "activities"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/persona/{user_id}")
async def update_persona(user_id: int, personality: dict = None, preferences: dict = None, communication_style: dict = None):
    try:
        # Store persona updates - would integrate with Travel DNA
        return {
            "success": True,
            "message": "Persona updated"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/suggestions")
async def get_suggestions(user_id: int, context: str = "{}"):
    try:
        import json
        context_dict = json.loads(context) if context != "{}" else {}
        
        suggestions = [
            "What's a good restaurant nearby?",
            "Show me popular attractions in this area",
            "I'm looking for something fun to do",
            "What's the weather like for outdoor activities?"
        ]
        
        return {
            "suggestions": suggestions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Recommendations
@app.post("/api/recommendations/generate")
async def generate_recommendations(request: RecommendationRequest):
    try:
        # Get user DNA profile (in real app, fetch from database)
        user_dna = {"adventure_level": "medium", "activity_types": ["cultural", "food"]}
        
        recommendations = await openai_service.generate_recommendations(
            location=request.location,
            preferences=request.preferences,
            user_dna=user_dna
        )
        
        return {
            "success": True,
            "location": request.location,
            "recommendations": recommendations,
            "message": "Recommendations generated successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Firebase Messaging Endpoints
@app.post("/api/notifications/send")
async def send_notification(request: NotificationRequest):
    try:
        response = await firebase_messaging.send_notification(
            token=request.token,
            title=request.title,
            body=request.body,
            data=request.data
        )
        return {
            "success": True,
            "message_id": response,
            "message": "Notification sent successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/notifications/send-multiple")
async def send_multicast_notification(request: MulticastNotificationRequest):
    try:
        response = await firebase_messaging.send_to_multiple_devices(
            tokens=request.tokens,
            title=request.title,
            body=request.body,
            data=request.data
        )
        return {
            "success": True,
            "result": response,
            "message": "Multicast notification sent successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Model training endpoint
@app.post("/api/models/train")
async def train_models():
    return {
        "message": "Model training endpoint - implement batch training jobs",
        "status": "training_started"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
