#!/bin/bash

# AI Travel Companion App - Complete Setup Script
# This script installs all dependencies for frontend, backend, AI/ML, and databases
# Compatible with Ubuntu/Debian and macOS

set -e  # Exit on any error

echo "🚀 AI Travel Companion App - Complete Setup"
echo "============================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if command -v apt-get &> /dev/null; then
            DISTRO="debian"
        elif command -v yum &> /dev/null; then
            DISTRO="redhat"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    else
        print_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
    print_status "Detected OS: $OS"
}

# Install system dependencies
install_system_deps() {
    print_header "Installing System Dependencies"
    
    if [[ "$OS" == "linux" && "$DISTRO" == "debian" ]]; then
        sudo apt-get update
        sudo apt-get install -y curl wget git unzip software-properties-common \
            build-essential libssl-dev libffi-dev python3-dev \
            postgresql postgresql-contrib redis-server \
            openjdk-11-jdk android-tools-adb
    elif [[ "$OS" == "macos" ]]; then
        # Install Homebrew if not present
        if ! command -v brew &> /dev/null; then
            print_status "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        brew update
        brew install curl wget git unzip postgresql redis openjdk@11
        brew services start postgresql
        brew services start redis
    fi
}

# Install Node.js and npm
install_nodejs() {
    print_header "Installing Node.js and npm"
    
    if ! command -v node &> /dev/null; then
        # Install Node.js 18 LTS
        if [[ "$OS" == "linux" ]]; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        elif [[ "$OS" == "macos" ]]; then
            brew install node@18
            brew link node@18
        fi
    else
        print_status "Node.js already installed: $(node --version)"
    fi
    
    # Install global packages
    npm install -g yarn @react-native-community/cli expo-cli
}

# Install Python and pip
install_python() {
    print_header "Installing Python 3.10+ and pip"
    
    if [[ "$OS" == "linux" ]]; then
        if ! command -v python3.10 &> /dev/null; then
            sudo add-apt-repository ppa:deadsnakes/ppa -y
            sudo apt-get update
            sudo apt-get install -y python3.10 python3.10-pip python3.10-venv python3.10-dev
        fi
        # Create symlinks
        sudo ln -sf /usr/bin/python3.10 /usr/local/bin/python3
        sudo ln -sf /usr/bin/python3.10 /usr/local/bin/python
    elif [[ "$OS" == "macos" ]]; then
        brew install python@3.10
        brew link python@3.10
    fi
    
    # Upgrade pip and install pipenv
    python3 -m pip install --upgrade pip pipenv virtualenv
}

# Install Flutter
install_flutter() {
    print_header "Installing Flutter SDK"
    
    FLUTTER_VERSION="3.13.9"
    FLUTTER_DIR="$HOME/flutter"
    
    if [ ! -d "$FLUTTER_DIR" ]; then
        print_status "Downloading Flutter SDK..."
        cd $HOME
        if [[ "$OS" == "linux" ]]; then
            wget -O flutter.tar.xz https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz
            tar xf flutter.tar.xz
            rm flutter.tar.xz
        elif [[ "$OS" == "macos" ]]; then
            wget -O flutter.zip https://storage.googleapis.com/flutter_infra_release/releases/stable/macos/flutter_macos_${FLUTTER_VERSION}-stable.zip
            unzip flutter.zip
            rm flutter.zip
        fi
    else
        print_status "Flutter already installed"
    fi
    
    # Add to PATH
    if ! grep -q "flutter/bin" ~/.bashrc 2>/dev/null; then
        echo 'export PATH="$HOME/flutter/bin:$PATH"' >> ~/.bashrc
    fi
    if ! grep -q "flutter/bin" ~/.zshrc 2>/dev/null; then
        echo 'export PATH="$HOME/flutter/bin:$PATH"' >> ~/.zshrc
    fi
    
    export PATH="$HOME/flutter/bin:$PATH"
    
    # Accept licenses and run doctor
    flutter doctor --android-licenses || true
    flutter doctor
}

# Install Android SDK (for Flutter)
install_android_sdk() {
    print_header "Setting up Android SDK"
    
    ANDROID_SDK_DIR="$HOME/Android/Sdk"
    
    if [ ! -d "$ANDROID_SDK_DIR" ]; then
        print_status "Installing Android SDK..."
        mkdir -p $HOME/Android
        cd $HOME/Android
        
        if [[ "$OS" == "linux" ]]; then
            wget -O sdk-tools.zip https://dl.google.com/android/repository/commandlinetools-linux-9477386_latest.zip
        elif [[ "$OS" == "macos" ]]; then
            wget -O sdk-tools.zip https://dl.google.com/android/repository/commandlinetools-mac-9477386_latest.zip
        fi
        
        unzip sdk-tools.zip -d Sdk
        rm sdk-tools.zip
        
        # Set up environment variables
        export ANDROID_HOME="$HOME/Android/Sdk"
        export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
        
        # Add to shell profiles
        echo 'export ANDROID_HOME="$HOME/Android/Sdk"' >> ~/.bashrc
        echo 'export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"' >> ~/.bashrc
        echo 'export ANDROID_HOME="$HOME/Android/Sdk"' >> ~/.zshrc
        echo 'export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"' >> ~/.zshrc
        
        # Install SDK packages
        yes | sdkmanager --licenses
        sdkmanager "platform-tools" "platforms;android-33" "build-tools;33.0.0"
    else
        print_status "Android SDK already installed"
    fi
}

