# Interview Copilot Backend

Backend server for the Interview Copilot application, providing API endpoints and realtime communication via WebSockets.

## Features

- RESTful API endpoints for AI analysis, Deepgram transcription, and resume parsing
- Socket.IO server for realtime bidirectional communication
- Express.js server with TypeScript
- CORS enabled for frontend integration

## Setup

1. **Environment Configuration**: This backend uses the `.env.local` file from the **root directory** (not this folder)
   - See root `/.env.example` for all configuration options
   - The backend automatically loads environment variables from `../../.env.local`
   - No need to create a separate `.env` file in this directory

2. Install dependencies (from root):
```bash
npm install
```

3. Run in development mode (from root):
```bash
npm run dev:backend
# or run both frontend and backend:
npm run dev
```

4. Build for production (from root):
```bash
npm run build:backend
# or build both:
npm run build
```

## Environment Variables

The backend reads from the root `.env.local` file via `src/config/env.ts`, which is imported at the top of all service files. Required variables:

- `PORT` - Server port (default: 3001)
- `CORS_ORIGIN` - Frontend URL for CORS (default: http://localhost:3000)
- `AI_PROVIDER` - 'openai' or 'gemini'
- `OPENAI_API_KEY` or `GOOGLE_API_KEY` - Based on provider
- `DEEPGRAM_API_KEY` - For speech recognition

## API Endpoints

- `GET /health` - Health check
- `POST /api/analyze` - Non-streaming AI analysis
- `POST /api/analyze-stream` - Streaming AI analysis (Server-Sent Events)
- `GET /api/deepgram` - Get Deepgram WebSocket connection details
- `POST /api/deepgram` - Get Deepgram WebSocket connection details (POST)
- `POST /api/parse-resume/parse-resume` - Parse resume text
- `POST /api/parse-pdf` - Parse PDF resume

## WebSocket Events

Socket.IO server available at `/socket.io` with the following events:

- `event` - Custom event broadcasting
- `join:session` - Join a session room
- `leave:session` - Leave a session room
- `transcript:update` - Real-time transcript updates
- `ai:response` - Real-time AI response updates

## Architecture

```
backend/
├── src/
│   ├── server.ts          # Main server entry point
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   ├── socket/            # Socket.IO handlers
│   └── types/             # TypeScript type definitions
├── package.json
└── tsconfig.json
```

