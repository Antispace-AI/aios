import type { AntispaceAppFunction } from "@antispace/sdk"

/**
 * MSG-002: Send a message to a Slack channel or DM
 */
export const sendMessage: AntispaceAppFunction<
  "sendMessage",
  {
    channelIdentifier: string
    text: string
    threadTs?: string
  }
> = {
  type: "function",
  function: {
    name: "sendMessage",
    description: "Send a message to a Slack channel, DM, or group. Can optionally reply in a thread.",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890), user ID for DM (e.g. U1234567890), or channel name (e.g. #general)",
        },
        text: {
          type: "string",
          description: "Message text to send. Supports Slack markdown formatting.",
        },
        threadTs: {
          type: "string",
          description: "Optional timestamp of parent message to reply in thread",
        },
      },
      required: ["channelIdentifier", "text"],
    },
  },
}

/**
 * CONV-001: List conversations
 */
export const listConversations: AntispaceAppFunction<
  "listConversations",
  {
    types?: string
    limit?: number
  }
> = {
  type: "function",
  function: {
    name: "listConversations",
    description: "List Slack conversations (channels, DMs, groups) that the user has access to",
    parameters: {
      type: "object",
      properties: {
        types: {
          type: "string",
          description: "Comma-separated list of conversation types to include: public_channel, private_channel, im, mpim. Default: all types",
        },
        limit: {
          type: "number",
          description: "Maximum number of conversations to return (default: 100, max: 1000)",
        },
      },
      required: [],
    },
  },
}

/**
 * MSG-001: Get recent messages from a specific channel
 */
export const getMessages: AntispaceAppFunction<
  "getMessages",
  {
    channelIdentifier: string
    limit?: number
    oldest?: string
    latest?: string
  }
> = {
  type: "function",
  function: {
    name: "getMessages",
    description: "Fetch recent messages from a specific Slack channel or DM",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890), channel name (e.g. 'general' or '#general'), or user ID for DM (e.g. U1234567890)",
        },
        limit: {
          type: "number",
          description: "Number of messages to fetch (default: 10, max: 1000)",
        },
        oldest: {
          type: "string",
          description: "Only messages after this timestamp (inclusive)",
        },
        latest: {
          type: "string",
          description: "Only messages before this timestamp (exclusive)",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * SRCH-001: Search for messages across accessible channels
 */
export const searchMessages: AntispaceAppFunction<
  "searchMessages",
  {
    query: string
    sort?: string
    count?: number
  }
> = {
  type: "function",
  function: {
    name: "searchMessages",
    description: "Search for messages across all accessible Slack channels and DMs",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query. Supports Slack search syntax (e.g. 'from:@user', 'in:#channel', 'has:link')",
        },
        sort: {
          type: "string",
          description: "Sort order: 'timestamp' (default) or 'score'",
        },
        count: {
          type: "number",
          description: "Number of messages to return (default: 20, max: 100)",
        },
      },
      required: ["query"],
    },
  },
}

/**
 * USER-001: Get user profile by user identifier
 */
export const getUserProfile: AntispaceAppFunction<
  "getUserProfile",
  {
    userIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "getUserProfile",
    description: "Get detailed profile information about a Slack user by their user ID, username, or display name",
    parameters: {
      type: "object",
      properties: {
        userIdentifier: {
          type: "string",
          description: "User ID (e.g. U1234567890), username, or display name to get profile for",
        },
      },
      required: ["userIdentifier"],
    },
  },
}

/**
 * CONV-002: Get detailed information about a conversation
 */
export const getConversationDetails: AntispaceAppFunction<
  "getConversationDetails",
  {
    conversationIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "getConversationDetails",
    description: "Get detailed information about a specific channel or conversation",
    parameters: {
      type: "object",
      properties: {
        conversationIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890), channel name (e.g. 'general' or '#general'), or user ID for DM (e.g. U1234567890)",
        },
      },
      required: ["conversationIdentifier"],
    },
  },
}

