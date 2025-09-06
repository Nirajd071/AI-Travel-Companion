#!/bin/bash

echo "📱 Starting AI Travel Frontend..."

# Check if we're in the right directory
if [ ! -f "frontend/pubspec.yaml" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to frontend directory
cd frontend

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Error: Flutter is not installed. Please run the setup script first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d ".dart_tool" ]; then
    echo "📦 Installing Flutter dependencies..."
    flutter pub get
fi

# Check if environment file exists
if [ ! -f "lib/config/environment.dart" ]; then
    echo "⚠️  Warning: Environment config not found. Creating template..."
    mkdir -p lib/config
    cat > lib/config/environment.dart << EOF
class Environment {
  static const String apiBaseUrl = 'http://localhost:3000/api';
  static const String aiServiceUrl = 'http://localhost:8000';
  static const String googleMapsApiKey = 'your_google_maps_api_key_here';
}
EOF
fi

# Run Flutter doctor to check setup
echo "🔍 Checking Flutter setup..."
flutter doctor

# Start the Flutter app
echo "🌟 Starting Flutter app..."
echo "📱 Make sure you have an emulator running or device connected"
flutter run
