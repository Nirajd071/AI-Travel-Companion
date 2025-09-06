-- AI Travel Companion Database Schema
-- Hybrid architecture with PostgreSQL + PostGIS for structured data

-- Users table with Travel DNA integration
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    profile_image_url TEXT,
    travel_dna_score JSONB, -- Store Travel DNA personality scores
    preferences JSONB, -- User preferences and settings
    push_token VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Places table with geospatial support (PostGIS)
CREATE TABLE IF NOT EXISTS places (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- restaurant, attraction, hotel, etc.
    subcategory VARCHAR(100),
    description TEXT,
    location GEOGRAPHY(POINT, 4326), -- PostGIS geography type for lat/lng
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(100),
    rating DECIMAL(3,2),
    price_level INTEGER, -- 1-4 scale
    opening_hours JSONB,
    contact_info JSONB, -- phone, website, etc.
    external_ids JSONB, -- Google Places ID, Foursquare ID, etc.
    metadata JSONB, -- Additional flexible data
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trips and itineraries
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    destination_city VARCHAR(100),
    destination_country VARCHAR(100),
    start_date DATE,
    end_date DATE,
    budget DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    trip_type VARCHAR(50), -- solo, family, business, etc.
    status VARCHAR(20) DEFAULT 'planning', -- planning, active, completed, cancelled
    itinerary JSONB, -- Day-wise detailed itinerary
    preferences JSONB, -- Trip-specific preferences
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trip activities (individual items in itinerary)
CREATE TABLE IF NOT EXISTS trip_activities (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER REFERENCES trips(id) ON DELETE CASCADE,
    place_id INTEGER REFERENCES places(id),
    day_number INTEGER NOT NULL,
    start_time TIME,
    end_time TIME,
    activity_type VARCHAR(50), -- visit, meal, transport, etc.
    notes TEXT,
    estimated_cost DECIMAL(8,2),
    actual_cost DECIMAL(8,2),
    status VARCHAR(20) DEFAULT 'planned', -- planned, completed, skipped
    user_rating INTEGER, -- 1-5 stars after completion
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User favorites and saved places
CREATE TABLE IF NOT EXISTS user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    place_id INTEGER REFERENCES places(id) ON DELETE CASCADE,
    category VARCHAR(50), -- wishlist, visited, liked, etc.
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, place_id, category)
);

-- AI chat sessions for context persistence
CREATE TABLE IF NOT EXISTS ai_chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id VARCHAR(100) UNIQUE NOT NULL,
    context JSONB, -- Conversation context and memory
    current_location GEOGRAPHY(POINT, 4326),
    active_trip_id INTEGER REFERENCES trips(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Notifications and alerts
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50), -- recommendation, reminder, alert, etc.
    data JSONB, -- Additional notification data
    location GEOGRAPHY(POINT, 4326), -- Location-based notifications
    scheduled_for TIMESTAMP,
    sent_at TIMESTAMP,
    read_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- pending, sent, read, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User feedback and ratings for ML training
CREATE TABLE IF NOT EXISTS user_feedback (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    feedback_type VARCHAR(50), -- recommendation, place, trip, etc.
    reference_id INTEGER, -- ID of the item being rated
    rating INTEGER, -- 1-5 stars
    feedback_text TEXT,
    context JSONB, -- Additional context for ML
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- Geospatial indexes (PostGIS)
CREATE INDEX IF NOT EXISTS idx_places_location ON places USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_places_category ON places(category);
CREATE INDEX IF NOT EXISTS idx_places_city ON places(city);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

CREATE INDEX IF NOT EXISTS idx_trip_activities_trip_id ON trip_activities(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_activities_day ON trip_activities(day_number);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favorites_place_id ON user_favorites(place_id);

CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_user_id ON ai_chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_session_id ON ai_chat_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_chat_sessions_expires ON ai_chat_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_location ON notifications USING GIST(location);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_type ON user_feedback(feedback_type);

-- Insert sample data for testing
INSERT INTO places (name, category, location, address, city, country, rating, price_level) VALUES
('Eiffel Tower', 'attraction', ST_GeogFromText('POINT(2.2945 48.8584)'), 'Champ de Mars, 5 Avenue Anatole France', 'Paris', 'France', 4.6, 2),
('Louvre Museum', 'museum', ST_GeogFromText('POINT(2.3376 48.8606)'), 'Rue de Rivoli', 'Paris', 'France', 4.7, 3),
('Café de Flore', 'restaurant', ST_GeogFromText('POINT(2.3326 48.8542)'), '172 Boulevard Saint-Germain', 'Paris', 'France', 4.2, 3),
('Tokyo Skytree', 'attraction', ST_GeogFromText('POINT(139.8107 35.7101)'), '1 Chome-1-2 Oshiage', 'Tokyo', 'Japan', 4.1, 2),
('Senso-ji Temple', 'temple', ST_GeogFromText('POINT(139.7967 35.7148)'), '2 Chome-3-1 Asakusa', 'Tokyo', 'Japan', 4.3, 1);

-- Database schema created successfully with PostGIS support!
