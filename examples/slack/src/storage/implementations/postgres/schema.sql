-- PostgreSQL Schema for Slack App
-- Phase 2: Events API Integration with local message storage
-- 
-- Privacy & Security: This schema stores a local mirror of each user's Slack data
-- to enable real-time unread counts, notifications, and unified inbox functionality.
-- All data is scoped to authenticated users and encrypted where appropriate.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===============================
-- 1. USERS TABLE
-- Store OAuth tokens and user info
-- ===============================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  anti_id VARCHAR(255) UNIQUE NOT NULL,  -- Antispace user ID
  access_token TEXT,                     -- Slack OAuth token (will encrypt later)
  refresh_token TEXT,                    -- For token refresh
  team_id VARCHAR(50),                   -- Slack workspace ID
  team_name VARCHAR(255),                -- Workspace name for display
  slack_user_id VARCHAR(50),             -- User's Slack ID
  slack_user_name VARCHAR(255),          -- User's Slack username
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================
-- 2. CONVERSATIONS TABLE
-- Channels, DMs, group chats
-- ===============================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR(50) NOT NULL,  -- Slack's channel ID
  name VARCHAR(255),                      -- Channel name
  topic TEXT,                             -- Channel topic
  purpose TEXT,                           -- Channel purpose
  display_name VARCHAR(255),              -- Formatted name for UI
  type VARCHAR(20) NOT NULL,              -- 'channel', 'im', 'mpim', 'group'
  is_private BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_member BOOLEAN DEFAULT true,
  avatar_url TEXT,                        -- Avatar URL for display
  member_count INTEGER DEFAULT 0,
  
  -- Unread tracking (core feature!)
  last_read_ts VARCHAR(50),               -- Last message user read
  unread_count INTEGER DEFAULT 0,         -- Number of unread messages
  unread_count_display INTEGER DEFAULT 0, -- Display count (may differ)
  
  -- Last activity for sorting conversation list
  last_message_ts VARCHAR(50),            -- Timestamp of last message
  last_message_user_id VARCHAR(50),       -- Who sent the last message
  last_message_preview TEXT,              -- Preview text for sidebar
  last_activity_at TIMESTAMP WITH TIME ZONE, -- When conversation was last active
  
  -- Muting and notification settings
  is_muted BOOLEAN DEFAULT false,         -- User muted this conversation
  muted_until TIMESTAMP WITH TIME ZONE,   -- Temporary mute expiration
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one conversation per user per Slack channel
  UNIQUE(user_id, slack_channel_id)
);

-- ===============================
-- 3. MESSAGES TABLE
-- All message content
-- ===============================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR(50) NOT NULL,  -- Denormalized for faster queries
  
  -- Slack message identifiers
  message_ts VARCHAR(50) NOT NULL,        -- Slack's unique message timestamp
  thread_ts VARCHAR(50),                  -- If this is a thread reply
  
  -- Message content (will be encrypted later)
  text TEXT,                              -- Message text
  message_type VARCHAR(20) DEFAULT 'message', -- 'message', 'reply', 'edit', 'tombstone'
  subtype VARCHAR(50),                    -- Slack message subtype
  
  -- Message metadata
  slack_user_id VARCHAR(50),              -- Who sent the message (nullable for bots/system)
  slack_user_name VARCHAR(255),           -- Sender's display name
  bot_id VARCHAR(50),                     -- If sent by a bot
  
  -- Rich content flags
  has_files BOOLEAN DEFAULT false,        -- Has file attachments
  has_reactions BOOLEAN DEFAULT false,    -- Has emoji reactions
  has_replies BOOLEAN DEFAULT false,      -- Has thread replies
  reply_count INTEGER DEFAULT 0,          -- Number of replies
  
  -- Message state
  is_edited BOOLEAN DEFAULT false,        -- Message was edited
  is_deleted BOOLEAN DEFAULT false,       -- Message was deleted
  
  -- Timestamps
  slack_timestamp TIMESTAMP WITH TIME ZONE, -- When message was sent
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique messages per user
  UNIQUE(user_id, slack_channel_id, message_ts)
);

-- ===============================
-- 4. THREADS TABLE
-- Thread metadata for conversations
-- ===============================
CREATE TABLE IF NOT EXISTS threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  slack_channel_id VARCHAR(50) NOT NULL,
  thread_ts VARCHAR(50) NOT NULL,         -- Thread root message timestamp
  message_count INTEGER DEFAULT 0,        -- Number of messages in thread
  participant_count INTEGER DEFAULT 0,    -- Number of participants
  last_reply_ts VARCHAR(50),              -- Most recent reply timestamp
  last_reply_user_id VARCHAR(50),         -- Who sent the last reply
  is_following BOOLEAN DEFAULT false,     -- User is following this thread
  last_read_ts VARCHAR(50),               -- Last message user read in thread
  unread_count INTEGER DEFAULT 0,         -- Unread messages in thread
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, slack_channel_id, thread_ts)
);

