/**
 * Slack Interactions Module - Phase 2B Implementation
 * Implements: INTR-001, INTR-002, INTR-003, INTR-004, INTR-005, INTR-006
 */

import type { User } from '../util'
import { validateUserAuth } from './auth'
import { clientPool, handleSlackResponse, SlackAPIError } from './client'
import { resolveChannelNameToId } from './utils'

/**
 * INTR-001: addReaction - Phase 2B Implementation
 */
export async function addReaction(
  user: User,
  channelIdentifier: string,
  messageTs: string,
  emoji: string
): Promise<{ success: boolean, error?: string }> {
  try {
    console.log('👍 Adding reaction:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`,
      emoji
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve channel name to ID if needed
    let channelId;
    try {
      channelId = await resolveChannelNameToId(client, channelIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve channel name:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.reactions.add({
        channel: channelId,
        timestamp: messageTs,
        name: emoji.replace(/:/g, '') // Remove colons if present
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to add reaction: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Reaction added successfully: ${emoji}`)

      return {
        success: true
      }

    }, 'addReaction')

  } catch (error) {
    console.error('❌ Failed to add reaction:', error)
    
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
      error: `Failed to add reaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * INTR-002: removeReaction - Phase 2B Implementation
 */
export async function removeReaction(
  user: User,
  channelIdentifier: string,
  messageTs: string,
  emoji: string
): Promise<{ success: boolean, error?: string }> {
  try {
    console.log('👎 Removing reaction:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`,
      emoji
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve channel name to ID if needed
    let channelId;
    try {
      channelId = await resolveChannelNameToId(client, channelIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve channel name:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.reactions.remove({
        channel: channelId,
        timestamp: messageTs,
        name: emoji.replace(/:/g, '') // Remove colons if present
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to remove reaction: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Reaction removed successfully: ${emoji}`)

      return {
        success: true
      }

    }, 'removeReaction')

  } catch (error) {
    console.error('❌ Failed to remove reaction:', error)
    
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
      error: `Failed to remove reaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * INTR-003: getMessageReactions - Phase 2B Implementation
 */
export async function getMessageReactions(
  user: User,
  channelIdentifier: string,
  messageTs: string
): Promise<{ success: boolean, reactions: any[], error?: string }> {
  try {
    console.log('📊 Getting message reactions:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve channel name to ID if needed
    let channelId;
    try {
      channelId = await resolveChannelNameToId(client, channelIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve channel name:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.reactions.get({
        channel: channelId,
        timestamp: messageTs
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get reactions: ${result.error}`, 'API_ERROR')
      }

      const reactions = result.message?.reactions?.map((reaction: any) => ({
        name: reaction.name,
        count: reaction.count,
        users: reaction.users || []
      })) || []

      console.log(`✅ Retrieved ${reactions.length} reactions`)

      return {
        success: true,
        reactions
      }

    }, 'getMessageReactions')

  } catch (error) {
    console.error('❌ Failed to get message reactions:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND') {
        return {
          success: false,
          reactions: [],
          error: `Channel "${channelIdentifier}" not found. Please provide a valid channel name or ID.`
        }
      }
      return {
        success: false,
        reactions: [],
        error: error.message
      }
    }

    return {
      success: false,
      reactions: [],
      error: `Failed to get message reactions: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * INTR-004: pinMessage - Phase 2B Implementation
 */
export async function pinMessage(
  user: User,
  channelIdentifier: string,
  messageTs: string
): Promise<{ success: boolean, error?: string }> {
  try {
    console.log('📌 Pinning message:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve channel name to ID if needed
    let channelId;
    try {
      channelId = await resolveChannelNameToId(client, channelIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve channel name:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.pins.add({
        channel: channelId,
        timestamp: messageTs
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to pin message: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Message pinned successfully: ${messageTs}`)

      return {
        success: true
      }

    }, 'pinMessage')

  } catch (error) {
    console.error('❌ Failed to pin message:', error)
    
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
      error: `Failed to pin message: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * INTR-005: unpinMessage - Phase 2B Implementation
 */
export async function unpinMessage(
  user: User,
  channelIdentifier: string,
  messageTs: string
): Promise<{ success: boolean, error?: string }> {
  try {
    console.log('📍 Unpinning message:', {
      channelIdentifier,
      messageTs: `${messageTs.substring(0, 15)}...`
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve channel name to ID if needed
    let channelId;
    try {
      channelId = await resolveChannelNameToId(client, channelIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve channel name:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.pins.remove({
        channel: channelId,
        timestamp: messageTs
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to unpin message: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Message unpinned successfully: ${messageTs}`)

      return {
        success: true
      }

    }, 'unpinMessage')

  } catch (error) {
    console.error('❌ Failed to unpin message:', error)
    
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
      error: `Failed to unpin message: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * INTR-006: listPinnedMessages - Phase 2B Implementation
 */
export async function listPinnedMessages(
  user: User,
  channelIdentifier: string
): Promise<{ success: boolean, pins: any[], error?: string }> {
  try {
    console.log('📋 Listing pinned messages:', {
      channelIdentifier
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve channel name to ID if needed
    let channelId;
    try {
      channelId = await resolveChannelNameToId(client, channelIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve channel name:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.pins.list({
        channel: channelId
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list pinned messages: ${result.error}`, 'API_ERROR')
      }

      const pins = result.items?.map((item: any) => ({
        type: item.type,
        created: item.created,
        created_by: item.created_by,
        message: item.message ? {
          ts: item.message.ts,
          type: item.message.type,
          user: item.message.user,
          text: item.message.text,
          thread_ts: item.message.thread_ts,
          reactions: item.message.reactions
        } : undefined,
        file: item.file ? {
          id: item.file.id,
          name: item.file.name,
          title: item.file.title,
          mimetype: item.file.mimetype,
          filetype: item.file.filetype,
          pretty_type: item.file.pretty_type,
          user: item.file.user,
          created: item.file.created,
          timestamp: item.file.timestamp,
          size: item.file.size,
          url_private: item.file.url_private,
          url_private_download: item.file.url_private_download,
          permalink: item.file.permalink,
          permalink_public: item.file.permalink_public
        } : undefined
      })) || []

      console.log(`✅ Retrieved ${pins.length} pinned items`)

      return {
        success: true,
        pins
      }

    }, 'listPinnedMessages')

  } catch (error) {
    console.error('❌ Failed to list pinned messages:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'CHANNEL_NOT_FOUND') {
        return {
          success: false,
          pins: [],
          error: `Channel "${channelIdentifier}" not found. Please provide a valid channel name or ID.`
        }
      }
      return {
        success: false,
        pins: [],
        error: error.message
      }
    }

    return {
      success: false,
      pins: [],
      error: `Failed to list pinned messages: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
} 