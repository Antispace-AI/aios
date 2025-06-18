// Message Event Handler - Handle message events with storage integration
import { SlackEventData, SlackMessageEvent } from '../types/events'
import { SlackDataStore } from '../../cache/interfaces/slack-data-store'
import { logger } from '../../util/logger'

// Global storage instance (will be injected later)
let dataStore: SlackDataStore | null = null

/**
 * Initialize the message handler with storage
 */
export function initializeMessageHandler(storage: SlackDataStore) {
  dataStore = storage
  logger.info('Message handler initialized with storage')
}

/**
 * Handle message events from Slack
 * This includes regular messages, bot messages, message edits, and system messages
 */
export async function handleMessageEvent(eventData: SlackEventData, userId: string): Promise<void> {
  if (!dataStore) {
    logger.error('DataStore not initialized in message processor')
    return
  }

  const event = eventData.event as SlackMessageEvent
  
  logger.info('Processing message event', {
    userId,
    eventType: event.type,
    subtype: event.subtype,
    channel: event.channel,
    hasUser: !!event.user,
    hasBotId: !!event.bot_id,
    messageTs: event.ts
  })

  try {
    // Handle different message event types
    if (event.subtype === 'message_changed') {
      await handleMessageChanged(event, userId)
    } else if (event.subtype === 'message_deleted') {
      await handleMessageDeleted(event, userId)
    } else if (event.subtype === 'bot_message') {
      await handleBotMessage(event, userId)
    } else if (shouldSkipMessage(event)) {
      logger.info('Skipping system message', {
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
 * Handle message_changed events (message edits)
 * Structure: { subtype: 'message_changed', message: { user, text, ts, ... }, ts, channel }
 */
async function handleMessageChanged(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')
  
  // In message_changed events, the actual message data is nested in event.message
  const messageData = (event as any).message
  if (!messageData) {
    logger.warn('message_changed event missing message data', { userId, channel: event.channel })
    return
  }

  const slackUserId = messageData.user
  const slackUserName = messageData.username || 'Unknown'

     await dataStore.storeMessage({
     userId,
     conversationId: event.channel, // This will be resolved to conversation UUID by storage layer
     slackChannelId: event.channel,
     messageTs: messageData.ts,
     threadTs: messageData.thread_ts,
     text: messageData.text || '',
     messageType: 'edit',
     subtype: event.subtype,
     slackUserId,
     slackUserName,
     botId: messageData.bot_id,
     hasFiles: messageData.files && messageData.files.length > 0,
     hasReactions: messageData.reactions && messageData.reactions.length > 0,
     hasReplies: (messageData.reply_count || 0) > 0,
     replyCount: messageData.reply_count || 0,
     slackTimestamp: messageData.ts
   })

  logger.info('Message edit processed', {
    userId,
    channel: event.channel,
    messageTs: messageData.ts,
    hasUser: !!slackUserId
  })
}

/**
 * Handle message_deleted events
 * We'll mark the message as deleted rather than removing it
 */
async function handleMessageDeleted(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')
  
  const deletedTs = (event as any).deleted_ts
  if (!deletedTs) {
    logger.warn('message_deleted event missing deleted_ts', { userId, channel: event.channel })
    return
  }

     // For deletion events, we'll try to update existing message or create a tombstone
   await dataStore.storeMessage({
     userId,
     conversationId: event.channel, // This will be resolved to conversation UUID by storage layer
     slackChannelId: event.channel,
     messageTs: deletedTs,
     text: '[Message deleted]',
     messageType: 'tombstone',
     subtype: event.subtype,
     slackUserId: undefined, // Deletion events may not have user info
     slackUserName: undefined,
     hasFiles: false,
     hasReactions: false,
     hasReplies: false,
     replyCount: 0,
     slackTimestamp: deletedTs
   })

  logger.info('Message deletion processed', {
    userId,
    channel: event.channel,
    deletedTs
  })
}

/**
 * Handle bot messages
 * Structure: { subtype: 'bot_message', bot_id, username, text, ts, ... }
 */
async function handleBotMessage(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')

  const botId = event.bot_id
  const botUsername = (event as any).username || 'Bot'

     await dataStore.storeMessage({
     userId,
     conversationId: event.channel, // This will be resolved to conversation UUID by storage layer
     slackChannelId: event.channel,
     messageTs: event.ts,
     threadTs: event.thread_ts,
     text: event.text || '',
     messageType: 'message',
     subtype: event.subtype,
     slackUserId: undefined, // Bot messages don't have a user ID
     slackUserName: botUsername,
     botId,
     hasFiles: event.files && event.files.length > 0,
     hasReactions: event.reactions && event.reactions.length > 0,
     hasReplies: false,
     replyCount: 0,
     slackTimestamp: event.ts
   })

  logger.info('Bot message processed', {
    userId,
    channel: event.channel,
    messageTs: event.ts,
    botId,
    botUsername
  })
}

/**
 * Handle regular user messages
 */
async function handleRegularMessage(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')

  // Regular messages should have a user field
  if (!event.user) {
    logger.warn('Regular message missing user field', {
      userId,
      channel: event.channel,
      messageTs: event.ts,
      subtype: event.subtype
    })
    return
  }

     await dataStore.storeMessage({
     userId,
     conversationId: event.channel, // This will be resolved to conversation UUID by storage layer
     slackChannelId: event.channel,
     messageTs: event.ts,
     threadTs: event.thread_ts,
     text: event.text || '',
     messageType: event.thread_ts ? 'reply' : 'message',
     subtype: event.subtype,
     slackUserId: event.user,
     slackUserName: 'Unknown', // We'll look this up later from user cache
     hasFiles: event.files && event.files.length > 0,
     hasReactions: event.reactions && event.reactions.length > 0,
     hasReplies: (event.reply_count || 0) > 0,
     replyCount: event.reply_count || 0,
     slackTimestamp: event.ts
   })

  logger.info('Regular message processed', {
    userId,
    channel: event.channel,
    messageTs: event.ts,
    slackUserId: event.user,
    isThread: !!event.thread_ts
  })
}

/**
 * Check if we should skip storing this message
 * Some system messages are not worth storing for our use case
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