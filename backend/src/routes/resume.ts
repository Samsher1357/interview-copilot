import { Router, Request, Response } from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import { resumeParserService } from '../services/resumeParserService'
import { validateBody, sanitizeBody } from '../middleware/validation'
import { uploadLimiter, strictLimiter } from '../middleware/rateLimiter'

const router = Router()

// Configure multer with file size limit (10MB) and file type validation
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Only PDF files are allowed'))
    }
  }
})

// Parse resume text endpoint
router.post(
  '/parse',
  strictLimiter,
  sanitizeBody,
  validateBody({
    resumeText: {
      required: true,
      type: 'string',
      minLength: 50,
      maxLength: 50000,
    },
  }),
  async (req: Request, res: Response) => {
    try {
      const { resumeText } = req.body
      const result = await resumeParserService.parseResumeText(resumeText)
      res.json(result)
    } catch (error: any) {
      console.error('Resume parsing error:', error)
      
      if (error.message.includes('OpenAI')) {
        return res.status(503).json({ error: 'AI service temporarily unavailable' })
      }
      
      res.status(500).json({ error: error.message || 'Internal server error' })
    }
  }
)

// Parse PDF endpoint with error handling
router.post(
  '/pdf',
  uploadLimiter,
  (req: Request, res: Response, next: Function) => {
    upload.single('file')(req, res, (err: any) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File size exceeds 10MB limit' })
        }
        return res.status(400).json({ error: `Upload error: ${err.message}` })
      } else if (err) {
        return res.status(400).json({ error: err.message })
      }
      next()
    })
  },
  async (req: Request, res: Response) => {
    try {
      const file = req.file

      if (!file) {
        return res.status(400).json({ error: 'No file provided' })
      }

      if (file.mimetype !== 'application/pdf') {
        return res.status(400).json({ error: 'File must be a PDF' })
      }

      // Extract text from PDF
      const buffer = Buffer.from(file.buffer)
      const data = await pdfParse(buffer)
      const resumeText = data.text

      if (!resumeText || resumeText.trim().length < 50) {
        return res.status(400).json({
          error: 'Could not extract text from PDF. The PDF might be image-based or corrupted.',
        })
      }

      // Parse resume with fallback
      const result = await resumeParserService.parseResumeTextWithFallback(resumeText)
      res.json(result)
    } catch (error: any) {
      console.error('PDF parsing error:', error)
      res.status(500).json({ error: error.message || 'Failed to parse PDF' })
    }
  }
)

export { router as resumeRouter }

