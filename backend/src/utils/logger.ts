/**
 * Simple logger utility with different log levels
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private level: LogLevel

  constructor() {
    const envLevel = process.env.LOG_LEVEL?.toUpperCase()
    this.level = LogLevel[envLevel as keyof typeof LogLevel] ?? LogLevel.INFO
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level
  }

  private formatMessage(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString()
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] ${level}: ${message}${metaStr}`
  }

  debug(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, meta))
    }
  }

  info(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, meta))
    }
  }

  warn(message: string, meta?: any) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, meta))
    }
  }

  error(message: string, error?: Error | any, meta?: any) {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorMeta = error instanceof Error
        ? { message: error.message, stack: error.stack, ...meta }
        : { error, ...meta }
      console.error(this.formatMessage('ERROR', message, errorMeta))
    }
  }

  setLevel(level: LogLevel) {
    this.level = level
  }
}

export const logger = new Logger()
