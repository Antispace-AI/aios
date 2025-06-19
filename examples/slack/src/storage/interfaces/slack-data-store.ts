// Core storage interface for Slack data operations
// Combines CQRS commands and queries in a single interface for simplicity

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
  UpdateMessageInput,
  GetMessagesQuery,
  GetConversationsQuery,
  SearchMessagesQuery,
  QuickMessageInput
} from '../schema/types/database'

export interface SlackDataStore {
  // ===============================
  // User Management
  // ===============================
  
  /**
   * Get user by Antispace ID
   */
  getUser(antiId: string): Promise<User | null>
  
  /**
   * Create new user
   */
  createUser(userData: CreateUserInput): Promise<User>
  
  /**
   * Update existing user
   */
  updateUser(antiId: string, updates: UpdateUserInput): Promise<User>
  
  /**
   * Delete all user data (GDPR compliance)
   */
  deleteUserData(antiId: string): Promise<void>

  // ===============================
  // Conversation Management
  // ===============================
  
  /**
   * Get specific conversation state
   */
  getConversation(userId: string, channelId: string): Promise<Conversation | null>
  
  /**
   * Create or update conversation
   */
  upsertConversation(userId: string, channelId: string, data: CreateConversationInput): Promise<Conversation>
  
  /**
   * Update conversation state (unread counts, read timestamps, etc.)
   */
  updateConversation(userId: string, channelId: string, updates: UpdateConversationInput): Promise<Conversation>
  
  /**
   * Get conversation list for UI (sidebar)
   */
  getConversationList(query: GetConversationsQuery): Promise<ConversationListItem[]>
  
  /**
   * Get unread summary across all conversations
   */
  getUnreadSummary(userId: string): Promise<UnreadSummary>
  
  /**
   * Mark conversation as read up to specific timestamp
   */
  markConversationAsRead(userId: string, channelId: string, readTs: string): Promise<void>

  // ===============================
  // Message & Thread Operations
  // ===============================
  
  /**
   * Store new message
   */
  storeMessage(message: CreateMessageInput): Promise<void>
  
  /**
   * Store message quickly for Events API cache updates
   * Optimized for minimal database queries (1-2 queries max)
   */
  storeMessageQuick(message: QuickMessageInput): Promise<void>
  
  /**
   * Update existing message (edits, reactions, etc.)
   */
  updateMessage(userId: string, messageId: string, updates: UpdateMessageInput): Promise<void>
  
  /**
   * Delete message (soft delete - mark as deleted)
   */
  deleteMessage(userId: string, messageId: string): Promise<void>
  
  /**
   * Get message history for conversation (with pagination)
   */
  getMessageHistory(query: GetMessagesQuery): Promise<MessageWithFiles[]>
  
  /**
   * Get thread messages
   */
  getThreadMessages(userId: string, channelId: string, threadTs: string): Promise<MessageWithFiles[]>
  
  /**
   * Update thread metadata
   */
  updateThreadState(userId: string, channelId: string, threadTs: string, updates: Partial<Thread>): Promise<void>
  
  /**
   * Get recent messages across all conversations (unified inbox)
   */
  getRecentMessages(userId: string, limit?: number): Promise<MessageWithFiles[]>
  
  /**
   * Search messages
   */
  searchMessages(query: SearchMessagesQuery): Promise<MessageWithFiles[]>
  
  /**
   * Mark message as deleted in cache (for Events API)
   */
  markMessageDeleted(userId: string, channelId: string, messageTs: string): Promise<void>

  // ===============================
  // Rich Content Operations
  // ===============================
  
  /**
   * Store file attachments for a message
   */
  storeMessageFiles(userId: string, messageId: string, files: Omit<MessageFile, 'id' | 'userId' | 'messageId' | 'createdAt'>[]): Promise<void>
  
  /**
   * Update message reactions
   */
  updateMessageReactions(userId: string, messageId: string, reactions: Omit<MessageReaction, 'id' | 'userId' | 'messageId' | 'createdAt' | 'updatedAt'>[]): Promise<void>
  
  /**
   * Add single reaction to message
   */
  addMessageReaction(userId: string, channelId: string, messageTs: string, reaction: Omit<MessageReaction, 'id' | 'userId' | 'messageId' | 'createdAt' | 'updatedAt'>): Promise<void>
  
  /**
   * Remove single reaction from message
   */
  removeMessageReaction(userId: string, channelId: string, messageTs: string, emojiName: string): Promise<void>

  // ===============================
  // Session Management (Week 4)
  // ===============================
  
  /**
   * Touch user activity to extend cache session
   */
  touchUserActivity(antiId: string): Promise<void>
  
  /**
   * Check if user cache is still active (within 1 hour)
   */
  isUserCacheActive(antiId: string): Promise<boolean>
  
  /**
   * Clean up inactive users (cache expired after 1 hour)
   */
  cleanupInactiveUsers(): Promise<string[]>
  
  /**
   * Get cache status for a user
   */
  getCacheStatus(antiId: string): Promise<{
    isActive: boolean
    lastActivity?: string
    messageCount: number
    conversationCount: number
  }>

  // ===============================
  // Data Synchronization (Week 5)
  // ===============================
  
  /**
   * Store multiple messages in batch for efficient sync
   */
  storeBatchMessages(messages: CreateMessageInput[]): Promise<void>
  
  /**
   * Store multiple conversations in batch for efficient sync
   */
  upsertBatchConversations(conversations: Array<{
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
  }>): Promise<void>
  
  /**
   * Sync user profiles for message attribution
   */
  syncUserProfiles(profiles: Array<{
    slackUserId: string
    realName: string
    displayName: string
    avatarUrl?: string
  }>): Promise<void>
  
  /**
   * Get sync state for user/conversation
   */
  getSyncState(userId: string, conversationId?: string): Promise<{
    lastSyncTs: Date
    syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
    lastMessageTs?: string
    messagesSynced: number
    conversationsSynced: number
  } | null>
  
  /**
   * Update sync state tracking
   */
  updateSyncState(state: {
    userId: string
    conversationId?: string
    syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
    messagesSynced?: number
    conversationsSynced?: number
    syncDurationMs?: number
    errorMessage?: string
  }): Promise<void>
  
  /**
   * Get all sync states for a user
   */
  getAllSyncStates(userId: string): Promise<Array<{
    conversationId?: string
    lastSyncTs: Date
    syncStatus: string
    lastMessageTs?: string
    messagesSynced: number
  }>>

  // ===============================
  // Data Export & Privacy
  // ===============================
  
  /**
   * Export all user data for GDPR compliance
   */
  exportUserData(userId: string): Promise<UserDataExport>
  
  /**
   * Health check for database connection
   */
  healthCheck(): Promise<boolean>
} 