// Event Router - Routes Slack events to appropriate handlers with storage integration
import { SlackEvent, SlackEventData } from '../types/events'
import { logger } from '../../util/logger'
import { getUser } from '../../util'
import { handleMessageEvent, initializeMessageHandler } from './message'
import { handleUserEvent } from './user'
import { createStorageContainer, type StorageContainer } from '../../storage'

// Global storage container
let storageContainer: StorageContainer | null = null

/**
 * Initialize the event router with storage
 */
export function initializeEventRouter() {
  try {
    if (!storageContainer) {
      storageContainer = createStorageContainer()
      
      // Initialize individual handlers with storage
      initializeMessageHandler(storageContainer.dataStore)
      
      logger.info('Event router initialized with storage')
    }
  } catch (error) {
    logger.error('Failed to initialize event router with storage', error instanceof Error ? error : new Error(String(error)))
    // Continue without storage - handlers will log warnings
  }
}

// Event handler registry
type EventHandler = (event: SlackEventData, userId: string) => Promise<void>

const eventHandlers: Record<string, EventHandler> = {
  // Message events
  'message': handleMessageEvent,
  
  // Channel marked events (unread count tracking)
  'channel_marked': handleChannelMarkedEvent,
  'group_marked': handleChannelMarkedEvent,
  'im_marked': handleChannelMarkedEvent,
  'mpim_marked': handleChannelMarkedEvent,
  
  // User events
  'presence_change': handleUserEvent,
  'user_change': handleUserEvent,
  
  // Channel lifecycle events
  'channel_created': handleChannelEvent,
  'channel_deleted': handleChannelEvent,
  'channel_archive': handleChannelEvent,
  'channel_unarchive': handleChannelEvent,
  
  // App lifecycle events
  'app_uninstalled': handleAppUninstalledEvent,
  'tokens_revoked': handleTokensRevokedEvent
}

// Event deduplication cache (in-memory for now, should be Redis in production)
const processedEvents = new Set<string>()
const DEDUP_CACHE_SIZE = 10000
const DEDUP_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Main event router - routes Slack events to appropriate handlers
 */
export async function routeSlackEvent(
  event: SlackEvent, 
  eventId: string,
  teamId: string,
  eventTime: number
): Promise<void> {
  try {
    // Initialize storage if not already done
    if (!storageContainer) {
      initializeEventRouter()
    }

    // Event deduplication
    if (processedEvents.has(eventId)) {
      logger.info('Event already processed, skipping', { eventId, eventType: event.type })
      return
    }

    // Find user by team_id (OAuth integration)
    const user = await findUserByTeamId(teamId)
    if (!user) {
      logger.warn('No user found for team_id, skipping event', { teamId, eventId, eventType: event.type })
      return
    }

    // Create event data structure
    const eventData: SlackEventData = {
      eventId,
      userId: user.antiId,
      teamId,
      eventType: event.type,
      eventTime,
      event,
      processedAt: new Date().toISOString()
    }

    // Route to appropriate handler
    const handler = eventHandlers[event.type]
    if (!handler) {
      logger.warn('No handler found for event type', { eventType: event.type, eventId })
      return
    }

    // Execute handler
    await handler(eventData, user.antiId)

    // Mark as processed
    addToDeduplicationCache(eventId)

    logger.info('Event processed successfully', { 
      eventType: event.type, 
      eventId, 
      userId: user.antiId 
    })

  } catch (error) {
    logger.error('Error routing Slack event', error instanceof Error ? error : new Error(String(error)), {
      eventId, 
      eventType: event.type,
      teamId
    })
    
    // Re-throw for retry logic in webhook handler
    throw error
  }
}

/**
 * Find user by Slack team_id using PostgreSQL storage
 */
async function findUserByTeamId(teamId: string): Promise<{ antiId: string } | null> {
  try {
    if (!storageContainer?.dataStore) {
      logger.error('Storage container not available for user lookup')
      return null
    }

    // Query PostgreSQL directly for user with matching team_id
    const result = await storageContainer.connection.query(
      'SELECT anti_id FROM users WHERE team_id = $1 LIMIT 1',
      [teamId]
    )

    if (result.rows.length === 0) {
      logger.debug('No user found for team_id', { teamId })
      return null
    }

    const antiId = result.rows[0].anti_id
    logger.debug('Found user for team_id', { teamId, antiId })
    return { antiId }

  } catch (error) {
    logger.error('Error finding user by team_id', error instanceof Error ? error : new Error(String(error)), { teamId })
    return null
  }
}

/**
 * Handle channel marked events (unread count tracking)
 */
async function handleChannelMarkedEvent(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event as any // Channel marked events have similar structure
  
  logger.info('Processing channel marked event', {
    eventType: eventData.eventType,
    channel: event.channel,
    ts: event.ts,
    unreadCount: event.unread_count,
    userId
  })

  // TODO: Update conversation read state in storage
  if (storageContainer?.dataStore) {
    try {
      await storageContainer.dataStore.markConversationAsRead(userId, event.channel, event.ts)
      logger.info('Conversation marked as read', { userId, channel: event.channel })
    } catch (error) {
      logger.error('Failed to mark conversation as read', error instanceof Error ? error : new Error(String(error)), { userId, channel: event.channel })
    }
  } else {
    logger.warn('Storage not available for marking conversation as read')
  }
}

/**
 * Handle channel lifecycle events
 */
async function handleChannelEvent(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event as any
  
  logger.info('Processing channel event', {
    eventType: eventData.eventType,
    channel: event.channel,
    userId
  })

  // TODO: Update channel state in storage
  // This will be implemented when channel management is ready
  logger.debug('Channel state updates not yet implemented')
}

/**
 * Handle app uninstalled event
 */
async function handleAppUninstalledEvent(eventData: SlackEventData, userId: string): Promise<void> {
  logger.warn('App uninstalled event received', {
    userId,
    teamId: eventData.teamId,
    eventId: eventData.eventId
  })

  // TODO: Clean up user data and revoke tokens
  if (storageContainer?.dataStore) {
    try {
      await storageContainer.dataStore.deleteUserData(userId)
      logger.info('User data cleaned up after app uninstall', { userId })
    } catch (error) {
      logger.error('Failed to clean up user data', error instanceof Error ? error : new Error(String(error)), { userId })
    }
  } else {
    logger.warn('Storage not available for user data cleanup')
  }
}

/**
 * Handle tokens revoked event
 */
async function handleTokensRevokedEvent(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event as any
  
  logger.warn('Tokens revoked event received', {
    userId,
    teamId: eventData.teamId,
    tokens: event.tokens,
    eventId: eventData.eventId
  })

  // TODO: Update token status in storage
  // This will be implemented when token management is ready
  logger.debug('Token revocation handling not yet implemented')
}

/**
 * Add event to deduplication cache
 */
function addToDeduplicationCache(eventId: string): void {
  processedEvents.add(eventId)
  
  // Limit cache size to prevent memory leaks
  if (processedEvents.size > DEDUP_CACHE_SIZE) {
    const toDelete = Math.floor(DEDUP_CACHE_SIZE * 0.1) // Remove 10%
    const iterator = processedEvents.values()
    for (let i = 0; i < toDelete; i++) {
      const { value, done } = iterator.next()
      if (!done) {
        processedEvents.delete(value)
      }
    }
  }
}

/**
 * Check if event was already processed
 */
export function isEventProcessed(eventId: string): boolean {
  return processedEvents.has(eventId)
}

/**
 * Clear event cache (for testing)
 */
export function clearEventCache(): void {
  processedEvents.clear()
} 