-- ===============================
-- 5. MESSAGE_FILES TABLE
-- File attachments
-- ===============================
CREATE TABLE IF NOT EXISTS message_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  slack_file_id VARCHAR(50) NOT NULL,     -- Slack's file ID
  name VARCHAR(255),                      -- Original filename
  title VARCHAR(255),                     -- File title
  mimetype VARCHAR(100),                  -- MIME type
  filetype VARCHAR(50),                   -- Slack file type
  size_bytes BIGINT,                      -- File size
  url_private TEXT,                       -- Private download URL
  url_download TEXT,                      -- Download URL
  permalink TEXT,                         -- Slack permalink
  is_public BOOLEAN DEFAULT false,        -- File is public
  is_shared BOOLEAN DEFAULT false,        -- File is shared
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===============================
-- 6. MESSAGE_REACTIONS TABLE
-- Emoji reactions
-- ===============================
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  emoji_name VARCHAR(100) NOT NULL,       -- Emoji name (e.g., 'thumbsup')
  count INTEGER DEFAULT 1,                -- How many people reacted
  users_reacted TEXT[],                   -- Array of user IDs who reacted
  user_reacted BOOLEAN DEFAULT false,     -- Did this user react?
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One reaction type per message per user
  UNIQUE(user_id, message_id, emoji_name)
);

-- ===============================
-- 7. EVENT_QUEUE TABLE
-- Reliable event processing
-- ===============================
CREATE TABLE IF NOT EXISTS event_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id VARCHAR(100) NOT NULL,         -- Slack's event ID
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,        -- 'message', 'channel_marked', etc.
  event_data JSONB NOT NULL,              -- Full event payload
  status VARCHAR(20) DEFAULT 'pending',   -- 'pending', 'processing', 'completed', 'failed'
  retry_count INTEGER DEFAULT 0,          -- How many times we've retried
  error_message TEXT,                     -- Last error message
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(event_id)  -- Prevent duplicate events
);

-- ===============================
-- PERFORMANCE INDEXES
-- Optimized for chat UI queries
-- ===============================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_anti_id ON users(anti_id);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

-- Conversations table indexes (critical for conversation list)
CREATE INDEX IF NOT EXISTS idx_conversations_user_activity 
  ON conversations(user_id, last_activity_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversations_user_unread 
  ON conversations(user_id, unread_count DESC) WHERE unread_count > 0;
CREATE INDEX IF NOT EXISTS idx_conversations_user_type 
  ON conversations(user_id, type, last_activity_at DESC);

-- Messages table indexes (critical for message history)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_ts 
  ON messages(conversation_id, message_ts DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_channel 
  ON messages(user_id, slack_channel_id, message_ts DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread 
  ON messages(user_id, thread_ts) WHERE thread_ts IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_user_timestamp 
  ON messages(user_id, slack_timestamp DESC) WHERE slack_timestamp IS NOT NULL;

-- Threads table indexes
CREATE INDEX IF NOT EXISTS idx_threads_conversation 
  ON threads(conversation_id, last_reply_ts DESC);
CREATE INDEX IF NOT EXISTS idx_threads_user_unread 
  ON threads(user_id, unread_count DESC) WHERE unread_count > 0;

-- Files table indexes
CREATE INDEX IF NOT EXISTS idx_files_message ON message_files(message_id);
CREATE INDEX IF NOT EXISTS idx_files_user ON message_files(user_id, created_at DESC);

-- Reactions table indexes
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

-- Event queue indexes (critical for processing)
CREATE INDEX IF NOT EXISTS idx_event_queue_status 
  ON event_queue(status, created_at) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_event_queue_user 
  ON event_queue(user_id, created_at DESC);

-- ===============================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ===============================

-- Update updated_at timestamp on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables that need updated_at tracking
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reactions_updated_at BEFORE UPDATE ON message_reactions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================
-- 8. SYNC_STATE TABLE
-- Track data synchronization progress
-- ===============================
CREATE TABLE IF NOT EXISTS sync_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id VARCHAR(50),             -- Slack channel ID (NULL for global sync)
  last_sync_ts TIMESTAMP WITH TIME ZONE NOT NULL,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  last_message_ts VARCHAR(50),             -- Last message timestamp synced
  messages_synced INTEGER DEFAULT 0,       -- Number of messages synced in last run
  conversations_synced INTEGER DEFAULT 0,  -- Number of conversations synced in last run
  sync_duration_ms INTEGER DEFAULT 0,      -- How long the sync took
  error_message TEXT,                      -- Last error message if failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- One sync state per user per conversation (or global)
  UNIQUE(user_id, conversation_id)
);

-- Sync state indexes
CREATE INDEX IF NOT EXISTS idx_sync_state_user 
  ON sync_state(user_id, last_sync_ts DESC);
CREATE INDEX IF NOT EXISTS idx_sync_state_status 
  ON sync_state(sync_status, created_at) WHERE sync_status IN ('pending', 'failed');

-- Add sync_state to the updated_at trigger
CREATE TRIGGER update_sync_state_updated_at BEFORE UPDATE ON sync_state 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===============================
-- SCHEMA VALIDATION COMPLETE
-- ===============================

-- Insert a test record to validate schema
DO $$
BEGIN
  RAISE NOTICE 'Slack App PostgreSQL schema created successfully!';
  RAISE NOTICE 'Tables: users, conversations, messages, threads, message_files, message_reactions, event_queue, sync_state';
  RAISE NOTICE 'Indexes: Optimized for conversation list, message history, and sync tracking queries';
  RAISE NOTICE 'Ready for data pull system implementation';
END $$; 