/**
 * Get Slack OAuth authentication URL
 */
export const getAuthUrl: AntispaceAppFunction<
  "getAuthUrl",
  {}
> = {
  type: "function",
  function: {
    name: "getAuthUrl",
    description: "Get the Slack OAuth URL to authenticate your account. Visit this URL in your browser to connect your Slack workspace.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
}

/**
 * Check current authentication status
 */
export const checkAuthStatus: AntispaceAppFunction<
  "checkAuthStatus",
  {}
> = {
  type: "function",
  function: {
    name: "checkAuthStatus",
    description: "Check if your Slack account is currently authenticated and get basic info about your connected workspace.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
}

/**
 * Manual authentication with token (for testing)
 */
export const manualAuth: AntispaceAppFunction<
  "manualAuth",
  {
    accessToken: string
    teamName?: string
  }
> = {
  type: "function",
  function: {
    name: "manualAuth",
    description: "Manually authenticate with a Slack bot token (for testing purposes). Use this only if you have a bot token from your Slack app settings.",
    parameters: {
      type: "object",
      properties: {
        accessToken: {
          type: "string",
          description: "Slack bot token (starts with xoxb-)",
        },
        teamName: {
          type: "string",
          description: "Optional team/workspace name for display purposes",
        },
      },
      required: ["accessToken"],
    },
  },
}

/**
 * PHASE 1 FUNCTIONS - Widget Functions
 */

/**
 * RT-001: Get total unread summary for widget display
 */
export const getTotalUnreadSummary: AntispaceAppFunction<
  "getTotalUnreadSummary",
  {}
> = {
  type: "function",
  function: {
    name: "getTotalUnreadSummary",
    description: "Get the total count of unread messages across all conversations, broken down by type (DMs, channels, mentions) for widget display",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
}

/**
 * RT-002: Get recent unread messages for widget preview
 */
export const getRecentUnreadMessages: AntispaceAppFunction<
  "getRecentUnreadMessages",
  {
    limit?: number
  }
> = {
  type: "function",
  function: {
    name: "getRecentUnreadMessages",
    description: "Get the most recent unread messages for widget preview display. Shows message previews with sender info and conversation context.",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of recent unread messages to return (default: 3, max: 10)",
        },
      },
      required: [],
    },
  },
}

/**
 * RT-003: Mark a conversation as read
 */
export const markConversationAsRead: AntispaceAppFunction<
  "markConversationAsRead",
  {
    conversationIdentifier: string
    latestMessageTs?: string
  }
> = {
  type: "function",
  function: {
    name: "markConversationAsRead",
    description: "Mark all messages in a specific conversation as read. Used when user opens a conversation from the widget.",
    parameters: {
      type: "object",
      properties: {
        conversationIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890), channel name (e.g. 'general' or '#general'), or user ID for DM (e.g. U1234567890)",
        },
        latestMessageTs: {
          type: "string",
          description: "Optional timestamp of the latest message to mark as read",
      },
      },
      required: ["conversationIdentifier"],
    },
  },
}

/**
 * CONV-012: Get all threads in a conversation
 */
export const getConversationThreads: AntispaceAppFunction<
  "getConversationThreads",
  {
    conversationIdentifier: string
    includeRead?: boolean
    minReplies?: number
    since?: string
  }
> = {
  type: "function",
  function: {
    name: "getConversationThreads",
    description: "Get list of all thread conversations in a channel with metadata about replies, participants, and read status",
    parameters: {
      type: "object",
      properties: {
        conversationIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890), channel name, or user ID to get threads from",
        },
        includeRead: {
          type: "boolean",
          description: "If true, include threads that have been read (default: true)",
        },
        minReplies: {
          type: "number",
          description: "Only return threads with at least this many replies (default: 1)",
        },
        since: {
          type: "string",
          description: "Only return threads created since this timestamp",
        },
      },
      required: ["conversationIdentifier"],
    },
  },
}

