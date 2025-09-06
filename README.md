# 🌍 AI Travel Companion App

A comprehensive AI-powered travel companion mobile app built with Flutter, Node.js backend, and Python-based AI services.

## 🚀 Features

- **Travel DNA Builder**: Personalized onboarding quiz and travel preference analysis
- **AI Twin Chatbot**: Intelligent assistant that learns user preferences and communication style
- **Smart Recommendations**: Hidden gems, activities, and personalized suggestions
- **Real-time Adaptive Itinerary**: Dynamic itinerary updates based on user behavior
- **Push Notifications**: Location-based and AI-driven notifications
- **Offline Support**: Local caching for essential features

## 🏗️ Architecture

```
ai-travel-app/
├── frontend/           # Flutter mobile app
├── backend/           # Node.js API server
├── ai-services/       # Python ML/AI services
├── docs/             # Documentation
├── scripts/          # Utility scripts
└── setup.sh          # One-click setup script
```

## 🛠️ Quick Setup

### Prerequisites
- Git
- Internet connection for downloading dependencies

### One-Click Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd AI-Travel

# Run the setup script (works on Ubuntu/Debian and macOS)
./setup.sh
```

The setup script will automatically install:
- Node.js 18 LTS & npm/yarn
- Python 3.10+ & pip
- Flutter SDK & Android SDK
- PostgreSQL & Redis
- Docker (optional)
- All project dependencies

### Manual Setup (if needed)

<details>
<summary>Click to expand manual setup instructions</summary>

#### 1. System Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y curl wget git unzip build-essential \
    postgresql postgresql-contrib redis-server openjdk-11-jdk
```

**macOS:**
```bash
# Install Homebrew first
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install node@18 python@3.10 postgresql redis openjdk@11
```

#### 2. Flutter Setup
```bash
# Download Flutter SDK
cd ~
wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.13.9-stable.tar.xz
tar xf flutter_linux_3.13.9-stable.tar.xz

# Add to PATH
echo 'export PATH="$HOME/flutter/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# Verify installation
flutter doctor
```

#### 3. Project Dependencies
```bash
# Backend
cd backend
npm install

# AI Services
cd ../ai-services
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../frontend
flutter pub get
```

</details>

## 🚦 Getting Started

### 1. Environment Configuration

Copy and configure environment files:

```bash
# Backend environment
cp backend/.env.example backend/.env
# Edit backend/.env with your API keys

# AI Services environment
cp ai-services/.env.example ai-services/.env
# Edit ai-services/.env with your API keys

# Frontend configuration
# Edit frontend/lib/config/environment.dart
```

### 2. Database Setup

```bash
# Start PostgreSQL and Redis
sudo systemctl start postgresql redis-server

# Create database
sudo -u postgres createdb ai_travel_db
sudo -u postgres createuser travel_user
```

### 3. Start Services

Use the provided scripts to start each service:

```bash
# Terminal 1: Start Backend API
./scripts/start-backend.sh

# Terminal 2: Start AI Services
./scripts/start-ai-services.sh

# Terminal 3: Start Frontend (mobile app)
./scripts/start-frontend.sh
```

## 🔑 Required API Keys

Add these API keys to your environment files:

1. **OpenAI API Key** - For AI chatbot functionality
2. **Google Maps API Key** - For maps and location services
3. **Firebase Server Key** - For push notifications
4. **Foursquare/Places API Key** - For location data (optional)

## 📱 Development Workflow

### Branch Structure
```
main                    # Production-ready code
├── develop            # Integration branch
├── feature/frontend   # Frontend development
├── feature/backend    # Backend development
├── feature/ai         # AI services development
└── feature/notifications # Notifications development
```

### Team Collaboration

#### Person A - Frontend (Flutter)
```bash
git checkout -b feature/frontend
cd frontend
flutter run
# Work on UI, screens, and mobile app logic
```

#### Person B - Backend (Node.js)
```bash
git checkout -b feature/backend
cd backend
npm run dev
# Work on API endpoints, authentication, database
```

#### Person C - AI Services (Python)
```bash
git checkout -b feature/ai
cd ai-services
source venv/bin/activate
uvicorn main:app --reload
# Work on ML models, recommendations, chatbot
```

#### Person D - Notifications & DevOps
```bash
git checkout -b feature/notifications
# Work on push notifications, deployment, CI/CD
```

### Code Standards

- **Backend**: ESLint + Prettier for JavaScript
- **AI Services**: Black + isort for Python
- **Frontend**: Flutter's built-in linter
- **Commits**: Conventional commit format

### Testing

```bash
# Backend tests
cd backend && npm test

# AI Services tests
cd ai-services && python -m pytest

# Frontend tests
cd frontend && flutter test
```

## 📚 API Documentation

- **Backend API**: http://localhost:3000/api/docs (Swagger)
- **AI Services API**: http://localhost:8000/docs (FastAPI docs)

## 🗂️ Project Structure

### Frontend (Flutter)
```
frontend/
├── lib/
│   ├── main.dart
│   ├── config/           # Environment & app config
│   ├── screens/          # UI screens
│   ├── components/       # Reusable widgets
│   ├── services/         # API services
│   ├── models/           # Data models
│   ├── utils/            # Helper functions
│   └── bloc/             # State management
├── assets/               # Images, fonts, data
└── test/                 # Unit & widget tests
```

### Backend (Node.js)
```
backend/
├── src/
│   ├── server.js         # Entry point
│   ├── routes/           # API routes
│   ├── controllers/      # Route handlers
│   ├── models/           # Database models
│   ├── middleware/       # Custom middleware
│   ├── services/         # Business logic
│   └── utils/            # Helper functions
├── config/               # Database & app config
└── tests/                # API tests
```

### AI Services (Python)
```
ai-services/
├── main.py               # FastAPI entry point
├── api/                  # API endpoints
├── models/               # ML models
├── services/             # AI logic
├── utils/                # Helper functions
├── data/                 # Training data
└── notebooks/            # Jupyter notebooks
```

## 🚀 Deployment

### Development
```bash
# All services locally
docker-compose up -d
```

### Production
- **Frontend**: Build APK/IPA and deploy to app stores
- **Backend**: Deploy to AWS/GCP/Azure with PM2
- **AI Services**: Deploy with Docker to cloud container service
- **Database**: Managed PostgreSQL service
- **Redis**: Managed Redis service

## 🔧 Troubleshooting

### Common Issues

1. **Flutter Doctor Issues**
   ```bash
   flutter doctor --android-licenses
   flutter doctor
   ```

2. **Node.js Version Issues**
   ```bash
   nvm install 18
   nvm use 18
   ```

3. **Python Virtual Environment**
   ```bash
   cd ai-services
   python3 -m venv venv
   source venv/bin/activate
   ```

4. **Database Connection**
   ```bash
   sudo systemctl status postgresql
   sudo systemctl start postgresql
   ```

### Getting Help

- Check the [Issues](../../issues) page
- Review API documentation
- Run `flutter doctor` for Flutter issues
- Check service logs in respective directories

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

- [ ] Travel DNA Builder implementation
- [ ] AI chatbot integration
- [ ] Real-time recommendations
- [ ] Push notification system
- [ ] Offline mode support
- [ ] Social features
- [ ] Advanced analytics

---

**Happy Coding! 🚀**
