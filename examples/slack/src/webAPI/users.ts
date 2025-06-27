/**
 * Slack Users Module
 * 
 * Functions for managing user information, profiles, status, and presence.
 * Part of Phase 1 implementation.
 */

import type { User } from '../util'
import type { SlackAPIResponse, UserProfile } from './types'
import { validateUserAuth } from './auth'
import { clientPool, handleSlackResponse, SlackAPIError } from './client'
import { resolveUsernameToId } from './utils'

/**
 * USER-001: getUserProfile - Get detailed profile information for a user
 */
export async function getUserProfile(user: User, userIdentifier: string) {
  try {
    console.log('👤 Getting user profile:', { userIdentifier })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve username to user ID if needed
    let userId;
    try {
      userId = await resolveUsernameToId(client, userIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve username:', error);
      throw error;
    }
    
    return handleSlackResponse(async () => {
      const result = await client.users.info({
        user: userId,
      })
      
      if (!result.ok) {
        throw new SlackAPIError(`Failed to get user profile: ${result.error}`, 'API_ERROR')
      }
      
      console.log(`✅ Retrieved profile for user ${userId}`)
      
      return {
        success: true,
        user: {
          id: result.user?.id,
          name: result.user?.name,
          real_name: result.user?.real_name,
          display_name: result.user?.profile?.display_name,
          email: result.user?.profile?.email,
          avatar: result.user?.profile?.image_72,
        },
      }
    }, 'getUserProfile')

  } catch (error) {
    console.error('❌ Failed to get user profile:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'USER_NOT_FOUND') {
        return {
          success: false,
          error: `User "${userIdentifier}" not found. Please provide a valid username or user ID.`
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to get user profile: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * USER-002: setUserStatus - Phase 2B Implementation
 */
export async function setUserStatus(
  user: User,
  statusText?: string,
  statusEmoji?: string,
  statusExpiration?: number
): Promise<{ success: boolean, error?: string }> {
  try {
    console.log('👤 Setting user status:', {
      statusText,
      statusEmoji,
      statusExpiration
    })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    return handleSlackResponse(async () => {
      const statusProfile: any = {}
      
      if (statusText !== undefined) {
        statusProfile.status_text = statusText
      }
      
      if (statusEmoji !== undefined) {
        // Clean emoji name (remove colons if present)
        const cleanEmoji = statusEmoji.replace(/^:+|:+$/g, '')
        statusProfile.status_emoji = cleanEmoji ? `:${cleanEmoji}:` : ''
      }
      
      if (statusExpiration !== undefined) {
        statusProfile.status_expiration = statusExpiration
      }

      const result = await client.users.profile.set({
        profile: statusProfile
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to set user status: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Successfully updated user status`)

      return {
        success: true
      }

    }, 'setUserStatus')

  } catch (error) {
    console.error('❌ Failed to set user status:', error)
    
    if (error instanceof SlackAPIError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to set user status: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}



/**
 * USER-003: getUserPresence - Phase 2B Implementation
 */
export async function getUserPresence(
  user: User,
  userIdentifier: string
): Promise<{ 
  success: boolean, 
  presence?: {
    presence: string,
    online?: boolean,
    auto_away?: boolean,
    manual_away?: boolean,
    connection_count?: number,
    last_activity?: number
  }, 
  error?: string 
}> {
  try {
    console.log('👁️ Getting user presence:', { userIdentifier })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)
    
    // Resolve username to user ID if needed
    let userId;
    try {
      userId = await resolveUsernameToId(client, userIdentifier);
    } catch (error) {
      console.error('❌ Failed to resolve username:', error);
      throw error;
    }

    return handleSlackResponse(async () => {
      const result = await client.users.getPresence({
        user: userId
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to get user presence: ${result.error}`, 'API_ERROR')
      }

      console.log(`✅ Retrieved presence for user ${userId}`)

      return {
        success: true,
        presence: {
          presence: result.presence || 'unknown',
          online: result.online,
          auto_away: result.auto_away,
          manual_away: result.manual_away,
          connection_count: result.connection_count,
          last_activity: result.last_activity
        }
      }

    }, 'getUserPresence')

  } catch (error) {
    console.error('❌ Failed to get user presence:', error)
    
    if (error instanceof SlackAPIError) {
      if (error.code === 'USER_NOT_FOUND') {
        return {
          success: false,
          error: `User "${userIdentifier}" not found. Please provide a valid username or user ID.`
        }
      }
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to get user presence: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * USER-004: listUsers - Phase 2B Implementation
 */
export async function listUsers(
  user: User,
  limit?: number,
  cursor?: string,
  includeLocale?: boolean
): Promise<{ 
  success: boolean, 
  users?: Array<{
    id: string,
    name: string,
    real_name?: string,
    display_name?: string,
    email?: string,
    is_admin?: boolean,
    is_owner?: boolean,
    is_bot?: boolean,
    is_deleted?: boolean,
    profile?: any,
    tz?: string,
    tz_label?: string,
    tz_offset?: number
  }>, 
  nextCursor?: string,
  error?: string 
}> {
  try {
    console.log('👥 Listing users:', { limit, cursor, includeLocale })

    validateUserAuth(user)
    const client = clientPool.getClient(user.accessToken!)

    return handleSlackResponse(async () => {
      const result = await client.users.list({
        limit: limit || 100,
        cursor,
        include_locale: includeLocale
      })

      if (!result.ok) {
        throw new SlackAPIError(`Failed to list users: ${result.error}`, 'API_ERROR')
      }

      const users = result.members?.map((member: any) => ({
        id: member.id,
        name: member.name,
        real_name: member.real_name,
        display_name: member.profile?.display_name,
        email: member.profile?.email,
        is_admin: member.is_admin,
        is_owner: member.is_owner,
        is_bot: member.is_bot,
        is_deleted: member.deleted,
        profile: {
          avatar_hash: member.profile?.avatar_hash,
          status_text: member.profile?.status_text,
          status_emoji: member.profile?.status_emoji,
          status_expiration: member.profile?.status_expiration,
          image_24: member.profile?.image_24,
          image_32: member.profile?.image_32,
          image_48: member.profile?.image_48,
          image_72: member.profile?.image_72,
          image_192: member.profile?.image_192,
          image_512: member.profile?.image_512
        },
        tz: member.tz,
        tz_label: member.tz_label,
        tz_offset: member.tz_offset
      })) || []

      console.log(`✅ Retrieved ${users.length} users`)

      return {
        success: true,
        users,
        nextCursor: result.response_metadata?.next_cursor
      }

    }, 'listUsers')

  } catch (error) {
    console.error('❌ Failed to list users:', error)
    
    if (error instanceof SlackAPIError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to list users: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

