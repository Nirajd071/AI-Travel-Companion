# Firebase Setup Guide for AI Travel Companion

## Step 4: After Creating Firebase Project

### 4.1 Configure Android App

1. **Download google-services.json**
   - Place it in `frontend/android/app/google-services.json`

2. **Update Android Gradle Files**

   **Project-level** `frontend/android/build.gradle`:
   ```gradle
   buildscript {
       dependencies {
           // Add this line
           classpath 'com.google.gms:google-services:4.3.15'
       }
   }
   ```

   **App-level** `frontend/android/app/build.gradle`:
   ```gradle
   // Add at the top
   apply plugin: 'com.google.gms.google-services'

   android {
       compileSdkVersion 34
       defaultConfig {
           applicationId "com.aitravel.companion" // Use this package name
           minSdkVersion 21
           targetSdkVersion 34
       }
   }

   dependencies {
       implementation platform('com.google.firebase:firebase-bom:32.7.0')
       implementation 'com.google.firebase:firebase-messaging'
   }
   ```

### 4.2 Configure iOS App (if needed)

1. **Download GoogleService-Info.plist**
   - Place it in `frontend/ios/Runner/GoogleService-Info.plist`

2. **Update iOS Configuration**
   - Open `frontend/ios/Runner.xcworkspace` in Xcode
   - Add GoogleService-Info.plist to Runner target

### 4.3 Enable Firebase Services

In Firebase Console, enable these services:

1. **Authentication**
   - Go to Authentication → Sign-in method
   - Enable Email/Password and Google sign-in

2. **Cloud Firestore**
   - Go to Firestore Database → Create database
   - Start in test mode for development

3. **Cloud Messaging**
   - Go to Cloud Messaging
   - Note down the Server Key for backend integration

4. **Analytics** (optional)
   - Already enabled by default

### 4.4 Get Configuration Values

From Firebase Console, collect these values for your `.env` files:

- **Project ID**: Found in Project Settings
- **Web API Key**: Found in Project Settings → General
- **Server Key**: Found in Cloud Messaging → Project credentials
- **Database URL**: Found in Realtime Database (if using)

## Step 5: Update Your App Configuration

Run the setup script we created:
```bash
./scripts/setup-firebase.sh
```

This will:
- Create necessary directories
- Update Flutter configuration
- Set up push notification handlers
- Configure backend Firebase admin

## Step 6: Test Firebase Integration

```bash
# Start your services
./scripts/start-backend.sh
./scripts/start-ai-services.sh  
./scripts/start-frontend.sh

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:8000/health
```

## Troubleshooting

- **Build errors**: Make sure google-services.json is in the correct location
- **Permission errors**: Check Android permissions in AndroidManifest.xml
- **iOS issues**: Ensure GoogleService-Info.plist is added to Xcode project
- **Network errors**: Verify API keys in .env files