/**
 * PHASE 2A FUNCTIONS - Core Extensions
 */

/**
 * AUTH-004: Revoke authentication
 */
export const revokeAuthentication: AntispaceAppFunction<
  "revokeAuthentication",
  {}
> = {
  type: "function",
  function: {
    name: "revokeAuthentication",
    description: "Revoke Slack authentication and disconnect your account. This will clear all stored tokens and require re-authentication.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
}

/**
 * CONV-003: Get conversation members
 */
export const getConversationMembers: AntispaceAppFunction<
  "getConversationMembers",
  {
    channelIdentifier: string
    limit?: number
  }
> = {
  type: "function",
  function: {
    name: "getConversationMembers",
    description: "Get list of all members in a specific channel or conversation with their profile information",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general')",
        },
        limit: {
          type: "number",
          description: "Maximum number of members to return (default: 100, max: 1000)",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * CONV-004: Create conversation
 */
export const createConversation: AntispaceAppFunction<
  "createConversation",
  {
    name: string
    isPrivate: boolean
    memberUserIds?: string[]
  }
> = {
  type: "function",
  function: {
    name: "createConversation",
    description: "Create a new Slack channel or private group. Can optionally invite specific users.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Channel name (without # prefix). Must be lowercase, no spaces, max 21 characters",
        },
        isPrivate: {
          type: "boolean",
          description: "Whether to create a private channel (true) or public channel (false)",
        },
        memberUserIds: {
          type: "string",
          description: "Optional comma-separated list of user IDs to invite to the channel (only works for private channels). Example: 'U1234567890,U0987654321'",
        },
      },
      required: ["name", "isPrivate"],
    },
  },
}

/**
 * CONV-009: Join conversation
 */
export const joinConversation: AntispaceAppFunction<
  "joinConversation",
  {
    channelIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "joinConversation",
    description: "Join a public channel. Note: You can only join public channels, not private ones unless invited.",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') of the public channel to join",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * CONV-010: Leave conversation
 */
export const leaveConversation: AntispaceAppFunction<
  "leaveConversation",
  {
    channelIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "leaveConversation",
    description: "Leave a channel or group conversation. You will no longer receive messages or have access to the channel.",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general')",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * MSG-003: Update message
 */
export const updateMessage: AntispaceAppFunction<
  "updateMessage",
  {
    channelIdentifier: string
    messageTs: string
    text?: string
    blocks?: any[]
  }
> = {
  type: "function",
  function: {
    name: "updateMessage",
    description: "Edit/update an existing message. You can only edit messages you sent.",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to update",
        },
        text: {
          type: "string",
          description: "New text content for the message",
        },
        blocks: {
          type: "array",
          description: "Optional Slack Block Kit blocks for rich formatting",
        },
      },
      required: ["channelIdentifier", "messageTs"],
    },
  },
}

/**
 * MSG-004: Delete message
 */
export const deleteMessage: AntispaceAppFunction<
  "deleteMessage",
  {
    channelIdentifier: string
    messageTs: string
  }
> = {
  type: "function",
  function: {
    name: "deleteMessage",
    description: "Delete a message. You can only delete messages you sent (unless you're an admin).",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to delete",
        },
      },
      required: ["channelIdentifier", "messageTs"],
    },
  },
}

/**
 * MSG-006: Get message permalink
 */
export const getMessagePermalink: AntispaceAppFunction<
  "getMessagePermalink",
  {
    channelIdentifier: string
    messageTs: string
  }
> = {
  type: "function",
  function: {
    name: "getMessagePermalink",
    description: "Get a shareable permalink URL for a specific message",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message",
        },
      },
      required: ["channelIdentifier", "messageTs"],
    },
  },
}

/**
 * FILE-001: List files
 */
export const listFiles: AntispaceAppFunction<
  "listFiles",
  {
    conversationIdentifier?: string
    types?: string[]
    limit?: number
    page?: number
  }
