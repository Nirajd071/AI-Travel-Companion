# 🚀 Production Deployment Guide

## 🎯 Deployment Options

### Option 1: Docker Deployment (Recommended)

```bash
# Build and deploy all services
docker-compose up -d --build

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 2: Cloud Deployment

#### Backend (Node.js) - AWS/GCP/Azure
```bash
# Build for production
cd backend
npm run build

# Deploy with PM2
pm2 start src/server.js --name "ai-travel-backend"
pm2 startup
pm2 save
```

#### AI Services (Python) - Container Service
```bash
# Build Docker image
cd ai-services
docker build -t ai-travel-services .

# Deploy to cloud container service
docker push your-registry/ai-travel-services:latest
```

#### Frontend (Flutter) - App Stores
```bash
cd frontend

# Android APK
flutter build apk --release

# iOS IPA
flutter build ios --release
```

## 🔧 Environment Configuration

### Production Environment Variables

**Backend (.env.production):**
```env
NODE_ENV=production
PORT=3000
DB_HOST=your-production-db-host
DB_NAME=ai_travel_prod
JWT_SECRET=your-secure-jwt-secret
OPENAI_API_KEY=your-openai-key
GOOGLE_MAPS_API_KEY=your-maps-key
FIREBASE_PROJECT_ID=your-firebase-project
```

**AI Services (.env.production):**
```env
DATABASE_URL=postgresql://user:pass@prod-host/db
OPENAI_API_KEY=your-openai-key
LOG_LEVEL=WARNING
RATE_LIMIT_PER_MINUTE=100
```

## 🗄️ Database Setup

### PostgreSQL Production
```sql
-- Create production database
CREATE DATABASE ai_travel_prod;
CREATE USER ai_travel_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ai_travel_prod TO ai_travel_user;

-- Run migrations
-- Add your database schema here
```

### Redis Production
```bash
# Configure Redis for production
redis-server --daemonize yes --port 6379 --bind 0.0.0.0
```

## 🔒 Security Checklist

### API Security
- [ ] Rate limiting enabled
- [ ] CORS configured for production domains
- [ ] API keys in environment variables (not code)
- [ ] JWT secrets are secure and rotated
- [ ] HTTPS enabled for all endpoints

### Database Security
- [ ] Database credentials secured
- [ ] Connection encryption enabled
- [ ] Regular backups configured
- [ ] Access restricted to application servers

### Firebase Security
- [ ] Service account keys secured
- [ ] Firestore rules configured
- [ ] Authentication rules set up
- [ ] API key restrictions enabled

## 📊 Monitoring & Logging

### Application Monitoring
```javascript
// Backend logging with Winston
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

### Health Checks
```bash
# Set up health check endpoints
curl https://api.yourapp.com/health
curl https://ai.yourapp.com/health
```

### Performance Monitoring
- Application Performance Monitoring (APM)
- Database query monitoring
- API response time tracking
- Error rate monitoring

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy to Production

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy Backend
        run: |
          # Your deployment commands
          
      - name: Deploy AI Services
        run: |
          # Your deployment commands
          
      - name: Build Mobile App
        run: |
          # Build and deploy mobile app
```

## 📱 Mobile App Deployment

### Android Play Store
1. Build signed APK
2. Upload to Play Console
3. Configure app listing
4. Submit for review

### iOS App Store
1. Build and archive in Xcode
2. Upload to App Store Connect
3. Configure app metadata
4. Submit for review

## 🔧 Infrastructure Requirements

### Minimum Server Specs
- **Backend**: 2 CPU, 4GB RAM, 20GB SSD
- **AI Services**: 4 CPU, 8GB RAM, 50GB SSD
- **Database**: 2 CPU, 4GB RAM, 100GB SSD
- **Redis**: 1 CPU, 2GB RAM, 10GB SSD

### Scaling Considerations
- Load balancer for multiple backend instances
- Horizontal scaling for AI services
- Database read replicas
- CDN for static assets

## 🚨 Backup & Recovery

### Database Backups
```bash
# Automated daily backups
pg_dump ai_travel_prod > backup_$(date +%Y%m%d).sql

# Restore from backup
psql ai_travel_prod < backup_20240101.sql
```

### File Backups
- User uploaded files
- Configuration files
- SSL certificates
- Service account keys

## 📈 Performance Optimization

### Backend Optimization
- Enable compression middleware
- Implement caching strategies
- Optimize database queries
- Use connection pooling

### AI Services Optimization
- Model caching
- Request batching
- Async processing
- Resource monitoring

### Frontend Optimization
- Code splitting
- Image optimization
- Caching strategies
- Bundle size optimization

## 🔍 Troubleshooting

### Common Production Issues

**High Memory Usage:**
```bash
# Monitor memory usage
htop
free -h

# Check for memory leaks
node --inspect server.js
```

**Database Connection Issues:**
```bash
# Check database connectivity
psql -h hostname -U username -d database

# Monitor connections
SELECT * FROM pg_stat_activity;
```

**API Rate Limiting:**
```bash
# Check rate limit logs
tail -f /var/log/nginx/access.log | grep 429
```

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates valid
- [ ] Monitoring configured

### Deployment
- [ ] Services deployed successfully
- [ ] Health checks passing
- [ ] Database connected
- [ ] External APIs working
- [ ] Mobile app builds successful

### Post-Deployment
- [ ] Smoke tests completed
- [ ] Performance metrics normal
- [ ] Error rates acceptable
- [ ] User feedback monitored
- [ ] Backup systems verified

## 📞 Support & Maintenance

### Monitoring Alerts
- Server resource usage
- API error rates
- Database performance
- User activity anomalies

### Regular Maintenance
- Security updates
- Dependency updates
- Database optimization
- Log rotation
- Certificate renewal

**Your AI Travel Companion is ready for production! 🌍🚀**
