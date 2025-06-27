/**
 * Simple configuration for Antispace app
 * No complex validation or multiple environments - just what you need
 */

// Required environment variables - will throw early if missing
export const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID || (() => {
  throw new Error('SLACK_CLIENT_ID environment variable is required')
})()

export const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET || (() => {
  throw new Error('SLACK_CLIENT_SECRET environment variable is required')
})()

// Optional with sensible defaults
export const BASE_URL = process.env.BASE_URL || 'http://localhost:6101'
export const ANTISPACE_URL = process.env.ANTISPACE_URL || 'https://localhost:3000'
export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

// Log level - simple approach
export const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug')

// Database (keeping it simple)
export const DATABASE_TYPE = process.env.DATABASE_TYPE || 'file' 