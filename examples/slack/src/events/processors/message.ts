// Message Event Handler - Handle message events with storage integration
import { SlackEventData, SlackMessageEvent } from '../types/events'
import { SlackDataStore } from '../../storage/interfaces/slack-data-store'
import { logger } from '../../util/logger'

// Global storage instance (will be injected later)
let dataStore: SlackDataStore | null = null

export function setDataStore(store: SlackDataStore): void {
  dataStore = store
}

/**
 * Handle message events from Slack Events API
 * PURPOSE: Lightweight cache updates only - store the event data quickly
 * NO Slack API calls, NO complex enrichment, NO heavy processing
 */
export async function handleMessageEvent(eventData: SlackEventData, userId: string): Promise<void> {
  if (!dataStore) {
    logger.error('DataStore not initialized in message processor')
    return
  }

  const event = eventData.event as SlackMessageEvent
  
  logger.info('Processing message event for cache update', {
    userId,
    eventType: event.type,
    subtype: event.subtype,
    channel: event.channel,
    messageTs: event.ts
  })

  try {
    // Handle different message event types with minimal processing
    if (event.subtype === 'message_changed') {
      await handleMessageChanged(event, userId)
    } else if (event.subtype === 'message_deleted') {
      await handleMessageDeleted(event, userId)
    } else if (event.subtype === 'bot_message') {
      await handleBotMessage(event, userId)
    } else if (shouldSkipMessage(event)) {
      logger.debug('Skipping system message', {
        userId,
        subtype: event.subtype,
        channel: event.channel
      })
      return
    } else {
      await handleRegularMessage(event, userId)
    }
    
  } catch (error) {
    logger.error('Failed to process message event', error instanceof Error ? error : new Error(String(error)), {
      userId,
      eventType: event.type,
      subtype: event.subtype,
      channel: event.channel,
      messageTs: event.ts
    })
    throw error
  }
}

/**
 * Handle regular user messages - LIGHTWEIGHT cache update only
 * Target: Single transaction, 1-2 queries maximum
 */
async function handleRegularMessage(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')

  // Regular messages should have a user field
  if (!event.user) {
    logger.warn('Regular message missing user field, skipping', {
      userId,
      channel: event.channel,
      messageTs: event.ts,
      subtype: event.subtype
    })
    return
  }

  // LIGHTWEIGHT: Store message with minimal conversation setup
  await dataStore.storeMessageQuick({
    userId,
    slackChannelId: event.channel,
    messageTs: event.ts,
    threadTs: event.thread_ts,
    text: event.text || '',
    messageType: event.thread_ts ? 'reply' : 'message',
    subtype: event.subtype,
    slackUserId: event.user,
    hasFiles: event.files && event.files.length > 0,
    hasReactions: event.reactions && event.reactions.length > 0,
    hasReplies: (event.reply_count || 0) > 0,
    replyCount: event.reply_count || 0,
    slackTimestamp: event.ts
  })

  logger.info('Message cached successfully', {
    userId,
    channel: event.channel,
    messageTs: event.ts,
    isThread: !!event.thread_ts
  })
}

/**
 * Handle message edits - LIGHTWEIGHT cache update
 */
async function handleMessageChanged(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')
  
  // In message_changed events, the actual message data is nested in event.message
  const messageData = (event as any).message
  if (!messageData) {
    logger.warn('message_changed event missing message data', { userId, channel: event.channel })
    return
  }

  await dataStore.storeMessageQuick({
    userId,
    slackChannelId: event.channel,
    messageTs: messageData.ts,
    threadTs: messageData.thread_ts,
    text: messageData.text || '',
    messageType: 'edit',
    subtype: event.subtype,
    slackUserId: messageData.user,
    hasFiles: messageData.files && messageData.files.length > 0,
    hasReactions: messageData.reactions && messageData.reactions.length > 0,
    hasReplies: (messageData.reply_count || 0) > 0,
    replyCount: messageData.reply_count || 0,
    slackTimestamp: messageData.ts
  })

  logger.info('Message edit cached', {
    userId,
    channel: event.channel,
    messageTs: messageData.ts
  })
}

/**
 * Handle message deletions - LIGHTWEIGHT cache update
 */
async function handleMessageDeleted(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')
  
  const deletedTs = (event as any).deleted_ts
  if (!deletedTs) {
    logger.warn('message_deleted event missing deleted_ts', { userId, channel: event.channel })
    return
  }

  // Mark message as deleted in cache
  await dataStore.markMessageDeleted(userId, event.channel, deletedTs)

  logger.info('Message deletion cached', {
    userId,
    channel: event.channel,
    deletedTs
  })
}

/**
 * Handle bot messages - LIGHTWEIGHT cache update
 */
async function handleBotMessage(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')

  const botUsername = (event as any).username || 'Bot'

  await dataStore.storeMessageQuick({
    userId,
    slackChannelId: event.channel,
    messageTs: event.ts,
    threadTs: event.thread_ts,
    text: event.text || '',
    messageType: 'message',
    subtype: event.subtype,
    slackUserId: undefined, // Bot messages don't have a user ID 
    botId: event.bot_id || 'unknown_bot',
    hasFiles: event.files && event.files.length > 0,
    hasReactions: event.reactions && event.reactions.length > 0,
    hasReplies: false,
    replyCount: 0,
    slackTimestamp: event.ts
  })

  logger.info('Bot message cached', {
    userId,
    channel: event.channel,
    messageTs: event.ts,
    botId: event.bot_id,
    username: botUsername
  })
}

/**
 * Check if we should skip storing this message
 * Skip system messages that aren't relevant for cache
 */
function shouldSkipMessage(event: SlackMessageEvent): boolean {
  const skipSubtypes = [
    'channel_join',
    'channel_leave',
    'channel_topic',
    'channel_purpose',
    'channel_name',
    'channel_archive',
    'channel_unarchive',
    'pinned_item',
    'unpinned_item',
    'group_join',
    'group_leave',
    'group_topic',
    'group_purpose',
    'group_name',
    'group_archive',
    'group_unarchive'
  ]

  // Skip if it's a system message we don't care about
  if (event.subtype && skipSubtypes.includes(event.subtype)) {
    return true
  }

  // Skip hidden messages (they're metadata, not user content)
  if ((event as any).hidden === true) {
    return true
  }

  return false
} 