#!/bin/bash

echo "🌐 Starting AI Travel Frontend (Next.js)..."

# Check if we're in the right directory
if [ ! -f "travel-companion/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to frontend directory
cd travel-companion

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please run the setup script first."
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm install
fi

# Check if environment file exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  Warning: Environment config not found. Creating template..."
    cat > .env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
NEXT_PUBLIC_AI_SERVICE_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
EOF
fi

# Start the Next.js development server
echo "🌟 Starting Next.js development server..."
echo "🌐 Frontend will be available at http://localhost:3001"
npm run dev
