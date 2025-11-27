# AI Interview Copilot

A professional-grade, **bidirectional** AI Interview Copilot that provides real-time assistance for **both interviewers AND applicants**. Listen to live conversations, get instant AI-powered insights, and conduct better interviews with role-specific guidance.

## 🏗️ Project Structure

This is a monorepo containing separate frontend and backend applications:

```
interview-copilot/
├── frontend/          # Next.js frontend application
│   ├── app/          # Next.js app directory
│   ├── components/   # React components
│   ├── lib/          # Frontend utilities and services
│   ├── types/        # TypeScript type definitions
│   └── package.json  # Frontend dependencies
│
├── backend/          # Express.js backend server
│   ├── src/          # Backend source code
│   │   ├── routes/   # API routes
│   │   ├── services/ # Business logic
│   │   ├── socket/   # WebSocket handlers
│   │   └── server.ts # Server entry point
│   └── package.json  # Backend dependencies
│
└── package.json      # Root workspace configuration
```

## 🆕 What's New in v2.0

- **🎯 Complete Conversation Analysis**: Analyzes BOTH interviewer and applicant speech
- **💡 Dual Assistance**: 
  - When interviewer speaks → Get answer suggestions
  - When you speak → Get feedback and improvements
- **🏗️ Improved Architecture**: Clean service layer with better scalability
- **📡 Real-time Events**: WebSocket-based event system for instant updates
- **⚙️ Configuration System**: Centralized settings management

**[See IMPROVEMENTS.md for full details →](IMPROVEMENTS.md)**

## Features

### Core Capabilities
- 🎤 **Real-time Audio Transcription**: Continuously transcribes spoken dialogue from both parties using Deepgram (professional-grade speech recognition)
- 🤖 **AI-Powered Analysis**: Detects interviewer intent (evaluation, follow-up questions, role-specific topics) using LangChain.js
- ⚡ **Real-time Streaming**: AI responses stream in real-time as they're generated for instant feedback
- 🌍 **Multi-language Support**: Supports transcription and response generation in multiple languages
- 🎨 **Modern UI**: Clean, responsive interface with dark mode support
- 🔒 **Secure API Keys**: Server-side API key handling for improved security

### 🆕 NEW: Complete Conversation Analysis
- 🎤 **Listen to Everyone**: Analyzes both interviewer and applicant speech in real-time
- 💡 **Answer Suggestions**: When interviewer asks questions, get complete ready-to-use answers
- 🔄 **Live Feedback**: When you answer, get instant feedback and improvement suggestions
- ❓ **Question Help**: When you ask questions, get suggestions to make them better
- 🤔 **Clarification Assistance**: When you need clarification, get help phrasing it professionally
- 📊 **What to Add Next**: Real-time hints on what points to mention or elaborate on
- 🎯 **Context-Aware**: Uses conversation context to provide relevant assistance

### 🆕 NEW: Advanced Architecture
- 🏗️ **Service Layer**: Clean separation between UI, business logic, and services
- 📡 **Real-time Events**: WebSocket-based event system for instant updates
- ⚙️ **Configuration Management**: Centralized settings with persistence
- 🔧 **Testable Code**: Independent service layer for better maintainability
- 🚀 **Multi-user Ready**: Event-driven architecture supports future multi-user scenarios

### Additional Features
- 💡 **Intelligent Responses**: Generates contextual and professional suggestions, hints, and talking points
- 🔊 **Auto-Speak**: Optional text-to-speech for AI responses
- 📊 **Context-Aware**: Uses interview context (job role, skills, experience) for personalized responses
- 🎓 **Multiple Use Cases**: Job interviews, practice sessions, training, evaluation assistance

## Prerequisites

