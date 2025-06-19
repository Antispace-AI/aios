import { createStorageContainer } from './implementations/postgres/container'
import { logger } from '../util/logger'

/**
 * Automatic cleanup scheduler for inactive users
 * Runs every hour to remove users inactive for more than 1 hour
 */

let cleanupInterval: NodeJS.Timeout | null = null
let isCleanupRunning = false

/**
 * Start the automatic cleanup scheduler
 */
export function startCleanupScheduler(): void {
  if (cleanupInterval) {
    logger.warn('Cleanup scheduler already running')
    return
  }

  logger.info('Starting automatic cleanup scheduler (runs every hour)')
  
  // Run cleanup every hour (3,600,000 ms)
  cleanupInterval = setInterval(async () => {
    await runScheduledCleanup()
  }, 60 * 60 * 1000) // 1 hour

  // Also run cleanup immediately on startup (after 30 seconds delay)
  setTimeout(async () => {
    await runScheduledCleanup()
  }, 30 * 1000) // 30 seconds delay
}

/**
 * Stop the automatic cleanup scheduler
 */
export function stopCleanupScheduler(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    logger.info('Cleanup scheduler stopped')
  }
}

/**
 * Run the scheduled cleanup process
 */
async function runScheduledCleanup(): Promise<void> {
  if (isCleanupRunning) {
    logger.debug('Cleanup already in progress, skipping')
    return
  }

  isCleanupRunning = true
  
  try {
    logger.info('Running scheduled cleanup of inactive users')
    
    const { dataStore } = createStorageContainer()
    const cleanedUsers = await dataStore.cleanupInactiveUsers()
    
    if (cleanedUsers.length > 0) {
      logger.info('Scheduled cleanup completed', { 
        cleanedCount: cleanedUsers.length,
        cleanedUsers: cleanedUsers.slice(0, 5) // Log first 5 user IDs only
      })
    } else {
      logger.debug('No inactive users to clean up')
    }
    
  } catch (error) {
    logger.error('Scheduled cleanup failed', error instanceof Error ? error : new Error(String(error)))
  } finally {
    isCleanupRunning = false
  }
}

/**
 * Check if cleanup scheduler is running
 */
export function isCleanupSchedulerRunning(): boolean {
  return cleanupInterval !== null
}

/**
 * Get cleanup scheduler status
 */
export function getCleanupStatus(): {
  isRunning: boolean
  nextCleanupIn?: string
} {
  return {
    isRunning: cleanupInterval !== null,
    nextCleanupIn: cleanupInterval ? 'Up to 1 hour' : undefined
  }
} 