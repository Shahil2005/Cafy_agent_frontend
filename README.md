








# Cafy - AI-Powered Job Tracking Platform

Cafy is a comprehensive job application tracking system designed specifically for students and graduates. It combines intelligent automation with AI-powered features to streamline the job search process.


## Features 

### 🎯 Core Features
- **Smart Job Tracking**: Track applications across multiple platforms with automated follow-up reminders
- **AI-Powered URL Scanner**: Extract job details and visa sponsorship information from job links
- **Visa Sponsorship Hub**: Special focus for international students tracking visa-required positions
- **CV Fit Score Analysis**: AI-powered matching between your CV and job requirements
- **Professional Communication Center**: Generate personalized follow-up emails and thank you notes

### 🤖 AI-Powered Features
- **Company Insights**: Real-time company research and culture analysis
- **Interview Coach**: Generate tailored interview questions for specific roles
- **Quick Gig Finder**: Discover local part-time opportunities
- **Automated Follow-up Suggestions**: Smart notifications for next steps

### 🔐 Security & Storage
- Firebase authentication with Google sign-in support
- Secure cloud storage for CVs and application data
- User-specific data isolation and privacy protection

## Technology Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Firebase (Authentication + Firestore)
- **AI Integration**: Google Gemini API
- **Build Tool**: Vite

## Getting Started

### Prerequisites

1. **Firebase Project**:
   - Create a new project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication (Email/Password and Google)
   - Enable Firestore Database
   - Get your Firebase configuration

2. **Gemini API Key**:
   - Get your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

3. Update `.env` with your credentials:
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:your_app_id

VITE_GEMINI_API_KEY=your_gemini_api_key
```

4. Update the Gemini API key in `src/App.tsx`:
```typescript
const LLM_API_KEY = "your_gemini_api_key_here";
```

5. Start the development server:
```bash
npm run dev
```

## Firebase Setup

### Firestore Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{artifactId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### Authentication
Enable the following sign-in methods:
- Email/Password
- Google (optional but recommended)

## Usage

1. **Sign Up/Login**: Create an account or sign in with Google
2. **Add Jobs**: Use the smart form with AI-powered URL scanning
3. **Track Progress**: Monitor applications with automated follow-up suggestions
4. **Upload CVs**: Securely store multiple CV versions
5. **AI Features**: 
   - Analyze CV fit scores against specific jobs
   - Generate professional emails
   - Get interview practice questions
   - Research company insights

## File Structure

```
src/
├── components/
│   ├── auth/           # Authentication components
│   ├── jobs/           # Job tracking components
│   ├── tabs/           # Feature tab components
│   └── navigation/     # Navigation components
├── services/
│   ├── firebase.ts     # Firebase configuration
│   ├── gemini.ts       # Gemini AI service
│   └── auth.ts         # Authentication service
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
├── types/              # TypeScript definitions
└── App.tsx             # Main application component
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue on the GitHub repository.
"# Cafy_agent_frontend" 
