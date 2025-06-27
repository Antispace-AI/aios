/**
 * Slack Integration Module - Phase 1 & 2A Implementation
 * 
 * This module provides organized access to Slack functionality for Antispace.
 * Implementation follows the structured plan with domain-based organization.
 * 
 * Phase 1 includes:
 * - Authentication (AUTH-001, AUTH-002, AUTH-003)
 * - Basic Conversations (CONV-001, CONV-002)
 * - Basic Messaging (MSG-001, MSG-002)
 * - Real-time Unread Tracking (RT-001, RT-002, RT-003)
 * - Basic User Management (USER-001)
 * - Basic Search (SRCH-001)
 * 
 * Phase 2A includes:
 * - Authentication Completion (AUTH-004)
 * - Advanced Conversation Management (CONV-003, CONV-004, CONV-009, CONV-010)
 * - Essential Messaging Operations (MSG-003, MSG-004, MSG-006)
 * - Basic File Management (FILE-001, FILE-002)
 */

// Export all types
export * from './types'

// Export shared utilities
export { SlackClientPool, SlackAPIError, clientPool, handleSlackResponse } from './client'
import { SlackAPIError } from './client'

// Authentication module exports
export {
  getOAuthURL,
  handleOAuthCallback,
  checkAuthenticationStatus,
  revokeAuthentication,
  validateUserAuth
} from './auth'

// Conversations module exports
export { 
  listConversations, 
  getConversationDetails, 
  getConversationMembers, 
  createConversation, 
  joinConversation, 
  leaveConversation,
  archiveConversation,
  unarchiveConversation,
  setConversationTopicPurpose
} from './conversations'

// Messaging module exports
export {
  getMessages,
  sendMessage,
  updateMessage,
  deleteMessage,
  getMessagePermalink
} from './messaging'

// Real-time state management exports
export {
  getTotalUnreadSummary,
  markConversationAsRead,
  getRecentUnreadMessages,
  markSpecificMessagesAsRead
} from './realtime'

// User management exports
export {
  getUserProfile,
  setUserStatus,
  getUserPresence,
  listUsers
} from './users'

// Search module exports
export {
  searchMessages,
  searchMessagesAdvanced
} from './search'

// Files module exports
export {
  listFiles,
  uploadFile
} from './files'

// Interactions module exports (Phase 2B)
export {
  addReaction,
  removeReaction,
  getMessageReactions,
  pinMessage,
  unpinMessage,
  listPinnedMessages
} from './interactions'

/**
 * Developer mode utilities for bypassing rate limiting
 * ⚠️ FOR DEVELOPMENT ONLY - Use with caution in production
 */

/**
 * Execute a Slack function directly with rate limiting bypassed
 * This bypasses all rate limiting mechanisms for developer mode
 */
export async function executeWithBypassedRateLimit<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  console.log(`🚨 DEVELOPER MODE: Executing ${operationName} with ALL rate limiting bypassed`)
  
  try {
    // Execute the operation directly without any rate limiting
    const result = await operation()
    
    console.log(`✅ DEVELOPER MODE: Successfully executed ${operationName}`)
    return result
  } catch (error: any) {
    console.error(`❌ DEVELOPER MODE: Failed to execute ${operationName}:`, error.message)
    throw error
  }
}

/**
 * Parse natural language commands using Gemini AI and map them to function calls
 * This replaces hardcoded pattern matching with AI-powered understanding
 */
