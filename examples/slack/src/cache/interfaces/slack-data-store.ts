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
  SearchMessagesQuery
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