# Setup databases
setup_databases() {
    print_header "Setting up Databases"
    
    # PostgreSQL setup
    print_status "Setting up PostgreSQL..."
    if [[ "$OS" == "linux" ]]; then
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
        
        # Create database and user
        sudo -u postgres psql -c "CREATE DATABASE ai_travel_db;" || true
        sudo -u postgres psql -c "CREATE USER travel_user WITH PASSWORD 'travel_pass';" || true
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ai_travel_db TO travel_user;" || true
    elif [[ "$OS" == "macos" ]]; then
        createdb ai_travel_db || true
    fi
    
    # Redis setup
    print_status "Starting Redis..."
    if [[ "$OS" == "linux" ]]; then
        sudo systemctl start redis-server
        sudo systemctl enable redis-server
    fi
    # Redis is already started via brew services on macOS
}

# Install Docker (optional but recommended)
install_docker() {
    print_header "Installing Docker (Optional)"
    
    if ! command -v docker &> /dev/null; then
        if [[ "$OS" == "linux" ]]; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sudo sh get-docker.sh
            sudo usermod -aG docker $USER
            rm get-docker.sh
            print_warning "Please log out and log back in for Docker permissions to take effect"
        elif [[ "$OS" == "macos" ]]; then
            print_status "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
        fi
    else
        print_status "Docker already installed"
    fi
}

# Create project structure
create_project_structure() {
    print_header "Creating Project Structure"
    
    mkdir -p {frontend,backend,ai-services,docs,scripts}
    mkdir -p frontend/{src,assets,components,screens,services,utils}
    mkdir -p backend/{src,tests,config,middleware,routes,models,controllers}
    mkdir -p ai-services/{models,data,notebooks,api,utils}
    mkdir -p docs/{api,architecture,deployment}
    
    print_status "Project structure created successfully"
}

# Install project dependencies
install_project_deps() {
    print_header "Installing Project Dependencies"
    
    # Backend dependencies (Node.js)
    cd backend
    if [ ! -f package.json ]; then
        npm init -y
        npm install express mongoose cors dotenv jsonwebtoken bcryptjs axios helmet morgan compression
        npm install -D nodemon jest supertest eslint prettier
    fi
    cd ..
    
    # AI Services dependencies (Python)
    cd ai-services
    if [ ! -f requirements.txt ]; then
        cat > requirements.txt << EOF
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
numpy==1.24.3
pandas==2.0.3
scikit-learn==1.3.0
sentence-transformers==2.2.2
torch==2.1.0
transformers==4.35.2
requests==2.31.0
redis==5.0.1
celery==5.3.4
python-dotenv==1.0.0
EOF
    fi
    
    # Create virtual environment and install dependencies
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate
    cd ..
    
    # Frontend dependencies (Flutter)
    cd frontend
    if [ ! -f pubspec.yaml ]; then
        flutter create . --org com.aitravel.app
        # Add additional dependencies to pubspec.yaml
        cat >> pubspec.yaml << EOF

  # Additional dependencies
  http: ^1.1.0
  provider: ^6.1.1
  flutter_bloc: ^8.1.3
  sqflite: ^2.3.0
  shared_preferences: ^2.2.2
  flutter_local_notifications: ^16.3.0
  google_maps_flutter: ^2.5.0
  firebase_core: ^2.24.2
  firebase_messaging: ^14.7.9
  cached_network_image: ^3.3.0
  image_picker: ^1.0.4
  geolocator: ^10.1.0
  permission_handler: ^11.1.0
EOF
        flutter pub get
    fi
    cd ..
}

# Setup environment files
setup_env_files() {
    print_header "Setting up Environment Files"
    
    # Backend .env
    cat > backend/.env << EOF
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ai_travel_db
DB_USER=travel_user
DB_PASS=travel_pass
JWT_SECRET=your_jwt_secret_here_change_in_production
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:8000
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
FIREBASE_SERVER_KEY=your_firebase_server_key_here
EOF
    
    # AI Services .env
    cat > ai-services/.env << EOF
DATABASE_URL=postgresql://travel_user:travel_pass@localhost/ai_travel_db
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your_openai_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here
MODEL_PATH=./models
LOG_LEVEL=INFO
EOF
    
    # Frontend environment (for API endpoints)
    mkdir -p frontend/lib/config
    cat > frontend/lib/config/environment.dart << EOF
class Environment {
  static const String apiBaseUrl = 'http://localhost:3000/api';
  static const String aiServiceUrl = 'http://localhost:8000';
  static const String googleMapsApiKey = 'your_google_maps_api_key_here';
}
EOF
}

# Final setup and verification
final_setup() {
    print_header "Final Setup and Verification"
    
    # Create startup scripts
    cat > scripts/start-backend.sh << EOF
#!/bin/bash
cd backend
npm run dev
EOF
    
    cat > scripts/start-ai-services.sh << EOF
#!/bin/bash
cd ai-services
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
EOF
    
    cat > scripts/start-frontend.sh << EOF
#!/bin/bash
cd frontend
flutter run
EOF
    
    chmod +x scripts/*.sh
    
    print_status "Setup completed successfully!"
    print_status "Next steps:"
    echo "1. Restart your terminal or run: source ~/.bashrc"
    echo "2. Add your API keys to the .env files"
    echo "3. Run 'flutter doctor' to verify Flutter installation"
    echo "4. Use the scripts in ./scripts/ to start services"
    echo "5. Check README.md for detailed usage instructions"
}

# Main execution
main() {
    detect_os
    install_system_deps
    install_nodejs
    install_python
    install_flutter
    install_android_sdk
    setup_databases
    install_docker
    create_project_structure
    install_project_deps
    setup_env_files
    final_setup
}

# Run main function
main "$@"
