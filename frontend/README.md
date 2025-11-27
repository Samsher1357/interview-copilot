# Interview Copilot - Frontend

Next.js frontend application for the AI Interview Copilot. This is a pure UI application that communicates with the backend API for all business logic.

## Architecture

This frontend is designed as a **pure client application**:
- ✅ UI components and styling
- ✅ Client-side state management (Zustand)
- ✅ WebSocket client for real-time updates
- ✅ API client for backend communication
- ❌ No AI logic (handled by backend)
- ❌ No API routes (all in backend)
- ❌ No server-side secrets

## Prerequisites

- Node.js >= 18.0.0
- Backend server running on port 3001 (or configured URL)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file:
```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# UI Configuration
NEXT_PUBLIC_AUTO_SPEAK=false
```

3. **Start the backend first** (from root directory):
```bash
npm run dev:backend
```

4. Run the frontend development server:
```bash
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | `http://localhost:3001` |
| `NEXT_PUBLIC_AUTO_SPEAK` | Enable auto-speak by default | `false` |

## Build for Production

```bash
npm run build
npm start
```

**Note:** Ensure the backend is accessible at the URL specified in `NEXT_PUBLIC_API_URL`.

## Features

- 🎨 Modern UI with Tailwind CSS
- 📱 Responsive design
- 🔄 Real-time transcription display
- 💬 WebSocket integration for live updates
- 🎯 Role-based interview assistance
- 📊 Performance monitoring
- 🌙 Dark mode support

## Technology Stack

- **Framework:** Next.js 14
- **UI:** React 18, Tailwind CSS
- **Icons:** Lucide React
- **State:** Zustand
- **Real-time:** Socket.IO Client
- **Language:** TypeScript

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main page
│   └── globals.css         # Global styles
├── components/
│   ├── InterviewCopilot.tsx     # Main component
│   ├── DeepgramTranscriber.tsx  # Audio capture
│   ├── ControlPanel.tsx         # Controls
│   ├── TranscriptPanel.tsx      # Transcripts
│   ├── ResponsePanel.tsx        # AI responses
│   └── ...
├── lib/
│   ├── apiClient.ts        # Backend API client
│   ├── store.ts            # State management
│   ├── hooks/              # Custom hooks
│   └── services/           # UI services
└── package.json
```

## Development Notes

- All AI processing happens in the backend
- API calls go through `lib/apiClient.ts`
- WebSocket connection managed by `lib/hooks/useSocket.ts`
- No secrets or API keys in frontend code
- Backend must be running for full functionality
