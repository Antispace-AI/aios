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

  async getConversation(userId: string, channelId: string): Promise<Conversation | null> {
    try {
      const result = await this.db.query(`
        SELECT c.*
        FROM conversations c
        JOIN users u ON c.user_id = u.id
        WHERE u.anti_id = $1 AND c.slack_channel_id = $2
      `, [userId, channelId])

      if (result.rows.length === 0) {
        return null
      }

      return this.mapRowToConversation(result.rows[0])
    } catch (error) {
      logger.error('Failed to get conversation', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
      throw error
    }
  }

  async upsertConversation(userId: string, channelId: string, data: CreateConversationInput): Promise<Conversation> {
    try {
      // First, get the user's UUID
      const userResult = await this.db.query(
        'SELECT id FROM users WHERE anti_id = $1',
        [userId]
      )

      if (userResult.rows.length === 0) {
        throw new Error(`User not found: ${userId}`)
      }

      const userUuid = userResult.rows[0].id

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
      logger.error('Failed to upsert conversation', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
      throw error
    }
  }

  async updateConversation(userId: string, channelId: string, updates: UpdateConversationInput): Promise<Conversation> {
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
          c.last_message_preview,
          c.last_message_user_id,
          c.last_message_ts
        FROM conversations c
        JOIN users u ON c.user_id = u.id
        WHERE u.anti_id = $1
      `
      const values = [query.userId]
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

      // Add sorting
      const sortBy = query.sortBy || 'activity'
      switch (sortBy) {
        case 'alphabetical':
          sql += ` ORDER BY c.display_name ASC`
          break
        case 'unread':
          sql += ` ORDER BY c.unread_count DESC, c.last_activity_at DESC NULLS LAST`
          break
        default: // 'activity'
          sql += ` ORDER BY c.last_activity_at DESC NULLS LAST`
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
        lastActivityAt: row.last_activity_at?.toISOString(),
        lastMessagePreview: row.last_message_preview,
        lastMessageUserId: row.last_message_user_id,
        lastMessageTs: row.last_message_ts,
        formattedTime: this.formatTime(row.last_activity_at),
        hasUnread: (row.unread_count || 0) > 0
      }))
    } catch (error) {
      logger.error('Failed to get conversation list', error instanceof Error ? error : new Error(String(error)), { userId: query.userId })
      throw error
    }
  }

  async getUnreadSummary(userId: string): Promise<UnreadSummary> {
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
        JOIN users u ON c.user_id = u.id
        WHERE u.anti_id = $1 AND c.unread_count > 0
      `, [userId])

      const row = result.rows[0]
      return {
        totalUnread: parseInt(row.total_unread) || 0,
        conversations: row.unread_conversations || []
      }
    } catch (error) {
      logger.error('Failed to get unread summary', error instanceof Error ? error : new Error(String(error)), { userId })
      throw error
    }
  }

  async markConversationAsRead(userId: string, channelId: string, readTs: string): Promise<void> {
    try {
      await this.db.query(`
        UPDATE conversations 
        SET last_read_ts = $1, unread_count = 0, unread_count_display = 0, updated_at = NOW()
        FROM users u
        WHERE conversations.user_id = u.id 
          AND u.anti_id = $2 
          AND conversations.slack_channel_id = $3
      `, [readTs, userId, channelId])

      logger.info('Conversation marked as read', { userId, channelId, readTs })
    } catch (error) {
      logger.error('Failed to mark conversation as read', error instanceof Error ? error : new Error(String(error)), { userId, channelId, readTs })
      throw error
    }
  }

  // ===============================
  // Message Operations
  // ===============================

  async storeMessage(message: CreateMessageInput): Promise<void> {
    // First, ensure conversation exists
    await this.upsertConversation(message.userId, message.slackChannelId, {
      userId: message.userId,
      slackChannelId: message.slackChannelId,
      type: 'channel', // Default, will be updated with real data later
      isPrivate: false
    })
    
    // Get conversation ID
    const convResult = await this.db.query(
      'SELECT id FROM conversations WHERE user_id = $1 AND slack_channel_id = $2',
      [message.userId, message.slackChannelId]
    )
    
    if (convResult.rows.length === 0) {
      throw new Error(`Conversation not found for channel ${message.slackChannelId}`)
    }
    
    const conversationId = convResult.rows[0].id
    
    // Store the message
    await this.db.query(`
      INSERT INTO messages (
        user_id, conversation_id, slack_channel_id, message_ts, thread_ts,
        text, message_type, subtype, slack_user_id, slack_user_name,
        has_files, has_reactions, has_replies, reply_count, slack_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id, slack_channel_id, message_ts) DO UPDATE SET
        text = EXCLUDED.text,
        is_edited = true,
        updated_at = NOW()
    `, [
      message.userId,
      conversationId,
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
    
    // Update conversation last activity
    await this.db.query(`
      UPDATE conversations 
      SET last_message_ts = $1, 
          last_message_preview = $2,
          last_activity_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $3 AND slack_channel_id = $4
    `, [
      message.messageTs,
      message.text?.substring(0, 100) || '',
      message.userId,
      message.slackChannelId
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
        VALUES ($1, $2, 'channel', $3, NOW())
        ON CONFLICT (user_id, slack_channel_id) 
        DO UPDATE SET 
          last_message_ts = EXCLUDED.last_message_ts,
          last_activity_at = NOW(),
          updated_at = NOW()
      `, [message.userId, message.slackChannelId, message.messageTs])
      
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
        message.slackUserId,
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
  async markMessageDeleted(userId: string, channelId: string, messageTs: string): Promise<void> {
    await this.db.query(`
      UPDATE messages 
      SET is_deleted = true, 
          text = '[Message deleted]',
          updated_at = NOW()
      WHERE user_id = $1 
        AND slack_channel_id = $2 
        AND message_ts = $3
    `, [userId, channelId, messageTs])
  }

  /**
   * Enrich conversation with real Slack data before storing
   */
  private async enrichAndUpsertConversation(userId: string, channelId: string): Promise<void> {
    try {
      // Check if conversation already exists and is enriched
      const existing = await this.getConversation(userId, channelId)
      if (existing && existing.name) {
        // Already enriched, no need to fetch again
        return
      }

      // Get user to fetch Slack token
      const user = await getUser(userId)
      if (!user || !user.accessToken) {
        logger.warn('No user or token found for conversation enrichment', { userId, channelId })
        // Fall back to minimal conversation
        await this.upsertConversation(userId, channelId, {
          userId,
          slackChannelId: channelId,
          type: this.guessConversationType(channelId),
          isPrivate: false
        })
        return
      }

      // Fetch real conversation data from Slack
      logger.info('Enriching conversation with Slack data', { userId, channelId })
      const response = await getConversationDetails(user, channelId)
      
      if (!response.success) {
        throw new Error(`Failed to fetch conversation details: ${(response as any).error || 'Unknown error'}`)
      }

      const slackConversation = (response as any).conversation

      // Map Slack data to our conversation format
      const conversationData = {
        userId,
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

      await this.upsertConversation(userId, channelId, conversationData)

      logger.info('Conversation enriched successfully', { 
        userId, 
        channelId, 
        name: conversationData.name,
        type: conversationData.type
      })

    } catch (error) {
      logger.error('Failed to enrich conversation, using fallback', error instanceof Error ? error : new Error(String(error)), { userId, channelId })
      
      // Fall back to minimal conversation
      await this.upsertConversation(userId, channelId, {
        userId,
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
    const diff = now.getTime() - timestamp.getTime()
    const hours = diff / (1000 * 60 * 60)

    if (hours < 24) {
      return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return timestamp.toLocaleDateString()
    }
  }

  // ===============================
  // Message Reactions
  // ===============================

  async addMessageReaction(userId: string, channelId: string, messageTs: string, reaction: Omit<MessageReaction, 'id' | 'userId' | 'messageId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    logger.info('Adding message reaction', { userId, channelId, messageTs, reaction: reaction.emojiName })
    
    const client = await this.db.query('BEGIN')
    
    try {
      // Get message ID
      const messageResult = await this.db.query(`
        SELECT id FROM messages 
        WHERE user_id = $1 AND slack_channel_id = $2 AND message_ts = $3
      `, [userId, channelId, messageTs])
      
      if (messageResult.rows.length === 0) {
        logger.warn('Message not found for reaction', { userId, channelId, messageTs })
        return
      }
      
      const messageId = messageResult.rows[0].id
      
      // Upsert reaction (update count if exists, insert if not)
      await this.db.query(`
        INSERT INTO message_reactions (user_id, message_id, emoji_name, count, user_reacted)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (user_id, message_id, emoji_name) 
        DO UPDATE SET 
          count = EXCLUDED.count,
          user_reacted = EXCLUDED.user_reacted,
          updated_at = NOW()
      `, [userId, messageId, reaction.emojiName, reaction.count, reaction.userReacted])
      
      await this.db.query('COMMIT')
      logger.info('Message reaction added successfully', { userId, channelId, messageTs, reaction: reaction.emojiName })
      
    } catch (error) {
      await this.db.query('ROLLBACK')
      logger.error('Failed to add message reaction', error instanceof Error ? error : new Error(String(error)), { userId, channelId, messageTs })
      throw error
    }
  }

  async removeMessageReaction(userId: string, channelId: string, messageTs: string, emojiName: string): Promise<void> {
    logger.info('Removing message reaction', { userId, channelId, messageTs, emojiName })
    
    try {
      // Get message ID
      const messageResult = await this.db.query(`
        SELECT id FROM messages 
        WHERE user_id = $1 AND slack_channel_id = $2 AND message_ts = $3
      `, [userId, channelId, messageTs])
      
      if (messageResult.rows.length === 0) {
        logger.warn('Message not found for reaction removal', { userId, channelId, messageTs })
        return
      }
      
      const messageId = messageResult.rows[0].id
      
      // Remove reaction
      await this.db.query(`
        DELETE FROM message_reactions 
        WHERE user_id = $1 AND message_id = $2 AND emoji_name = $3
      `, [userId, messageId, emojiName])
      
      logger.info('Message reaction removed successfully', { userId, channelId, messageTs, emojiName })
      
    } catch (error) {
      logger.error('Failed to remove message reaction', error instanceof Error ? error : new Error(String(error)), { userId, channelId, messageTs })
      throw error
    }
  }

  // ===============================
  // Data Synchronization Methods (Week 5)
  // ===============================

  /**
   * Store multiple messages in batch for efficient sync
   */
  async storeBatchMessages(messages: CreateMessageInput[]): Promise<void> {
    if (messages.length === 0) return

    logger.info('Storing batch messages', { messageCount: messages.length })

    const client = await this.db.query('BEGIN')
    
    try {
      // Prepare batch insert with conflict resolution
      const values: string[] = []
      const params: any[] = []
      let paramIndex = 1

      for (const msg of messages) {
        // Get or create conversation
        await this.enrichAndUpsertConversation(msg.userId, msg.slackChannelId)
        
        // Get conversation ID
        const convResult = await this.db.query(
          'SELECT id FROM conversations WHERE user_id = $1 AND slack_channel_id = $2',
          [msg.userId, msg.slackChannelId]
        )
        
        if (convResult.rows.length === 0) {
          logger.warn('Failed to find conversation for batch message', { userId: msg.userId, channelId: msg.slackChannelId })
          continue
        }
        
        const conversationId = convResult.rows[0].id
        
        values.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`)
        
        params.push(
          msg.userId,
          conversationId,
          msg.slackChannelId,
          msg.messageTs,
          msg.threadTs || null,
          msg.text || '',
          msg.messageType || 'message',
          msg.subtype || null,
          msg.slackUserId || null,
          msg.slackUserName || null,
          msg.hasFiles || false,
          msg.hasReactions || false,
          msg.hasReplies || false,
          msg.slackTimestamp ? this.parseSlackTimestamp(msg.slackTimestamp) : new Date()
        )
      }

      if (values.length > 0) {
        const query = `
          INSERT INTO messages (
            user_id, conversation_id, slack_channel_id, message_ts, thread_ts,
            text, message_type, subtype, slack_user_id, slack_user_name,
            has_files, has_reactions, has_replies, slack_timestamp
          ) VALUES ${values.join(', ')}
          ON CONFLICT (user_id, slack_channel_id, message_ts) DO UPDATE SET
            text = EXCLUDED.text,
            is_edited = true,
            updated_at = NOW()
        `
        
        await this.db.query(query, params)
      }

      await this.db.query('COMMIT')
      logger.info('Batch messages stored successfully', { messageCount: messages.length })
      
    } catch (error) {
      await this.db.query('ROLLBACK')
      logger.error('Failed to store batch messages', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Store multiple conversations in batch for efficient sync
   */
  async upsertBatchConversations(conversations: Array<{
    userId: string
    slackChannelId: string
    name: string
    displayName: string
    type: string
    isPrivate: boolean
    isArchived: boolean
    isMember: boolean
    memberCount: number
    lastMessageTs?: string
    lastMessagePreview?: string
  }>): Promise<void> {
    if (conversations.length === 0) return

    logger.info('Upserting batch conversations', { conversationCount: conversations.length })

    const client = await this.db.query('BEGIN')
    
    try {
      for (const conv of conversations) {
        await this.db.query(`
          INSERT INTO conversations (
            user_id, slack_channel_id, name, display_name, type,
            is_private, is_archived, is_member, member_count,
            last_message_ts, last_message_preview, last_activity_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          ON CONFLICT (user_id, slack_channel_id) DO UPDATE SET
            name = EXCLUDED.name,
            display_name = EXCLUDED.display_name,
            type = EXCLUDED.type,
            is_private = EXCLUDED.is_private,
            is_archived = EXCLUDED.is_archived,
            is_member = EXCLUDED.is_member,
            member_count = EXCLUDED.member_count,
            last_message_ts = COALESCE(EXCLUDED.last_message_ts, conversations.last_message_ts),
            last_message_preview = COALESCE(EXCLUDED.last_message_preview, conversations.last_message_preview),
            last_activity_at = GREATEST(conversations.last_activity_at, NOW()),
            updated_at = NOW()
        `, [
          conv.userId,
          conv.slackChannelId,
          conv.name,
          conv.displayName,
          conv.type,
          conv.isPrivate,
          conv.isArchived,
          conv.isMember,
          conv.memberCount,
          conv.lastMessageTs,
          conv.lastMessagePreview
        ])
      }

      await this.db.query('COMMIT')
      logger.info('Batch conversations upserted successfully', { conversationCount: conversations.length })
      
    } catch (error) {
      await this.db.query('ROLLBACK')
      logger.error('Failed to upsert batch conversations', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Sync user profiles for message attribution
   */
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

  /**
   * Get sync state for user/conversation
   */
  async getSyncState(userId: string, conversationId?: string): Promise<{
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
      `, [userId, conversationId])

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

  /**
   * Update sync state tracking
   */
  async updateSyncState(state: {
    userId: string
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
        state.userId,
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

  /**
   * Get all sync states for a user
   */
  async getAllSyncStates(userId: string): Promise<Array<{
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
      `, [userId])

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
  // Not Yet Implemented (TODO)
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