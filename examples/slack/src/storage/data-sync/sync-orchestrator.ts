// Sync Orchestrator - Layer 2
// High-level coordination of data synchronization using the pull engine

import { logger } from '../../util/logger'
import { SlackDataPullEngine } from './pull-engine'
import type { SlackDataStore } from '../interfaces/slack-data-store'
import type {
  SyncResult,
  PullOptions,
  RefreshOptions,
  MessagePullResult
} from './types'
import { DEFAULT_PULL_OPTIONS } from './types'
import { getUser } from '../../util'

export class SlackSyncOrchestrator {
  private pullEngine: SlackDataPullEngine

  constructor(
    private dataStore: SlackDataStore,
    private antiId: string
  ) {
    this.pullEngine = new SlackDataPullEngine(dataStore, antiId)
  }

  /**
   * Perform full 7-day data synchronization
   * Used for new users or complete refresh
   */
  async fullSync(options: Partial<PullOptions> = {}): Promise<SyncResult> {
    const opts = { ...DEFAULT_PULL_OPTIONS, ...options }
    const startTime = Date.now()
    const user = await getUser(this.antiId)
    
    logger.info('Starting full sync', { 
      antiId: this.antiId, 
      timeWindow: opts.timeWindow + ' days',
      options: opts
    })

    try {
      // Update sync state to in_progress
      await this.dataStore.updateSyncState({
        userId: user.id,
        syncStatus: 'in_progress'
      })

      // Step 1: Pull all active conversations
      logger.info('Step 1: Pulling conversations', { antiId: this.antiId })
      const convResult = await this.pullEngine.pullConversations(opts)
      
      if (convResult.errors.length > 0) {
        logger.warn('Conversation pull had errors', { errors: convResult.errors })
      }

      // Get user data and verify the internal ID exists in database
      const userIdCheck = await this.dataStore.getUser(this.antiId)
      if (!userIdCheck) {
        throw new Error(`User not found in database: ${this.antiId}`)
      }
      
      // Use the verified user ID from fresh database lookup
      const verifiedUserId = userIdCheck.id

      // Store conversation data with unread counts
      if (convResult.conversations.length > 0) {
        await this.dataStore.upsertBatchConversations(convResult.conversations.map(conv => ({
          userId: verifiedUserId, // Use verified user ID instead of potentially stale one
          slackChannelId: conv.id,
          name: conv.name,
          displayName: conv.displayName,
          type: conv.type,
          isPrivate: conv.isPrivate,
          isArchived: conv.isArchived,
          isMember: conv.isMember,
          memberCount: conv.memberCount,
          unreadCount: conv.unreadCount,
          unreadCountDisplay: conv.unreadCountDisplay,
          lastReadTs: conv.lastRead,
          lastMessageTs: undefined, // Will be updated when messages are stored
          lastMessagePreview: undefined // Will be updated when messages are stored
        })))
        
        logger.info('Stored conversations with unread count data', { 
          antiId: this.antiId, 
          conversationsStored: convResult.conversations.length 
        })
      }

      // Step 2: Pull messages for each conversation with rate limiting
      logger.info('Step 2: Pulling messages for conversations', { 
        antiId: this.antiId,
        conversationCount: convResult.conversations.length
      })

      const since = new Date(Date.now() - opts.timeWindow * 24 * 60 * 60 * 1000)
      const messageResults: MessagePullResult[] = []
      const messageErrors: string[] = []
      let totalMessages = 0

      // Process conversations in batches to respect rate limits
      const batchSize = opts.maxConcurrency
      for (let i = 0; i < convResult.conversations.length; i += batchSize) {
        const batch = convResult.conversations.slice(i, i + batchSize)
        
        // Process batch in parallel
        const batchPromises = batch.map(async (conv) => {
          try {
            const result = await this.pullEngine.pullMessagesForConversation(
              conv.id, 
              since, 
              opts
            )
            totalMessages += result.messages.length
            
            // Store messages if any were found
            if (result.messages.length > 0) {
              for (const msg of result.messages) {
                try {
                  await this.dataStore.storeMessage({
                    userId: verifiedUserId, // Use verified user ID instead of potentially stale one
                    conversationId: '', // Will be looked up by storeMessage
                    slackChannelId: msg.channelId,
                    messageTs: msg.messageTs,
                    threadTs: msg.threadTs,
                    text: msg.text,
                    messageType: 'message',
                    subtype: undefined,
                    slackUserId: msg.userId,
                    slackUserName: undefined, // Will be filled in when user profiles are synced
                    hasFiles: msg.files && msg.files.length > 0,
                    hasReactions: msg.reactions && msg.reactions.length > 0,
                    hasReplies: false,
                    replyCount: 0,
                    slackTimestamp: msg.messageTs
                  })
                } catch (msgError) {
                  logger.warn('Failed to store message', { 
                    antiId: this.antiId, 
                    messageTs: msg.messageTs, 
                    error: msgError instanceof Error ? msgError.message : String(msgError) 
                  })
                }
              }
            }
            
            return result
          } catch (error) {
            const errorMsg = `Failed to pull messages for ${conv.id}: ${error instanceof Error ? error.message : error}`
            messageErrors.push(errorMsg)
            logger.warn(errorMsg, { antiId: this.antiId, conversationId: conv.id })
            return null
          }
        })

        const batchResults = await Promise.all(batchPromises)
        messageResults.push(...batchResults.filter((result): result is MessagePullResult => result !== null))

        // Rate limiting delay between batches
        if (i + batchSize < convResult.conversations.length && opts.rateLimitDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, opts.rateLimitDelay))
        }
      }

