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
      await client.query(`
        INSERT INTO conversations (user_id, slack_channel_id, type, last_message_ts, last_activity_at)
        VALUES (
          (SELECT id FROM users WHERE anti_id = $1), 
          $2, 
          'channel', 
          $3, 
          NOW()
        )
        ON CONFLICT (user_id, slack_channel_id) 
        DO UPDATE SET 
          last_message_ts = EXCLUDED.last_message_ts,
          last_activity_at = NOW(),
          updated_at = NOW()
      `, [message.userId, message.slackChannelId, message.messageTs])
      
      // Insert/update message
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
          (SELECT id FROM users WHERE anti_id = $1),
          (SELECT id FROM conversations WHERE user_id = (SELECT id FROM users WHERE anti_id = $1) AND slack_channel_id = $2),
          $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
        ON CONFLICT (user_id, slack_channel_id, message_ts) DO UPDATE SET
          text = EXCLUDED.text,
          message_type = EXCLUDED.message_type,
          is_edited = true,
          updated_at = NOW()
      `, [
        message.userId,
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
      WHERE user_id = (SELECT id FROM users WHERE anti_id = $1) 
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