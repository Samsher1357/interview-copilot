import { Request, Response, NextFunction } from 'express'

/**
 * Validation middleware for request body
 */
export function validateBody(schema: Record<string, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field]

      // Required check
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`)
        continue
      }

      // Skip further validation if field is optional and not provided
      if (!rules.required && (value === undefined || value === null)) {
        continue
      }

      // Type check
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value
        if (actualType !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`)
        }
      }

      // String validations
      if (rules.type === 'string' && typeof value === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`)
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`)
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} format is invalid`)
        }
      }

      // Number validations
      if (rules.type === 'number' && typeof value === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`)
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${field} must be at most ${rules.max}`)
        }
      }

      // Array validations
      if (rules.type === 'array' && Array.isArray(value)) {
        if (rules.minItems && value.length < rules.minItems) {
          errors.push(`${field} must have at least ${rules.minItems} items`)
        }
        if (rules.maxItems && value.length > rules.maxItems) {
          errors.push(`${field} must have at most ${rules.maxItems} items`)
        }
      }

      // Custom validator
      if (rules.validator && typeof rules.validator === 'function') {
        const customError = rules.validator(value)
        if (customError) {
          errors.push(customError)
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      })
    }

    next()
  }
}

/**
 * Validation middleware for query parameters
 */
export function validateQuery(schema: Record<string, any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: string[] = []

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.query[field]

      // Required check
      if (rules.required && !value) {
        errors.push(`${field} is required`)
        continue
      }

      // Skip further validation if field is optional and not provided
      if (!rules.required && !value) {
        continue
      }

      // Type coercion and validation
      if (rules.type === 'number') {
        const num = Number(value)
        if (isNaN(num)) {
          errors.push(`${field} must be a number`)
        }
      }

      if (rules.type === 'boolean') {
        if (value !== 'true' && value !== 'false') {
          errors.push(`${field} must be true or false`)
        }
      }

      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`)
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
      })
    }

    next()
  }
}

/**
 * Sanitize request body to prevent injection attacks
 */
export function sanitizeBody(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body)
  }
  next()
}

function sanitizeObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  }

  const sanitized: any = {}
  for (const [key, value] of Object.entries(obj)) {
    // Remove potentially dangerous keys
    if (key.startsWith('$') || key.startsWith('_')) {
      continue
    }

    if (typeof value === 'string') {
      // Basic XSS prevention
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .trim()
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
