import { Request, Response, NextFunction } from 'express'

/**
 * Security headers middleware
 * Adds various security headers to protect against common vulnerabilities
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Prevent clickjacking attacks (allow same origin for Railway preview deployments)
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block')
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy (relaxed for Railway deployment)
  // Adjust as needed based on your security requirements
  const csp = process.env.NODE_ENV === 'production'
    ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https:; img-src 'self' data: https:;"
    : "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  
  res.setHeader('Content-Security-Policy', csp)
  
  // Remove X-Powered-By header to hide Express
  res.removeHeader('X-Powered-By')
  
  next()
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  
  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start
    const { method, originalUrl } = req
    const { statusCode } = res
    
    // Only log non-health-check requests in production
    if (originalUrl !== '/health' || process.env.NODE_ENV !== 'production') {
      console.log(`${method} ${originalUrl} ${statusCode} - ${duration}ms`)
    }
  })
  
  next()
}

/**
 * Error sanitizer middleware
 * Prevents leaking sensitive information in error messages
 */
export function errorSanitizer(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the full error for debugging
  console.error('Error:', err)
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  const statusCode = err.statusCode || err.status || 500
  
  let message: string
  if (isDevelopment) {
    message = err.message
  } else if (statusCode === 500) {
    message = 'Internal server error'
  } else {
    message = err.message || 'An error occurred'
  }
  
  res.status(statusCode).json({
    error: message,
    ...(isDevelopment && { stack: err.stack }),
  })
}
