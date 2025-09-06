#!/bin/bash

echo "🚀 Starting AI Travel Backend..."

# Check if we're in the right directory
if [ ! -f "backend/package.json" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Navigate to backend directory
cd backend

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found. Creating from template..."
    cp .env.example .env 2>/dev/null || echo "Please create .env file manually"
fi

# Start the backend server
echo "🌟 Starting backend server on http://localhost:3000"
npm run dev
