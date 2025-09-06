// MongoDB initialization script for AI Travel Companion analytics
// This creates collections and indexes for ML data and user behavior tracking

// Switch to analytics database
db = db.getSiblingDB('ai_travel_analytics');

// Create collections for different types of analytics data

// 1. User Behavior Events
db.createCollection('user_events', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["user_id", "event_type", "timestamp"],
            properties: {
                user_id: { bsonType: "string" },
                event_type: { bsonType: "string" },
                timestamp: { bsonType: "date" },
                location: {
                    bsonType: "object",
                    properties: {
                        lat: { bsonType: "double" },
                        lng: { bsonType: "double" },
                        city: { bsonType: "string" }
                    }
                },
                metadata: { bsonType: "object" }
            }
        }
    }
});

// 2. AI Interaction Logs
db.createCollection('ai_interactions', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["user_id", "session_id", "timestamp", "query", "response"],
            properties: {
                user_id: { bsonType: "string" },
                session_id: { bsonType: "string" },
                timestamp: { bsonType: "date" },
                query: { bsonType: "string" },
                response: { bsonType: "string" },
                context: { bsonType: "object" },
                feedback: { bsonType: "object" }
            }
        }
    }
});

// 3. Recommendation Feedback
db.createCollection('recommendation_feedback', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["user_id", "recommendation_id", "action", "timestamp"],
            properties: {
                user_id: { bsonType: "string" },
                recommendation_id: { bsonType: "string" },
                action: { enum: ["like", "dislike", "skip", "save", "visit"] },
                timestamp: { bsonType: "date" },
                location: { bsonType: "object" },
                context: { bsonType: "object" }
            }
        }
    }
});

// 4. Travel Patterns
db.createCollection('travel_patterns', {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["user_id", "trip_id", "timestamp"],
            properties: {
                user_id: { bsonType: "string" },
                trip_id: { bsonType: "string" },
                timestamp: { bsonType: "date" },
                duration: { bsonType: "int" },
                locations_visited: { bsonType: "array" },
                preferences: { bsonType: "object" },
                satisfaction_score: { bsonType: "double" }
            }
        }
    }
});

// Create indexes for performance
// User events indexes
db.user_events.createIndex({ "user_id": 1, "timestamp": -1 });
db.user_events.createIndex({ "event_type": 1, "timestamp": -1 });
db.user_events.createIndex({ "location.city": 1 });

// AI interactions indexes
db.ai_interactions.createIndex({ "user_id": 1, "timestamp": -1 });
db.ai_interactions.createIndex({ "session_id": 1 });
db.ai_interactions.createIndex({ "timestamp": -1 });

// Recommendation feedback indexes
db.recommendation_feedback.createIndex({ "user_id": 1, "timestamp": -1 });
db.recommendation_feedback.createIndex({ "recommendation_id": 1 });
db.recommendation_feedback.createIndex({ "action": 1, "timestamp": -1 });

// Travel patterns indexes
db.travel_patterns.createIndex({ "user_id": 1, "timestamp": -1 });
db.travel_patterns.createIndex({ "trip_id": 1 });

// Create TTL index for automatic cleanup of old logs (optional)
// Remove logs older than 1 year
db.user_events.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 31536000 });
db.ai_interactions.createIndex({ "timestamp": 1 }, { expireAfterSeconds: 31536000 });

print("MongoDB collections and indexes created successfully for AI Travel Analytics");
