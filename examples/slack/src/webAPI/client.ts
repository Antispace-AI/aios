/**
 * Slack Client Utilities
 * 
 * Shared utilities for WebClient management, error handling, and response processing.
 * This consolidates code that was duplicated across multiple modules.
 * 
 * ⚠️  RATE LIMITING TEMPORARILY DISABLED FOR DEVELOPMENT ⚠️
 */

import { WebClient } from '@slack/web-api'

/**
 * Enhanced retry configuration with exponential backoff
 */
interface RetryConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
}

/**
 * Circuit breaker states for graceful degradation
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open', 
  HALF_OPEN = 'half_open'
}

/**
 * Circuit breaker for API endpoints
 * ⚠️ TEMPORARILY DISABLED - Always allows operations through
 */
class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failures = 0
  private lastFailureTime = 0
  private readonly failureThreshold = 5
  private readonly timeoutWindow = 60000 // 1 minute
  private readonly halfOpenMaxCalls = 3
  private halfOpenCalls = 0

  async execute<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    // ⚠️ RATE LIMITING DISABLED: Circuit breaker bypassed for development
    console.log(`🔧 DEV MODE: Circuit breaker bypassed for ${operationName}`)
    return await operation()
    
    /* ORIGINAL CIRCUIT BREAKER LOGIC - COMMENTED OUT FOR DEV
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.timeoutWindow) {
        this.state = CircuitState.HALF_OPEN
        this.halfOpenCalls = 0
        console.log(`🔄 Circuit breaker HALF_OPEN for ${operationName}`)
      } else {
        throw new SlackAPIError(`Circuit breaker OPEN for ${operationName}`, 'CIRCUIT_OPEN', false)
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      throw new SlackAPIError(`Circuit breaker HALF_OPEN limit reached for ${operationName}`, 'CIRCUIT_HALF_OPEN', false)
    }

    try {
      const result = await operation()
      
      // Success - reset circuit breaker
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED
        this.failures = 0
        console.log(`✅ Circuit breaker CLOSED for ${operationName}`)
      }
      
      return result
    } catch (error) {
      this.failures++
      this.lastFailureTime = Date.now()
      
      if (this.state === CircuitState.HALF_OPEN) {
        this.halfOpenCalls++
      }
      
      if (this.failures >= this.failureThreshold) {
        this.state = CircuitState.OPEN
        console.error(`🚨 Circuit breaker OPEN for ${operationName} after ${this.failures} failures`)
      }
      
      throw error
    }
    */
  }
}

/**
 * Request queue for managing API call rates
 * ⚠️ TEMPORARILY DISABLED - No delays or concurrency limits
 */
class RequestQueue {
  private queue: Array<() => void> = []
  private processing = false
  private readonly maxConcurrent = 999999 // ⚠️ DISABLED: Effectively unlimited
  private readonly rateLimitDelay = 0 // ⚠️ DISABLED: No delay
  private activeCalls = 0

  async enqueue<T>(operation: () => Promise<T>): Promise<T> {
    // ⚠️ RATE LIMITING DISABLED: Execute immediately without queuing
    console.log(`🔧 DEV MODE: Request queue bypassed - executing immediately`)
    return await operation()
    
    /* ORIGINAL QUEUE LOGIC - COMMENTED OUT FOR DEV
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          this.activeCalls++
          const result = await operation()
          resolve(result)
        } catch (error) {
          reject(error)
        } finally {
          this.activeCalls--
          this.processNext()
        }
      })
      
      this.processNext()
    })
    */
  }

  private processNext() {
    if (this.processing || this.queue.length === 0 || this.activeCalls >= this.maxConcurrent) {
      return
    }

    this.processing = true
    const next = this.queue.shift()!
    
    setTimeout(() => {
      this.processing = false
      next()
    }, this.rateLimitDelay)
  }
}

/**
 * Reusable WebClient pool for efficient connection management
 */
export class SlackClientPool {
  private clients = new Map<string, WebClient>()
  private lastUsed = new Map<string, number>()
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private requestQueue = new RequestQueue()
  private readonly maxClients = 50
  private readonly clientTTL = 300000 // 5 minutes

  getClient(token: string): WebClient {
    const now = Date.now()
    
    // Clean up old clients
    this.cleanup(now)
    
    // Return existing client if available
    if (this.clients.has(token)) {
      this.lastUsed.set(token, now)
      return this.clients.get(token)!
    }
    
    // Create new client with enhanced retry configuration
    const client = new WebClient(token, {
      retryConfig: {
        retries: 5,           // Increased from 3
        factor: 2.5,          // More aggressive backoff
      },
      rejectRateLimitedCalls: false,
      timeout: 30000,         // 30 second timeout
    })
    
    this.clients.set(token, client)
    this.lastUsed.set(token, now)
    
    return client
  }

  getCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(operationName, new CircuitBreaker())
    }
    return this.circuitBreakers.get(operationName)!
  }

  async executeWithQueue<T>(operation: () => Promise<T>): Promise<T> {
    return this.requestQueue.enqueue(operation)
  }

  private cleanup(now: number) {
    if (this.clients.size <= this.maxClients) return
    
    // Remove expired clients
    const entries = Array.from(this.lastUsed.entries())
    for (const [token, lastUsed] of entries) {
      if (now - lastUsed > this.clientTTL) {
        this.clients.delete(token)
        this.lastUsed.delete(token)
      }
    }
    
    // If still too many, remove oldest
    if (this.clients.size > this.maxClients) {
      const sortedByAge = Array.from(this.lastUsed.entries())
        .sort(([,a], [,b]) => a - b)
      
      const toRemove = sortedByAge.slice(0, this.clients.size - this.maxClients)
      for (const [token] of toRemove) {
        this.clients.delete(token)
        this.lastUsed.delete(token)
      }
    }
  }
}

/**
 * Consistent error class for Slack API operations
 */
export class SlackAPIError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'SlackAPIError'
  }
}

/**
 * Enhanced error handling wrapper with retry logic and circuit breaker
 * ⚠️ CIRCUIT BREAKER TEMPORARILY DISABLED
 */
export async function handleSlackResponse<T>(
  operation: () => Promise<T>,
  operationName: string,
  enableCircuitBreaker: boolean = false // ⚠️ DISABLED: Changed default to false
): Promise<T> {
  // ⚠️ RATE LIMITING DISABLED: Circuit breaker bypassed
  const circuitBreaker = false ? clientPool.getCircuitBreaker(operationName) : null

  const executeOperation = async (): Promise<T> => {
    try {
      return await operation()
    } catch (error: any) {
      console.error(`Slack API error (${operationName}):`, error)
      
      // Enhanced error categorization
      if (error.code === 'slack_webapi_rate_limited') {
        const retryAfter = error.data?.retry_after || 60
        console.warn(`⏳ Rate limited for ${operationName}, retry after ${retryAfter}s`)
        throw new SlackAPIError(
          `Rate limited: ${error.message} (retry after ${retryAfter}s)`, 
          'RATE_LIMITED', 
          true
        )
      }
      
      if (error.code === 'slack_webapi_request_error') {
        throw new SlackAPIError(`Network error: ${error.message}`, 'NETWORK_ERROR', true)
      }
      
      if (error.code === 'timeout') {
        throw new SlackAPIError(`Request timeout: ${error.message}`, 'TIMEOUT', true)
      }
      
      // Handle specific Slack API errors
      if (error.data?.error === 'missing_scope') {
        throw new SlackAPIError(`Missing OAuth scope: ${error.message}`, 'AUTH_ERROR', false)
      }
      
      if (error.data?.error === 'invalid_auth') {
        throw new SlackAPIError(`Invalid authentication: ${error.message}`, 'AUTH_ERROR', false)
      }
      
      if (error.data?.error === 'account_inactive') {
        throw new SlackAPIError(`Account inactive: ${error.message}`, 'AUTH_ERROR', false)
      }
      
      throw new SlackAPIError(`${operationName} failed: ${error.message}`, 'API_ERROR', false)
    }
  }

  if (circuitBreaker) {
    return circuitBreaker.execute(executeOperation, operationName)
  } else {
    return executeOperation()
  }
}

// Global client pool instance
export const clientPool = new SlackClientPool()

/**
 * Utility for batch processing with rate limiting
 * ⚠️ DELAYS TEMPORARILY DISABLED
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 50, // ⚠️ DISABLED: Increased batch size
  delayMs: number = 0 // ⚠️ DISABLED: No delay
): Promise<R[]> {
  const results: R[] = []
  
  console.log(`🔧 DEV MODE: Batch processing with no delays (batchSize: ${batchSize})`)
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    try {
      const batchResults = await Promise.all(
        batch.map(item => processor(item))
      )
      results.push(...batchResults)
      
      // ⚠️ RATE LIMITING DISABLED: No delay between batches
      // Original code: await new Promise(resolve => setTimeout(resolve, delayMs))
      
    } catch (error) {
      console.warn(`Batch processing failed for batch starting at index ${i}:`, error)
      // Continue with next batch instead of failing entirely
    }
  }
  
  return results
} 