> = {
  type: "function",
  function: {
    name: "listFiles",
    description: "List files shared in Slack workspace. Can filter by channel, file type, and pagination.",
    parameters: {
      type: "object",
      properties: {
        conversationIdentifier: {
          type: "string",
          description: "Optional channel ID, channel name, or user ID to filter files from specific conversation",
        },
        types: {
          type: "string",
          description: "Optional comma-separated list of file types to filter (e.g. 'images,documents,archives')",
        },
        limit: {
          type: "number",
          description: "Number of files to return (default: 20, max: 100)",
        },
        page: {
          type: "number",
          description: "Page number for pagination (starts at 1)",
        },
      },
      required: [],
    },
  },
}

/**
 * FILE-002: Upload file
 */
export const uploadFile: AntispaceAppFunction<
  "uploadFile",
  {
    conversationIdentifier: string
    filename: string
    title?: string
    initialComment?: string
    filetype?: string
  }
> = {
  type: "function",
  function: {
    name: "uploadFile",
    description: "Upload a file to a Slack channel or DM. Note: This requires file content to be provided through the system.",
    parameters: {
      type: "object",
      properties: {
        conversationIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890), channel name, or user ID to upload the file to",
        },
        filename: {
          type: "string",
          description: "Name of the file including extension (e.g. 'document.pdf')",
        },
        title: {
          type: "string",
          description: "Optional title for the file",
        },
        initialComment: {
          type: "string",
          description: "Optional comment to post with the file",
        },
        filetype: {
          type: "string",
          description: "Optional file type hint (e.g. 'pdf', 'text', 'image')",
        },
      },
      required: ["conversationIdentifier", "filename"],
    },
  },
}

/**
 * PHASE 2B FUNCTIONS - User Experience
 */

/**
 * INTR-001: Add reaction to message
 */
export const addReaction: AntispaceAppFunction<
  "addReaction",
  {
    channelIdentifier: string
    messageTs: string
    emoji: string
  }
> = {
  type: "function",
  function: {
    name: "addReaction",
    description: "Add an emoji reaction to a specific message",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to react to",
        },
        emoji: {
          type: "string",
          description: "Emoji name (e.g. 'thumbsup', ':thumbsup:', or 'smile'). Colons are optional.",
        },
      },
      required: ["channelIdentifier", "messageTs", "emoji"],
    },
  },
}

/**
 * INTR-002: Remove reaction from message
 */
export const removeReaction: AntispaceAppFunction<
  "removeReaction",
  {
    channelIdentifier: string
    messageTs: string
    emoji: string
  }
> = {
  type: "function",
  function: {
    name: "removeReaction",
    description: "Remove an emoji reaction from a specific message",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to remove reaction from",
        },
        emoji: {
          type: "string",
          description: "Emoji name (e.g. 'thumbsup', ':thumbsup:', or 'smile'). Colons are optional.",
        },
      },
      required: ["channelIdentifier", "messageTs", "emoji"],
    },
  },
}

/**
 * INTR-003: Get message reactions
 */
export const getMessageReactions: AntispaceAppFunction<
  "getMessageReactions",
  {
    channelIdentifier: string
    messageTs: string
  }
> = {
  type: "function",
  function: {
    name: "getMessageReactions",
    description: "Get all reactions on a specific message with user details",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to get reactions for",
        },
      },
      required: ["channelIdentifier", "messageTs"],
    },
  },
}

/**
 * INTR-004: Pin message
 */
export const pinMessage: AntispaceAppFunction<
  "pinMessage",
  {
    channelIdentifier: string
    messageTs: string
  }
> = {
  type: "function",
  function: {
    name: "pinMessage",
    description: "Pin a message to the channel for easy reference",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to pin",
        },
      },
      required: ["channelIdentifier", "messageTs"],
    },
  },
}

/**
 * INTR-005: Unpin message
 */
export const unpinMessage: AntispaceAppFunction<
  "unpinMessage",
  {
    channelIdentifier: string
    messageTs: string
  }
