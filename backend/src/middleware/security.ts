import { Request, Response, NextFunction } from 'express'

/**
 * Basic error handler
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err)
  
  const statusCode = err.statusCode || err.status || 500
  
  let message: string
  if (process.env.NODE_ENV === 'development') {
    message = err.message
  } else if (statusCode === 500) {
    message = 'Internal server error'
  } else {
    message = err.message || 'An error occurred'
  }
  
  res.status(statusCode).json({ error: message })
}
