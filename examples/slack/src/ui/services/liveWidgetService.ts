import { getWidgetData, getConversationsForWidget } from '../../routes/widget-data/index.js'
import { logger } from '../../util/logger'
import { getUser } from '../../util/index.js'
import { handleSlackActions } from '../../ai/handlers/slack.js'
import { reconcileUserUnreadCounts } from '../../storage/reconciliation'

/**
 * Live Widget Data Interface - Optimized for automatic refresh
 */
export interface LiveWidgetData {
  totalUnread: number
  conversations: Array<{
    id: string
    displayName: string
    type: string
    unreadCount: number
    lastMessage?: string
    lastActivity?: string
    hasUnread: boolean
    isNew?: boolean // Highlight new activity
    slackChannelId?: string // For quick actions
  }>
  lastUpdate: string
  error?: string
  backgroundSyncTriggered?: boolean
}

/**
 * Sync Status Interface - Shows real-time sync state
 */
export interface SyncStatus {
  isLive: boolean
  isFirstSync: boolean
  isSyncing: boolean
  progress: number
  lastSync?: string
  cacheActive: boolean
  eventsConnected: boolean
  error?: string
}

/**
 * Fetch live widget data optimized for frequent polling
 * Uses smart caching and change detection to minimize database load
 */
export async function fetchLiveWidgetData(userId: string): Promise<LiveWidgetData> {
  try {
    const widgetData = await getWidgetData(userId)
    
    return {
      totalUnread: widgetData.totalUnread,
      conversations: widgetData.conversations.map(conv => ({
        id: conv.id,
        displayName: conv.displayName,
        type: 'channel', // TODO: Get actual type from data
        unreadCount: conv.unreadCount,
        lastMessage: conv.lastMessage,
        lastActivity: conv.lastActivity,
        hasUnread: conv.unreadCount > 0,
        isNew: false, // TODO: Implement new message detection
        slackChannelId: conv.slackChannelId // Use the actual Slack channel ID
      })),
      lastUpdate: new Date().toISOString(),
      error: widgetData.error,
      backgroundSyncTriggered: widgetData.backgroundSyncTriggered
    }
  } catch (error) {
    logger.error('Failed to fetch live widget data', error instanceof Error ? error : new Error(String(error)), { userId })
    
    return {
      totalUnread: 0,
      conversations: [],
      lastUpdate: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Failed to fetch widget data'
    }
  }
}

/**
 * Check sync status for live indicators
 */
export async function checkSyncStatus(userId: string): Promise<SyncStatus> {
  try {
    // For now, return a basic status - TODO: Implement real sync status checking
    return {
      isLive: true,
      isFirstSync: false,
      isSyncing: false,
      progress: 100,
      lastSync: new Date().toISOString(),
      cacheActive: true,
      eventsConnected: true
    }
  } catch (error) {
    logger.error('Failed to check sync status', error instanceof Error ? error : new Error(String(error)), { userId })
    
    return {
      isLive: false,
      isFirstSync: false,
      isSyncing: false,
      progress: 0,
      cacheActive: false,
      eventsConnected: false,
      error: error instanceof Error ? error.message : 'Failed to check sync status'
    }
  }
}

/**
 * Handle quick actions with optimistic updates
 */
export async function handleQuickAction(action: string, values: any, userId: string): Promise<void> {
  try {
    // Parse action format: "action_name:channel_id"
    const [actionName, channelId] = action.split(':')
    
    switch (actionName) {
      case 'mark_as_read':
        if (channelId) {
          await markConversationAsRead(userId, channelId)
        }
        break
        
      case 'toggle_mute':
        if (channelId) {
          await toggleMuteConversation(userId, channelId)
        }
        break
        
      case 'open_in_slack':
        if (channelId) {
          await openInSlack(userId, channelId)
        }
        break
        
      case 'refresh_cache':
        await refreshUserCache(userId)
        break
        
      case 'logoutSlack':
        // Handle logout action - will be processed by main widget
        break
        
      case 'reconcile_unread':
        await reconcileUserUnreadCounts(userId)
        break
        
      default:
        logger.warn('Unknown quick action', { action, userId })
    }
  } catch (error) {
    logger.error('Quick action failed', error instanceof Error ? error : new Error(String(error)), { action, userId })
    // Don't throw - let widget handle gracefully on next refresh
  }
}

/**
 * Mark conversation as read via AI function
 */
async function markConversationAsRead(userId: string, channelId: string): Promise<void> {
  try {
    const user = await getUser(userId)
    if (!user) {
      throw new Error('User not found')
    }
    
    await handleSlackActions('markConversationAsRead', { conversationIdentifier: channelId }, user)
    logger.info('Mark as read action completed', { userId, channelId })
  } catch (error) {
    logger.error('Failed to mark conversation as read', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
    throw error
  }
}

/**
 * Toggle mute/unmute conversation
 */
async function toggleMuteConversation(userId: string, channelId: string): Promise<void> {
  try {
    // TODO: Implement mute/unmute functionality when available in Slack API
    logger.info('Toggle mute action (not yet implemented)', { userId, channelId })
  } catch (error) {
    logger.error('Failed to toggle mute conversation', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
    throw error
  }
}

/**
 * Open conversation in Slack app
 */
async function openInSlack(userId: string, channelId: string): Promise<void> {
  try {
    // TODO: This would typically open a deep link or redirect to Slack
    // For now, just log the action
    logger.info('Open in Slack action (not yet implemented)', { userId, channelId })
  } catch (error) {
    logger.error('Failed to open in Slack', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
    throw error
  }
}

/**
 * Mute conversation via AI function (legacy function)
 */
async function muteConversation(userId: string, channelId: string): Promise<void> {
  try {
    // TODO: Implement via AI function
    logger.info('Mute conversation action', { userId, channelId })
  } catch (error) {
    logger.error('Failed to mute conversation', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
    throw error
  }
}

/**
 * Refresh user cache
 */
async function refreshUserCache(userId: string): Promise<void> {
  try {
    // TODO: Implement cache refresh
    logger.info('Cache refresh action', { userId })
  } catch (error) {
    logger.error('Failed to refresh cache', error instanceof Error ? error : new Error(String(error)), { userId })
    throw error
  }
}

/**
 * Reconcile unread counts for the user
 */
async function reconcileUnreadCounts(userId: string): Promise<void> {
  try {
    logger.info('Starting unread count reconciliation', { userId })
    await reconcileUserUnreadCounts(userId)
    logger.info('Unread count reconciliation completed successfully', { userId })
  } catch (error) {
    logger.error('Failed to reconcile unread counts', error instanceof Error ? error : new Error(String(error)), { userId })
    throw error
  }
} 