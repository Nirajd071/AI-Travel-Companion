import openai
import json
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
import asyncio
from sentence_transformers import SentenceTransformer
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import sqlite3
import os

logger = logging.getLogger(__name__)

class AITwinChatbot:
    def __init__(self):
        self.openai_client = openai.OpenAI(api_key=os.getenv('OPENAI_API_KEY'))
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.memory_db_path = 'data/chatbot_memory.db'
        self.init_memory_db()
        
    def init_memory_db(self):
        """Initialize SQLite database for conversation memory"""
        os.makedirs('data', exist_ok=True)
        conn = sqlite3.connect(self.memory_db_path)
        cursor = conn.cursor()
        
        # Create tables for memory storage
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS conversation_memory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                session_id TEXT NOT NULL,
                message_type TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                importance_score REAL DEFAULT 0.5,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                ttl_hours INTEGER DEFAULT 168
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                fact_type TEXT NOT NULL,
                fact_content TEXT NOT NULL,
                confidence REAL DEFAULT 0.8,
                last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                source TEXT DEFAULT 'conversation'
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS poi_knowledge (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                poi_id INTEGER,
                poi_name TEXT NOT NULL,
                description TEXT,
                tips TEXT,
                embedding BLOB,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        conn.commit()
        conn.close()

    async def chat(self, user_id: int, message: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Main chat interface with persona conditioning"""
        try:
            # Get user's Travel DNA and conversation history
            travel_dna = await self.get_user_travel_dna(user_id)
            conversation_history = await self.get_conversation_history(user_id, limit=10)
            relevant_memories = await self.retrieve_relevant_memories(user_id, message)
            
            # Build system prompt with persona conditioning
            system_prompt = self.build_persona_prompt(travel_dna, relevant_memories, context)
            
            # Prepare conversation messages
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history
            for msg in conversation_history:
                messages.append({
                    "role": msg['message_type'],
                    "content": msg['content']
                })
            
            # Add current user message
            messages.append({"role": "user", "content": message})
            
            # Get AI response
            response = await self.get_openai_response(messages)
            
            # Store conversation in memory
            session_id = context.get('session_id', f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            await self.store_conversation(user_id, session_id, message, response, context)
            
            # Extract and store user facts
            await self.extract_user_facts(user_id, message, response)
            
            return {
                "response": response,
                "session_id": session_id,
                "persona_applied": bool(travel_dna),
                "memories_used": len(relevant_memories),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Chat error for user {user_id}: {e}")
            return {
                "response": "I'm having trouble processing your request right now. Could you try again?",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }

    def build_persona_prompt(self, travel_dna: Dict, memories: List[Dict], context: Dict = None) -> str:
        """Build system prompt with Travel DNA conditioning"""
        base_prompt = """You are an AI travel companion that adapts to the user's personality and preferences. 
You provide personalized travel recommendations, answer questions, and help plan activities.

Key traits:
- Friendly and conversational
- Knowledgeable about travel and local experiences
- Adaptive to user's communication style
- Proactive in suggesting relevant activities
- Safety-conscious and practical"""

        if travel_dna:
            persona_section = f"""

USER TRAVEL PERSONA:
- Primary personality: {self.get_primary_persona(travel_dna.get('persona_labels', {}))}
- Budget preference: {travel_dna.get('budget_range', 'mixed')}
- Travel style: {travel_dna.get('travel_style', 'solo')}
- Preferred categories: {self.format_category_preferences(travel_dna.get('category_preferences', {}))}
- Transport modes: {', '.join(travel_dna.get('transport_modes', ['walking']))}
- Dietary restrictions: {', '.join(travel_dna.get('dietary_restrictions', ['none']))}

Adapt your responses to match this persona. Be more adventurous for adventurers, food-focused for foodies, etc."""

            base_prompt += persona_section

        if memories:
            memory_section = "\n\nRELEVANT MEMORIES:\n"
            for memory in memories[:3]:  # Top 3 most relevant
                memory_section += f"- {memory['content']}\n"
            memory_section += "\nUse these memories to provide personalized responses."
            base_prompt += memory_section

        if context:
            context_section = f"""

CURRENT CONTEXT:
- Location: {context.get('location', 'Unknown')}
- Time: {context.get('time_of_day', 'Unknown')}
- Weather: {context.get('weather', 'Unknown')}
- Mood: {context.get('mood', 'Unknown')}

Consider this context when making recommendations."""
            base_prompt += context_section

        base_prompt += """

RESPONSE GUIDELINES:
- Keep responses conversational and helpful
- Suggest specific places when relevant
- Ask follow-up questions to better understand needs
- Provide practical details (distance, time, cost when known)
- Be encouraging and enthusiastic about travel experiences
- If you don't know something specific, say so and suggest alternatives"""

        return base_prompt

    async def get_openai_response(self, messages: List[Dict]) -> str:
        """Get response from OpenAI with error handling"""
        try:
            response = self.openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                max_tokens=500,
                temperature=0.7,
                presence_penalty=0.1,
                frequency_penalty=0.1
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return "I'm experiencing some technical difficulties. Let me try to help you in a different way."

    async def store_conversation(self, user_id: int, session_id: str, user_message: str, 
                                ai_response: str, context: Dict = None):
        """Store conversation in memory database"""
        try:
            conn = sqlite3.connect(self.memory_db_path)
            cursor = conn.cursor()
            
            # Store user message
            user_embedding = self.embedding_model.encode(user_message).tobytes()
            cursor.execute('''
                INSERT INTO conversation_memory 
                (user_id, session_id, message_type, content, embedding, importance_score)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, session_id, 'user', user_message, user_embedding, 0.6))
            
            # Store AI response
            ai_embedding = self.embedding_model.encode(ai_response).tobytes()
            cursor.execute('''
                INSERT INTO conversation_memory 
                (user_id, session_id, message_type, content, embedding, importance_score)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, session_id, 'assistant', ai_response, ai_embedding, 0.5))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")

    async def retrieve_relevant_memories(self, user_id: int, query: str, limit: int = 5) -> List[Dict]:
        """Retrieve relevant memories using semantic search"""
        try:
            query_embedding = self.embedding_model.encode(query)
            
            conn = sqlite3.connect(self.memory_db_path)
            cursor = conn.cursor()
            
            # Get recent memories with embeddings
            cursor.execute('''
                SELECT content, embedding, importance_score, timestamp
                FROM conversation_memory
                WHERE user_id = ? AND embedding IS NOT NULL
                ORDER BY timestamp DESC
                LIMIT 50
            ''', (user_id,))
            
            memories = cursor.fetchall()
            conn.close()
            
            if not memories:
                return []
            
            # Calculate similarity scores
            relevant_memories = []
            for content, embedding_bytes, importance, timestamp in memories:
                try:
                    memory_embedding = np.frombuffer(embedding_bytes, dtype=np.float32)
                    similarity = cosine_similarity([query_embedding], [memory_embedding])[0][0]
                    
                    # Combine similarity with importance score
                    relevance_score = similarity * 0.7 + importance * 0.3
                    
                    if relevance_score > 0.3:  # Threshold for relevance
                        relevant_memories.append({
                            'content': content,
                            'relevance_score': relevance_score,
                            'timestamp': timestamp
                        })
                except Exception as e:
                    logger.warning(f"Error processing memory embedding: {e}")
                    continue
            
            # Sort by relevance and return top results
            relevant_memories.sort(key=lambda x: x['relevance_score'], reverse=True)
            return relevant_memories[:limit]
            
        except Exception as e:
            logger.error(f"Error retrieving memories: {e}")
            return []

    async def extract_user_facts(self, user_id: int, user_message: str, ai_response: str):
        """Extract and store user facts from conversation"""
        try:
            # Simple fact extraction patterns
            fact_patterns = {
                'preference': ['i like', 'i love', 'i prefer', 'i enjoy', 'favorite'],
                'dislike': ['i hate', 'i dislike', 'not a fan', 'avoid'],
                'experience': ['i went to', 'i visited', 'i tried', 'last time'],
                'plan': ['planning to', 'want to visit', 'thinking about', 'hoping to']
            }
            
            message_lower = user_message.lower()
            facts_found = []
            
            for fact_type, patterns in fact_patterns.items():
                for pattern in patterns:
                    if pattern in message_lower:
                        # Extract the relevant part of the sentence
                        start_idx = message_lower.find(pattern)
                        fact_content = user_message[start_idx:start_idx + 100]  # Get context
                        facts_found.append({
                            'type': fact_type,
                            'content': fact_content.strip(),
                            'confidence': 0.7
                        })
                        break
            
            # Store facts in database
            if facts_found:
                conn = sqlite3.connect(self.memory_db_path)
                cursor = conn.cursor()
                
                for fact in facts_found:
                    cursor.execute('''
                        INSERT OR REPLACE INTO user_facts 
                        (user_id, fact_type, fact_content, confidence)
                        VALUES (?, ?, ?, ?)
                    ''', (user_id, fact['type'], fact['content'], fact['confidence']))
                
                conn.commit()
                conn.close()
                
        except Exception as e:
            logger.error(f"Error extracting user facts: {e}")

    async def get_conversation_history(self, user_id: int, limit: int = 10) -> List[Dict]:
        """Get recent conversation history"""
        try:
            conn = sqlite3.connect(self.memory_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT message_type, content, timestamp
                FROM conversation_memory
                WHERE user_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (user_id, limit * 2))  # Get more to account for user/assistant pairs
            
            history = cursor.fetchall()
            conn.close()
            
            # Convert to list of dicts and reverse to chronological order
            return [{'message_type': msg[0], 'content': msg[1], 'timestamp': msg[2]} 
                   for msg in reversed(history)]
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []

    async def get_user_travel_dna(self, user_id: int) -> Optional[Dict]:
        """Get user's Travel DNA from backend API"""
        try:
            # This would typically make an API call to the backend
            # For now, return None to indicate no Travel DNA available
            # In production, implement HTTP client to fetch from backend
            return None
        except Exception as e:
            logger.error(f"Error fetching Travel DNA: {e}")
            return None

    def get_primary_persona(self, persona_labels: Dict) -> str:
        """Get the primary persona from labels"""
        if not persona_labels:
            return "balanced traveler"
        
        primary = max(persona_labels.items(), key=lambda x: x[1])
        return f"{primary[0]} (score: {primary[1]:.2f})"

    def format_category_preferences(self, category_prefs: Dict) -> str:
        """Format category preferences for prompt"""
        if not category_prefs:
            return "no specific preferences"
        
        top_categories = sorted(category_prefs.items(), key=lambda x: x[1], reverse=True)[:3]
        return ", ".join([f"{cat} ({score:.2f})" for cat, score in top_categories])

    async def add_poi_knowledge(self, poi_id: int, poi_name: str, description: str, tips: str = ""):
        """Add POI knowledge to the chatbot's knowledge base"""
        try:
            # Create embedding for POI information
            poi_text = f"{poi_name} {description} {tips}".strip()
            embedding = self.embedding_model.encode(poi_text).tobytes()
            
            conn = sqlite3.connect(self.memory_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO poi_knowledge 
                (poi_id, poi_name, description, tips, embedding)
                VALUES (?, ?, ?, ?, ?)
            ''', (poi_id, poi_name, description, tips, embedding))
            
            conn.commit()
            conn.close()
            
        except Exception as e:
            logger.error(f"Error adding POI knowledge: {e}")

    async def cleanup_old_memories(self, max_age_hours: int = 168):  # 1 week default
        """Clean up old conversation memories"""
        try:
            conn = sqlite3.connect(self.memory_db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                DELETE FROM conversation_memory 
                WHERE datetime(timestamp) < datetime('now', '-' || ? || ' hours')
            ''', (max_age_hours,))
            
            deleted_count = cursor.rowcount
            conn.commit()
            conn.close()
            
            logger.info(f"Cleaned up {deleted_count} old conversation memories")
            
        except Exception as e:
            logger.error(f"Error cleaning up memories: {e}")

# Global chatbot instance
chatbot = AITwinChatbot()
