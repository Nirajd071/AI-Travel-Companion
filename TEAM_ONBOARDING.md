# 👥 Team Onboarding Checklist

## 🎯 New Team Member Setup (5 minutes)

### Prerequisites Check
- [ ] Git installed and configured
- [ ] Code editor (VS Code recommended)
- [ ] Terminal access

### One-Command Setup
```bash
# Clone and setup everything
git clone <repository-url>
cd AI-Travel
./setup.sh
```

**That's it! Everything else is automated.**

## 🔧 Development Environment

### Required Tools (Auto-installed by setup.sh)
- [ ] Node.js 18+ (Backend)
- [ ] Python 3.10+ (AI Services)
- [ ] Flutter SDK (Mobile App)
- [ ] PostgreSQL (Database)
- [ ] Redis (Caching)
- [ ] Docker (Optional)

### IDE Extensions
**VS Code Recommended:**
- [ ] Flutter
- [ ] Python
- [ ] JavaScript/TypeScript
- [ ] GitLens
- [ ] Thunder Client (API testing)

## 📋 Role-Specific Setup

### 👨‍💻 Frontend Developer (Flutter)
```bash
# Your branch
git checkout -b feature/frontend

# Start development
cd frontend
flutter doctor
flutter run
```

**Focus Areas:**
- UI/UX implementation
- Firebase integration
- State management (BLoC)
- Maps and location services

### 🔧 Backend Developer (Node.js)
```bash
# Your branch
git checkout -b feature/backend

# Start development
cd backend
npm run dev
```

**Focus Areas:**
- REST API development
- Database design
- Authentication (JWT)
- Third-party integrations

### 🤖 AI Developer (Python)
```bash
# Your branch
git checkout -b feature/ai

# Start development
cd ai-services
source venv/bin/activate
uvicorn main:app --reload
```

**Focus Areas:**
- ML model development
- OpenAI integration
- Recommendation algorithms
- Data processing

### 🔔 DevOps/Notifications (Full Stack)
```bash
# Your branch
git checkout -b feature/notifications

# Work across all services
```

**Focus Areas:**
- Firebase messaging
- CI/CD pipelines
- Deployment automation
- Monitoring setup

## 🧪 Testing Your Setup

### Quick Health Check
```bash
# Test all services
python3 test_api_integration.py

# Expected output: All tests passing ✅
```

### Individual Service Tests
```bash
# Backend
curl http://localhost:3000/health

# AI Services  
curl http://localhost:8000/health

# Flutter
flutter doctor
```

## 📚 Key Documentation

### Essential Reading
- [ ] `README.md` - Project overview
- [ ] `QUICK_START.md` - Development guide
- [ ] `docs/firebase-setup.md` - Firebase integration
- [ ] API documentation at `/docs` endpoints

### Code Structure
```
AI-Travel/
├── frontend/          # Flutter mobile app
├── backend/           # Node.js API server
├── ai-services/       # Python ML services
├── scripts/           # Utility scripts
└── docs/             # Documentation
```

## 🔑 Environment Setup

### API Keys (Already Configured)
- ✅ OpenAI API Key
- ✅ Google Maps API Key  
- ✅ Foursquare API Key
- ✅ Firebase Service Account

### Local Development URLs
- Backend API: `http://localhost:3000`
- AI Services: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

## 🚀 Daily Development Workflow

### 1. Start Your Day
```bash
# Pull latest changes
git pull origin develop

# Start your services
./scripts/start-backend.sh      # Terminal 1
./scripts/start-ai-services.sh  # Terminal 2
./scripts/start-frontend.sh     # Terminal 3 (if needed)
```

### 2. Development Cycle
```bash
# Make changes in your feature branch
git add .
git commit -m "feat: implement user authentication"

# Test your changes
python3 test_api_integration.py

# Push when ready
git push origin feature/your-branch
```

### 3. Code Review Process
1. Create Pull Request to `develop` branch
2. Request review from team members
3. Address feedback
4. Merge after approval

## 🛠️ Common Commands

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm test            # Run tests
npm run lint        # Check code style
```

### AI Services Development
```bash
cd ai-services
source venv/bin/activate
uvicorn main:app --reload    # Start development server
python -m pytest           # Run tests
black .                    # Format code
```

### Frontend Development
```bash
cd frontend
flutter run                # Start app
flutter test              # Run tests
flutter analyze           # Check code
```

## 🔍 Debugging Tips

### Service Not Starting
```bash
# Check if ports are in use
lsof -i :3000
lsof -i :8000

# Kill processes if needed
pkill -f "node.*server"
pkill -f "uvicorn"
```

### API Issues
```bash
# Check environment variables
cat backend/.env
cat ai-services/.env

# Test API endpoints
curl -X POST http://localhost:8000/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"test","user_id":"123"}'
```

### Flutter Issues
```bash
cd frontend
flutter clean
flutter pub get
flutter doctor --verbose
```

## 📞 Getting Help

### Team Communication
- **Daily Standups**: Share progress and blockers
- **Code Reviews**: Learn from each other
- **Pair Programming**: Tackle complex features together

### Resources
- Project documentation in `/docs`
- API documentation at service endpoints
- Flutter docs: https://flutter.dev
- FastAPI docs: https://fastapi.tiangolo.com

## ✅ Onboarding Complete

You're ready when you can:
- [ ] Start all services successfully
- [ ] Run tests and see them pass
- [ ] Make a small change and test it
- [ ] Create a pull request

**Welcome to the AI Travel Companion team! 🌍✈️**
