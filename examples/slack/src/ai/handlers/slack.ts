import { sendMessage, getMessages, updateMessage, deleteMessage, getMessagePermalink } from "../../webAPI/messaging"
import { listConversations, getConversationDetails, getConversationMembers, createConversation, joinConversation, leaveConversation, archiveConversation, unarchiveConversation, setConversationTopicPurpose } from "../../webAPI/conversations"  
import { searchMessages } from "../../webAPI/search"
import { getUserProfile, setUserStatus, getUserPresence, listUsers } from "../../webAPI/users"
import { getTotalUnreadSummary, markConversationAsRead, getRecentUnreadMessages } from "../../webAPI/realtime"
import { revokeAuthentication } from "../../webAPI/auth"
import { listFiles, uploadFile } from "../../webAPI/files"
import { addReaction, removeReaction, getMessageReactions, pinMessage, unpinMessage, listPinnedMessages } from "../../webAPI/interactions"
import type { User } from "../../util"

/**
 * Slack action handlers
 * Uses clean parameter naming convention:
 * - channelIdentifier: for channel-only functions
 * - conversationIdentifier: for universal conversation functions (channels + DMs)
 * - userIdentifier: for user functions
 */

export async function handleSlackActions(
  name: string,
  parsedParams: any,
  user: User
): Promise<any> {
  
  switch (name) {
    // MSG-002: sendMessage
    case "sendMessage": {
      const { channelIdentifier, text, threadTs } = parsedParams as any
      return await sendMessage(user, channelIdentifier, text, undefined, threadTs)
    }

    // CONV-001: listConversations
    case "listConversations": {
      try {
        return await listConversations(user)
      } catch (error: any) {
        return {
          error: "Failed to get conversations",
          message: error.message,
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      }
    }

    // MSG-001: getMessages
    case "getMessages": {
      const { channelIdentifier, limit = 20 } = parsedParams as any
      return await getMessages(user, channelIdentifier, limit)
    }

    // SRCH-001: searchMessages
    case "searchMessages": {
      const { query, limit = 20 } = parsedParams as any
      return await searchMessages(user, query, limit)
    }

    // USER-001: getUserProfile
    case "getUserProfile": {
      const { userIdentifier } = parsedParams as any
      return await getUserProfile(user, userIdentifier)
    }

    // CONV-002: getConversationDetails
    case "getConversationDetails": {
      const { conversationIdentifier } = parsedParams as any
      return await getConversationDetails(user, conversationIdentifier)
    }

    // RT-001: getTotalUnreadSummary
    case "getTotalUnreadSummary": {
      return await getTotalUnreadSummary(user)
    }

    // RT-002: getRecentUnreadMessages
    case "getRecentUnreadMessages": {
      const { limit = 10 } = parsedParams as any
      return await getRecentUnreadMessages(user, limit)
    }

    // RT-003: markConversationAsRead
    case "markConversationAsRead": {
      const { conversationIdentifier, latestMessageTs } = parsedParams as any
      return await markConversationAsRead(user, conversationIdentifier, latestMessageTs)
    }

    // ===== PHASE 2A FUNCTIONS =====

    // AUTH-004: revokeAuthentication
    case "revokeAuthentication": {
      return await revokeAuthentication(user.id)
    }

    // CONV-003: getConversationMembers
    case "getConversationMembers": {
      const { channelIdentifier, limit } = parsedParams as any
      return await getConversationMembers(user, channelIdentifier, limit)
    }

    // CONV-004: createConversation
    case "createConversation": {
      const { name, isPrivate, memberUserIds } = parsedParams as any
      return await createConversation(user, name, isPrivate, memberUserIds)
    }

    // CONV-009: joinConversation
    case "joinConversation": {
      const { channelIdentifier } = parsedParams as any
      return await joinConversation(user, channelIdentifier)
    }

    // CONV-010: leaveConversation
    case "leaveConversation": {
      const { channelIdentifier } = parsedParams as any
      return await leaveConversation(user, channelIdentifier)
    }

    // MSG-003: updateMessage
    case "updateMessage": {
      const { channelIdentifier, messageTs, text, blocks } = parsedParams as any
      return await updateMessage(user, channelIdentifier, messageTs, text, blocks)
    }

    // MSG-004: deleteMessage
    case "deleteMessage": {
      const { channelIdentifier, messageTs } = parsedParams as any
      return await deleteMessage(user, channelIdentifier, messageTs)
    }

    // MSG-006: getMessagePermalink
    case "getMessagePermalink": {
      const { channelIdentifier, messageTs } = parsedParams as any
      return await getMessagePermalink(user, channelIdentifier, messageTs)
    }

    // FILE-001: listFiles
    case "listFiles": {
      const { conversationIdentifier, types, limit, page } = parsedParams as any
      return await listFiles(user, conversationIdentifier, types, limit, page)
    }

    // FILE-002: uploadFile
    case "uploadFile": {
      const { conversationIdentifier, filename, title, initialComment, filetype } = parsedParams as any
      // Note: This is a placeholder - actual file upload would need file content handling
      return {
        success: false,
        error: "File upload requires file content handling implementation"
      }
    }

    // ===== PHASE 2B FUNCTIONS =====

    // INTR-001: addReaction
    case "addReaction": {
      const { channelIdentifier, messageTs, emoji } = parsedParams as any
      return await addReaction(user, channelIdentifier, messageTs, emoji)
    }

    // INTR-002: removeReaction
    case "removeReaction": {
      const { channelIdentifier, messageTs, emoji } = parsedParams as any
      return await removeReaction(user, channelIdentifier, messageTs, emoji)
    }

    // INTR-003: getMessageReactions
    case "getMessageReactions": {
      const { channelIdentifier, messageTs } = parsedParams as any
      return await getMessageReactions(user, channelIdentifier, messageTs)
    }

    // INTR-004: pinMessage
    case "pinMessage": {
      const { channelIdentifier, messageTs } = parsedParams as any
      return await pinMessage(user, channelIdentifier, messageTs)
    }

    // INTR-005: unpinMessage
    case "unpinMessage": {
      const { channelIdentifier, messageTs } = parsedParams as any
      return await unpinMessage(user, channelIdentifier, messageTs)
    }

    // INTR-006: listPinnedMessages
    case "listPinnedMessages": {
      const { channelIdentifier } = parsedParams as any
      return await listPinnedMessages(user, channelIdentifier)
    }

    // USER-002: setUserStatus
    case "setUserStatus": {
      const { statusText, statusEmoji, statusExpiration } = parsedParams as any
      return await setUserStatus(user, statusText, statusEmoji, statusExpiration)
    }

    // USER-003: getUserPresence
    case "getUserPresence": {
      const { userIdentifier } = parsedParams as any
      return await getUserPresence(user, userIdentifier)
    }

    // USER-004: listUsers
    case "listUsers": {
      const { limit, cursor, includeLocale } = parsedParams as any
      return await listUsers(user, limit, cursor, includeLocale)
    }

    // CONV-005: archiveConversation
    case "archiveConversation": {
      const { channelIdentifier } = parsedParams as any
      return await archiveConversation(user, channelIdentifier)
    }

    // CONV-006: unarchiveConversation
    case "unarchiveConversation": {
      const { channelIdentifier } = parsedParams as any
      return await unarchiveConversation(user, channelIdentifier)
    }

    // CONV-011: setConversationTopicPurpose
    case "setConversationTopicPurpose": {
      const { channelIdentifier, topic, purpose } = parsedParams as any
      return await setConversationTopicPurpose(user, channelIdentifier, topic, purpose)
    }

    default: {
      return { 
        error: `Unknown function: ${name}` 
      }
    }
  }
}

/**
 * Execute Slack functions with rate limiting bypassed for developer mode
 * This is called from the widget UI for direct function execution
 */
export async function executeSlackFunctionBypass(
  functionName: string,
  parameters: any,
  user: User
): Promise<any> {
  
  try {
    console.log(`🚨 DEVELOPER MODE: Starting bypass execution of ${functionName}`)
    
    // Import the bypass utility
    const { executeWithBypassedRateLimit } = await import("../../webAPI/index.js")
    
    const result = await executeWithBypassedRateLimit(async () => {
      // Execute the function normally, but rate limiting is bypassed
      return await handleSlackActions(functionName, parameters, user)
    }, `BYPASS_${functionName}`)
    
    console.log(`🚨 DEVELOPER MODE: Bypass execution completed for ${functionName}`, result)
    
    // Ensure we always return a valid object
    return result || { success: true, message: "Function executed but returned no data" }
  } catch (error: any) {
    console.error(`🚨 DEVELOPER MODE: Bypass execution failed for ${functionName}:`, error)
    return {
      error: error.message || "Unknown error occurred",
      functionName,
      parameters
    }
  }
}

/**
 * Execute natural language commands with rate limiting bypassed
 */
export async function executeNaturalLanguageBypass(
  command: string,
  user: User
): Promise<any> {
  
  try {
    console.log(`🚨 DEVELOPER MODE: Starting natural language bypass for: "${command}"`)
    
    // Import the utilities
    const { executeWithBypassedRateLimit, parseNaturalLanguageCommand } = await import("../../webAPI/index.js")
    
    const parsed = await parseNaturalLanguageCommand(command)
    
    if (!parsed) {
      console.log(`🚨 DEVELOPER MODE: Could not parse command: "${command}"`)
      return {
        error: "Could not parse natural language command",
        suggestion: "Try commands like 'send a message to #general saying hello' or 'get recent messages from #random'",
        command
      }
    }
    
    console.log(`🚨 DEVELOPER MODE: Parsed command as:`, parsed)
    
    const result = await executeWithBypassedRateLimit(async () => {
      // Route to appropriate handler based on function type
      if (isAuthenticationAction(parsed.functionName)) {
        const { handleAuthenticationActions } = await import("./auth.js")
        return await handleAuthenticationActions(parsed.functionName, parsed.params, user, user.id)
      }
      // Default to Slack actions for non-auth functions
      return await handleSlackActions(parsed.functionName, parsed.params, user)
    }, `BYPASS_NL_${parsed.functionName}`)
    
    // Enhanced logging for better reaction display
    if (parsed.functionName === 'getMessageReactions' && result?.reactions) {
      console.log(`🚨 DEVELOPER MODE: Natural language bypass completed for getMessageReactions:`)
      console.log(`  Success: ${result.success}`)
      console.log(`  Reactions:`)
      result.reactions.forEach((reaction: any, index: number) => {
        console.log(`    ${index + 1}. ${reaction.name} (${reaction.count} reactions)`)
        console.log(`       Users: [${reaction.users.join(', ')}]`)
      })
    } else {
      console.log(`🚨 DEVELOPER MODE: Natural language bypass completed`, result)
    }
    
    // Ensure we always return a valid object
    return result || { success: true, message: "Command executed but returned no data" }
  } catch (error: any) {
    console.error(`🚨 DEVELOPER MODE: Natural language bypass failed:`, error)
    return {
      error: error.message || "Unknown error occurred",
      command
    }
  }
}

/**
 * Helper function to check if a function is an authentication action
 */
function isAuthenticationAction(name: string): boolean {
  return ['getAuthUrl', 'checkAuthStatus', 'manualAuth'].includes(name)
} 