      // Step 3: Extract and sync user profiles for message attribution
      logger.info('Step 3: Syncing user profiles', { antiId: this.antiId })
      const userIds = this.extractUniqueUserIds(messageResults)
      const userProfileResult = await this.pullEngine.pullUserProfiles(userIds, opts)

      if (userProfileResult.errors.length > 0) {
        logger.warn('User profile pull had errors', { errors: userProfileResult.errors })
      }

      await this.dataStore.syncUserProfiles(userProfileResult.users)

      // Update sync state
      const duration = Date.now() - startTime
      await this.dataStore.updateSyncState({
        userId: user.id,
        syncStatus: 'completed',
        messagesSynced: totalMessages,
        conversationsSynced: convResult.conversations.length,
        syncDurationMs: duration
      })

      logger.info('Full sync completed successfully', {
        antiId: this.antiId,
        success: true,
        conversationsSync: convResult.conversations.length,
        messagesSync: totalMessages,
        usersSync: userProfileResult.users.length,
        timeWindow: `${opts.timeWindow} days`,
        duration,
        errors: [
          ...convResult.errors,
          ...messageErrors,
          ...userProfileResult.errors
        ]
      })

      return {
        success: true,
        conversationsSync: convResult.conversations.length,
        messagesSync: totalMessages,
        usersSync: userProfileResult.users.length,
        timeWindow: `${opts.timeWindow} days`,
        duration,
        errors: [
          ...convResult.errors,
          ...messageErrors,
          ...userProfileResult.errors
        ]
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Update sync state to failed
      await this.dataStore.updateSyncState({
        userId: user.id,
        syncStatus: 'failed',
        syncDurationMs: duration,
        errorMessage
      })

      logger.error('Full sync failed', error instanceof Error ? error : new Error(String(error)), {
        antiId: this.antiId,
        duration
      })

      return {
        success: false,
        conversationsSync: 0,
        messagesSync: 0,
        usersSync: 0,
        timeWindow: `${opts.timeWindow} days`,
        duration,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Perform incremental synchronization
   * Only pulls new data since last sync
   */
  async incrementalSync(options: Partial<RefreshOptions> = {}): Promise<SyncResult> {
    const startTime = Date.now()
    const user = await getUser(this.antiId)
    
    logger.info('Starting incremental sync', { 
      antiId: this.antiId,
      options
    })

    try {
      // Get last sync states to determine what to update
      const syncStates = await this.dataStore.getAllSyncStates(user.id)
      
      if (syncStates.length === 0) {
        logger.info('No previous sync found, performing full sync instead', { antiId: this.antiId })
        return await this.fullSync()
      }

      // For incremental sync, we'll pull recent messages (last 24 hours) for active conversations
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      let totalMessages = 0
      let conversationsUpdated = 0
      const errors: string[] = []

      // Update sync state to in_progress
      await this.dataStore.updateSyncState({
        userId: user.id,
        syncStatus: 'in_progress'
      })

      // Pull recent messages for conversations that have been active
      if (options.conversationIds) {
        // Sync specific conversations only
        for (const channelId of options.conversationIds) {
          try {
            const result = await this.pullEngine.pullMessagesForConversation(channelId, since)
            totalMessages += result.messages.length
            conversationsUpdated++
          } catch (error) {
            const errorMsg = `Failed to sync conversation ${channelId}: ${error instanceof Error ? error.message : error}`
            errors.push(errorMsg)
            logger.warn(errorMsg, { antiId: this.antiId, conversationId: channelId })
          }
        }
      } else {
        // Pull conversations and sync recent activity
        const convResult = await this.pullEngine.pullConversations({ timeWindow: 1 }) // Last day
        
        for (const conv of convResult.conversations) {
          try {
            const result = await this.pullEngine.pullMessagesForConversation(conv.id, since)
            totalMessages += result.messages.length
            if (result.messages.length > 0) {
              conversationsUpdated++
            }
          } catch (error) {
            const errorMsg = `Failed to sync conversation ${conv.id}: ${error instanceof Error ? error.message : error}`
            errors.push(errorMsg)
            logger.warn(errorMsg, { antiId: this.antiId, conversationId: conv.id })
          }
        }
      }

      const duration = Date.now() - startTime
      const syncResult: SyncResult = {
        success: true,
        conversationsSync: conversationsUpdated,
        messagesSync: totalMessages,
        usersSync: 0, // User profiles don't change frequently
        timeWindow: '24 hours',
        duration,
        errors
      }

      // Update sync state to completed
      await this.dataStore.updateSyncState({
        userId: user.id,
        syncStatus: 'completed',
        messagesSynced: totalMessages,
        conversationsSynced: conversationsUpdated,
        syncDurationMs: duration
      })

      logger.info('Incremental sync completed', {
        antiId: this.antiId,
        ...syncResult
      })

      return syncResult

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Update sync state to failed
      await this.dataStore.updateSyncState({
        userId: user.id,
        syncStatus: 'failed',
        syncDurationMs: duration,
        errorMessage
      })

      logger.error('Incremental sync failed', error instanceof Error ? error : new Error(String(error)), {
        antiId: this.antiId,
        duration
      })

      return {
        success: false,
        conversationsSync: 0,
        messagesSync: 0,
        usersSync: 0,
        timeWindow: '24 hours',
        duration,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Sync a specific conversation
   * Useful for targeted updates
   */
  async conversationSync(
    conversationId: string, 
    options: Partial<PullOptions> = {}
  ): Promise<SyncResult> {
    const opts = { ...DEFAULT_PULL_OPTIONS, ...options }
    const startTime = Date.now()
    const user = await getUser(this.antiId)
    
    logger.info('Starting conversation sync', { 
      antiId: this.antiId, 
      conversationId,
      timeWindow: opts.timeWindow + ' days'
    })

    try {
      const since = new Date(Date.now() - opts.timeWindow * 24 * 60 * 60 * 1000)
      
      // Pull messages for this specific conversation
      const messageResult = await this.pullEngine.pullMessagesForConversation(
        conversationId, 
        since, 
        opts
      )

      if (messageResult.errors.length > 0) {
        logger.warn('Message pull had errors', { errors: messageResult.errors })
      }

      // Extract and sync user profiles from these messages
      const userIds = this.extractUniqueUserIds([messageResult])
      const userResult = await this.pullEngine.pullUserProfiles(userIds, opts)

      const duration = Date.now() - startTime
      const syncResult: SyncResult = {
        success: true,
        conversationsSync: 1,
        messagesSync: messageResult.messages.length,
        usersSync: userResult.users.length,
        timeWindow: `${opts.timeWindow} days`,
        duration,
        errors: [...messageResult.errors, ...userResult.errors]
      }

      // Update sync state for this conversation
      await this.dataStore.updateSyncState({
        userId: user.id,
        conversationId,
        syncStatus: 'completed',
        messagesSynced: messageResult.messages.length,
        conversationsSynced: 1,
        syncDurationMs: duration
      })

      logger.info('Conversation sync completed', {
        antiId: this.antiId,
        conversationId,
        ...syncResult
      })

      return syncResult

    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Update sync state to failed
      await this.dataStore.updateSyncState({
        userId: user.id,
        conversationId,
        syncStatus: 'failed',
        syncDurationMs: duration,
        errorMessage
      })

      logger.error('Conversation sync failed', error instanceof Error ? error : new Error(String(error)), {
        antiId: this.antiId,
        conversationId,
        duration
      })

      return {
        success: false,
        conversationsSync: 0,
        messagesSync: 0,
        usersSync: 0,
        timeWindow: `${opts.timeWindow} days`,
        duration,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Check if user needs a full sync
   */
  async shouldPerformFullSync(): Promise<boolean> {
    try {
      const user = await getUser(this.antiId)
      const cacheStatus = await this.dataStore.getCacheStatus(this.antiId)
      
      // Perform full sync if:
      // 1. No cached data exists
      // 2. Cache is inactive (expired)
      // 3. No successful sync in the last 24 hours
      
      if (cacheStatus.messageCount === 0 || !cacheStatus.isActive) {
        return true
      }

      const syncState = await this.dataStore.getSyncState(user.id)
      if (!syncState || syncState.syncStatus === 'failed') {
        return true
      }

      // Check if last successful sync was more than 24 hours ago
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      if (syncState.lastSyncTs < dayAgo) {
        return true
      }

      return false
    } catch (error) {
      logger.warn('Error checking sync status, defaulting to full sync', { 
        antiId: this.antiId, 
        error: error instanceof Error ? error.message : error 
      })
      return true
    }
  }

  /**
   * Extract unique user IDs from message results
   */
  private extractUniqueUserIds(messageResults: Array<{ messages: Array<{ userId: string }> }>): string[] {
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