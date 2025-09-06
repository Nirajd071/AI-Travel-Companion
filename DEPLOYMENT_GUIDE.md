# AI Travel Companion - Deployment Guide

## 🚀 Full-Stack Deployment Instructions

### Architecture Overview
- **Frontend**: Next.js React app (Port 3001)
- **Backend**: Node.js Express API (Port 3000) 
- **AI Services**: Python FastAPI (Port 8000)
- **Databases**: PostgreSQL + PostGIS, Redis, MongoDB

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- Python 3.8+
- Git

## 🔧 Local Development Setup

### 1. Clone and Setup
```bash
git clone <repository-url>
cd AI-Travel
```

### 2. Start Databases
```bash
docker-compose up -d postgres redis mongodb
```

### 3. Backend Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration
npm install
node src/server.js
```

### 4. AI Services Setup
```bash
cd ai-services
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn openai python-dotenv firebase-admin
python simple_main.py
```

### 5. Frontend Setup
```bash
cd travel-companion
npm install
npm run dev
```

## 🌐 Production Deployment

### Docker Compose Production
```bash
# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose logs -f
```

### Environment Variables

#### Backend (.env)
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# Database URLs
DATABASE_URL=postgresql://user:password@postgres:5432/travel_companion
REDIS_URL=redis://redis:6379
MONGODB_URL=mongodb://mongodb:27017/travel_analytics

# API Keys
OPENAI_API_KEY=your-openai-api-key
GOOGLE_MAPS_API_KEY=your-google-maps-key
FOURSQUARE_API_KEY=your-foursquare-key

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_SERVER_KEY=your-firebase-server-key
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
```

## 🧪 Testing

### API Testing
```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:8000/health

# Authentication test
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User"}'

# Places API test
curl "http://localhost:3000/api/places/nearby?lat=48.8584&lng=2.2945&radius=5"

# AI Chat test
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"user_id":"test","message":"Plan a trip to Paris","context":{}}'
```

## 📊 Database Schema

### PostgreSQL Tables
- `users` - User accounts and profiles
- `trips` - User trip plans and itineraries
- `places` - Points of interest with geospatial data
- `user_preferences` - Travel preferences and settings
- `notifications` - Push notifications and alerts

### MongoDB Collections
- `user_analytics` - User behavior tracking
- `ml_training_data` - Machine learning datasets
- `search_logs` - Search queries and results

### Redis Keys
- `user:profile:{id}` - Cached user profiles
- `places:nearby:{lat}:{lng}` - Cached place searches
- `session:{token}` - User sessions
- `rate_limit:{ip}` - Rate limiting counters

## 🔒 Security Considerations

### Authentication
- JWT tokens with 7-day expiration
- Password hashing with bcrypt
- Protected routes with middleware

### API Security
- Rate limiting on auth endpoints
- Input validation and sanitization
- CORS configuration for frontend

### Database Security
- Connection pooling and timeouts
- Prepared statements (SQL injection prevention)
- Environment-based configuration

## 📈 Monitoring & Logging

### Application Logs
```bash
# Backend logs
docker-compose logs backend

# AI services logs
docker-compose logs ai-services

# Database logs
docker-compose logs postgres redis mongodb
```

### Health Monitoring
- `/health` endpoints on all services
- Database connection status
- Redis cache availability
- MongoDB analytics connection

## 🚀 Scaling Considerations

### Horizontal Scaling
- Load balancer for multiple backend instances
- Redis cluster for session management
- MongoDB replica set for analytics

### Performance Optimization
- Redis caching for frequent queries
- Database indexing on search fields
- CDN for static assets
- Image optimization and compression

## 🔧 Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database status
docker-compose ps
docker-compose logs postgres

# Reset databases
docker-compose down -v
docker-compose up -d
```

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3000
netstat -tulpn | grep :8000

# Kill processes
pkill -f "node src/server.js"
pkill -f "python simple_main.py"
```

#### Authentication Issues
- Verify JWT_SECRET in environment
- Check token format in Authorization header
- Ensure user exists in database

### Performance Issues
- Monitor Redis memory usage
- Check PostgreSQL query performance
- Optimize MongoDB indexes
- Review API response times

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users/profile` - Get user profile (protected)

### Places Endpoints
- `GET /api/places/nearby` - Find nearby places
- `GET /api/places/search/{query}` - Search places
- `GET /api/places/{id}` - Get place details

### AI Endpoints
- `POST /chat` - AI chat conversation
- `POST /api/recommendations` - Get travel recommendations
- `POST /api/travel-dna/analyze` - Analyze travel preferences

## 🎯 Next Steps

1. **Production Deployment**: Deploy to cloud provider (AWS, GCP, Azure)
2. **CI/CD Pipeline**: Set up automated testing and deployment
3. **Monitoring**: Implement application performance monitoring
4. **Backup Strategy**: Set up database backups and recovery
5. **SSL/TLS**: Configure HTTPS for production
6. **CDN**: Set up content delivery network for assets

---

**Status**: ✅ Fully Integrated and Functional
**Last Updated**: 2025-09-06
**Version**: 1.0.0
