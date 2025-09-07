#!/bin/bash

# AI Travel Companion - Main Startup Script
# This script starts both the backend API server and frontend Next.js application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        return 0
    elif lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    if check_port $port; then
        print_warning "Port $port is in use. Killing existing processes..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18+ and try again."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm and try again."
        exit 1
    fi
    
    # Check PostgreSQL
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL is not installed. Please install PostgreSQL and try again."
        exit 1
    fi
    
    # Check Redis
    if ! command -v redis-cli &> /dev/null; then
        print_warning "Redis CLI not found. Make sure Redis server is running."
    fi
    
    print_success "Prerequisites check completed"
}

# Function to setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    # Check if .env files exist
    if [ ! -f "travel-companion/.env.local" ]; then
        print_warning "Frontend .env.local not found. Creating from example..."
        if [ -f "travel-companion/.env.example" ]; then
            cp travel-companion/.env.example travel-companion/.env.local
        fi
    fi
    
    if [ ! -f "backend/.env" ]; then
        print_warning "Backend .env not found. Creating from example..."
        if [ -f "backend/.env.example" ]; then
            cp backend/.env.example backend/.env
        fi
    fi
    
    print_success "Environment setup completed"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    cd backend
    npm install --silent
    cd ..
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    cd travel-companion
    npm install --silent
    cd ..
    
    # Install AI services dependencies
    if [ -d "ai-services" ]; then
        print_status "Installing AI services dependencies..."
        cd ai-services
        if [ -f "requirements.txt" ]; then
            if command -v python3 &> /dev/null; then
                # Create virtual environment if it doesn't exist
                if [ ! -d ".venv" ]; then
                    python3 -m venv .venv
                fi
                # Activate virtual environment and install dependencies
                source .venv/bin/activate
                pip install -r requirements.txt --quiet
            else
                print_warning "Python3 not found. Skipping AI services setup."
            fi
        fi
        cd ..
    fi
    
    print_success "Dependencies installation completed"
}

# Function to start backend
start_backend() {
    print_status "Starting backend server..."
    
    # Kill any existing backend processes
    kill_port 3005
    
    cd backend
    # Start backend in background
    nohup node src/production-server.js > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > ../backend.pid
    cd ..
    
    # Wait for backend to start
    print_status "Waiting for backend to start..."
    for i in {1..30}; do
        if check_port 3005; then
            print_success "Backend server started on http://localhost:3005"
            return 0
        fi
        sleep 1
    done
    
    print_error "Backend failed to start. Check backend.log for details."
    return 1
}

# Function to start AI services
start_ai_services() {
    if [ -d "ai-services" ] && [ -f "ai-services/production_main.py" ]; then
        print_status "Starting AI services..."
        
        # Kill any existing AI services
        kill_port 8000
        
        cd ai-services
        if command -v python3 &> /dev/null; then
            # Activate virtual environment if it exists
            if [ -d ".venv" ]; then
                source .venv/bin/activate
            fi
            # Start AI services in background
            nohup python3 production_main.py > ../ai-services.log 2>&1 &
            AI_PID=$!
            echo $AI_PID > ../ai-services.pid
            cd ..
            
            # Wait for AI services to start
            print_status "Waiting for AI services to start..."
            for i in {1..20}; do
                if check_port 8000; then
                    print_success "AI services started on http://localhost:8000"
                    return 0
                fi
                sleep 1
            done
            
            print_warning "AI services may have failed to start. Check ai-services.log for details."
        else
            print_warning "Python3 not found. Skipping AI services."
            cd ..
        fi
    else
        print_warning "AI services not found. Skipping AI services startup."
    fi
}

# Function to start frontend
start_frontend() {
    print_status "Starting frontend application..."
    
    # Kill any existing frontend processes more thoroughly
    kill_port 3006
    pkill -f "next dev" 2>/dev/null || true
    sleep 2
    
    cd travel-companion
    # Start frontend in background
    nohup npm run dev > ../frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > ../frontend.pid
    cd ..
    
    # Wait for frontend to start
    print_status "Waiting for frontend to start..."
    for i in {1..60}; do
        if check_port 3006; then
            print_success "Frontend application started on http://localhost:3006"
            return 0
        fi
        # Also check if the process is still running
        if ! kill -0 $FRONTEND_PID 2>/dev/null; then
            print_error "Frontend process died unexpectedly"
            break
        fi
        sleep 1
    done
    
    print_error "Frontend failed to start. Check frontend.log for details."
    cat frontend.log | tail -20
    return 1
}

# Function to display running services
show_services() {
    echo ""
    print_success "🚀 AI Travel Companion is now running!"
    echo ""
    echo "📱 Frontend:     http://localhost:3006"
    echo "🔧 Backend API:  http://localhost:3005"
    echo "🤖 AI Services:  http://localhost:8000"
    echo "💾 Health Check: http://localhost:3005/health"
    echo ""
    echo "📋 Logs:"
    echo "   Frontend: tail -f frontend.log"
    echo "   Backend:  tail -f backend.log"
    echo "   AI:       tail -f ai-services.log"
    echo ""
    echo "🛑 To stop all services, run: ./stop.sh"
    echo ""
}

# Function to cleanup on exit
cleanup() {
    print_status "Cleaning up..."
    if [ -f "backend.pid" ]; then
        kill $(cat backend.pid) 2>/dev/null || true
        rm backend.pid
    fi
    if [ -f "frontend.pid" ]; then
        kill $(cat frontend.pid) 2>/dev/null || true
        rm frontend.pid
    fi
    if [ -f "ai-services.pid" ]; then
        kill $(cat ai-services.pid) 2>/dev/null || true
        rm ai-services.pid
    fi
}

# Main execution
main() {
    echo ""
    print_status "🌟 Starting AI Travel Companion..."
    echo ""
    
    # Set up cleanup trap
    trap cleanup EXIT
    
    # Run setup steps
    check_prerequisites
    setup_environment
    
    # Install dependencies if --install flag is provided
    if [[ "$1" == "--install" ]]; then
        install_dependencies
    fi
    
    # Start services
    start_backend
    if [ $? -eq 0 ]; then
        start_ai_services
        start_frontend
        if [ $? -eq 0 ]; then
            show_services
            
            # Keep script running
            print_status "Press Ctrl+C to stop all services"
            while true; do
                sleep 1
            done
        fi
    fi
}

# Run main function
main "$@"
