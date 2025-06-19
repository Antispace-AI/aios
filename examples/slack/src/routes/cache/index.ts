import { getUser } from '../../util'
import { createStorageContainer } from '../../storage/implementations/postgres/container'
import { logger } from '../../util/logger'
import { getCleanupStatus, startCleanupScheduler, isCleanupSchedulerRunning } from '../../storage/cleanup-scheduler'
import { SlackSyncOrchestrator } from '../../storage/data-sync'

/**
 * Cache Management Endpoints for Week 4
 * Handles cache status, refresh, and UI data
 */

interface CacheStatus {
  isActive: boolean
  lastActivity?: string
  messageCount: number
  conversationCount: number
}

interface RefreshResult {
  success: boolean
  refreshedAt?: Date
  scope?: string
  message?: string
  error?: string
  syncStats?: {
    conversationsSync: number
    messagesSync: number
    usersSync: number
    duration: number
  }
}

/**
 * Get cache status for a user
 */
export async function getCacheStatus(antiId: string): Promise<CacheStatus> {
  try {
    const { dataStore } = createStorageContainer()
    return await dataStore.getCacheStatus(antiId)
  } catch (error) {
    logger.error('Failed to get cache status', error instanceof Error ? error : new Error(String(error)), { antiId })
    return {
      isActive: false,
      messageCount: 0,
      conversationCount: 0
    }
  }
}

/**
 * Manual cache refresh for users
 * ENHANCED: Now performs real Slack data pull using the sync orchestrator
 * Scope: Recent messages (last 7 days) for performance
 */
export async function refreshUserCache(antiId: string, options: { incremental?: boolean } = {}): Promise<RefreshResult> {
  try {
    logger.info('Manual cache refresh initiated - pulling real Slack data', { antiId, options })
    
    const { dataStore } = createStorageContainer()
    const user = await dataStore.getUser(antiId)
    
    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Create sync orchestrator for this user
    const orchestrator = new SlackSyncOrchestrator(dataStore, antiId)
    
    // Determine sync type based on cache state and options
    const shouldPerformFullSync = options.incremental ? false : await orchestrator.shouldPerformFullSync()
    
    // Perform the appropriate sync
    const syncResult = shouldPerformFullSync 
      ? await orchestrator.fullSync()
      : await orchestrator.incrementalSync()
    
    if (!syncResult.success) {
      return { 
        success: false, 
        error: `Sync failed: ${syncResult.errors.join(', ')}` 
      }
    }
    
    // Touch activity to extend session after successful sync
    await dataStore.touchUserActivity(antiId)
    
    logger.info('Cache refresh completed with real Slack data', {
      antiId,
      syncType: shouldPerformFullSync ? 'full' : 'incremental',
      ...syncResult
    })
    
    return { 
      success: true, 
      refreshedAt: new Date(),
      scope: `${syncResult.timeWindow} of Slack data`,
      message: `Synced ${syncResult.conversationsSync} conversations, ${syncResult.messagesSync} messages`,
      syncStats: {
        conversationsSync: syncResult.conversationsSync,
        messagesSync: syncResult.messagesSync,
        usersSync: syncResult.usersSync,
        duration: syncResult.duration
      }
    }
  } catch (error) {
    logger.error('Failed to refresh cache', error instanceof Error ? error : new Error(String(error)), { antiId })
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Clear user cache immediately
 */
export async function clearUserCache(antiId: string): Promise<RefreshResult> {
  try {
    logger.info('Manual cache clear initiated', { antiId })
    
    const { dataStore } = createStorageContainer()
    await dataStore.deleteUserData(antiId)
    
    logger.info('Cache cleared successfully', { antiId })
    
    return { 
      success: true, 
      refreshedAt: new Date(),
      message: 'Cache cleared successfully'
    }
  } catch (error) {
    logger.error('Failed to clear cache', error instanceof Error ? error : new Error(String(error)), { antiId })
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Run cleanup of inactive users
 */
export async function runCleanup(): Promise<{ success: boolean; cleanedCount: number; cleanedUsers: string[] }> {
  try {
    logger.info('Running inactive user cleanup')
    
    const { dataStore } = createStorageContainer()
    const cleanedUsers = await dataStore.cleanupInactiveUsers()
    
    logger.info('Cleanup completed', { cleanedCount: cleanedUsers.length })
    
    return { 
      success: true, 
      cleanedCount: cleanedUsers.length,
      cleanedUsers
    }
  } catch (error) {
    logger.error('Failed to run cleanup', error instanceof Error ? error : new Error(String(error)))
    return { success: false, cleanedCount: 0, cleanedUsers: [] }
  }
}

/**
 * Default export for Antispace routing system
 */
export default async function handler(c: any): Promise<any> {
  const method = c.req.method
  const action = c.req.query('action') || 'status' // Default to status
  
  // Auto-start scheduler on first request if not running
  if (!isCleanupSchedulerRunning()) {
    logger.info('Auto-starting cleanup scheduler on first cache request')
    startCleanupScheduler()
  }
  
  try {
    if (method === 'GET' && action === 'status') {
      // GET /cache?action=status&antiId=... - Get cache status for a user
      const antiId = c.req.query('antiId')
      if (!antiId) {
        return c.json({ error: 'antiId parameter required' }, 400)
      }
      
      const status = await getCacheStatus(antiId)
      const cleanupStatus = getCleanupStatus()
      
      return c.json({
        ...status,
        scheduler: cleanupStatus
      })
    }
    
    if (method === 'POST' && action === 'refresh') {
      // POST /cache?action=refresh - Refresh user cache
      const body = await c.req.json()
      const { antiId } = body
      
      if (!antiId) {
        return c.json({ error: 'antiId required in request body' }, 400)
      }
      
      const result = await refreshUserCache(antiId)
      return c.json(result, result.success ? 200 : 400)
    }
    
    if (method === 'POST' && action === 'clear') {
      // POST /cache?action=clear - Clear user cache
      const body = await c.req.json()
      const { antiId } = body
      
      if (!antiId) {
        return c.json({ error: 'antiId required in request body' }, 400)
      }
      
      const result = await clearUserCache(antiId)
      return c.json(result, result.success ? 200 : 400)
    }
    
    if ((method === 'POST' || method === 'GET') && action === 'cleanup') {
      // POST|GET /cache?action=cleanup - Run cleanup process
      const result = await runCleanup()
      return c.json(result)
    }
    
    if (method === 'POST' && action === 'start-scheduler') {
      // POST /cache?action=start-scheduler - Start the automatic cleanup scheduler
      if (isCleanupSchedulerRunning()) {
        return c.json({ 
          success: false,
          message: 'Scheduler is already running',
          status: getCleanupStatus()
        })
      }
      
      try {
        startCleanupScheduler()
        return c.json({ 
          success: true,
          message: 'Cleanup scheduler started successfully',
          status: getCleanupStatus()
        })
      } catch (error) {
        return c.json({ 
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }, 500)
      }
    }
    
    return c.json({ 
      error: 'Invalid action',
      availableActions: ['status', 'refresh', 'clear', 'cleanup', 'start-scheduler'],
      usage: 'GET /cache?action=status&antiId=USER_ID'
    }, 400)
    
  } catch (error) {
    logger.error('Cache endpoint error', error instanceof Error ? error : new Error(String(error)))
    return c.json({ error: 'Internal Server Error' }, 500)
  }
} 