// Event queue interface for reliable Slack event processing
// Handles webhook events with retry logic and failure management

export interface QueuedEvent {
  jobId: string
  eventId: string  // Slack's event ID for deduplication
  userId: string
  eventType: string
  eventData: string  // JSON serialized event payload
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  createdAt: Date
  processedAt?: Date
  failedAt?: Date
  nextRetryAt?: Date
  error?: string
}

export interface SlackEventData {
  eventId: string
  eventType: string
  userId: string
  teamId: string
  eventTime: number
  event: any  // Raw Slack event payload
}

export interface QueueMetrics {
  pending: number
  processing: number
  completed: number
  failed: number
  avgProcessingTime: number
}

export interface EventQueue {
  /**
   * Add event to processing queue
   * @returns Job ID for tracking
   */
  enqueueEvent(event: SlackEventData): Promise<string>
  
  /**
   * Get next event to process
   * @returns Next queued event or null if queue is empty
   */
  dequeueEvent(): Promise<QueuedEvent | null>
  
  /**
   * Mark event as successfully completed
   */
  completeEvent(jobId: string): Promise<void>
  
  /**
   * Mark event as failed and schedule retry if attempts remaining
   */
  failEvent(jobId: string, error: string): Promise<void>
  
  /**
   * Get failed events for manual inspection/retry
   */
  getFailedEvents(limit?: number): Promise<QueuedEvent[]>
  
  /**
   * Manually retry a failed event
   */
  retryEvent(jobId: string): Promise<void>
  
  /**
   * Get queue health and performance metrics
   */
  getQueueMetrics(): Promise<QueueMetrics>
  
  /**
   * Clean up old completed/failed events
   * @param olderThanDays Delete events older than this many days
   * @returns Number of events deleted
   */
  cleanup(olderThanDays: number): Promise<number>
  
  /**
   * Health check for queue system
   */
  healthCheck(): Promise<boolean>
} 