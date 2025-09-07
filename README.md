# AI Travel Companion

A comprehensive travel planning application with AI-powered chat assistance using NVIDIA NIM API.

## Features

- **AI Chat Assistant**: Powered by NVIDIA NIM Llama 3.1 405B model
- **Authentication System**: Complete signup/login with JWT tokens
- **Travel Planning**: Personalized recommendations and itinerary planning
- **Real-time Chat**: Contextual conversations with travel expertise
- **Enhanced Fallbacks**: Intelligent responses when API limits are reached

## Quick Start

1. Clone the repository
2. Set up environment variables (see .env.example files)
3. Install dependencies for all services
4. Run `./start.sh` to start all services
5. Access the application at http://localhost:3006

## Services

- **Frontend**: Next.js 14 with NextAuth (Port 3006)
- **Backend**: Node.js/Express with PostgreSQL (Port 3005)  
- **AI Services**: FastAPI with NVIDIA NIM integration (Port 8000)

## Environment Setup

Copy the .env.example files and configure:
- NVIDIA_API_KEY for AI services
- Database credentials for backend
- NextAuth configuration for frontend

## Production Ready

All services are configured for production deployment with proper error handling, logging, and security measures.

