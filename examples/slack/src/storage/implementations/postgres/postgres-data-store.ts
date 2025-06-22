import { SlackDataStore } from '../../interfaces/slack-data-store'
import { PostgreSQLConnection } from './connection'
import { logger } from '../../../util/logger'
import type {
  User,
  Conversation,
  Message,
  Thread,
  MessageFile,
  MessageReaction,
  ConversationListItem,
  MessageWithFiles,
  UnreadSummary,
  UserDataExport,
  CreateUserInput,
  UpdateUserInput,
  CreateConversationInput,
  UpdateConversationInput,
  CreateMessageInput,
  QuickMessageInput,
  UpdateMessageInput,
  GetMessagesQuery,
  GetConversationsQuery,
  SearchMessagesQuery
} from '../../schema/types/database'
import { getConversationDetails } from '../../../webAPI/conversations'
import { getUser } from '../../../util'

export class PostgreSQLSlackDataStore implements SlackDataStore {
  constructor(private db: PostgreSQLConnection) {}

  /**
   * Convert Slack timestamp string to JavaScript Date
   * Slack timestamps are Unix timestamps with microseconds (e.g., "1750280265.049239")
   */
  private parseSlackTimestamp(slackTimestamp?: string): Date {
    if (!slackTimestamp) {
      return new Date()
    }

    try {
      // Parse as float to handle the microseconds, then convert to milliseconds
      const timestamp = parseFloat(slackTimestamp)
      if (isNaN(timestamp)) {
        logger.warn('Invalid Slack timestamp, using current time', { slackTimestamp })
        return new Date()
      }
      
      // Convert from seconds to milliseconds
      return new Date(timestamp * 1000)
    } catch (error) {
      logger.warn('Failed to parse Slack timestamp, using current time', { slackTimestamp, error })
      return new Date()
    }
  }

  // ===============================
  // User Management
  // ===============================

