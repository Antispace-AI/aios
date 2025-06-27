/**
 * Slack Events API Configuration
 * 
 * Environment variables and configuration for the Events API integration.
 * This is separate from the main webAPI configuration to maintain clear
 * separation between Phase 1 (AI functions) and Phase 2 (Events API).
 */

import { logger } from '../../util/logger'

// Events API specific environment variables
export const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET
export const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
export const EVENTS_API_ENABLED = process.env.EVENTS_API_ENABLED === 'true'

// Configuration validation
export interface EventsConfig {
  signingSecret: string
  webhookUrl?: string
  enabled: boolean
}

/**
 * Get validated Events API configuration
 * @returns EventsConfig object or throws error if invalid
 */
export function getEventsConfig(): EventsConfig {
  if (!EVENTS_API_ENABLED) {
    logger.info('Events API is disabled via EVENTS_API_ENABLED environment variable')
    return {
      signingSecret: '',
      enabled: false
    }
  }

  if (!SLACK_SIGNING_SECRET) {
    throw new Error(
      'SLACK_SIGNING_SECRET environment variable is required when Events API is enabled. ' +
      'Get this from your Slack app settings: Basic Information → App Credentials → Signing Secret'
    )
  }

  const config: EventsConfig = {
    signingSecret: SLACK_SIGNING_SECRET,
    webhookUrl: SLACK_WEBHOOK_URL,
    enabled: true
  }

  logger.info('Events API configuration loaded', {
    enabled: config.enabled,
    hasSigningSecret: !!config.signingSecret,
    webhookUrl: config.webhookUrl
  })

  return config
}

/**
 * Check if Events API is properly configured
 * @returns boolean indicating if Events API can be used
 */
export function isEventsApiConfigured(): boolean {
  try {
    const config = getEventsConfig()
    return config.enabled && !!config.signingSecret
  } catch (error: any) {
    logger.warn('Events API configuration check failed', { error: error.message })
    return false
  }
}

// Export configuration constants for convenience
export const eventsConfig = {
  get: getEventsConfig,
  isConfigured: isEventsApiConfigured,
  enabled: EVENTS_API_ENABLED
} 