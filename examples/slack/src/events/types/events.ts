/**
 * Slack Events API Type Definitions
 * 
 * These types define the structure of webhook requests and events
 * received from Slack's Events API.
 */

// Base webhook request structure
export interface SlackWebhookRequest {
  token: string
  team_id: string
  api_app_id: string
  type: 'url_verification' | 'event_callback'
  challenge?: string  // Only present for url_verification
  event?: SlackEvent  // Only present for event_callback
  event_id?: string   // Only present for event_callback
  event_time?: number // Only present for event_callback
}

// URL verification request
export interface SlackUrlVerificationRequest extends SlackWebhookRequest {
  type: 'url_verification'
  challenge: string
}

// Event callback request
export interface SlackEventCallbackRequest extends SlackWebhookRequest {
  type: 'event_callback'
  event: SlackEvent
  event_id: string
  event_time: number
}

// Base event interface
export interface SlackEvent {
  type: string
  ts: string
  user?: string
  channel?: string
  text?: string
  event_ts?: string
}

// Message events
export interface SlackMessageEvent extends SlackEvent {
  type: 'message'
  channel: string
  user: string
  text: string
  ts: string
  thread_ts?: string
  subtype?: string
  bot_id?: string
  edited?: {
    user: string
    ts: string
  }
  files?: SlackFile[]
  reactions?: SlackReaction[]
  reply_count?: number
  reply_users_count?: number
  latest_reply?: string
}

// Channel marked events (when user reads messages)
export interface SlackChannelMarkedEvent extends SlackEvent {
  type: 'channel_marked'
  channel: string
  ts: string
  user: string
  unread_count?: number
  unread_count_display?: number
}

// User presence events
export interface SlackPresenceChangeEvent extends SlackEvent {
  type: 'presence_change'
  user: string
  presence: 'active' | 'away'
}

// Channel events
export interface SlackChannelCreatedEvent extends Omit<SlackEvent, 'channel'> {
  type: 'channel_created'
  channel: {
    id: string
    name: string
    created: number
    creator: string
  }
}

// User read state events (for unread count tracking)
export interface SlackGroupMarkedEvent extends SlackEvent {
  type: 'group_marked'
  channel: string
  ts: string
  user: string
  unread_count?: number
  unread_count_display?: number
}

export interface SlackImMarkedEvent extends SlackEvent {
  type: 'im_marked'
  channel: string
  ts: string
  user: string
  unread_count?: number
  unread_count_display?: number
}

export interface SlackMpimMarkedEvent extends SlackEvent {
  type: 'mpim_marked'
  channel: string
  ts: string
  user: string
  unread_count?: number
  unread_count_display?: number
}

// User profile/status events
export interface SlackUserChangeEvent extends Omit<SlackEvent, 'user'> {
  type: 'user_change'
  user: {
    id: string
    name: string
    profile: {
      display_name?: string
      real_name?: string
      status_text?: string
      status_emoji?: string
    }
  }
}

// Channel lifecycle events
export interface SlackChannelDeletedEvent extends Omit<SlackEvent, 'channel'> {
  type: 'channel_deleted'
  channel: string
}

export interface SlackChannelArchiveEvent extends SlackEvent {
  type: 'channel_archive'
  channel: string
  user: string
}

export interface SlackChannelUnarchiveEvent extends SlackEvent {
  type: 'channel_unarchive'
  channel: string
  user: string
}

// App lifecycle events
export interface SlackAppUninstalledEvent extends SlackEvent {
  type: 'app_uninstalled'
}

export interface SlackTokensRevokedEvent extends SlackEvent {
  type: 'tokens_revoked'
  tokens: {
    oauth?: string[]
    bot?: string[]
  }
}

// Supporting Types
export interface SlackFile {
  id: string
  name: string
  title?: string
  mimetype: string
  filetype: string
  pretty_type: string
  user: string
  size: number
  url_private: string
  url_private_download: string
  permalink: string
  permalink_public?: string
  thumb_64?: string
  thumb_80?: string
  thumb_360?: string
  thumb_360_w?: number
  thumb_360_h?: number
}

export interface SlackReaction {
  name: string
  users: string[]
  count: number
}

export interface SlackUser {
  id: string
  team_id: string
  name: string
  deleted: boolean
  color?: string
  real_name?: string
  tz?: string
  tz_label?: string
  tz_offset?: number
  profile: {
    title?: string
    phone?: string
    skype?: string
    real_name?: string
    real_name_normalized?: string
    display_name?: string
    display_name_normalized?: string
    status_text?: string
    status_emoji?: string
    status_expiration?: number
    avatar_hash?: string
    image_24?: string
    image_32?: string
    image_48?: string
    image_72?: string
    image_192?: string
    image_512?: string
    email?: string
    first_name?: string
    last_name?: string
  }
  is_admin?: boolean
  is_owner?: boolean
  is_primary_owner?: boolean
  is_restricted?: boolean
  is_ultra_restricted?: boolean
  is_bot?: boolean
  is_app_user?: boolean
  updated: number
  presence?: 'active' | 'away'
}

export interface SlackChannel {
  id: string
  name: string
  is_channel: boolean
  is_group: boolean
  is_im: boolean
  is_mpim: boolean
  is_private: boolean
  created: number
  is_archived: boolean
  is_general: boolean
  unlinked: number
  name_normalized: string
  is_shared: boolean
  is_org_shared: boolean
  is_member: boolean
  is_open?: boolean
  last_read?: string
  latest?: SlackMessageEvent
  unread_count?: number
  unread_count_display?: number
  members?: string[]
  topic?: {
    value: string
    creator: string
    last_set: number
  }
  purpose?: {
    value: string
    creator: string
    last_set: number
  }
}

// Union type of all events we handle
export type SupportedSlackEvent = 
  | SlackMessageEvent
  | SlackChannelMarkedEvent
  | SlackGroupMarkedEvent
  | SlackImMarkedEvent
  | SlackMpimMarkedEvent
  | SlackPresenceChangeEvent
  | SlackUserChangeEvent
  | SlackChannelCreatedEvent
  | SlackChannelDeletedEvent
  | SlackChannelArchiveEvent
  | SlackChannelUnarchiveEvent
  | SlackAppUninstalledEvent
  | SlackTokensRevokedEvent

// Event processing metadata
export interface EventProcessingContext {
  event_id: string
  team_id: string
  api_app_id: string
  event_time: number
  received_at: Date
}

// Webhook payload structure
export interface SlackEventPayload {
  token: string
  team_id: string
  api_app_id: string
  event: SlackEvent
  type: 'event_callback'
  event_id: string
  event_time: number
  authorizations?: Array<{
    enterprise_id?: string
    team_id: string
    user_id: string
    is_bot: boolean
    is_enterprise_install?: boolean
  }>
  is_ext_shared_channel?: boolean
  event_context?: string
}

// URL verification payload
export interface SlackUrlVerificationPayload {
  token: string
  challenge: string
  type: 'url_verification'
}

// Union type for all webhook payloads
export type SlackWebhookPayload = SlackEventPayload | SlackUrlVerificationPayload

// Event processing metadata
export interface SlackEventData {
  eventId: string
  userId: string
  teamId: string
  eventType: string
  eventTime: number
  event: SlackEvent
  retryCount?: number
  processedAt?: string
}

// Event validation result
export interface EventValidationResult {
  isValid: boolean
  error?: string
  eventData?: SlackEventData
} 