// Core Data Pull Engine - Layer 1
// Uses existing WebAPI functions to pull data from Slack

import { logger } from '../../util/logger'
import type { SlackDataStore } from '../interfaces/slack-data-store'
import type {
  PullOptions,
  ConversationPullResult,
  MessagePullResult,
  UserPullResult
} from './types'
import { DEFAULT_PULL_OPTIONS } from './types'

// Import existing WebAPI functions
import {
  listConversations,
  getMessages,
  getUserProfile,
  getConversationDetails
} from '../../webAPI'
import { getUser } from '../../util'

export class SlackDataPullEngine {
  private user: any = null
  
  constructor(
    private dataStore: SlackDataStore,
    private antiId: string
  ) {}

  private async getAuthenticatedUser() {
    // Always refresh user data from database to prevent stale cache issues
    this.user = await getUser(this.antiId)
    if (!this.user?.accessToken) {
      throw new Error(`User ${this.antiId} is not authenticated with Slack`)
    }
    return this.user
  }

  /**
   * Pull all active conversations from Slack
   */
  async pullConversations(options: Partial<PullOptions> = {}): Promise<ConversationPullResult> {
    const opts = { ...DEFAULT_PULL_OPTIONS, ...options }
    const timeWindow = new Date(Date.now() - opts.timeWindow * 24 * 60 * 60 * 1000)
    const user = await this.getAuthenticatedUser()
    
    logger.info('Starting conversation pull', { 
      antiId: this.antiId, 
      timeWindow: opts.timeWindow + ' days' 
    })

    try {
      // Use existing listConversations function  
      const slackConversations = await listConversations(
        user,
        ['public_channel', 'private_channel', 'mpim', 'im'],
        1000
      )

      if (!slackConversations.success) {
        throw new Error(slackConversations.error || 'Failed to list conversations')
      }

      const conversations: Array<{
        id: string
        name: string
        type: string
        lastActivity: Date
        memberCount: number
        unreadCount: number
        unreadCountDisplay: number
        lastRead?: string
        displayName: string
        isPrivate: boolean
        isArchived: boolean
        isMember: boolean
      }> = []
      const errors: string[] = []
      let activeCount = 0

      for (const conv of slackConversations.conversations || []) {
        try {
          // Check if conversation has recent activity (use created timestamp as fallback)
          const lastActivity = conv.created ? new Date(conv.created * 1000) : new Date(0)
          const isActive = lastActivity > timeWindow

          if (isActive) {
            activeCount++
          }

          conversations.push({
            id: conv.id,
            name: conv.name || 'Unknown',
            displayName: conv.display_name || conv.name || 'Unknown',
            type: conv.type,
            lastActivity,
            memberCount: conv.num_members || 0,
            unreadCount: conv.unread_count || 0,
            unreadCountDisplay: conv.unread_count_display || conv.unread_count || 0,
            lastRead: conv.last_read || undefined,
            isPrivate: conv.is_private || false,
            isArchived: conv.is_archived || false,
            isMember: conv.is_member || false
          })

          // Rate limiting delay
          if (opts.rateLimitDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, opts.rateLimitDelay))
          }

        } catch (error) {
          const errorMsg = `Failed to process conversation ${conv.id}: ${error instanceof Error ? error.message : error}`
          logger.warn(errorMsg, { antiId: this.antiId, conversationId: conv.id })
          errors.push(errorMsg)
        }
      }

      logger.info('Conversation pull completed', {
        antiId: this.antiId,
        totalConversations: conversations.length,
        activeConversations: activeCount,
        totalUnreadCount: conversations.reduce((sum, conv) => sum + conv.unreadCount, 0),
        errors: errors.length
      })

