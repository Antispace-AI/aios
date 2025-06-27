// User Event Handler - Handle user presence and profile changes
import { SlackEventData, SlackPresenceChangeEvent, SlackUserChangeEvent } from '../types/events'
import { logger } from '../../util/logger'

/**
 * Handle user-related events (presence changes, profile updates)
 */
export async function handleUserEvent(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event

  try {
    switch (event.type) {
      case 'presence_change':
        await handlePresenceChange(eventData, userId)
        break
      
      case 'user_change':
        await handleUserChange(eventData, userId)
        break
      
      default:
        logger.warn('Unknown user event type', { 
          eventType: event.type, 
          eventId: eventData.eventId,
          userId 
        })
    }
  } catch (error) {
    logger.error('Error handling user event', error instanceof Error ? error : new Error(String(error)), {
      eventType: event.type,
      eventId: eventData.eventId,
      userId
    })
    throw error
  }
}

/**
 * Handle presence change events
 */
async function handlePresenceChange(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event as SlackPresenceChangeEvent
  
  logger.info('Processing presence change event', {
    slackUserId: event.user,
    presence: event.presence,
    userId,
    eventId: eventData.eventId
  })

  // TODO: Update user presence in storage
  // This will be implemented when storage layer is ready
  // await updateUserPresence(userId, event.user, event.presence)
}

/**
 * Handle user profile change events
 */
async function handleUserChange(eventData: SlackEventData, userId: string): Promise<void> {
  const event = eventData.event as unknown as SlackUserChangeEvent
  
  logger.info('Processing user change event', {
    slackUserId: event.user.id,
    realName: event.user.profile?.real_name,
    displayName: event.user.profile?.display_name,
    userId,
    eventId: eventData.eventId
  })

  // TODO: Update user profile in storage
  // This will be implemented when storage layer is ready
  // await updateUserProfile(userId, event.user)
} 