/**
 * Slack Messaging Module - Phase 1 Implementation
 * Implements: MSG-001, MSG-002
 */

import type { User } from '../util'
import type { 
  SlackMessage,
  MessagesResponse,
  MessageSendResponse
} from './types'
import { validateUserAuth } from './auth'
import { clientPool, handleSlackResponse, SlackAPIError } from './client'
import { resolveConversationId } from './utils'

/**
 * MSG-001: Get messages from a conversation, with threading support
 */
export async function getMessages(
  user: User,
  channelIdentifier: string,
  limit?: number,
  cursor?: string,
  oldest?: string,
  latest?: string,
  threadTs?: string
): Promise<MessagesResponse> {
  try {
    console.log('📬 Getting messages:', {
      channelIdentifier,
      limit,
      threadTs: threadTs ? `${threadTs.substring(0, 15)}...` : undefined
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve conversation ID (supports channels and DMs)
    let channelId;
    try {
      channelId = await resolveConversationId(client, channelIdentifier, {
        includePrivate: true,
        includeArchived: false,
        allowDMs: true
      });
    } catch (error) {
      console.error('❌ Failed to resolve conversation:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.conversations.history({
        channel: channelId,
        limit: limit || 20,
        cursor,
        oldest,
        latest
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get messages: ${result.error}`, 'API_ERROR')
      }

      const messages: SlackMessage[] = result.messages?.map((msg: any) => ({
        ts: msg.ts,
        type: msg.type,
        user: msg.user,
        bot_id: msg.bot_id,
        username: msg.username,
        text: msg.text,
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count,
        reactions: msg.reactions?.map((reaction: any) => ({
          name: reaction.name,
          users: reaction.users || [],
          count: reaction.count || 0
        })),
        files: msg.files?.map((file: any) => ({
          id: file.id,
          name: file.name,
          title: file.title,
          mimetype: file.mimetype,
          filetype: file.filetype,
          pretty_type: file.pretty_type,
          user: file.user,
          created: file.created,
          timestamp: file.timestamp,
          size: file.size,
          url_private: file.url_private,
          url_private_download: file.url_private_download,
          permalink: file.permalink,
          permalink_public: file.permalink_public
        })),
        blocks: msg.blocks,
        attachments: msg.attachments,
        edited: msg.edited ? {
          user: msg.edited.user,
          ts: msg.edited.ts
        } : undefined,
        deleted_ts: msg.deleted_ts,
        subtype: msg.subtype
      })) || []

      console.log(`✅ Retrieved ${messages.length} messages`)

      return {
        success: true,
        messages,
        hasMore: !!result.has_more,
        nextCursor: result.response_metadata?.next_cursor
      }

    }, 'getMessages')

  } catch (error) {
    console.error('❌ Failed to get messages:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND' || error.code === 'USER_NOT_FOUND') {
        return {
          success: false,
          messages: [],
          error: `Conversation "${channelIdentifier}" not found. Please provide a valid channel name, user ID, or username.`
        }
      }
      return {
        success: false,
        messages: [],
        error: error.message
      }
    }

    return {
      success: false,
      messages: [],
      error: `Failed to get messages: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * MSG-002: Send a message to a conversation or as a threaded reply
 */
export async function sendMessage(
  user: User,
  channelIdentifier: string,
  text: string,
  blocks?: any[],
  threadTs?: string,
  broadcastToChannel?: boolean
): Promise<MessageSendResponse> {
  try {
    console.log('📤 Sending message:', {
      channelIdentifier,
      textLength: text.length,
      hasBlocks: !!blocks,
      isThreadReply: !!threadTs
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve conversation ID (supports channels and DMs)
    let channelId;
    try {
      channelId = await resolveConversationId(client, channelIdentifier, {
        includePrivate: true,
        includeArchived: false,
        allowDMs: true
      });
    } catch (error) {
      console.error('❌ Failed to resolve conversation:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const messagePayload: any = {
        channel: channelId,
        text: text
      }

      if (blocks && blocks.length > 0) {
        messagePayload.blocks = blocks
      }

      if (threadTs) {
        messagePayload.thread_ts = threadTs
        if (broadcastToChannel) {
          messagePayload.reply_broadcast = true
        }
      }

      const result = await client.chat.postMessage(messagePayload)

      if (!result.ok) {
        throw new SlackAPIError(`Failed to send message: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Message sent successfully: ${result.ts}`)

      return {
        success: true,
        messageTs: result.ts,
        message: result.message ? {
          ts: (result.message as any).ts,
          type: (result.message as any).type,
          user: (result.message as any).user,
          text: (result.message as any).text,
          thread_ts: (result.message as any).thread_ts,
          blocks: (result.message as any).blocks
        } as SlackMessage : undefined
      }

    }, 'sendMessage')

  } catch (error) {
    console.error('❌ Failed to send message:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND' || error.code === 'USER_NOT_FOUND') {
        return {
          success: false,
          error: `Conversation "${channelIdentifier}" not found. Please provide a valid channel name, user ID, or username.`
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

// Phase 2A implementations
/**
 * MSG-003: updateMessage - Phase 2A Implementation
 */
export async function updateMessage(
  user: User,
  channelIdentifier: string,
  messageTs: string,
  text?: string,
  blocks?: any[]
): Promise<{ success: boolean, message?: SlackMessage, error?: string }> {
  try {
    console.log('✏️ Updating message:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`,
      hasText: !!text,
      hasBlocks: !!blocks
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve conversation ID (supports channels and DMs)
    let channelId;
    try {
      channelId = await resolveConversationId(client, channelIdentifier, {
        includePrivate: true,
        includeArchived: false,
        allowDMs: true
      });
    } catch (error) {
      console.error('❌ Failed to resolve conversation:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const updatePayload: any = {
        channel: channelId,
        ts: messageTs
      }

      if (text) {
        updatePayload.text = text
      }

      if (blocks && blocks.length > 0) {
        updatePayload.blocks = blocks
      }

      const result = await client.chat.update(updatePayload)

      if (!result.ok) {
        throw new SlackAPIError(`Failed to update message: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Message updated successfully: ${result.ts}`)

      return {
        success: true,
        message: result.message ? {
          ts: (result.message as any).ts,
          type: (result.message as any).type,
          user: (result.message as any).user,
          text: (result.message as any).text,
          thread_ts: (result.message as any).thread_ts,
          blocks: (result.message as any).blocks
        } as SlackMessage : undefined
      }

    }, 'updateMessage')

  } catch (error) {
    console.error('❌ Failed to update message:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND') {
        return {
          success: false,
          error: `Channel "${channelIdentifier}" not found. Please provide a valid channel name or ID.`
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to update message: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * MSG-004: deleteMessage - Phase 2A Implementation
 */
export async function deleteMessage(
  user: User,
  channelIdentifier: string,
  messageTs: string
): Promise<{ success: boolean, error?: string }> {
  try {
    console.log('🗑️ Deleting message:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve conversation ID (supports channels and DMs)
    let channelId;
    try {
      channelId = await resolveConversationId(client, channelIdentifier, {
        includePrivate: true,
        includeArchived: false,
        allowDMs: true
      });
    } catch (error) {
      console.error('❌ Failed to resolve conversation:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.chat.delete({
        channel: channelId,
        ts: messageTs
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to delete message: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Message deleted successfully: ${messageTs}`)

      return {
        success: true
      }

    }, 'deleteMessage')

  } catch (error) {
    console.error('❌ Failed to delete message:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND') {
        return {
          success: false,
          error: `Channel "${channelIdentifier}" not found. Please provide a valid channel name or ID.`
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to delete message: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * MSG-006: getMessagePermalink - Phase 2A Implementation
 */
export async function getMessagePermalink(
  user: User,
  channelIdentifier: string,
  messageTs: string
): Promise<{ success: boolean, permalink?: string, error?: string }> {
  try {
    console.log('🔗 Getting message permalink:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve conversation ID (supports channels and DMs)
    let channelId;
    try {
      channelId = await resolveConversationId(client, channelIdentifier, {
        includePrivate: true,
        includeArchived: false,
        allowDMs: true
      });
    } catch (error) {
      console.error('❌ Failed to resolve conversation:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.chat.getPermalink({
        channel: channelId,
        message_ts: messageTs
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get message permalink: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Got message permalink: ${result.permalink}`)

      return {
        success: true,
        permalink: result.permalink
      }

    }, 'getMessagePermalink')

  } catch (error) {
    console.error('❌ Failed to get message permalink:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND') {
        return {
          success: false,
          error: `Channel "${channelIdentifier}" not found. Please provide a valid channel name or ID.`
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to get message permalink: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
} 