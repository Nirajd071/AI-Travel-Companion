#!/bin/bash

# AI Travel Companion - Stop Script
# This script stops all running services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to kill processes on specific ports
kill_port() {
    local port=$1
    local service_name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_status "Stopping $service_name on port $port..."
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
        print_success "$service_name stopped"
    else
        print_warning "$service_name not running on port $port"
    fi
}

# Function to kill processes by PID files
kill_by_pid() {
    local pid_file=$1
    local service_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            print_status "Stopping $service_name (PID: $pid)..."
            kill "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
            print_success "$service_name stopped"
        else
            print_warning "$service_name process not found"
        fi
        rm "$pid_file"
    else
        print_warning "$service_name PID file not found"
    fi
}

main() {
    echo ""
    print_status "🛑 Stopping AI Travel Companion services..."
    echo ""
    
    # Stop by PID files first
    kill_by_pid "frontend.pid" "Frontend"
    kill_by_pid "backend.pid" "Backend"
    kill_by_pid "ai-services.pid" "AI Services"
    
    # Stop by ports as backup
    kill_port 3006 "Frontend"
    kill_port 3005 "Backend"
    kill_port 8000 "AI Services"
    
    # Clean up log files if they exist
    if [ -f "frontend.log" ]; then
        rm frontend.log
    fi
    if [ -f "backend.log" ]; then
        rm backend.log
    fi
    if [ -f "ai-services.log" ]; then
        rm ai-services.log
    fi
    
    echo ""
    print_success "✅ All services stopped successfully"
    echo ""
}

main "$@"
