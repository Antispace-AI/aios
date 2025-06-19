// Data Pull System Types and Interfaces

export interface PullOptions {
  timeWindow: number          // Days to pull (default: 7)
  includeThreads: boolean     // Pull threaded messages (default: true)
  includeFiles: boolean       // Pull file metadata (default: true)
  includeReactions: boolean   // Pull emoji reactions (default: true)
  batchSize: number          // Messages per batch (default: 100)
  maxConcurrency: number     // Parallel conversations (default: 5)
  rateLimitDelay: number     // Delay between requests (default: 200ms)
}

export interface RefreshOptions {
  incremental?: boolean      // Only pull new data since last sync
  conversationIds?: string[] // Sync specific conversations only
  force?: boolean           // Force full resync even if recent
}

export interface SyncResult {
  success: boolean
  conversationsSync: number  // Number of conversations synced
  messagesSync: number      // Number of messages synced
  usersSync: number         // Number of user profiles synced
  timeWindow: string        // Human readable time range
  duration: number          // Sync duration in milliseconds
  errors: string[]          // Any non-fatal errors encountered
}

export interface ConversationPullResult {
  conversations: Array<{
    id: string
    name: string
    type: string
    lastActivity: Date
    memberCount: number
  }>
  totalCount: number
  activeCount: number // Conversations with activity in timeWindow
  errors: string[]
}

export interface MessagePullResult {
  messages: Array<{
    messageTs: string
    channelId: string
    userId: string
    text: string
    threadTs?: string
    files?: any[]
    reactions?: any[]
  }>
  totalCount: number
  conversationId: string
  timeRange: {
    start: Date
    end: Date
  }
  errors: string[]
}

export interface UserPullResult {
  users: Array<{
    slackUserId: string
    realName: string
    displayName: string
    avatarUrl?: string
  }>
  totalCount: number
  errors: string[]
}

export interface SyncState {
  userId: string
  conversationId?: string
  lastSyncTs: Date
  syncStatus: 'pending' | 'in_progress' | 'completed' | 'failed'
  lastMessageTs?: string
  messagesSynced: number
  createdAt: Date
  updatedAt: Date
}

export interface RateLimitOptions {
  maxConcurrency: number
  delayMs: number
  retryCount?: number
  backoffMultiplier?: number
}

// Default configurations
export const DEFAULT_PULL_OPTIONS: PullOptions = {
  timeWindow: 7,
  includeThreads: true,
  includeFiles: true,
  includeReactions: true,
  batchSize: 100,
  maxConcurrency: 5,
  rateLimitDelay: 200
}

export const DEFAULT_RATE_LIMIT_OPTIONS: RateLimitOptions = {
  maxConcurrency: 5,
  delayMs: 200,
  retryCount: 3,
  backoffMultiplier: 2
} 