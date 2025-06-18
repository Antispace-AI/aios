// Database entity types matching the SQL schema
// These represent the raw database rows

export interface User {
  id: string
  antiId: string
  accessToken?: string // encrypted
  refreshToken?: string // encrypted
  teamId?: string
  teamName?: string
  slackUserId?: string
  slackUserName?: string
  createdAt: string
  updatedAt: string
}

export interface Conversation {
  id: string
  userId: string
  slackChannelId: string
  name?: string
  topic?: string
  purpose?: string
  type: 'channel' | 'im' | 'mpim' | 'group'
  isPrivate: boolean
  isArchived: boolean
  isMember: boolean
  displayName?: string
  avatarUrl?: string
  memberCount: number
  lastReadTs?: string
  unreadCount: number
  unreadCountDisplay: number
  lastMessageTs?: string
  lastMessageUserId?: string
  lastMessagePreview?: string
  lastActivityAt?: string
  isMuted: boolean
  mutedUntil?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  userId: string
  conversationId: string
  slackChannelId: string
  messageTs: string
  threadTs?: string
  text?: string // encrypted
  messageType: 'message' | 'reply' | 'edit' | 'tombstone'
  subtype?: string
  slackUserId: string
  slackUserName?: string
  botId?: string
  hasFiles: boolean
  hasReactions: boolean
  hasReplies: boolean
  replyCount: number
  isEdited: boolean
  isDeleted: boolean
  slackTimestamp?: string
  createdAt: string
  updatedAt: string
}

export interface Thread {
  id: string
  userId: string
  conversationId: string
  slackChannelId: string
  threadTs: string
  messageCount: number
  participantCount: number
  lastReplyTs?: string
  lastReplyUserId?: string
  isFollowing: boolean
  lastReadTs?: string
  unreadCount: number
  createdAt: string
  updatedAt: string
}

export interface MessageFile {
  id: string
  userId: string
  messageId: string
  slackFileId: string
  name?: string
  title?: string
  mimetype?: string
  filetype?: string
  sizeBytes?: number
  urlPrivate?: string
  urlDownload?: string
  permalink?: string
  isPublic: boolean
  isShared: boolean
  createdAt: string
}

export interface MessageReaction {
  id: string
  userId: string
  messageId: string
  emojiName: string
  count: number
  usersReacted: string[]
  userReacted: boolean
  createdAt: string
  updatedAt: string
}

// ===============================
// View Types (for UI queries)
// ===============================

export interface ConversationListItem {
  id: string
  slackChannelId: string
  displayName?: string
  type: 'channel' | 'im' | 'mpim' | 'group'
  avatarUrl?: string
  unreadCount: number
  unreadCountDisplay: number
  isMuted: boolean
  lastActivityAt?: string
  lastMessagePreview?: string
  lastMessageUserId?: string
  lastMessageTs?: string
  formattedTime?: string
  hasUnread: boolean
}

export interface RecentMessage {
  id: string
  text?: string
  slackUserName?: string
  slackTimestamp?: string
  conversationName?: string
  conversationType: 'channel' | 'im' | 'mpim' | 'group'
  isReply: boolean
}

// ===============================
// Composite Types for API responses
// ===============================

export interface MessageWithFiles extends Message {
  files: MessageFile[]
  reactions: MessageReaction[]
}

export interface ConversationWithMessages extends Conversation {
  messages: MessageWithFiles[]
  threads: Thread[]
}

export interface UnreadSummary {
  totalUnread: number
  conversations: Array<{
    id: string
    slackChannelId: string
    displayName: string
    type: 'channel' | 'im' | 'mpim' | 'group'
    unreadCount: number
    lastMessage?: {
      text: string
      slackUserName: string
      timestamp: string
    }
  }>
}

// ===============================
// GDPR & Privacy Types
// ===============================

export interface UserDataExport {
  user: User
  conversations: Conversation[]
  messages: MessageWithFiles[]
  threads: Thread[]
  exportedAt: string
  totalConversations: number
  totalMessages: number
  dataRetentionDays?: number
}

// ===============================
// Input Types for operations
// ===============================

export interface CreateUserInput {
  antiId: string
  accessToken?: string
  refreshToken?: string
  teamId?: string
  teamName?: string
  slackUserId?: string
  slackUserName?: string
}

export interface UpdateUserInput {
  accessToken?: string
  refreshToken?: string
  teamId?: string
  teamName?: string
  slackUserId?: string
  slackUserName?: string
}

export interface CreateConversationInput {
  userId: string
  slackChannelId: string
  name?: string
  topic?: string
  purpose?: string
  type: 'channel' | 'im' | 'mpim' | 'group'
  isPrivate?: boolean
  displayName?: string
  avatarUrl?: string
  memberCount?: number
}

export interface UpdateConversationInput {
  name?: string
  topic?: string
  purpose?: string
  isArchived?: boolean
  isMember?: boolean
  displayName?: string
  avatarUrl?: string
  memberCount?: number
  lastReadTs?: string
  unreadCount?: number
  unreadCountDisplay?: number
  isMuted?: boolean
  mutedUntil?: string
}

export interface CreateMessageInput {
  userId: string
  conversationId: string
  slackChannelId: string
  messageTs: string
  threadTs?: string
  text?: string
  messageType?: 'message' | 'reply' | 'edit' | 'tombstone'
  subtype?: string
  slackUserId: string
  slackUserName?: string
  botId?: string
  hasFiles?: boolean
  hasReactions?: boolean
  hasReplies?: boolean
  replyCount?: number
  slackTimestamp?: string
}

export interface UpdateMessageInput {
  text?: string
  messageType?: 'message' | 'reply' | 'edit' | 'tombstone'
  hasFiles?: boolean
  hasReactions?: boolean
  hasReplies?: boolean
  replyCount?: number
  isEdited?: boolean
  isDeleted?: boolean
}

// ===============================
// Query Types for data retrieval
// ===============================

export interface GetMessagesQuery {
  userId: string
  conversationId: string
  limit?: number
  beforeTs?: string
  afterTs?: string
  threadTs?: string // for getting thread messages
  includeFiles?: boolean
  includeReactions?: boolean
}

export interface GetConversationsQuery {
  userId: string
  types?: ('channel' | 'im' | 'mpim' | 'group')[]
  unreadOnly?: boolean
  limit?: number
  sortBy?: 'activity' | 'alphabetical' | 'unread'
  includeArchived?: boolean
}

export interface SearchMessagesQuery {
  userId: string
  query: string
  conversationId?: string
  fromUserId?: string
  hasFiles?: boolean
  limit?: number
  beforeTs?: string
  afterTs?: string
} 