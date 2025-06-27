/**
 * Simple logging utility for consistent logging across the application
 */

import { LOG_LEVEL, IS_PRODUCTION } from '../config/simple'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  functionName?: string
  [key: string]: any
}

class SimpleLogger {
  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    }
    
    return levels[level] >= levels[LOG_LEVEL as LogLevel]
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    }[level]

    if (!IS_PRODUCTION) {
      return `${emoji} [${level.toUpperCase()}] ${message}${context ? ` | ${JSON.stringify(context)}` : ''}`
    }

    return JSON.stringify({
      timestamp,
      level: level.toUpperCase(),
      message,
      ...context,
    })
  }

  debug(message: string, context?: LogContext): void {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message, context))
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, context))
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.shouldLog('error')) {
      const errorContext = {
        ...context,
        error: error ? {
          name: error.name,
          message: error.message,
          stack: !IS_PRODUCTION ? error.stack : undefined,
        } : undefined,
      }
      console.error(this.formatMessage('error', message, errorContext))
    }
  }
}

export const logger = new SimpleLogger()

// Simple helper for creating loggers with context
export function createLogger(context: LogContext) {
  return {
    debug: (message: string, additionalContext?: LogContext) => 
      logger.debug(message, { ...context, ...additionalContext }),
    info: (message: string, additionalContext?: LogContext) => 
      logger.info(message, { ...context, ...additionalContext }),
    warn: (message: string, additionalContext?: LogContext) => 
      logger.warn(message, { ...context, ...additionalContext }),
    error: (message: string, error?: Error, additionalContext?: LogContext) => 
      logger.error(message, error, { ...context, ...additionalContext }),
  }
} 