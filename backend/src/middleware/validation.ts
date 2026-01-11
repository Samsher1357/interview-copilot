import { Request, Response, NextFunction } from 'express'

/**
 * Simple validation middleware
 */
export function validateBody(schema: Record<string, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field]

      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`)
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    next()
  }
}

export function validateQuery(schema: Record<string, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.query[field]

      if (rules.required && !value) {
        errors.push(`${field} is required`)
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors })
    }

    next()
  }
}

export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body)
  }
  next()
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(sanitizeObject)

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$') || key.startsWith('_')) continue
    
    if (typeof value === 'string') {
      sanitized[key] = value.replaceAll(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').trim()
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
