/**
 * Slack Real-time State Management Module - Phase 1 Implementation
 * Implements: RT-001, RT-003
 * Provides basic unread tracking and read state management
 */

import type { User } from '../util'
import type { 
  UnreadSummary,
  SlackAPIResponse,
  SlackMessage
} from './types'
import { validateUserAuth } from './auth'
import { clientPool, handleSlackResponse, SlackAPIError, processBatch } from './client'
import { resolveConversationId } from './utils'

/**
 * RT-001: Get total unread summary for the user
 * This is a basic implementation for Phase 1
 */
export async function getTotalUnreadSummary(user: User): Promise<UnreadSummary & SlackAPIResponse> {
  try {
    console.log('📊 Getting total unread summary for user:', user.id)

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    return handleSlackResponse(async () => {
      // Get all conversations
      const conversationsResult = await client.conversations.list({
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: true,
        limit: 1000
      })

      if (!conversationsResult.ok || !conversationsResult.channels) {
        throw new SlackAPIError('Failed to fetch conversations for unread count', 'API_ERROR')
      }

      console.log(`📋 Processing ${conversationsResult.channels.length} conversations for unread counts`)

      let totalUnread = 0
      let totalMentions = 0
      let channels = 0
      let dms = 0
      let groups = 0
      let mentions = 0

      // Process conversations in batches to respect rate limits
      const processConversation = async (conversation: any) => {
        if (!conversation.id) return null

        try {
          // Get conversation info with unread count
          const convInfo = await client.conversations.info({
            channel: conversation.id
          })

          if (convInfo.ok && convInfo.channel) {
            const channel = convInfo.channel as any
            const unreadCount = channel.unread_count || 0
            const unreadCountDisplay = channel.unread_count_display || 0
            
            if (unreadCount > 0) {
              console.log(`📨 Unread: ${conversation.name || conversation.id}`, {
                type: conversation.is_im ? 'dm' : conversation.is_group ? 'group' : 'channel',
                unread: unreadCount,
                mentions: unreadCountDisplay
              })

              return {
                unreadCount,
                unreadCountDisplay,
                type: conversation.is_im ? 'dm' : conversation.is_group || conversation.is_mpim ? 'group' : 'channel'
              }
            }
          }
        } catch (convError) {
          console.warn(`⚠️ Failed to get unread count for conversation ${conversation.id}:`, convError)
        }
        
        return null
      }

      // Process conversations in batches of 10 with 500ms delay between batches
      const results = await processBatch(
        conversationsResult.channels,
        processConversation,
        10, // batch size
        500 // delay in ms
      )

      // Aggregate results
      for (const result of results) {
        if (result) {
          totalUnread += result.unreadCount
          totalMentions += result.unreadCountDisplay
          mentions += result.unreadCountDisplay

          if (result.type === 'dm') {
            dms += result.unreadCount
          } else if (result.type === 'group') {
            groups += result.unreadCount
          } else {
            channels += result.unreadCount
          }
        }
      }

      const summary: UnreadSummary = {
        totalUnread,
        totalMentions,
        breakdown: {
          channels: channels + groups, // Combine channels and groups for simplicity
          dms,
          groups: 0, // Reset since we combined with channels
          mentions
        }
      }

      console.log('✅ Unread summary calculated:', summary)

      return {
        success: true,
        ...summary
      }

    }, 'getTotalUnreadSummary')

  } catch (error) {
    console.error('❌ Failed to get unread summary:', error)
    
    if (error instanceof SlackAPIError) {
      return {
        success: false,
        error: error.message,
        totalUnread: 0,
        totalMentions: 0
      }
    }

    return {
      success: false,
      error: `Failed to get unread summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
      totalUnread: 0,
      totalMentions: 0
    }
  }
}

/**
 * RT-003: Mark conversation as read
 */
export async function markConversationAsRead(
  user: User,
  conversationIdentifier: string,
  latestMessageTs?: string
): Promise<SlackAPIResponse> {
  try {
    console.log('✅ Marking conversation as read:', {
      conversationIdentifier,
      latestMessageTs: latestMessageTs ? `${latestMessageTs.substring(0, 15)}...` : undefined
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    return handleSlackResponse(async () => {
      // Resolve conversation ID (supports channel names, IDs, usernames, user IDs for DMs)
      let actualConversationId;
      try {
        actualConversationId = await resolveConversationId(client, conversationIdentifier, {
          includePrivate: true,
          includeArchived: false,
          allowDMs: true
        });
      } catch (error) {
        console.error('❌ Failed to resolve conversation for marking as read:', error);
        throw error;
      }

      // If no specific timestamp provided, get the latest message timestamp
      if (!latestMessageTs) {
        const historyResult = await client.conversations.history({
          channel: actualConversationId,
          limit: 1
        })

        if (historyResult.ok && historyResult.messages && historyResult.messages.length > 0) {
          latestMessageTs = historyResult.messages[0].ts
        }
      }

      if (!latestMessageTs) {
        return {
          success: true,
          error: 'No messages to mark as read'
        }
      }

      // Mark the conversation as read up to the specified timestamp
      const markResult = await client.conversations.mark({
        channel: actualConversationId,
        ts: latestMessageTs
      })

      if (!markResult.ok) {
        throw new SlackAPIError(`Failed to mark conversation as read: ${markResult.error}`, 'API_ERROR')
      }

      console.log('✅ Conversation marked as read successfully')

      return {
        success: true
      }

    }, 'markConversationAsRead')

  } catch (error) {
    console.error('❌ Failed to mark conversation as read:', error)
    
    if (error instanceof SlackAPIError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to mark conversation as read: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * RT-002: Get recent unread messages (basic implementation)
 */
export async function getRecentUnreadMessages(
  user: User, 
  limit?: number
): Promise<{ messages: SlackMessage[], totalUnread?: number, error?: string } & SlackAPIResponse> {
  try {
    console.log('📬 Getting recent unread messages, limit:', limit || 10)

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    return handleSlackResponse(async () => {
      // This is a simplified implementation for Phase 1
      // In Phase 2, this would use the real-time state manager
      
      const recentUnreadMessages: SlackMessage[] = []
      let totalUnread = 0

      // Get conversations with unread messages
      const conversationsResult = await client.conversations.list({
        types: 'public_channel,private_channel,mpim,im',
        exclude_archived: true,
        limit: 100
      })

      if (!conversationsResult.ok) {
        throw new SlackAPIError('Failed to get conversations', 'API_ERROR')
      }

      // Process up to the limit
      const maxMessages = limit || 10
      
      for (const conversation of conversationsResult.channels || []) {
        if (recentUnreadMessages.length >= maxMessages) break
        
        try {
          const convInfo = await client.conversations.info({
            channel: conversation.id!
          })

          if (convInfo.ok && convInfo.channel) {
            const channel = convInfo.channel as any
            const unreadCount = channel.unread_count || 0
            
            if (unreadCount > 0) {
              totalUnread += unreadCount
              
              // Get the last_read timestamp for this conversation
              const lastRead = channel.last_read
              
              // Get recent messages from this conversation
              const messagesResult = await client.conversations.history({
                channel: conversation.id!,
                limit: 50 // Get more messages to filter through
              })

              if (messagesResult.ok && messagesResult.messages) {
                // Filter messages to only include unread ones
                const unreadMessages = messagesResult.messages.filter((msg: any) => {
                  // If we have a last_read timestamp, only include messages after it
                  if (lastRead && msg.ts) {
                    return parseFloat(msg.ts) > parseFloat(lastRead)
                  }
                  // If no last_read, consider all messages as potentially unread
                  return true
                }).slice(0, Math.min(unreadCount, maxMessages - recentUnreadMessages.length))

                // Add the unread messages
                for (const msg of unreadMessages) {
                  if (recentUnreadMessages.length >= maxMessages) break
                  
                  recentUnreadMessages.push({
                    ts: msg.ts || '',
                    type: msg.type || 'message',
                    user: msg.user,
                    text: msg.text,
                    thread_ts: msg.thread_ts,
                    conversation_id: conversation.id!
                  })
                }
              }
            }
          }
        } catch (convError) {
          console.warn(`⚠️ Failed to get unread messages from ${conversation.id}:`, convError)
        }
      }

      console.log(`✅ Retrieved ${recentUnreadMessages.length} recent unread messages (filtered from conversations with ${totalUnread} total unread)`)

      return {
        success: true,
        messages: recentUnreadMessages,
        totalUnread
      }

    }, 'getRecentUnreadMessages')

  } catch (error) {
    console.error('❌ Failed to get recent unread messages:', error)
    
    return {
      success: false,
      messages: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Placeholder for RT-004: Mark specific messages as read (Phase 2C)
 */
export async function markSpecificMessagesAsRead(
  user: User,
  conversationIdentifier: string,
  target: { messageTs?: string, threadTs?: string }
): Promise<any> {
  return {
    success: false,
    error: 'markSpecificMessagesAsRead will be implemented in Phase 2C'
  }
} 