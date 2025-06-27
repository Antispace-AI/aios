/**
 * Core Slack Types for Antispace Integration
 * Based on implementation plan Phase 1 requirements
 */

export interface SlackUser {
  id: string
  name: string
  real_name?: string
  display_name?: string
  email?: string
  avatar?: string
  presence?: 'active' | 'away'
  status_text?: string
  status_emoji?: string
}

export interface UserProfile {
  id: string
  name: string
  real_name?: string
  display_name?: string
  email?: string
  avatar?: string
  title?: string
  phone?: string
  skype?: string
  status_text?: string
  status_emoji?: string
  status_expiration?: number
  team?: string
  deleted?: boolean
  color?: string
  is_admin?: boolean
  is_owner?: boolean
  is_restricted?: boolean
  is_ultra_restricted?: boolean
  has_2fa?: boolean
  locale?: string
  tz?: string
  tz_label?: string
  tz_offset?: number
}

export interface SlackConversation {
  id: string
  name?: string
  display_name: string
  type: 'channel' | 'group' | 'im' | 'mpim'
  is_private: boolean
  is_member: boolean
  is_archived?: boolean
  created: number
  creator?: string
  last_read?: string
  latest?: SlackMessage
  unread_count?: number
  unread_count_display?: number
  num_members?: number
  purpose?: {
    value: string
    creator: string
    last_set: number
  }
  topic?: {
    value: string
    creator: string
    last_set: number
  }
}

export interface SlackMessage {
  ts: string
  type: string
  user?: string
  bot_id?: string
  username?: string
  text?: string
  thread_ts?: string
  reply_count?: number
  replies?: SlackMessage[]
  reactions?: SlackReaction[]
  files?: SlackFile[]
  blocks?: any[]
  attachments?: any[]
  edited?: {
    user: string
    ts: string
  }
  deleted_ts?: string
  subtype?: string
  conversation_id?: string
}

export interface SlackReaction {
  name: string
  users: string[]
  count: number
}

export interface SlackFile {
  id: string
  name: string
  title?: string
  mimetype: string
  filetype: string
  pretty_type: string
  user: string
  created: number
  timestamp: number
  size: number
  url_private?: string
  url_private_download?: string
  permalink?: string
  permalink_public?: string
  channels?: string[]
  groups?: string[]
  ims?: string[]
}

export interface UnreadSummary {
  totalUnread: number
  totalMentions: number
  breakdown?: {
    channels: number
    dms: number
    groups: number
    mentions: number
  }
}

export interface ConversationUnread {
  unread: number
  mentions: number
}

// API Response Types
export interface SlackAPIResponse<T = any> {
  success: boolean
  error?: string
  data?: T
}

export interface ConversationsListResponse extends SlackAPIResponse<{ conversations: SlackConversation[], nextPageCursor?: string }> {
  conversations: SlackConversation[]
  nextPageCursor?: string
}

export interface MessagesResponse extends SlackAPIResponse<{ messages: SlackMessage[], hasMore?: boolean, nextCursor?: string }> {
  messages: SlackMessage[]
  hasMore?: boolean
  nextCursor?: string
}

export interface MessageSendResponse extends SlackAPIResponse<{ messageTs?: string, message?: SlackMessage }> {
  messageTs?: string
  message?: SlackMessage
}

export interface AuthStatusResponse extends SlackAPIResponse<{ isAuthenticated: boolean, slackUserId?: string }> {
  isAuthenticated: boolean
  slackUserId?: string
}

export interface OAuthResponse extends SlackAPIResponse<{ oauthURL?: string, userId?: string }> {
  oauthURL?: string
  userId?: string
}

// Event Types for Real-time Updates
export interface SlackMessageEvent {
  type: 'message'
  channel: string
  user: string
  text: string
  ts: string
  thread_ts?: string
  subtype?: string
}

export interface SlackChannelMarkedEvent {
  type: 'channel_marked' | 'group_marked' | 'im_marked' | 'mpim_marked'
  channel: string
  ts: string
  unread_count?: number
  unread_count_display?: number
}

export interface SlackPresenceChangeEvent {
  type: 'presence_change'
  user: string
  presence: 'active' | 'away'
}

export type SlackEvent = 
  | SlackMessageEvent 
  | SlackChannelMarkedEvent 
  | SlackPresenceChangeEvent

// Configuration Types
export interface SlackConfig {
  clientId: string
  clientSecret: string
  appToken?: string // For Socket Mode
  signingSecret: string
  redirectUri: string
  scopes: string[]
}

export interface SlackAuthTokens {
  accessToken: string
  botToken?: string
  refreshToken?: string
  teamId: string
  userId: string
  scope: string
} 