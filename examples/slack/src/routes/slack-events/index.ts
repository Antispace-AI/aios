import type { Context } from "hono"
import { logger } from "../../util/logger"
import type { SlackWebhookRequest, SlackUrlVerificationRequest, SlackEventCallbackRequest } from "../../events/types/events"
import { validateWebhookRequest } from "../../events/webhook/validation"
import { getEventsConfig } from "../../events/config/events"

/**
 * Slack Events API Webhook Endpoint
 * 
 * This endpoint receives HTTP POST requests from Slack's Events API.
 * It handles two main types of requests:
 * 1. url_verification - Initial challenge when setting up the webhook
 * 2. event_callback - Actual events from Slack workspace
 */
export default async function slackEventsHandler(c: Context) {
  try {
    // Get Events API configuration
    const config = getEventsConfig()
    
    if (!config.enabled) {
      logger.warn('Events API is disabled, rejecting request')
      return c.text('Events API not enabled', 404)
    }

    // Parse the request body
    const body = await c.req.text()
    
    // Handle empty body
    if (!body || body.trim() === '') {
      logger.warn('Empty request body received')
      return c.text('Error', 200)
    }
    
    let request: SlackWebhookRequest
    try {
      request = JSON.parse(body) as SlackWebhookRequest
    } catch (parseError: any) {
      logger.warn('Invalid JSON in request body', { 
        error: parseError.message,
        body: body.substring(0, 100) + (body.length > 100 ? '...' : '')
      })
      return c.text('Error', 200)
    }

    // Validate request signature (skip validation for url_verification during initial setup)
    const headers = Object.fromEntries(
      Object.entries(c.req.header()).map(([key, value]) => [key.toLowerCase(), value])
    )
    
    // For url_verification, we can be more lenient with validation
    // since this happens during initial webhook setup
    if (request.type !== 'url_verification') {
      const validation = validateWebhookRequest(headers, body, config.signingSecret)
      
      if (!validation.isValid) {
        logger.warn('Invalid webhook request', { error: validation.error })
        return c.text('Unauthorized', 401)
      }
    }
    
    logger.info('Slack Events API request received', {
      type: request.type,
      team_id: request.team_id,
      api_app_id: request.api_app_id
    })

    // Handle URL verification challenge
    if (request.type === 'url_verification') {
      const verificationRequest = request as SlackUrlVerificationRequest
      logger.info('URL verification challenge received', {
        challenge: verificationRequest.challenge?.substring(0, 10) + '...'
      })
      
      return c.text(verificationRequest.challenge)
    }

    // Handle event callbacks
    if (request.type === 'event_callback') {
      const eventRequest = request as SlackEventCallbackRequest
      logger.info('Event callback received', {
        event_type: eventRequest.event?.type,
        event_ts: eventRequest.event?.ts,
        user: eventRequest.event?.user,
        channel: eventRequest.event?.channel,
        event_id: eventRequest.event_id
      })

      // Acknowledge immediately to Slack (must respond within 3 seconds)
      const response = c.text('OK')
      
      // Process event asynchronously after acknowledgment
      setImmediate(async () => {
        try {
          logger.info('Processing event asynchronously', {
            event_id: eventRequest.event_id,
            event_type: eventRequest.event?.type
          })
          
          // Route to event processors
          if (eventRequest.event) {
            const { routeSlackEvent } = await import('../../events/processors/router.js')
            await routeSlackEvent(
              eventRequest.event,
              eventRequest.event_id,
              eventRequest.team_id,
              eventRequest.event_time
            )
          }
          
        } catch (error: any) {
          logger.error('Async event processing failed', error, {
            event_id: eventRequest.event_id,
            event_type: eventRequest.event?.type
          })
        }
      })
      
      return response
    }

    // Handle unknown event types
    logger.warn('Unknown event type received', {
      type: request.type,
      body: body.substring(0, 200)
    })
    
    return c.text('OK')

  } catch (error: any) {
    logger.error('Error processing Slack Events API request', error)
    
    // Still return 200 to avoid Slack retries for parsing errors
    return c.text('Error', 200)
  }
} 