// Message Event Handler - Handle message events with storage integration
import { SlackEventData, SlackMessageEvent } from '../types/events'
import { SlackDataStore } from '../../storage/interfaces/slack-data-store'
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
 * Handle message events (new messages, edits, deletions, threads)
 */
export async function handleMessageEvent(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event as SlackMessageEvent
  
  try {
    logger.info('Processing message event', {
      channel: event.channel,
      messageTs: event.ts,
      threadTs: event.thread_ts,
      hasFiles: event.files && event.files.length > 0,
      hasReactions: event.reactions && event.reactions.length > 0,
      userId,
      eventId: eventData.eventId
    })

    if (!dataStore) {
      logger.warn('Message handler not initialized with storage, skipping message storage')
      return
    }

    // Handle different message subtypes
    switch (event.subtype) {
      case 'message_deleted':
        await handleMessageDeleted(event, userId)
        break
      case 'message_changed':
        await handleMessageEdited(event, userId)
        break
      case undefined: // Regular message
      default:
        await handleRegularMessage(event, userId)
        break
    }

    logger.info('Message event processed successfully', {
      userId,
      channel: event.channel,
      messageTs: event.ts,
      eventId: eventData.eventId
    })

  } catch (error) {
    logger.error('Failed to process message event', error instanceof Error ? error : new Error(String(error)), {
      userId,
      channel: event.channel,
      messageTs: event.ts,
      eventId: eventData.eventId
    })
    throw error
  }
}

/**
 * Handle regular message (new message or thread reply)
 */
async function handleRegularMessage(event: SlackMessageEvent, userId: string): Promise<void> {
  if (!dataStore) throw new Error('DataStore not initialized')

  // Extract message data
  const messageData = {
    userId,
    conversationId: event.channel, // Will be converted to UUID by storage layer
    slackChannelId: event.channel,
    messageTs: event.ts,
    threadTs: event.thread_ts,
    text: event.text,
    messageType: event.thread_ts ? 'reply' as const : 'message' as const,
    subtype: event.subtype,
    slackUserId: event.user,
    slackUserName: 'Unknown', // TODO: Get from user cache later
    botId: event.bot_id,
    hasFiles: event.files && event.files.length > 0,
    hasReactions: event.reactions && event.reactions.length > 0,
    hasReplies: false, // Will be updated when replies come in
    replyCount: 0,
    slackTimestamp: event.ts // Slack timestamp as string
  }

  // Store the message
  await dataStore.storeMessage(messageData)

  // TODO: Store file attachments if present
  if (event.files && event.files.length > 0) {
    logger.debug('Message has files, file storage not yet implemented', {
      userId,
      messageTs: event.ts,
      fileCount: event.files.length
    })
  }

  // TODO: Store reactions if present
  if (event.reactions && event.reactions.length > 0) {
    logger.debug('Message has reactions, reaction storage not yet implemented', {
      userId,
      messageTs: event.ts,
      reactionCount: event.reactions.length
    })
  }
}

/**
 * Handle message edited
 */
async function handleMessageEdited(event: SlackMessageEvent, userId: string): Promise<void> {
  logger.info('Message edited event received', {
    userId,
    channel: event.channel,
    messageTs: event.ts
  })

  // For now, treat edits as new messages (the ON CONFLICT clause will handle updates)
  await handleRegularMessage(event, userId)
}

/**
 * Handle message deleted
 */
async function handleMessageDeleted(event: SlackMessageEvent, userId: string): Promise<void> {
  logger.info('Message deleted event received', {
    userId,
    channel: event.channel,
    messageTs: event.ts
  })

  // TODO: Implement message deletion (soft delete)
  // This will be implemented when updateMessage is ready
  logger.debug('Message deletion not yet implemented')
} 