- Node.js 18+ and npm/yarn
- OpenAI API key (for AI analysis and response generation)
- Deepgram API key (for speech recognition) - [Get free API key](https://console.deepgram.com)
- Modern browser with microphone access (Chrome, Edge, Firefox, or Safari)

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd interview-copilot
```

2. Install all dependencies:
```bash
npm run install:all
```

Or install manually:
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
npm install
```

3. Configure environment variables:

**Create `.env.local` in the ROOT directory** (both frontend and backend use this single file):
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:
```env
# Frontend Configuration
NEXT_PUBLIC_API_URL=http://localhost:3001

# Backend Configuration
PORT=3001
CORS_ORIGIN=http://localhost:3000

# AI Provider (choose 'openai' or 'gemini')
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
# OR use Gemini (FREE!)
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-1.5-flash
AI_MAX_TOKENS=1200

# Deepgram Configuration (Required)
DEEPGRAM_API_KEY=your_deepgram_api_key_here
```

**Important:** 
- Both frontend and backend read from this single `.env.local` file in the root directory
- Frontend (Next.js) automatically reads variables prefixed with `NEXT_PUBLIC_`
- Backend loads the file via `src/config/env.ts`
- All API keys are managed by the backend for security

**Getting API Keys:**
- **OpenAI:** https://platform.openai.com/api-keys
- **Google Gemini (FREE):** https://makersuite.google.com/app/apikey
- **Deepgram (FREE):** https://console.deepgram.com

### Development

Run both frontend and backend concurrently:
```bash
npm run dev
```

Or run them separately:
```bash
# Frontend only (runs on port 3000)
npm run dev:frontend

# Backend only (runs on port 3001)
npm run dev:backend
```

The application will be available at:
- Frontend: [http://localhost:3000](http://localhost:3000)
- Backend: [http://localhost:3001](http://localhost:3001)

### Production Build

Build both applications:
```bash
npm run build
```

Start both applications:
```bash
npm run start
```

## Available Scripts

### Root Level

- `npm run dev` - Run both frontend and backend in development mode
- `npm run build` - Build both applications for production
- `npm run start` - Start both applications in production mode
- `npm run install:all` - Install dependencies for all workspaces
- `npm run clean` - Remove all node_modules and build artifacts
- `npm run lint` - Run linters for both applications

### Frontend

- `npm run dev:frontend` - Run frontend development server
- `npm run build:frontend` - Build frontend for production
- `npm run start:frontend` - Start frontend production server

### Backend

- `npm run dev:backend` - Run backend development server
- `npm run build:backend` - Build backend for production
- `npm run start:backend` - Start backend production server

## Usage

### Quick Start

1. **Configure Context** (Optional): Add your job role, skills, and relevant information
2. **Start Listening**: Click the "Start Listening" button to begin transcription
3. **Get Real-time Assistance**: AI analyzes everyone's speech and provides help
   - Interviewer speaks → Get answer suggestions
   - You speak → Get feedback and improvements

### How It Works

#### When Interviewer Speaks
The AI provides **answer suggestions**:
- ✅ Complete, ready-to-use answers
- 💡 Key talking points to mention
- 📝 Structured responses (STAR method)
- 🎯 Examples and elaborations

#### When You (Applicant) Speak

The AI detects what you're doing and provides **appropriate help**:

**If you're ANSWERING:**
- 🔄 What you did well
- 💡 What to add or elaborate on
- 📊 Points you missed
- 🎯 How to improve your answer

**If you're ASKING A QUESTION:**
- ✅ Quality of your question
- 💡 How to make it better/more specific
- ❓ Follow-up questions to consider
- ⏰ Timing suggestions

**If you're ASKING FOR CLARIFICATION:**
- ✅ Validates it's good to clarify
- 💬 Better ways to phrase it
- 🎯 What specifically to clarify
- 🔄 What to say after getting clarification

**Example Flow:**
```
1. Interviewer: "Tell me about a challenging project."
   → AI shows: Complete STAR answer, talking points

2. You start answering...
   → AI shows: "Good start! Also mention: team size, specific metrics"

3. You: "Could you clarify what you mean by challenging?"
   → AI shows: "Good question! You could also ask about: technical vs organizational challenges"

4. You: "What's the team structure for this role?"
   → AI shows: "Excellent question! Follow up with: reporting structure, collaboration style"
```

### Additional Features

1. **Select Language**: Choose your preferred language from the dropdown
2. **View Transcripts**: See real-time transcriptions with speaker identification
3. **Auto-Speak**: Enable auto-speak to have AI suggestions read aloud automatically
4. **Manual Speak**: Click the speaker icon on any response to hear it spoken
5. **Export Session**: Export transcripts and AI responses for later review

## Supported Languages

- English (US/UK)
- Spanish
- French
- German
- Italian
- Portuguese
- Japanese
- Chinese (Simplified)
- Korean

## Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Safari
- ✅ Firefox
- ✅ All modern browsers with microphone access support

**Note**: The app uses Deepgram for speech recognition, which works in all modern browsers (unlike Web Speech API which has limited browser support).

## Detailed Project Structure

```
interview-copilot/
├── frontend/                         # Next.js Frontend Application
│   ├── app/
│   │   ├── layout.tsx                   # Root layout
│   │   ├── page.tsx                     # Main page
│   │   ├── globals.css                  # Global styles
│   │   └── api/
│   │       ├── analyze-stream/          # Streaming analysis endpoint
│   │       ├── deepgram/                # Deepgram WebSocket endpoint
│   │       ├── parse-pdf/               # PDF parsing
│   │       ├── parse-resume/            # Resume parsing
│   │       └── socket/                  # Socket.IO endpoint
│   ├── components/
│   │   ├── InterviewCopilot.tsx         # Main component
│   │   ├── RoleSelector.tsx             # Role selection UI
│   │   ├── DeepgramTranscriber.tsx     # Speech recognition
│   │   ├── ControlPanel.tsx            # Control buttons
│   │   ├── TranscriptPanel.tsx         # Transcript display
│   │   ├── ResponsePanel.tsx           # AI responses display
│   │   └── ContextModal.tsx            # Context settings
│   ├── lib/
│   │   ├── store.ts                     # Zustand state management
│   │   ├── langchainService.ts         # LangChain.js integration
│   │   ├── deepgramService.ts          # Deepgram client service
│   │   ├── socket-server.ts            # Socket.IO server
│   │   ├── services/                    # Service Layer
│   │   │   ├── TranscriptionService.ts  # Deepgram management
│   │   │   ├── AIAnalysisService.ts     # AI analysis
│   │   │   ├── RolePromptStrategy.ts    # Role-specific prompts
│   │   │   ├── ConfigurationService.ts  # Settings management
│   │   │   └── RealtimeEventService.ts  # WebSocket events
│   │   └── hooks/
│   │       ├── useDeepgram.ts           # Deepgram hook
│   │       ├── useSocket.ts             # Socket.IO hook
│   │       └── useStreamingAnalysis.ts  # Streaming analysis
│   ├── types/                           # TypeScript types
│   ├── package.json                     # Frontend dependencies
│   └── README.md                        # Frontend documentation
│
├── backend/                          # Express.js Backend Server
│   ├── src/
│   │   ├── server.ts                    # Server entry point
│   │   ├── routes/                      # API routes
│   │   │   ├── analyze-stream.ts        # Streaming analysis
│   │   │   ├── analyze.ts               # Standard analysis
│   │   │   ├── deepgram.ts              # Deepgram routes
│   │   │   ├── index.ts                 # Route aggregator
│   │   │   └── resume.ts                # Resume parsing
│   │   ├── services/                    # Business logic
│   │   │   ├── AIAnalysisService.ts     # AI analysis service
│   │   │   └── langchainService.ts      # LangChain integration
│   │   ├── socket/                      # WebSocket handlers
│   │   │   └── socketHandler.ts         # Socket.IO logic
│   │   └── types/                       # TypeScript types
│   │       └── index.ts
│   ├── package.json                     # Backend dependencies
│   └── README.md                        # Backend documentation
│
├── package.json                      # Root workspace config
└── README.md                         # This file
```

## Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **React 18**: UI library
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Socket.IO Client**: Real-time communication
- **Zustand**: Lightweight state management
- **Deepgram SDK**: Speech recognition client

### Backend
- **Express.js**: Web server framework
- **TypeScript**: Type-safe development
- **Socket.IO**: Real-time bidirectional communication
- **LangChain.js**: AI orchestration with streaming
- **OpenAI / Google AI**: AI providers
- **Deepgram SDK**: Speech recognition API
- **PDF Parser**: Resume parsing

### Architecture
- **Monorepo Structure**: Separate frontend and backend
- **Service Layer Pattern**: Clean separation of concerns
- **Event-Driven Architecture**: Real-time updates
- **Role-Based Strategies**: Adaptive AI prompts

## Configuration

### Environment Variables

#### AI Provider Selection
- `AI_PROVIDER`: Choose AI provider (optional, default: `openai`)
  - `openai`: Use OpenAI models (GPT)
  - `gemini`: Use Google Gemini models (FREE!)

#### OpenAI Configuration (if using OpenAI)
- `OPENAI_API_KEY`: Your OpenAI API key (required for OpenAI)
- `OPENAI_MODEL`: AI model to use (optional, default: `gpt-4o-mini`)
  - `gpt-3.5-turbo`: Cheapest, highest rate limits, good quality
  - `gpt-4o-mini`: Balanced (default)
  - `gpt-4`: Most powerful, expensive
  - `gpt-4o`: Latest, powerful

#### Google Gemini Configuration (if using Gemini)
- `GOOGLE_API_KEY`: Your Google API key (required for Gemini) - **FREE!**
  - Get at: https://makersuite.google.com/app/apikey
- `GEMINI_MODEL`: Gemini model to use (optional, default: `gemini-1.5-flash`)
  - `gemini-1.5-flash`: Free, fastest, great quality (recommended)
  - `gemini-1.5-pro`: More powerful, free tier available
  - `gemini-2.0-flash-exp`: Experimental, latest features

#### Common Configuration
- `AI_MAX_TOKENS`: Max response length (optional, default: `1200`)
- `DEEPGRAM_API_KEY`: Your Deepgram API key (required for speech recognition)
- `NEXT_PUBLIC_AUTO_SPEAK`: Enable/disable auto-speak by default (optional, default: false)

**Security Note**: 
- Use `OPENAI_API_KEY` for production. It's server-side only and more secure than `NEXT_PUBLIC_OPENAI_API_KEY`
- Deepgram API key is handled server-side for security

### Customization

You can customize the AI behavior by modifying the system prompt in `lib/langchainService.ts`. The prompt controls how the AI analyzes conversations and generates responses.

## Security Notes

- Never commit your `.env.local` file or API keys to version control
- **Use `OPENAI_API_KEY` instead of `NEXT_PUBLIC_OPENAI_API_KEY`** for better security (server-side only)
- All API calls are now made server-side through Next.js API routes
- For production, implement rate limiting and API key protection
- Socket.IO connections are configured with CORS protection

## Troubleshooting

### Speech Recognition Not Working

- Ensure you're using a supported browser (Chrome/Edge/Safari)
- Check microphone permissions in your browser settings
- Make sure you're using HTTPS (required for microphone access in most browsers)
- Try refreshing the page and allowing microphone access when prompted

### AI Responses Not Appearing

- **Check API Key**: Verify your OpenAI API key is correctly set in `.env.local`
  - The key should start with `sk-`
  - Make sure there are no extra spaces or quotes
  - Restart the dev server after changing `.env.local`
  
- **Check Browser Console**: Open Developer Tools (F12) and check for errors
  - Look for API errors or network failures
  - Check if the `/api/analyze` endpoint is being called
  
- **Verify API Credits**: Ensure you have sufficient OpenAI API credits
  - Check your OpenAI dashboard at https://platform.openai.com
  
- **Check Network**: Ensure you have internet connection
  - The app needs to connect to OpenAI's API

### Common Issues

1. **"OpenAI API key not configured" error**
   - Make sure `.env.local` exists in the root directory
   - Verify the variable name is exactly `NEXT_PUBLIC_OPENAI_API_KEY`
   - Restart the dev server: `npm run dev`

2. **No answers appearing when interviewer speaks**
   - Check if transcripts are appearing (if not, microphone issue)
   - Look for error messages in the error display (top-right)
   - Check browser console for detailed errors

3. **API errors (401, 403, 429)**
   - 401: Invalid API key - check your key
   - 403: API key doesn't have access - check your OpenAI account
   - 429: Rate limit exceeded - wait a moment and try again

4. **"Analyzing..." but no results**
   - Check browser console for errors
   - Verify API key is valid
   - Check network tab to see if API calls are failing

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

