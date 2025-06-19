import { getUser } from '../../util'
import { createStorageContainer } from '../../storage/implementations/postgres/container'
import { logger } from '../../util/logger'
import { SlackSyncOrchestrator } from '../../storage/data-sync'

/**
 * Widget Data Endpoint for Week 4
 * Optimized data for Widget UI component
 */

interface WidgetData {
  totalUnread: number
  conversations: Array<{
    id: string
    displayName: string
    unreadCount: number
    lastMessage?: string
    lastActivity?: string
  }>
  isActive: boolean
  lastRefresh?: string
  error?: string
  backgroundSyncTriggered?: boolean
}

/**
 * Get optimized data for Widget UI component
 * ENHANCED: Now triggers background sync when cache is empty
 */
export async function getWidgetData(antiId: string): Promise<WidgetData> {
  try {
    const { dataStore } = createStorageContainer()
    const user = await dataStore.getUser(antiId)
    
    if (!user) {
      return { 
        error: 'Not authenticated',
        totalUnread: 0,
        conversations: [],
        isActive: false
      }
    }

    const [unreadSummary, conversations, cacheStatus] = await Promise.all([
      dataStore.getUnreadSummary(user.id),
      dataStore.getConversationList({ 
        userId: user.id, 
        limit: 10,
        unreadOnly: true 
      }),
      dataStore.isUserCacheActive(antiId)
    ])
    
    // Check if cache is empty and trigger background sync
    let backgroundSyncTriggered = false
    if (unreadSummary.totalUnread === 0 && conversations.length === 0) {
      logger.info('First widget access or empty cache - initiating background data sync', { antiId })
      
      // Trigger background sync without blocking the response
      setImmediate(async () => {
        try {
          const orchestrator = new SlackSyncOrchestrator(dataStore, antiId)
          const syncResult = await orchestrator.fullSync()
          logger.info('Background sync completed for widget access', {
            antiId,
            success: syncResult.success,
            conversationsSync: syncResult.conversationsSync,
            messagesSync: syncResult.messagesSync
          })
        } catch (error) {
          logger.warn('Background sync failed for widget access', { 
            antiId, 
            error: error instanceof Error ? error.message : error 
          })
        }
      })
      
      backgroundSyncTriggered = true
    }
    
    return {
      totalUnread: unreadSummary.totalUnread,
      conversations: conversations.map(conv => ({
        id: conv.id,
        displayName: conv.displayName || `Channel ${conv.id}`,
        unreadCount: conv.unreadCount,
        lastMessage: conv.lastMessagePreview,
        lastActivity: conv.formattedTime
      })),
      isActive: cacheStatus,
      lastRefresh: user.updatedAt,
      backgroundSyncTriggered
    }
  } catch (error) {
    logger.error('Failed to get widget data', error instanceof Error ? error : new Error(String(error)), { antiId })
    return {
      error: error instanceof Error ? error.message : String(error),
      totalUnread: 0,
      conversations: [],
      isActive: false
    }
  }
}

/**
 * Get all conversations for Widget sidebar
 */
export async function getConversationsForWidget(antiId: string, limit: number = 20): Promise<{
  success: boolean
  conversations: Array<{
    id: string
    displayName: string
    type: string
    unreadCount: number
    lastMessage?: string
    lastActivity?: string
    hasUnread: boolean
  }>
  error?: string
}> {
  try {
    const { dataStore } = createStorageContainer()
    const user = await dataStore.getUser(antiId)
    
    if (!user) {
      return { 
        success: false,
        error: 'Not authenticated',
        conversations: []
      }
    }

    const conversations = await dataStore.getConversationList({ 
      userId: user.id, 
      limit,
      // Don't filter by unread - show all conversations
    })
    
    return {
      success: true,
      conversations: conversations.map(conv => ({
        id: conv.id,
        displayName: conv.displayName || `Channel ${conv.id}`,
        type: conv.type,
        unreadCount: conv.unreadCount,
        lastMessage: conv.lastMessagePreview,
        lastActivity: conv.formattedTime,
        hasUnread: conv.hasUnread
      }))
    }
  } catch (error) {
    logger.error('Failed to get conversations for widget', error instanceof Error ? error : new Error(String(error)), { antiId })
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      conversations: []
    }
  }
}

/**
 * Default export for Antispace routing system
 */
export default async function handler(c: any): Promise<any> {
  const path = c.req.path
  const method = c.req.method
  
  try {
    if (method === 'GET' && path.endsWith('/widget-data')) {
      // GET /widget-data - Get complete widget data
      const antiId = c.req.query('antiId')
      if (!antiId) {
        return c.json({ error: 'antiId parameter required' }, 400)
      }
      
      const data = await getWidgetData(antiId)
      return c.json(data)
    }
    
    if (method === 'GET' && path.endsWith('/conversations')) {
      // GET /widget-data/conversations - Get conversations for widget
      const antiId = c.req.query('antiId')
      const limitStr = c.req.query('limit')
      const limit = limitStr ? parseInt(limitStr) : 20
      
      if (!antiId) {
        return c.json({ error: 'antiId parameter required' }, 400)
      }
      
      const result = await getConversationsForWidget(antiId, limit)
      return c.json(result)
    }
    
    return c.json({ error: 'Not Found' }, 404)
    
  } catch (error) {
    logger.error('Widget data endpoint error', error instanceof Error ? error : new Error(String(error)))
    return c.json({ error: 'Internal Server Error' }, 500)
  }
} 