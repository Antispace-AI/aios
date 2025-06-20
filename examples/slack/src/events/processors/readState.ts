// Read State Event Handler - Handle read state events (channel_marked, im_marked, etc.)
import { SlackEventData } from '../types/events'
import { SlackDataStore } from '../../storage/interfaces/slack-data-store'
import { logger } from '../../util/logger'

// Global storage instance (will be injected later)
let dataStore: SlackDataStore | null = null

export function setDataStore(store: SlackDataStore): void {
  dataStore = store
}

/**
 * Handle channel marked events (channel_marked, im_marked, group_marked, mpim_marked)
 * PURPOSE: Update unread counts when users mark conversations as read
 */
export async function handleChannelMarkedEvent(eventData: SlackEventData, userId: string): Promise<void> {
  if (!dataStore) {
    logger.error('DataStore not initialized in read state processor')
    return
  }

  const event = eventData.event
  
  logger.info('Processing read state event for unread count update', {
    userId,
    eventType: event.type,
    channel: event.channel,
    ts: event.ts
  })

  try {
    // The 'ts' field indicates the timestamp up to which messages are marked as read
    const readTimestamp = event.ts as string
    const channelId = event.channel as string

    // Update the conversation's read state and unread count
    await dataStore.updateConversationReadState(userId, channelId, readTimestamp)
    
    logger.info('Read state updated successfully', {
      userId,
      eventType: event.type,
      channel: channelId,
      readTimestamp
    })
    
  } catch (error) {
    logger.error('Failed to process read state event', error instanceof Error ? error : new Error(String(error)), {
      userId,
      eventType: event.type,
      channel: event.channel,
      ts: event.ts
    })
    throw error
  }
} 