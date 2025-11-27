import { Express } from 'express'
import { analyzeRouter } from './analyze'
import { analyzeStreamRouter } from './analyze-stream'
import { deepgramRouter } from './deepgram'
import { resumeRouter } from './resume'

export function setupRoutes(app: Express) {
  app.use('/api/analyze', analyzeRouter)
  app.use('/api/analyze-stream', analyzeStreamRouter)
  app.use('/api/deepgram', deepgramRouter)
  app.use('/api/parse-resume', resumeRouter)
  app.use('/api/parse-pdf', resumeRouter)
}

