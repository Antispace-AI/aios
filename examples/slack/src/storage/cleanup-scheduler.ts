import { createStorageContainer } from './implementations/postgres/container'
import { logger } from '../util/logger'
import { reconcileAllUnreadCounts, isReconciliationNeeded } from './reconciliation'

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

  // Run unread count reconciliation on startup (after 10 seconds delay)
  setTimeout(async () => {
    await runStartupReconciliation()
  }, 10 * 1000) // 10 seconds delay
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
 * Run unread count reconciliation on server startup
 * This fixes any data inconsistencies that occurred while the server was offline
 */
async function runStartupReconciliation(): Promise<void> {
  logger.info('Running startup unread count reconciliation')
  
  try {
    // First check if reconciliation is needed
    const checkResult = await isReconciliationNeeded()
    
    if (!checkResult.needed) {
      logger.info('No unread count reconciliation needed', { 
        mismatches: checkResult.mismatches,
        details: checkResult.details 
      })
      return
    }
    
    logger.info('Unread count mismatches detected, starting reconciliation', {
      mismatches: checkResult.mismatches,
      details: checkResult.details
    })
    
    // Run reconciliation for all users
    const reconcileResult = await reconcileAllUnreadCounts()
    
    if (reconcileResult.success) {
      logger.info('Startup unread count reconciliation completed successfully', {
        usersProcessed: reconcileResult.usersProcessed,
        errors: reconcileResult.errors.length
      })
    } else {
      logger.warn('Startup unread count reconciliation completed with errors', {
        usersProcessed: reconcileResult.usersProcessed,
        errors: reconcileResult.errors
      })
    }
    
  } catch (error) {
    logger.error('Startup unread count reconciliation failed', 
      error instanceof Error ? error : new Error(String(error))
    )
  }
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