# CampusMind — AI Study Companion App

An AI-powered daily study companion built with **React Native (Expo)** and **Vercel Serverless Functions**.
Designed with Google's **Material You** aesthetic — soft pastel tones, cozy elevation, warm charcoal dark mode, rounded typography, and calm micro-interactions.

## Architecture

```
campusmind/
├── mobile/                  # React Native (Expo SDK 57) Mobile Client
│   ├── assets/              # App icons, splash, and mock images
│   ├── src/
│   │   ├── components/      # Material You UI components (Card, Badge, Header, etc.)
│   │   ├── navigation/      # React Navigation bottom tabs & root stack
│   │   ├── screens/         # Home, Library, Study Chat, Settings
│   │   ├── store/           # Zustand state management (Theme, Auth, Content)
│   │   ├── theme/           # Material You pastel color tokens & typography presets
│   │   └── types/           # App-wide TypeScript definitions
│   ├── App.tsx              # App root
│   ├── app.json             # Expo app configuration
│   └── package.json
└── backend/                 # Vercel Serverless Node.js Backend
    ├── api/                 # Serverless endpoints (Health, Groq AI, Whisper, Vision OCR, Pinecone RAG)
    ├── src/                 # Backend helpers & services
    ├── vercel.json          # Vercel deployment routes
    └── package.json
```

## Security & Architecture Principle

No third-party secret API keys (Groq, Google Cloud Vision, Pinecone) are ever bundled into the mobile app. All heavy processing, OCR, audio transcription, embeddings, and LLM calls run exclusively through the Vercel serverless backend.

## Roadmap & Features (Completed)

- [x] **Stage 1: Project Scaffold & Material You Design System** (Soft pastel light & warm charcoal dark modes, Plus Jakarta Sans)
- [x] **Stage 2: Firebase Auth & Google Sign-In** (Native Google Play Services & iOS OAuth, Firestore user sync, Demo Mode)
- [x] **Stage 3: Multi-Format Content Ingestion** (PDF, YouTube transcript, Live Audio Whisper, Handwritten Notes OCR)
- [x] **Stage 4: AI Summarization & Key Points** (Groq LLaMA 3.3 70B, numbered takeaways, structured headings)
- [x] **Stage 5: Bilingual Support** (English, Roman Urdu, and formal Urdu script with RTL support)
- [x] **Stage 6: Text-to-Speech Audio Playback** (`expo-speech` with 0.8x–1.5x speed controls and localized accents)
- [x] **Stage 7: Practice Quiz Generator & Mode** (Interactive multiple choice quizzes, SM-2 retention score tracking)
- [x] **Stage 8: RAG-based Grounded Study Chat** (Pinecone integrated embedding search with `llama-text-embed-v2` & inline excerpt citations)
- [x] **Stage 9: Concept Map Visualization** (Interactive 2D SVG graph canvas with expandable node inspection)
- [x] **Stage 10: Library, Organization & Spaced Repetition Reminders** (SM-2 review schedule, folders, due status badges)
- [x] **Stage 11: Home Dashboard & Final Polish** (Streak counter, time-of-day greeting, Material You cards, Dark Mode audit)
- [x] **Stage 12: Production Credentials & Deployment Wiring** (Firebase iOS/Android, Pinecone integrated vector RAG, Google Vision OCR)

## Getting Started

### 1. Backend (Vercel Serverless)

```bash
cd backend
npm install
npm run typecheck
```

Deploy directly to Vercel:
```bash
npx vercel
```
Set the following environment variables in your Vercel project settings:
- `GROQ_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX` (e.g. `campusmind-index`)
- `GOOGLE_VISION_API_KEY`

### 2. Mobile App (React Native / Expo SDK 57)

```bash
cd mobile
npm install
npm run typecheck
npx expo start
```
Configure `mobile/.env`:
```env
EXPO_PUBLIC_BACKEND_URL=https://your-campusmind-backend.vercel.app
```
