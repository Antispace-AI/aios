// Main storage interfaces for Slack app
// Clean separation of concerns with well-defined interfaces

export { SlackDataStore } from './slack-data-store'
export { EventQueue, QueuedEvent, SlackEventData, QueueMetrics } from './event-queue'

// Re-export database types for convenience
export type {
  // Core entities
  User,
  Conversation,
  Message,
  Thread,
  MessageFile,
  MessageReaction,
  
  // UI-optimized types
  ConversationListItem,
  MessageWithFiles,
  UnreadSummary,
  UserDataExport,
  
  // Input types
  CreateUserInput,
  UpdateUserInput,
  CreateConversationInput,
  UpdateConversationInput,
  CreateMessageInput,
  UpdateMessageInput,
  
  // Query types
  GetMessagesQuery,
  GetConversationsQuery,
  SearchMessagesQuery
} from '../schema/types/database' 