> = {
  type: "function",
  function: {
    name: "unpinMessage",
    description: "Remove a pinned message from the channel",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') where the message is located",
        },
        messageTs: {
          type: "string",
          description: "Message timestamp (e.g. '1234567890.123456') of the message to unpin",
        },
      },
      required: ["channelIdentifier", "messageTs"],
    },
  },
}

/**
 * INTR-006: List pinned messages
 */
export const listPinnedMessages: AntispaceAppFunction<
  "listPinnedMessages",
  {
    channelIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "listPinnedMessages",
    description: "Get all pinned messages and files in a channel",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') to list pinned items from",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * USER-002: Set user status
 */
export const setUserStatus: AntispaceAppFunction<
  "setUserStatus",
  {
    statusText?: string
    statusEmoji?: string
    statusExpiration?: number
  }
> = {
  type: "function",
  function: {
    name: "setUserStatus",
    description: "Update your Slack status text and emoji",
    parameters: {
      type: "object",
      properties: {
        statusText: {
          type: "string",
          description: "Status text to display (e.g. 'In a meeting', 'Working from home'). Use empty string to clear.",
        },
        statusEmoji: {
          type: "string",
          description: "Status emoji (e.g. 'calendar', ':calendar:', 'house'). Use empty string to clear. Colons are optional.",
        },
        statusExpiration: {
          type: "number",
          description: "Unix timestamp when status should expire and be cleared automatically",
        },
      },
      required: [],
    },
  },
}

/**
 * USER-003: Get user presence
 */
export const getUserPresence: AntispaceAppFunction<
  "getUserPresence",
  {
    userIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "getUserPresence",
    description: "Check if a user is currently active or away on Slack",
    parameters: {
      type: "object",
      properties: {
        userIdentifier: {
          type: "string",
          description: "User ID (e.g. U1234567890), username, or display name to check presence for",
        },
      },
      required: ["userIdentifier"],
    },
  },
}

/**
 * USER-004: List users
 */
export const listUsers: AntispaceAppFunction<
  "listUsers",
  {
    limit?: number
    cursor?: string
    includeLocale?: boolean
  }
> = {
  type: "function",
  function: {
    name: "listUsers",
    description: "List all users in the Slack workspace with their profile information",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of users to return (default: 100, max: 1000)",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor for getting next page of results",
        },
        includeLocale: {
          type: "boolean",
          description: "Whether to include user locale information",
        },
      },
      required: [],
    },
  },
}

/**
 * CONV-005: Archive conversation
 */
export const archiveConversation: AntispaceAppFunction<
  "archiveConversation",
  {
    channelIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "archiveConversation",
    description: "Archive a channel to hide it from the channel list while preserving its history",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') to archive",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * CONV-006: Unarchive conversation
 */
export const unarchiveConversation: AntispaceAppFunction<
  "unarchiveConversation",
  {
    channelIdentifier: string
  }
> = {
  type: "function",
  function: {
    name: "unarchiveConversation",
    description: "Restore an archived channel back to the active channel list",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') to unarchive",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}

/**
 * CONV-011: Set conversation topic and purpose
 */
export const setConversationTopicPurpose: AntispaceAppFunction<
  "setConversationTopicPurpose",
  {
    channelIdentifier: string
    topic?: string
    purpose?: string
  }
> = {
  type: "function",
  function: {
    name: "setConversationTopicPurpose",
    description: "Update the topic and/or purpose of a channel",
    parameters: {
      type: "object",
      properties: {
        channelIdentifier: {
          type: "string",
          description: "Channel ID (e.g. C1234567890) or channel name (e.g. 'general' or '#general') to update",
        },
        topic: {
          type: "string",
          description: "New topic for the channel (short description shown in channel header)",
        },
        purpose: {
          type: "string",
          description: "New purpose for the channel (longer description of channel's intended use)",
        },
      },
      required: ["channelIdentifier"],
    },
  },
}