      return {
        conversations,
        totalCount: conversations.length,
        activeCount,
        errors
      }

    } catch (error) {
      const errorMsg = `Failed to pull conversations: ${error instanceof Error ? error.message : error}`
      logger.error(errorMsg, error instanceof Error ? error : new Error(String(error)), { antiId: this.antiId })
      
      return {
        conversations: [],
        totalCount: 0,
        activeCount: 0,
        errors: [errorMsg]
      }
    }
  }

  /**
   * Pull message history for a specific conversation
   */
  async pullMessagesForConversation(
    channelId: string, 
    since: Date, 
    options: Partial<PullOptions> = {}
  ): Promise<MessagePullResult> {
    const opts = { ...DEFAULT_PULL_OPTIONS, ...options }
    const olderTs = since.getTime() / 1000 // Convert to Slack timestamp
    const user = await this.getAuthenticatedUser()
    
    logger.info('Starting message pull for conversation', {
      antiId: this.antiId,
      channelId,
      since: since.toISOString(),
      batchSize: opts.batchSize
    })

    try {
      const messages: Array<{
        messageTs: string
        channelId: string
        userId: string
        text: string
        threadTs?: string
        files?: any[]
        reactions?: any[]
      }> = []
      const errors: string[] = []
      let cursor: string | undefined = undefined
      let totalBatches = 0

      do {
        try {
          // Use existing getMessages function with pagination
          const result = await getMessages(
            user,
            channelId,
            opts.batchSize,
            cursor,
            olderTs.toString()
          )

          if (!result.success) {
            throw new Error(result.error || 'Failed to get messages')
          }

          if (result.messages) {
            for (const msg of result.messages) {
              // Skip messages that don't meet our criteria
              if (msg.type !== 'message' || msg.subtype === 'bot_message') {
                continue
              }

              messages.push({
                messageTs: msg.ts || '',
                channelId,
                userId: msg.user || 'unknown',
                text: msg.text || '',
                threadTs: msg.thread_ts,
                files: msg.files || [],
                reactions: msg.reactions || []
              })
            }
          }

          // Update cursor for next batch
          cursor = result.nextCursor
          totalBatches++

          // Rate limiting delay between batches
          if (cursor && opts.rateLimitDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, opts.rateLimitDelay))
          }

          // Safety break to prevent infinite loops
          if (totalBatches > 100) {
            logger.warn('Message pull exceeded batch limit', { 
              antiId: this.antiId, 
              channelId, 
              totalBatches 
            })
            break
          }

        } catch (error) {
          const errorMsg = `Failed to pull message batch for ${channelId}: ${error instanceof Error ? error.message : error}`
          logger.warn(errorMsg, { antiId: this.antiId, channelId, cursor })
          errors.push(errorMsg)
          break // Stop pagination on error
        }

      } while (cursor)

      logger.info('Message pull completed for conversation', {
        antiId: this.antiId,
        channelId,
        messagesCount: messages.length,
        batchesProcessed: totalBatches,
        errors: errors.length
      })

      return {
        messages,
        totalCount: messages.length,
        conversationId: channelId,
        timeRange: {
          start: since,
          end: new Date()
        },
        errors
      }

    } catch (error) {
      const errorMsg = `Failed to pull messages for ${channelId}: ${error instanceof Error ? error.message : error}`
      logger.error(errorMsg, error instanceof Error ? error : new Error(String(error)), { 
        antiId: this.antiId, 
        channelId 
      })

      return {
        messages: [],
        totalCount: 0,
        conversationId: channelId,
        timeRange: {
          start: since,
          end: new Date()
        },
        errors: [errorMsg]
      }
    }
  }

  /**
   * Pull user profiles for message attribution
   */
  async pullUserProfiles(userIds: string[], options: Partial<PullOptions> = {}): Promise<UserPullResult> {
    const opts = { ...DEFAULT_PULL_OPTIONS, ...options }
    const uniqueUserIds = Array.from(new Set(userIds.filter(id => id && id !== 'unknown')))
    const user = await this.getAuthenticatedUser()
    
    logger.info('Starting user profile pull', {
      antiId: this.antiId,
      userCount: uniqueUserIds.length
    })

    try {
      const users: Array<{
        slackUserId: string
        realName: string
        displayName: string
        avatarUrl?: string
      }> = []
      const errors: string[] = []
      let processed = 0

      for (const userId of uniqueUserIds) {
        try {
          // Use existing getUserProfile function
          const profileResult = await getUserProfile(user, userId)
          
          if (profileResult.success && 'user' in profileResult) {
            const profile = profileResult.user
            users.push({
              slackUserId: userId,
              realName: profile.real_name || profile.display_name || 'Unknown',
              displayName: profile.display_name || profile.real_name || 'Unknown',
              avatarUrl: profile.avatar
            })
          }

          processed++

          // Rate limiting delay
          if (opts.rateLimitDelay > 0 && processed % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, opts.rateLimitDelay))
          }

        } catch (error) {
          const errorMsg = `Failed to get profile for user ${userId}: ${error instanceof Error ? error.message : error}`
          logger.warn(errorMsg, { antiId: this.antiId, userId })
          errors.push(errorMsg)
        }
      }

      logger.info('User profile pull completed', {
        antiId: this.antiId,
        requestedCount: uniqueUserIds.length,
        retrievedCount: users.length,
        errors: errors.length
      })

      return {
        users,
        totalCount: users.length,
        errors
      }

    } catch (error) {
      const errorMsg = `Failed to pull user profiles: ${error instanceof Error ? error.message : error}`
      logger.error(errorMsg, error instanceof Error ? error : new Error(String(error)), { antiId: this.antiId })

      return {
        users: [],
        totalCount: 0,
        errors: [errorMsg]
      }
    }
  }

  /**
   * Extract unique user IDs from message results
   */
  extractUniqueUserIds(messageResults: MessagePullResult[]): string[] {
    const userIds = new Set<string>()
    
    for (const result of messageResults) {
      for (const message of result.messages) {
        if (message.userId && message.userId !== 'unknown') {
          userIds.add(message.userId)
        }
      }
    }
    
    return Array.from(userIds)
  }
} 