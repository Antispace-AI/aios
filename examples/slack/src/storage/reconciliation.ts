import { createStorageContainer } from './implementations/postgres/container'
import { logger } from '../util/logger'

/**
 * Data reconciliation utilities
 * Fixes data inconsistencies that can occur when the server is offline
 */

/**
 * Reconcile unread counts for all users
 * This should be called on server startup to fix any inconsistencies
 */
export async function reconcileAllUnreadCounts(): Promise<{
  success: boolean
  usersProcessed: number
  errors: string[]
}> {
  logger.info('Starting unread count reconciliation for all users')
  
  const errors: string[] = []
  let usersProcessed = 0
  
  try {
    const storageContainer = createStorageContainer()
    const dataStore = storageContainer.dataStore
    
    // Get all users that need reconciliation
    const usersResult = await storageContainer.connection.query(`
      SELECT DISTINCT u.id, u.anti_id 
      FROM users u 
      JOIN conversations c ON u.id = c.user_id
    `)
    
    const users = usersResult.rows
    logger.info(`Found ${users.length} users requiring unread count reconciliation`)
    
    // Process each user
    for (const user of users) {
      try {
        logger.info('Reconciling unread counts for user', { 
          antiId: user.anti_id,
          userUuid: user.id 
        })
        
        await dataStore.recalculateAllUnreadCounts(user.id)
        usersProcessed++
        
        logger.info('Successfully reconciled unread counts for user', { 
          antiId: user.anti_id,
          userUuid: user.id 
        })
        
      } catch (userError) {
        const errorMsg = `Failed to reconcile unread counts for user ${user.anti_id}: ${userError instanceof Error ? userError.message : String(userError)}`
        errors.push(errorMsg)
        logger.error('User reconciliation failed', userError instanceof Error ? userError : new Error(String(userError)), { 
          antiId: user.anti_id,
          userUuid: user.id 
        })
      }
    }
    
    logger.info('Unread count reconciliation completed', {
      usersProcessed,
      totalUsers: users.length,
      errors: errors.length
    })
    
    return {
      success: errors.length === 0,
      usersProcessed,
      errors
    }
    
  } catch (error) {
    const errorMsg = `Unread count reconciliation failed: ${error instanceof Error ? error.message : String(error)}`
    logger.error('Global reconciliation failed', error instanceof Error ? error : new Error(String(error)))
    
    return {
      success: false,
      usersProcessed,
      errors: [errorMsg, ...errors]
    }
  }
}

/**
 * Reconcile unread counts for a specific user
 */
export async function reconcileUserUnreadCounts(antiId: string): Promise<{
  success: boolean
  error?: string
}> {
  try {
    const storageContainer = createStorageContainer()
    const dataStore = storageContainer.dataStore
    
    // Get user UUID
    const user = await dataStore.getUser(antiId)
    if (!user) {
      return {
        success: false,
        error: `User not found: ${antiId}`
      }
    }
    
    logger.info('Reconciling unread counts for specific user', { antiId, userUuid: user.id })
    
    await dataStore.recalculateAllUnreadCounts(user.id)
    
    logger.info('Successfully reconciled unread counts for user', { antiId, userUuid: user.id })
    
    return { success: true }
    
  } catch (error) {
    const errorMsg = `Failed to reconcile unread counts for user ${antiId}: ${error instanceof Error ? error.message : String(error)}`
    logger.error('User reconciliation failed', error instanceof Error ? error : new Error(String(error)), { antiId })
    
    return {
      success: false,
      error: errorMsg
    }
  }
}

/**
 * Check if reconciliation is needed
 * Returns true if there are significant unread count mismatches
 */
export async function isReconciliationNeeded(): Promise<{
  needed: boolean
  mismatches: number
  details?: string
}> {
  try {
    const storageContainer = createStorageContainer()
    
    // Check for conversations with NULL last_read_ts that have messages
    const nullReadStateResult = await storageContainer.connection.query(`
      SELECT COUNT(*) as count
      FROM conversations c
      WHERE c.last_read_ts IS NULL
        AND EXISTS (
          SELECT 1 FROM messages m 
          WHERE m.conversation_id = c.id 
            AND m.is_deleted = false 
            AND m.message_type != 'tombstone'
        )
    `)
    
    const nullReadStateCount = parseInt(nullReadStateResult.rows[0]?.count || '0')
    
    // Check for mismatches between stored count and actual count
    const mismatchResult = await storageContainer.connection.query(`
      SELECT COUNT(*) as count
      FROM conversations c
      LEFT JOIN (
        SELECT 
          conversation_id,
          COUNT(*) as actual_count
        FROM messages m
        JOIN conversations c2 ON m.conversation_id = c2.id
        WHERE 
          (c2.last_read_ts IS NULL OR m.message_ts > c2.last_read_ts)
          AND m.is_deleted = false
          AND m.message_type != 'tombstone'
        GROUP BY conversation_id
      ) actual_unread ON c.id = actual_unread.conversation_id
      WHERE c.unread_count != COALESCE(actual_unread.actual_count, 0)
    `)
    
    const mismatchCount = parseInt(mismatchResult.rows[0]?.count || '0')
    const totalMismatches = nullReadStateCount + mismatchCount
    
    logger.info('Reconciliation check completed', {
      nullReadStates: nullReadStateCount,
      mismatches: mismatchCount,
      totalIssues: totalMismatches
    })
    
    return {
      needed: totalMismatches > 0,
      mismatches: totalMismatches,
      details: `Found ${nullReadStateCount} conversations with NULL read state and ${mismatchCount} count mismatches`
    }
    
  } catch (error) {
    logger.error('Failed to check if reconciliation is needed', error instanceof Error ? error : new Error(String(error)))
    
    return {
      needed: true, // Default to needing reconciliation if we can't check
      mismatches: 0,
      details: `Error checking: ${error instanceof Error ? error.message : String(error)}`
    }
  }
} 