export async function parseNaturalLanguageCommand(command: string): Promise<{ functionName: string; params: any } | null> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    
    // Initialize Gemini AI
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('🔧 GEMINI_API_KEY not found, falling back to basic pattern matching');
      return parseNaturalLanguageCommandFallback(command);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Create the functions manifest context
    const functionsManifest = {
      addReaction: {
        description: "Add an emoji reaction to a specific message. Use this when user wants to 'react to' or 'add reaction' to a message.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to react to",
          emoji: "Emoji name (e.g. 'thumbsup', 'smile', 'heart'). Do not include colons."
        },
        required: ["channelIdentifier", "messageTs", "emoji"]
      },
      removeReaction: {
        description: "Remove an emoji reaction from a specific message.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to remove reaction from",
          emoji: "Emoji name (e.g. 'thumbsup', 'smile', 'heart'). Do not include colons."
        },
        required: ["channelIdentifier", "messageTs", "emoji"]
      },
      getMessageReactions: {
        description: "Get all reactions on a specific message. Use this when user wants to 'get reactions' or 'see reactions' or 'show reactions' on a message.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to get reactions from"
        },
        required: ["channelIdentifier", "messageTs"]
      },
      sendMessage: {
        description: "Send a message to a Slack channel, DM, or group. Can optionally reply in a thread.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890), user ID for DM (e.g. U1234567890), or channel name (e.g. #general)",
          text: "Message text to send. Supports Slack markdown formatting.",
          threadTs: "Optional timestamp of parent message to reply in thread"
        },
        required: ["channelIdentifier", "text"]
      },
      getMessages: {
        description: "Fetch recent messages from a specific Slack channel or DM",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or user ID for DM (e.g. U1234567890)",
          limit: "Number of messages to fetch (default: 10, max: 1000)",
          oldest: "Only messages after this timestamp (inclusive)",
          latest: "Only messages before this timestamp (exclusive)"
        },
        required: ["channelIdentifier"]
      },
      listConversations: {
        description: "List Slack conversations (channels, DMs, groups) that the user has access to",
        parameters: {
          types: "Comma-separated list of conversation types to include: public_channel, private_channel, im, mpim. Default: all types",
          limit: "Maximum number of conversations to return (default: 100, max: 1000)"
        },
        required: []
      },
      searchMessages: {
        description: "Search for messages across all accessible Slack channels and DMs",
        parameters: {
          query: "Search query string. Can include Slack search modifiers like 'from:username', 'in:channel', etc.",
          limit: "Maximum number of results to return (default: 20, max: 100)"
        },
        required: ["query"]
      },
      pinMessage: {
        description: "Pin a specific message to a Slack channel. Use this when user wants to 'pin message' or 'pin this'.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to pin"
        },
        required: ["channelIdentifier", "messageTs"]
      },
      unpinMessage: {
        description: "Unpin a specific message from a Slack channel.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to unpin"
        },
        required: ["channelIdentifier", "messageTs"]
      },
      listPinnedMessages: {
        description: "List all pinned messages in a specific Slack channel.",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) to list pinned content from"
        },
        required: ["channelIdentifier"]
      },
      getUserProfile: {
        description: "Get detailed profile information for a Slack user",
        parameters: {
          userIdentifier: "User ID (e.g. U1234567890), username, or display name to get profile for"
        },
        required: ["userIdentifier"]
      },
      getUserPresence: {
        description: "Check online presence status of a Slack user",
        parameters: {
          userIdentifier: "User ID (e.g. U1234567890) or username (e.g. 'john.doe') to check presence for"
        },
        required: ["userIdentifier"]
      },
      setUserStatus: {
        description: "Set your own Slack status message and emoji",
        parameters: {
          statusText: "Status text message (optional)",
          statusEmoji: "Status emoji (e.g. 'coffee', 'meeting') - do not include colons (optional)",
          statusExpiration: "Unix timestamp when status expires (optional)"
        },
        required: []
      },
      listUsers: {
        description: "List all users in the Slack workspace",
        parameters: {
          limit: "Maximum number of users to return (default: 100, max: 500)",
          cursor: "Pagination cursor for getting next page of results"
        },
        required: []
      },
      getConversationDetails: {
        description: "Get detailed information about a specific Slack conversation (channel, DM, group)",
        parameters: {
          conversationIdentifier: "Channel ID (e.g. C1234567890), user ID for DM (e.g. U1234567890), or channel name (e.g. #general)"
        },
        required: ["conversationIdentifier"]
      },
      getConversationMembers: {
        description: "List members of a specific Slack conversation",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) - DMs not supported",
          limit: "Maximum number of members to return (default: 100, max: 1000)"
        },
        required: ["channelIdentifier"]
      },
      createConversation: {
        description: "Create a new Slack channel or private group",
        parameters: {
          name: "Name for the new channel (without # prefix)",
          isPrivate: "Whether to create a private channel (true) or public channel (false)",
          memberUserIds: "Comma-separated list of user IDs to invite to the channel (optional)"
        },
        required: ["name", "isPrivate"]
      },
      joinConversation: {
        description: "Join a public Slack channel",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) to join"
        },
        required: ["channelIdentifier"]
      },
      leaveConversation: {
        description: "Leave a Slack channel or group",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) to leave"
        },
        required: ["channelIdentifier"]
      },
      archiveConversation: {
        description: "Archive a Slack channel",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) to archive"
        },
        required: ["channelIdentifier"]
      },
      unarchiveConversation: {
        description: "Unarchive a Slack channel",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) to unarchive"
        },
        required: ["channelIdentifier"]
      },
      setConversationTopicPurpose: {
        description: "Set the topic and/or purpose for a Slack channel",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) to update",
          topic: "New topic for the channel (optional)",
          purpose: "New purpose for the channel (optional)"
        },
        required: ["channelIdentifier"]
      },
      markConversationAsRead: {
        description: "Mark all messages in a conversation as read",
        parameters: {
          conversationIdentifier: "Channel ID (e.g. C1234567890), user ID for DM (e.g. U1234567890), or channel name (e.g. #general)",
          latestMessageTs: "Timestamp of latest message to mark as read (optional - defaults to latest message)"
        },
        required: ["conversationIdentifier"]
      },
      updateMessage: {
        description: "Edit/update an existing Slack message",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to update",
          text: "New text for the message (optional if blocks provided)"
        },
        required: ["channelIdentifier", "messageTs"]
      },
      deleteMessage: {
        description: "Delete a Slack message",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to delete"
        },
        required: ["channelIdentifier", "messageTs"]
      },
      getMessagePermalink: {
        description: "Get a permanent link to a specific Slack message",
        parameters: {
          channelIdentifier: "Channel ID (e.g. C1234567890) or channel name (e.g. #general) where the message is located",
          messageTs: "Message timestamp (e.g. '1234567890.123456') of the message to get permalink for"
        },
        required: ["channelIdentifier", "messageTs"]
      },
      listFiles: {
        description: "List files shared in Slack conversations",
        parameters: {
          conversationIdentifier: "Channel ID (e.g. C1234567890), user ID for DM (e.g. U1234567890), or channel name (e.g. #general) to list files from (optional - defaults to all accessible files)",
          types: "Comma-separated file types to filter by (e.g. 'images,documents') (optional)",
          limit: "Maximum number of files to return (default: 20, max: 100)"
        },
        required: []
      },
      uploadFile: {
        description: "Upload a file to a Slack conversation",
        parameters: {
          conversationIdentifier: "Channel ID (e.g. C1234567890), user ID for DM (e.g. U1234567890), or channel name (e.g. #general) to upload file to",
          filename: "Name for the uploaded file",
          title: "Title for the file (optional)",
          initialComment: "Comment to add with the file upload (optional)"
        },
        required: ["conversationIdentifier", "filename"]
      },
      getTotalUnreadSummary: {
        description: "Get the total count of unread messages across all conversations, broken down by type",
        parameters: {},
        required: []
      },
      getRecentUnreadMessages: {
        description: "Get the most recent unread messages for preview display",
        parameters: {
          limit: "Maximum number of recent unread messages to return (default: 10, max: 50)"
        },
        required: []
      },
      checkAuthStatus: {
        description: "Check the current Slack authentication status. Use this when user wants to 'check auth', 'check authentication', 'check slack auth', 'verify auth', or 'am I authenticated'.",
        parameters: {},
        required: []
      }
    };

    // Create AI prompt for function mapping
    const prompt = `You are a Slack API function mapper. Given a natural language command, map it to the appropriate Slack function call.

Available functions and their parameters:
${JSON.stringify(functionsManifest, null, 2)}

Examples of expected outputs:
- "react to 1749240228.366519 in test-channel with thumbs up" → {"functionName": "addReaction", "params": {"channelIdentifier": "test-channel", "messageTs": "1749240228.366519", "emoji": "thumbsup"}}
- "get reactions to 1749240228.366519 in test-channel" → {"functionName": "getMessageReactions", "params": {"channelIdentifier": "test-channel", "messageTs": "1749240228.366519"}}
- "show pinned messages in test-channel" → {"functionName": "listPinnedMessages", "params": {"channelIdentifier": "test-channel"}}
- "send hello to #general" → {"functionName": "sendMessage", "params": {"channelIdentifier": "#general", "text": "hello"}}
- "list my channels" → {"functionName": "listConversations", "params": {}}
- "archive channel test-channel" → {"functionName": "archiveConversation", "params": {"channelIdentifier": "test-channel"}}
- "unarchive channel old-channel" → {"functionName": "unarchiveConversation", "params": {"channelIdentifier": "old-channel"}}
- "set topic for #general to Daily Updates" → {"functionName": "setConversationTopicPurpose", "params": {"channelIdentifier": "#general", "topic": "Daily Updates"}}
- "get unread message count" → {"functionName": "getTotalUnreadSummary", "params": {}}
- "show recent unread messages" → {"functionName": "getRecentUnreadMessages", "params": {"limit": 10}}
- "mark #general as read" → {"functionName": "markConversationAsRead", "params": {"conversationIdentifier": "#general"}}
- "check slack auth" → {"functionName": "checkAuthStatus", "params": {}}
- "am I authenticated" → {"functionName": "checkAuthStatus", "params": {}}

Rules:
1. Always respond with valid JSON in format: {"functionName": "string", "params": {}}
2. Use the exact parameter names from the function manifest
3. Convert channel names to include # prefix if missing (e.g. "general" → "#general")
4. For emoji reactions, use just the emoji name without colons (e.g. "thumbsup" not ":thumbsup:")
5. If no function matches, return null
6. Be flexible with natural language variations

Command: "${command}"

Response (JSON only):`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    try {
      // Clean up the response to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('🤖 AI response did not contain valid JSON, falling back to pattern matching');
        return parseNaturalLanguageCommandFallback(command);
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate the response structure
      if (!parsed.functionName || typeof parsed.params !== 'object') {
        console.warn('🤖 AI response missing required fields, falling back to pattern matching');
        return parseNaturalLanguageCommandFallback(command);
      }

      console.log('🤖 AI successfully mapped command:', command, '→', parsed);
      return parsed;

    } catch (parseError) {
      console.warn('🤖 Failed to parse AI response, falling back to pattern matching:', parseError);
      return parseNaturalLanguageCommandFallback(command);
    }

  } catch (error) {
    console.warn('🤖 AI command parsing failed, falling back to pattern matching:', error);
    return parseNaturalLanguageCommandFallback(command);
  }
}

