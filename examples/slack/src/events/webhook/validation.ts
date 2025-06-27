import crypto from 'crypto'
import { logger } from '../../util/logger'

/**
 * Slack Webhook Request Validation
 * 
 * Validates that incoming webhook requests actually come from Slack
 * using HMAC-SHA256 signature verification and timestamp checking.
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Verify that a request came from Slack by validating the signature
 * 
 * @param body - Raw request body (string)
 * @param signature - X-Slack-Signature header value
 * @param timestamp - X-Slack-Request-Timestamp header value  
 * @param signingSecret - Your app's signing secret from environment
 * @returns ValidationResult indicating if request is valid
 */
export function verifySlackSignature(
  body: string,
  signature: string, 
  timestamp: string,
  signingSecret: string
): ValidationResult {
  try {
    // Check if we have all required parameters
    if (!body || !signature || !timestamp || !signingSecret) {
      return {
        isValid: false,
        error: 'Missing required parameters for signature verification'
      }
    }

    // Validate timestamp (prevent replay attacks)
    const currentTime = Math.floor(Date.now() / 1000)
    const requestTime = parseInt(timestamp)
    
    if (isNaN(requestTime)) {
      return {
        isValid: false,
        error: 'Invalid timestamp format'
      }
    }

    // Reject requests older than 5 minutes (300 seconds)
    const timeDiff = Math.abs(currentTime - requestTime)
    if (timeDiff > 300) {
      return {
        isValid: false,
        error: `Request too old: ${timeDiff} seconds (max 300)`
      }
    }

    // Create the signature base string
    const baseString = `v0:${timestamp}:${body}`
    
    // Compute the expected signature
    const hmac = crypto.createHmac('sha256', signingSecret)
    hmac.update(baseString)
    const expectedSignature = `v0=${hmac.digest('hex')}`

    // Perform timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      new Uint8Array(Buffer.from(signature)),
      new Uint8Array(Buffer.from(expectedSignature))
    )

    if (!isValid) {
      logger.warn('Slack signature verification failed', {
        expectedPrefix: expectedSignature.substring(0, 10) + '...',
        receivedPrefix: signature.substring(0, 10) + '...',
        timeDiff
      })
      
      return {
        isValid: false,
        error: 'Signature verification failed'
      }
    }

    return { isValid: true }

  } catch (error: any) {
    logger.error('Error during signature verification', error)
    return {
      isValid: false,
      error: `Verification error: ${error.message}`
    }
  }
}

/**
 * Validate the overall webhook request
 * 
 * @param headers - Request headers object
 * @param body - Raw request body
 * @param signingSecret - Slack signing secret
 * @returns ValidationResult
 */
export function validateWebhookRequest(
  headers: Record<string, string | undefined>,
  body: string,
  signingSecret: string
): ValidationResult {
  const signature = headers['x-slack-signature']
  const timestamp = headers['x-slack-request-timestamp']

  if (!signature) {
    return {
      isValid: false,
      error: 'Missing X-Slack-Signature header'
    }
  }

  if (!timestamp) {
    return {
      isValid: false,
      error: 'Missing X-Slack-Request-Timestamp header'
    }
  }

  return verifySlackSignature(body, signature, timestamp, signingSecret)
} 