  async getUser(antiId: string): Promise<User | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE anti_id = $1',
        [antiId]
      )

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      logger.error('Failed to get user', error instanceof Error ? error : new Error(String(error)), { antiId })
      throw error
    }
  }

  async createUser(userData: CreateUserInput): Promise<User> {
    try {
      const result = await this.db.query(`
        INSERT INTO users (anti_id, access_token, refresh_token, team_id, team_name, slack_user_id, slack_user_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        userData.antiId,
        userData.accessToken,
        userData.refreshToken,
        userData.teamId,
        userData.teamName,
        userData.slackUserId,
        userData.slackUserName
      ])

      const user = this.mapRowToUser(result.rows[0])
      logger.info('User created successfully', { 
        antiId: user.antiId, 
        teamId: user.teamId,
        slackUserId: user.slackUserId 
      })

      return user
    } catch (error) {
      logger.error('Failed to create user', error instanceof Error ? error : new Error(String(error)), { 
        antiId: userData.antiId,
        teamId: userData.teamId 
      })
      throw error
    }
  }

  async updateUser(antiId: string, updates: UpdateUserInput): Promise<User> {
    try {
      const result = await this.db.query(`
        UPDATE users 
        SET 
          access_token = COALESCE($2, access_token),
          refresh_token = COALESCE($3, refresh_token),
          team_id = COALESCE($4, team_id),
          team_name = COALESCE($5, team_name),
          slack_user_id = COALESCE($6, slack_user_id),
          slack_user_name = COALESCE($7, slack_user_name),
          updated_at = NOW()
        WHERE anti_id = $1
        RETURNING *
      `, [
        antiId,
        updates.accessToken,
        updates.refreshToken,
        updates.teamId,
        updates.teamName,
        updates.slackUserId,
        updates.slackUserName
      ])

      if (result.rows.length === 0) {
        throw new Error(`User not found: ${antiId}`)
      }

      return this.mapRowToUser(result.rows[0])
    } catch (error) {
      logger.error('Failed to update user', error instanceof Error ? error : new Error(String(error)), { antiId })
      throw error
    }
  }

  async deleteUserData(antiId: string): Promise<void> {
    try {
      // CASCADE DELETE will handle all related data
      const result = await this.db.query(
        'DELETE FROM users WHERE anti_id = $1',
        [antiId]
      )

      logger.info('User data deleted successfully', { 
        antiId, 
        deletedRows: result.rowCount 
      })
    } catch (error) {
      logger.error('Failed to delete user data', error instanceof Error ? error : new Error(String(error)), { antiId })
      throw error
    }
  }

  // ===============================
  // Conversation Management
  // ===============================
  // NOTE: All methods now expect userUuid (users.id) instead of antiId for performance

  async getConversation(userUuid: string, channelId: string): Promise<Conversation | null> {
    try {
      const result = await this.db.query(`
        SELECT c.*
        FROM conversations c
        WHERE c.user_id = $1 AND c.slack_channel_id = $2
      `, [userUuid, channelId])

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToConversation(result.rows[0])
    } catch (error) {
      logger.error('Failed to get conversation', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId })
      throw error
    }
  }

  async upsertConversation(userUuid: string, channelId: string, data: CreateConversationInput): Promise<Conversation> {
    try {
      // userUuid is now the actual UUID, no lookup needed
      const result = await this.db.query(`
        INSERT INTO conversations (
          user_id, slack_channel_id, name, topic, purpose, display_name, type,
          is_private, avatar_url, member_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (user_id, slack_channel_id) DO UPDATE SET
          name = EXCLUDED.name,
          topic = EXCLUDED.topic,
          purpose = EXCLUDED.purpose,
          display_name = EXCLUDED.display_name,
          type = EXCLUDED.type,
          is_private = EXCLUDED.is_private,
          avatar_url = EXCLUDED.avatar_url,
          member_count = EXCLUDED.member_count,
          updated_at = NOW()
        RETURNING *
      `, [
        userUuid,
        channelId,
        data.name,
        data.topic,
        data.purpose,
        data.displayName,
        data.type,
        data.isPrivate || false,
        data.avatarUrl,
        data.memberCount || 0
      ])

      return this.mapRowToConversation(result.rows[0])
    } catch (error) {
      logger.error('Failed to upsert conversation', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId })
      throw error
    }
  }

  async updateConversation(userUuid: string, channelId: string, updates: UpdateConversationInput): Promise<Conversation> {
    throw new Error('updateConversation not implemented yet')
  }

  async getConversationList(query: GetConversationsQuery): Promise<ConversationListItem[]> {
    try {
      let sql = `
        SELECT 
          c.id,
          c.slack_channel_id,
          c.display_name,
          c.name,
          c.type,
          c.avatar_url,
          c.unread_count,
          c.unread_count_display,
          c.is_muted,
          c.last_activity_at,
          -- Get actual latest message data from messages table
          latest_msg.text as latest_message_text,
          latest_msg.slack_timestamp as latest_message_timestamp,
          latest_msg.slack_user_id as latest_message_user_id,
          latest_msg.message_ts as latest_message_ts
        FROM conversations c
        LEFT JOIN LATERAL (
          SELECT text, slack_timestamp, slack_user_id, message_ts
          FROM messages m 
          WHERE m.conversation_id = c.id 
          ORDER BY m.slack_timestamp DESC 
          LIMIT 1
        ) latest_msg ON true
        WHERE c.user_id = $1
      `
      const values = [query.userUuid] // Changed from userId to userUuid
      let paramIndex = 2

      // Add type filter
      if (query.types && query.types.length > 0) {
        sql += ` AND c.type = ANY($${paramIndex++})`
        values.push(query.types as any)
      }

      // Add unread filter
      if (query.unreadOnly) {
        sql += ` AND c.unread_count > 0`
      }

      // Add archived filter
      if (!query.includeArchived) {
        sql += ` AND c.is_archived = false`
      }

      // Add sorting - use actual message timestamp for better sorting
      const sortBy = query.sortBy || 'activity'
      switch (sortBy) {
        case 'alphabetical':
          sql += ` ORDER BY c.display_name ASC`
          break
        case 'unread':
          sql += ` ORDER BY c.unread_count DESC, latest_msg.slack_timestamp DESC NULLS LAST`
          break
        default: // 'activity'
          sql += ` ORDER BY latest_msg.slack_timestamp DESC NULLS LAST`
      }

      // Add limit
      sql += ` LIMIT $${paramIndex++}`
      values.push((query.limit || 50).toString())

      const result = await this.db.query(sql, values)

      return result.rows.map(row => ({
        id: row.id,
        slackChannelId: row.slack_channel_id,
        displayName: row.display_name || row.name || `Channel ${row.slack_channel_id}`,
        type: row.type,
        avatarUrl: row.avatar_url,
        unreadCount: row.unread_count || 0,
        unreadCountDisplay: row.unread_count_display || row.unread_count || 0,
        isMuted: row.is_muted || false,
        lastActivityAt: row.latest_message_timestamp?.toISOString(),
        lastMessagePreview: row.latest_message_text,
        lastMessageUserId: row.latest_message_user_id,
        lastMessageTs: row.latest_message_ts,
        formattedTime: this.formatTime(row.latest_message_timestamp),
        hasUnread: (row.unread_count || 0) > 0
      }))
    } catch (error) {
      logger.error('Failed to get conversation list', error instanceof Error ? error : new Error(String(error)), { userUuid: query.userUuid })
      throw error
    }
  }

  async getUnreadSummary(userUuid: string): Promise<UnreadSummary> {
    try {
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total_conversations,
          SUM(c.unread_count) as total_unread,
          json_agg(
            json_build_object(
              'id', c.id,
              'slackChannelId', c.slack_channel_id,
              'displayName', c.display_name,
              'type', c.type,
              'unreadCount', c.unread_count
            ) ORDER BY c.unread_count DESC
          ) FILTER (WHERE c.unread_count > 0) as unread_conversations
        FROM conversations c
        WHERE c.user_id = $1 AND c.unread_count > 0
      `, [userUuid])

      const row = result.rows[0]
      return {
        totalUnread: parseInt(row.total_unread) || 0,
        conversations: row.unread_conversations || []
      }
    } catch (error) {
      logger.error('Failed to get unread summary', error instanceof Error ? error : new Error(String(error)), { userUuid })
      throw error
    }
  }

  async markConversationAsRead(userUuid: string, channelId: string, readTs: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE conversations 
        SET last_read_ts = $1, unread_count = 0, unread_count_display = 0, updated_at = NOW()
        WHERE user_id = $2 AND slack_channel_id = $3
      `, [readTs, userUuid, channelId])

      logger.info('Conversation marked as read', { userUuid, channelId, readTs })
    } catch (error) {
      logger.error('Failed to mark conversation as read', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId, readTs })
      throw error
    }
  }

  async updateConversationReadState(userUuid: string, channelId: string, readTs: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE conversations 
        SET 
          last_read_ts = $1,
          unread_count = GREATEST(0, unread_count - 1),
          unread_count_display = GREATEST(0, unread_count_display - 1),
          updated_at = NOW()
        WHERE user_id = $2 AND slack_channel_id = $3
      `, [readTs, userUuid, channelId])

      logger.info('Conversation read state updated', { userUuid, channelId, readTs })
    } catch (error) {
      logger.error('Failed to update conversation read state', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId, readTs })
      throw error
    }
  }

  // ===============================
  // Message Management  
  // ===============================
  // NOTE: All methods now expect userUuid (users.id) instead of antiId for performance

  async storeMessage(message: CreateMessageInput): Promise<void> {
    // First ensure conversation exists and is up-to-date with metadata
    await this.enrichAndUpsertConversation(message.userId, message.slackChannelId)
    
    // Insert/update message - message.userId is now a UUID, use directly
    await this.db.query(`
      INSERT INTO messages (
        user_id, 
        conversation_id, 
        slack_channel_id, 
        message_ts, 
        thread_ts,
        text, 
        message_type, 
        subtype, 
        slack_user_id,
        slack_user_name,
        has_files, 
        has_reactions, 
        has_replies, 
        reply_count, 
        slack_timestamp
      ) VALUES (
        $1,
        (SELECT id FROM conversations WHERE user_id = $1 AND slack_channel_id = $2),
        $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (user_id, slack_channel_id, message_ts) DO UPDATE SET
        text = EXCLUDED.text,
        message_type = EXCLUDED.message_type,
        slack_user_name = EXCLUDED.slack_user_name,
        has_files = EXCLUDED.has_files,
        has_reactions = EXCLUDED.has_reactions,
        has_replies = EXCLUDED.has_replies,
        reply_count = EXCLUDED.reply_count,
        is_edited = true,
        updated_at = NOW()
    `, [
      message.userId, // Now a UUID
      message.slackChannelId,
      message.messageTs,
      message.threadTs,
      message.text,
      message.messageType || 'message',
      message.subtype,
      message.slackUserId,
      message.slackUserName,
      message.hasFiles || false,
      message.hasReactions || false,
      message.hasReplies || false,
      message.replyCount || 0,
      this.parseSlackTimestamp(message.slackTimestamp)
    ])
    
    // Update conversation last activity - message.userId is now a UUID
    await this.db.query(`
      UPDATE conversations 
      SET last_message_ts = $1, 
          last_message_preview = $2,
          last_activity_at = $5,
          updated_at = NOW()
      WHERE user_id = $3 AND slack_channel_id = $4
    `, [
      message.messageTs,
      message.text?.substring(0, 100) || '',
      message.userId, // Now a UUID
      message.slackChannelId,
      this.parseSlackTimestamp(message.slackTimestamp)
    ])
  }

  /**
   * Store message quickly for Events API cache updates
   * OPTIMIZED: Single transaction, minimal queries (1-2 max)
   */
  async storeMessageQuick(message: QuickMessageInput): Promise<void> {
    await this.db.transaction(async (client) => {
      // UPSERT conversation with minimal data
      // message.userId is now a UUID, use it directly
      await client.query(`
        INSERT INTO conversations (user_id, slack_channel_id, type, last_message_ts, last_activity_at)
        VALUES ($1, $2, 'channel', $3, $4)
        ON CONFLICT (user_id, slack_channel_id) 
        DO UPDATE SET 
          last_message_ts = EXCLUDED.last_message_ts,
          last_activity_at = EXCLUDED.last_activity_at,
          updated_at = NOW()
      `, [message.userId, message.slackChannelId, message.messageTs, this.parseSlackTimestamp(message.slackTimestamp)])
      
      // Insert/update message
      // message.userId is now a UUID, use it directly
      await client.query(`
        INSERT INTO messages (
          user_id, 
          conversation_id, 
          slack_channel_id, 
          message_ts, 
          thread_ts,
          text, 
          message_type, 
          subtype, 
          slack_user_id,
          bot_id,
          has_files, 
          has_reactions, 
          has_replies, 
          reply_count, 
          slack_timestamp
        ) VALUES (
          $1,
          (SELECT id FROM conversations WHERE user_id = $1 AND slack_channel_id = $2),
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT (user_id, slack_channel_id, message_ts) DO UPDATE SET
          text = EXCLUDED.text,
          message_type = EXCLUDED.message_type,
          is_edited = true,
          updated_at = NOW()
      `, [
        message.userId, // Now a UUID
        message.slackChannelId,
        message.messageTs,
        message.threadTs,
        message.text,
        message.messageType || 'message',
        message.subtype,
        message.slackUserId || null,
        message.botId,
        message.hasFiles || false,
        message.hasReactions || false,
        message.hasReplies || false,
        message.replyCount || 0,
        this.parseSlackTimestamp(message.slackTimestamp)
      ])
    })
  }

  /**
   * Mark message as deleted in cache (for Events API)
   * OPTIMIZED: Single query update
   */
  async markMessageDeleted(userUuid: string, channelId: string, messageTs: string): Promise<void> {
    await this.db.query(`
      UPDATE messages 
      SET is_deleted = true, 
          text = '[Message deleted]',
          updated_at = NOW()
      WHERE user_id = $1 
        AND slack_channel_id = $2 
        AND message_ts = $3
    `, [userUuid, channelId, messageTs])
  }

  /**
   * Enrich conversation with real Slack data before storing
   */
  private async enrichAndUpsertConversation(userUuid: string, channelId: string): Promise<void> {
    try {
      // Check if conversation already exists and is enriched
      const existing = await this.getConversation(userUuid, channelId)
      if (existing && existing.name) {
        // Already enriched, no need to fetch again
        return
      }

      // Need to get antiId from userUuid to fetch user data
      const userResult = await this.db.query('SELECT anti_id FROM users WHERE id = $1', [userUuid])
      if (userResult.rows.length === 0) {
        throw new Error(`User not found for UUID: ${userUuid}`)
      }
      const antiId = userResult.rows[0].anti_id

      // Get user to fetch Slack token
      const user = await getUser(antiId)
      if (!user || !user.accessToken) {
        logger.warn('No user or token found for conversation enrichment', { userUuid, channelId })
        // Fall back to minimal conversation
        await this.upsertConversation(userUuid, channelId, {
          userId: userUuid,
          slackChannelId: channelId,
          type: this.guessConversationType(channelId),
          isPrivate: false
        })
        return
      }

      // Fetch real conversation data from Slack
      logger.info('Enriching conversation with Slack data', { userUuid, channelId })
      const response = await getConversationDetails(user, channelId)
      
      if (!response.success) {
        throw new Error(`Failed to fetch conversation details: ${(response as any).error || 'Unknown error'}`)
      }

      const slackConversation = (response as any).conversation

      // Map Slack data to our conversation format
      const conversationData = {
        userId: userUuid,
        slackChannelId: channelId,
        name: slackConversation.name,
        displayName: this.formatDisplayName(slackConversation),
        topic: slackConversation.topic,
        purpose: slackConversation.purpose,
        type: this.mapSlackConversationType(slackConversation),
        isPrivate: slackConversation.is_private || false,
        isArchived: false, // Not available in current response
        isMember: slackConversation.is_member || true,
        memberCount: 0 // Not available in current response
      }

      await this.upsertConversation(userUuid, channelId, conversationData)

      logger.info('Conversation enriched successfully', { 
        userUuid, 
        channelId, 
        name: conversationData.name,
        type: conversationData.type
      })

    } catch (error) {
      logger.error('Failed to enrich conversation, using fallback', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId })
      
      // Fall back to minimal conversation
      await this.upsertConversation(userUuid, channelId, {
        userId: userUuid,
        slackChannelId: channelId,
        type: this.guessConversationType(channelId),
        isPrivate: false
      })
    }
  }

  /**
   * Guess conversation type from channel ID format
   */
  private guessConversationType(channelId: string): 'channel' | 'im' | 'mpim' | 'group' {
    if (channelId.startsWith('D')) return 'im'      // Direct message
    if (channelId.startsWith('G')) return 'group'   // Private group
    if (channelId.startsWith('C')) return 'channel' // Public channel
    return 'channel' // Default fallback
  }

  /**
   * Map Slack conversation type to our type
   */
  private mapSlackConversationType(conversation: any): 'channel' | 'im' | 'mpim' | 'group' {
    if (conversation.is_im) return 'im'
    if (conversation.is_mpim) return 'mpim' 
    if (conversation.is_group) return 'group'
    return 'channel'
  }

  /**
   * Format display name for UI
   */
  private formatDisplayName(conversation: any): string {
    // For DMs, try to get the other user's display name
    if (conversation.is_im && conversation.user) {
      // TODO: Get user display name from user cache
      return `@${conversation.user}`
    }
    
    // For channels/groups, use the name with appropriate prefix
    const name = conversation.name || `Channel ${conversation.id}`
    if (conversation.is_private) {
      return `🔒 ${name}`
    }
    return `# ${name}`
  }

  // ===============================
  // Session Management (Week 4)
  // ===============================

  /**
   * Touch user activity to extend cache session
   */
  async touchUserActivity(antiId: string): Promise<void> {
    await this.db.query(
      'UPDATE users SET updated_at = NOW() WHERE anti_id = $1',
      [antiId]
    )
    logger.debug('User activity touched', { antiId })
  }

  /**
   * Check if user cache is still active (within 1 hour)
   */
  async isUserCacheActive(antiId: string): Promise<boolean> {
    const result = await this.db.query(
      'SELECT updated_at FROM users WHERE anti_id = $1 AND updated_at > NOW() - INTERVAL \'1 hour\'',
      [antiId]
    )
    return result.rows.length > 0
  }

  /**
   * Clean up inactive users (cache expired after 1 hour)
   */
  async cleanupInactiveUsers(): Promise<string[]> {
    const result = await this.db.query(`
      DELETE FROM users 
      WHERE updated_at < NOW() - INTERVAL '1 hour'
      RETURNING anti_id
    `)
    
    const cleanedUserIds = result.rows.map(row => row.anti_id)
    logger.info('Cleaned up inactive users', { count: cleanedUserIds.length, userIds: cleanedUserIds })
    return cleanedUserIds
  }

  /**
   * Get cache status for a user
   */
  async getCacheStatus(antiId: string): Promise<{
    isActive: boolean
    lastActivity?: string
    messageCount: number
    conversationCount: number
  }> {
    const user = await this.getUser(antiId)
    if (!user) {
      return {
        isActive: false,
        messageCount: 0,
        conversationCount: 0
      }
    }

    const isActive = await this.isUserCacheActive(antiId)
    
    // Get counts for last 7 days
    const [messageResult, conversationResult] = await Promise.all([
      this.db.query(
        'SELECT COUNT(*) FROM messages WHERE user_id = $1 AND created_at > NOW() - INTERVAL \'7 days\'',
        [user.id]
      ),
      this.db.query(
        'SELECT COUNT(*) FROM conversations WHERE user_id = $1',
        [user.id]
      )
    ])

    return {
      isActive,
      lastActivity: user.updatedAt,
      messageCount: parseInt(messageResult.rows[0].count),
      conversationCount: parseInt(conversationResult.rows[0].count)
    }
  }

  // ===============================
  // Health Check
  // ===============================

  async healthCheck(): Promise<boolean> {
    return this.db.healthCheck()
  }

  // ===============================
  // Helper Methods
  // ===============================

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      antiId: row.anti_id,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      teamId: row.team_id,
      teamName: row.team_name,
      slackUserId: row.slack_user_id,
      slackUserName: row.slack_user_name,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }
  }

  private mapRowToConversation(row: any): Conversation {
    return {
      id: row.id,
      userId: row.user_id,
      slackChannelId: row.slack_channel_id,
      name: row.name,
      topic: row.topic,
      purpose: row.purpose,
      displayName: row.display_name,
      type: row.type,
      isPrivate: row.is_private,
      isArchived: row.is_archived,
      isMember: row.is_member,
      avatarUrl: row.avatar_url,
      memberCount: row.member_count,
      lastReadTs: row.last_read_ts,
      unreadCount: row.unread_count,
      unreadCountDisplay: row.unread_count_display,
      lastMessageTs: row.last_message_ts,
      lastMessageUserId: row.last_message_user_id,
      lastMessagePreview: row.last_message_preview,
      lastActivityAt: row.last_activity_at?.toISOString(),
      isMuted: row.is_muted,
      mutedUntil: row.muted_until?.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    }
  }

  private formatTime(timestamp: Date | null): string {
    if (!timestamp) return ''

    const now = new Date()
    const messageTime = new Date(timestamp)
    const diff = now.getTime() - messageTime.getTime()
    const hours = diff / (1000 * 60 * 60)
    const days = hours / 24

    // Same day - show time only
    if (hours < 24 && now.toDateString() === messageTime.toDateString()) {
      return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } 
    // Within a week - show day and time
    else if (days < 7) {
      return messageTime.toLocaleDateString([], { 
        weekday: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
    // Older - show date and time
    else {
      return messageTime.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    }
  }

  // ===============================
  // Message Reactions
  // ===============================
  // NOTE: All methods now expect userUuid (users.id) instead of antiId for performance

  async addMessageReaction(userUuid: string, channelId: string, messageTs: string, reaction: Omit<MessageReaction, 'id' | 'userId' | 'messageId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO message_reactions (
          user_id, 
          message_id, 
          emoji_name, 
          count, 
          users_reacted, 
          user_reacted
        ) VALUES (
          $1,
          (SELECT id FROM messages WHERE user_id = $1 AND slack_channel_id = $2 AND message_ts = $3),
          $4, $5, $6, $7
        )
        ON CONFLICT (user_id, message_id, emoji_name) DO UPDATE SET
          count = EXCLUDED.count,
          users_reacted = EXCLUDED.users_reacted,
          user_reacted = EXCLUDED.user_reacted,
          updated_at = NOW()
      `, [
        userUuid,
        channelId,
        messageTs,
        reaction.emojiName,
        reaction.count,
        JSON.stringify(reaction.usersReacted),
        reaction.userReacted
      ])

      logger.info('Message reaction added', { userUuid, channelId, messageTs, emojiName: reaction.emojiName })
    } catch (error) {
      logger.error('Failed to add message reaction', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId, messageTs })
      throw error
    }
  }

  async removeMessageReaction(userUuid: string, channelId: string, messageTs: string, emojiName: string): Promise<void> {
    try {
      await this.db.query(`
        DELETE FROM message_reactions 
        WHERE user_id = $1 
          AND message_id = (
            SELECT id FROM messages 
            WHERE user_id = $1 AND slack_channel_id = $2 AND message_ts = $3
          )
          AND emoji_name = $4
      `, [userUuid, channelId, messageTs, emojiName])

      logger.info('Message reaction removed', { userUuid, channelId, messageTs, emojiName })
    } catch (error) {
      logger.error('Failed to remove message reaction', error instanceof Error ? error : new Error(String(error)), { userUuid, channelId, messageTs })
      throw error
    }
  }

  // ===============================
  // Batch Operations for Performance
  // ===============================
  // NOTE: All batch methods now expect UUIDs consistently

  async storeBatchMessages(messages: CreateMessageInput[]): Promise<void> {
    if (messages.length === 0) return

    try {
      await this.db.transaction(async (client) => {
        for (const message of messages) {
          // message.userId is now a UUID, use directly
          await client.query(`
            INSERT INTO messages (
              user_id, 
              conversation_id, 
              slack_channel_id, 
              message_ts, 
              thread_ts,
              text, 
              message_type, 
              subtype, 
              slack_user_id,
              slack_user_name,
              has_files, 
              has_reactions, 
              has_replies, 
              reply_count, 
              slack_timestamp
            ) VALUES (
              $1,
              (SELECT id FROM conversations WHERE user_id = $1 AND slack_channel_id = $2),
              $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
            )
            ON CONFLICT (user_id, slack_channel_id, message_ts) DO UPDATE SET
              text = EXCLUDED.text,
              message_type = EXCLUDED.message_type,
              slack_user_name = EXCLUDED.slack_user_name,
              has_files = EXCLUDED.has_files,
              has_reactions = EXCLUDED.has_reactions,
              has_replies = EXCLUDED.has_replies,
              reply_count = EXCLUDED.reply_count,
              is_edited = true,
              updated_at = NOW()
          `, [
            message.userId, // Now a UUID
            message.slackChannelId,
            message.messageTs,
            message.threadTs,
            message.text,
            message.messageType || 'message',
            message.subtype,
            message.slackUserId,
            message.slackUserName,
            message.hasFiles || false,
            message.hasReactions || false,
            message.hasReplies || false,
            message.replyCount || 0,
            this.parseSlackTimestamp(message.slackTimestamp)
          ])
        }
      })

      logger.info('Batch messages stored successfully', { count: messages.length })
    } catch (error) {
      logger.error('Failed to store batch messages', error instanceof Error ? error : new Error(String(error)), { count: messages.length })
      throw error
    }
  }

  async upsertBatchConversations(conversations: Array<{
    userId: string // This is now a UUID
    slackChannelId: string
    name: string
    displayName: string
    type: string
    isPrivate: boolean
    isArchived: boolean
    isMember: boolean
    memberCount: number
    unreadCount?: number
    unreadCountDisplay?: number
    lastReadTs?: string
    lastMessageTs?: string
    lastMessagePreview?: string
  }>): Promise<void> {
    if (conversations.length === 0) return

    try {
      await this.db.transaction(async (client) => {
        for (const conv of conversations) {
          // conv.userId is now a UUID, use directly
          await client.query(`
            INSERT INTO conversations (
              user_id, slack_channel_id, name, display_name, type,
              is_private, is_archived, is_member, member_count,
              unread_count, unread_count_display, last_read_ts,
              last_message_ts, last_message_preview
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (user_id, slack_channel_id) DO UPDATE SET
              name = EXCLUDED.name,
              display_name = EXCLUDED.display_name,
              type = EXCLUDED.type,
              is_private = EXCLUDED.is_private,
              is_archived = EXCLUDED.is_archived,
              is_member = EXCLUDED.is_member,
              member_count = EXCLUDED.member_count,
              unread_count = EXCLUDED.unread_count,
              unread_count_display = EXCLUDED.unread_count_display,
              last_read_ts = EXCLUDED.last_read_ts,
              last_message_ts = EXCLUDED.last_message_ts,
              last_message_preview = EXCLUDED.last_message_preview,
              updated_at = NOW()
          `, [
            conv.userId, // Now a UUID
            conv.slackChannelId,
            conv.name,
            conv.displayName,
            conv.type,
            conv.isPrivate,
            conv.isArchived,
            conv.isMember,
            conv.memberCount,
            conv.unreadCount || 0,
            conv.unreadCountDisplay || 0,
            conv.lastReadTs,
            conv.lastMessageTs,
            conv.lastMessagePreview
          ])
        }
      })

      logger.info('Batch conversations upserted successfully', { count: conversations.length })
    } catch (error) {
      logger.error('Failed to upsert batch conversations', error instanceof Error ? error : new Error(String(error)), { count: conversations.length })
      throw error
    }
  }

  // ===============================
  // Sync State Management
  // ===============================
  // NOTE: Sync state methods expect UUIDs for consistency

  async syncUserProfiles(profiles: Array<{
    slackUserId: string
    realName: string
    displayName: string
    avatarUrl?: string
  }>): Promise<void> {
    if (profiles.length === 0) return

    logger.info('Syncing user profiles', { profileCount: profiles.length })

    try {
      // For now, we'll store this as a simple lookup table
      // In the future, this could be a dedicated user_profiles table
      // For MVP, we'll just log the profiles for message attribution
      for (const profile of profiles) {
        logger.debug('User profile cached', {
          slackUserId: profile.slackUserId,
          displayName: profile.displayName,
          realName: profile.realName
        })
      }
      
      logger.info('User profiles synced successfully', { profileCount: profiles.length })
      
    } catch (error) {
      logger.error('Failed to sync user profiles', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async getSyncState(userUuid: string, conversationId?: string): Promise<{
    lastSyncTs: Date
    syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
    lastMessageTs?: string
    messagesSynced: number
    conversationsSynced: number
  } | null> {
    try {
      const result = await this.db.query(`
        SELECT last_sync_ts, sync_status, last_message_ts, messages_synced, conversations_synced
        FROM sync_state 
        WHERE user_id = $1 AND ($2::text IS NULL OR conversation_id = $2)
        ORDER BY last_sync_ts DESC
        LIMIT 1
      `, [userUuid, conversationId])

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return {
        lastSyncTs: row.last_sync_ts,
        syncStatus: row.sync_status,
        lastMessageTs: row.last_message_ts,
        messagesSynced: row.messages_synced || 0,
        conversationsSynced: row.conversations_synced || 0
      }
      
    } catch (error) {
      logger.error('Failed to get sync state', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async updateSyncState(state: {
    userId: string // This is now a UUID
    conversationId?: string
    syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
    messagesSynced?: number
    conversationsSynced?: number
    syncDurationMs?: number
    errorMessage?: string
  }): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO sync_state (
          user_id, conversation_id, last_sync_ts, sync_status, 
          messages_synced, conversations_synced, sync_duration_ms, error_message
        ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7)
        ON CONFLICT (user_id, conversation_id) DO UPDATE SET
          last_sync_ts = NOW(),
          sync_status = EXCLUDED.sync_status,
          messages_synced = EXCLUDED.messages_synced,
          conversations_synced = EXCLUDED.conversations_synced,
          sync_duration_ms = EXCLUDED.sync_duration_ms,
          error_message = EXCLUDED.error_message,
          updated_at = NOW()
      `, [
        state.userId, // Now a UUID
        state.conversationId,
        state.syncStatus,
        state.messagesSynced || 0,
        state.conversationsSynced || 0,
        state.syncDurationMs || 0,
        state.errorMessage
      ])
      
    } catch (error) {
      logger.error('Failed to update sync state', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  async getAllSyncStates(userUuid: string): Promise<Array<{
    conversationId?: string
    lastSyncTs: Date
    syncStatus: string
    lastMessageTs?: string
    messagesSynced: number
  }>> {
    try {
      const result = await this.db.query(`
        SELECT conversation_id, last_sync_ts, sync_status, last_message_ts, messages_synced
        FROM sync_state 
        WHERE user_id = $1
        ORDER BY last_sync_ts DESC
      `, [userUuid])

      return result.rows.map(row => ({
        conversationId: row.conversation_id,
        lastSyncTs: row.last_sync_ts,
        syncStatus: row.sync_status,
        lastMessageTs: row.last_message_ts,
        messagesSynced: row.messages_synced || 0
      }))
      
    } catch (error) {
      logger.error('Failed to get all sync states', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  // ===============================
  // Placeholder methods (not implemented)
  // ===============================

  async updateMessage(): Promise<void> { throw new Error('Not implemented') }
  async deleteMessage(): Promise<void> { throw new Error('Not implemented') }
  async getMessageHistory(): Promise<any[]> { throw new Error('Not implemented') }
  async getThreadMessages(): Promise<any[]> { throw new Error('Not implemented') }
  async updateThreadState(): Promise<void> { throw new Error('Not implemented') }
  async getRecentMessages(): Promise<any[]> { throw new Error('Not implemented') }
  async searchMessages(): Promise<any[]> { throw new Error('Not implemented') }
  async storeMessageFiles(): Promise<void> { throw new Error('Not implemented') }
  async updateMessageReactions(): Promise<void> { throw new Error('Not implemented') }
  async exportUserData(): Promise<any> { throw new Error('Not implemented') }
} 