/**
 * Fallback pattern matching for natural language commands
 * Used when Gemini API is not available or fails
 */
function parseNaturalLanguageCommandFallback(command: string): { functionName: string; params: any } | null {
  const lowerCommand = command.toLowerCase().trim()
  
  // React to message patterns
  if (lowerCommand.includes('react') && lowerCommand.includes('to')) {
    const messageTimestampMatch = lowerCommand.match(/react\s+to\s+([0-9]+\.[0-9]+)/i)
    const channelMatch = lowerCommand.match(/(?:to.*?)?(?:in|from)\s+([#@]?\w+[\w-]*)/i)
    const emojiMatch = lowerCommand.match(/with\s+(?:a\s+)?(?:an?\s+)?([:\w]+)/i)
    
    if (messageTimestampMatch && channelMatch && emojiMatch) {
      let channel = channelMatch[1];
      let emoji = emojiMatch[1];
      
      // Clean emoji name (remove colons and common words)
      emoji = emoji.replace(/^:+|:+$/g, '').replace(/thumbs?\s*up/i, 'thumbsup').replace(/thumbs?\s*down/i, 'thumbsdown');
      
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      
      return {
        functionName: 'addReaction',
        params: {
          channelIdentifier: channel,
          messageTs: messageTimestampMatch[1],
          emoji: emoji
        }
      }
    }
  }
  
  // Send message patterns
  if (lowerCommand.includes('send') && (lowerCommand.includes('message') || lowerCommand.includes('say'))) {
    const channelMatch = lowerCommand.match(/(?:to|in)\s+([#@]\w+|\w+)/i)
    const textMatch = lowerCommand.match(/(?:saying?|message)\s+["']?([^"']+)["']?/i)
    
    if (channelMatch && textMatch) {
      let channel = channelMatch[1];
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      return {
        functionName: 'sendMessage',
        params: {
          channelIdentifier: channel,
          text: textMatch[1]
        }
      }
    }
  }
  
  // Get reactions patterns - this needs to come before general get messages
  if ((lowerCommand.includes('get') || lowerCommand.includes('show') || lowerCommand.includes('see')) && lowerCommand.includes('reaction')) {
    const messageTimestampMatch = lowerCommand.match(/(?:to|from|on)\s+([0-9]+\.[0-9]+)/i)
    const channelMatch = lowerCommand.match(/(?:in|from)\s+([#@]?\w+[\w-]*)/i)
    
    if (messageTimestampMatch && channelMatch) {
      let channel = channelMatch[1];
      
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      
      return {
        functionName: 'getMessageReactions',
        params: {
          channelIdentifier: channel,
          messageTs: messageTimestampMatch[1]
        }
      }
    }
  }

  // Pinned messages patterns
  if ((lowerCommand.includes('show') || lowerCommand.includes('list') || lowerCommand.includes('get') || lowerCommand.includes('see')) && 
      (lowerCommand.includes('pinned') || lowerCommand.includes('pin'))) {
    const channelMatch = lowerCommand.match(/(?:in|from)\s+([#@]?\w+[\w-]*)/i)
    
    if (channelMatch) {
      let channel = channelMatch[1];
      
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      
      return {
        functionName: 'listPinnedMessages',
        params: {
          channelIdentifier: channel
        }
      }
    }
  }

  // Unread message patterns
  if (lowerCommand.includes('unread')) {
    if (lowerCommand.includes('count') || lowerCommand.includes('total') || lowerCommand.includes('summary')) {
      return {
        functionName: 'getTotalUnreadSummary',
        params: {}
      }
    }
    
    if (lowerCommand.includes('messages') || lowerCommand.includes('recent')) {
      const limitMatch = lowerCommand.match(/(\d+)/i)
      return {
        functionName: 'getRecentUnreadMessages',
        params: {
          limit: limitMatch ? parseInt(limitMatch[1]) : 10
        }
      }
    }
  }

  // Mark as read patterns
  if ((lowerCommand.includes('mark') || lowerCommand.includes('read')) && 
      (lowerCommand.includes('conversation') || lowerCommand.includes('channel') || lowerCommand.includes('as read'))) {
    const channelMatch = lowerCommand.match(/(?:in|from|channel|conversation)\s+([#@]?\w+[\w-]*)/i)
    
    if (channelMatch) {
      let channel = channelMatch[1];
      
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      
      return {
        functionName: 'markConversationAsRead',
        params: {
          conversationIdentifier: channel
        }
      }
    }
  }

  // Get messages patterns
  if (lowerCommand.includes('get') || lowerCommand.includes('show') || lowerCommand.includes('recent')) {
    if (lowerCommand.includes('message')) {
      const channelMatch = lowerCommand.match(/(?:from|in)\s+([#@]\w+|\w+)/i)
      if (channelMatch) {
        let channel = channelMatch[1];
        // Add # if not present and it's not a user mention
        if (!channel.startsWith('#') && !channel.startsWith('@')) {
          channel = '#' + channel;
        }
        return {
          functionName: 'getMessages',
          params: {
            channelIdentifier: channel,
            limit: 10
          }
        }
      }
    }
  }
  
  // Archive/Unarchive conversation patterns
  if (lowerCommand.includes('archive')) {
    const channelMatch = lowerCommand.match(/(?:archive|unarchive)\s+(?:channel\s+)?([#@]?\w+[\w-]*)/i)
    
    if (channelMatch) {
      let channel = channelMatch[1];
      
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      
      const functionName = lowerCommand.includes('unarchive') ? 'unarchiveConversation' : 'archiveConversation';
      
      return {
        functionName,
        params: {
          channelIdentifier: channel
        }
      }
    }
  }

  // List users pattern
  if ((lowerCommand.includes('list') || lowerCommand.includes('show') || lowerCommand.includes('get')) && 
      (lowerCommand.includes('users') || lowerCommand.includes('members') || lowerCommand.includes('people'))) {
    return {
      functionName: 'listUsers',
      params: {}
    }
  }

  // User presence pattern
  if ((lowerCommand.includes('check') || lowerCommand.includes('get') || lowerCommand.includes('see') || lowerCommand.includes('is')) &&
      (lowerCommand.includes('presence') || lowerCommand.includes('online') || lowerCommand.includes('status') || lowerCommand.includes('away'))) {
    // Try to match user ID first
    const userIdMatch = lowerCommand.match(/(?:user\s+)?(U[A-Z0-9]{8,})/i)
    // Try to match username patterns
    const usernameMatch = lowerCommand.match(/(?:user\s+|@)?([a-zA-Z0-9._-]+)\s+(?:online|presence|status|away)/i) ||
                         lowerCommand.match(/is\s+([a-zA-Z0-9._-]+)\s+online/i) ||
                         lowerCommand.match(/(?:check|get|see)\s+(?:if\s+)?(?:user\s+)?([a-zA-Z0-9._-]+)/i)
    
    if (userIdMatch) {
      return {
        functionName: 'getUserPresence',
        params: {
          userIdentifier: userIdMatch[1]
        }
      }
    } else if (usernameMatch) {
      return {
        functionName: 'getUserPresence',
        params: {
          userIdentifier: usernameMatch[1]
        }
      }
    }
  }

  // Set topic/purpose pattern
  if ((lowerCommand.includes('set') || lowerCommand.includes('update') || lowerCommand.includes('change')) &&
      (lowerCommand.includes('topic') || lowerCommand.includes('purpose'))) {
    const channelMatch = lowerCommand.match(/(?:for|in)\s+([#@]?\w+[\w-]*)/i)
    const topicMatch = lowerCommand.match(/topic\s+(?:to\s+)?["']?([^"']+)["']?/i)
    const purposeMatch = lowerCommand.match(/purpose\s+(?:to\s+)?["']?([^"']+)["']?/i)
    
    if (channelMatch) {
      let channel = channelMatch[1];
      
      // Add # if not present and it's not a user mention
      if (!channel.startsWith('#') && !channel.startsWith('@')) {
        channel = '#' + channel;
      }
      
      const params: any = { channelIdentifier: channel };
      
      if (topicMatch) params.topic = topicMatch[1];
      if (purposeMatch) params.purpose = purposeMatch[1];
      
      return {
        functionName: 'setConversationTopicPurpose',
        params
      }
    }
  }

  // List conversations
  if (lowerCommand.includes('conversation') || lowerCommand.includes('channel')) {
    if (lowerCommand.includes('list') || lowerCommand.includes('get') || lowerCommand.includes('show')) {
      return {
        functionName: 'listConversations',
        params: {}
      }
    }
  }
  
  // Search messages
  if (lowerCommand.includes('search')) {
    const queryMatch = lowerCommand.match(/search\s+(?:for\s+)?["']?([^"']+)["']?/i)
    if (queryMatch) {
      return {
        functionName: 'searchMessages',
        params: {
          query: queryMatch[1],
          count: 20
        }
      }
    }
  }
  
  return null
}

// Export utilities
export { resolveChannelNameToId, resolveUsernameToId, resolveConversationId } from './utils'

/**
 * ✅ PHASE 1 & 2A IMPLEMENTATION STATUS:
 * 
 * ✅ Phase 1 Core Functions:
 * - AUTH-001: getOAuthURL
 * - AUTH-002: handleOAuthCallback  
 * - AUTH-003: checkAuthenticationStatus
 * - CONV-001: listConversations
 * - CONV-002: getConversationDetails
 * - MSG-001: getMessages
 * - MSG-002: sendMessage
 * - RT-001: getTotalUnreadSummary
 * - RT-002: getRecentUnreadMessages
 * - RT-003: markConversationAsRead
 * - USER-001: getUserProfile
 * - SRCH-001: searchMessages
 * 
 * ✅ Phase 2A Core Extensions:
 * - AUTH-004: revokeAuthentication
 * - CONV-003: getConversationMembers
 * - CONV-004: createConversation
 * - CONV-009: joinConversation
 * - CONV-010: leaveConversation
 * - MSG-003: updateMessage
 * - MSG-004: deleteMessage
 * - MSG-006: getMessagePermalink
 * - FILE-001: listFiles
 * - FILE-002: uploadFile
 * 
 * ✅ Shared Infrastructure:
 * - Single SlackClientPool for all modules
 * - Consistent error handling via SlackAPIError
 * - Shared handleSlackResponse wrapper
 * - Clean modular structure
 * 
 * 🚧 Phase 2B+ Ready:
 * - Message interactions (reactions, pins)
 * - Enhanced user management
 * - Advanced search with filters
 * - Productivity features (reminders, drafts)
 * - Real-time advanced state management
 */ 