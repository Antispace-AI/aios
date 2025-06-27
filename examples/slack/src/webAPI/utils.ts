import { SlackAPIError } from './client'

/**
 * Shared utility to resolve a channel name to a channel ID
 * This supports both active and archived channels
 */
export async function resolveChannelNameToId(
  client: any, // WebClient
  channelIdentifier: string,
  options: {
    includePrivate?: boolean,
    includeArchived?: boolean,
    types?: string
  } = {}
): Promise<string> {
  const { 
    includePrivate = true, 
    includeArchived = false,
    types = includePrivate ? 'public_channel,private_channel' : 'public_channel'
  } = options;

  // If it's already a valid channel ID, return it directly
  if (channelIdentifier.match(/^C[A-Z0-9]{8,}$/)) {
    return channelIdentifier;
  }
  
  // If it's already a valid DM ID, return it directly
  if (channelIdentifier.match(/^D[A-Z0-9]{8,}$/)) {
    return channelIdentifier;
  }
  
  // Strip # if present
  let channelName = channelIdentifier;
  if (channelName.startsWith('#')) {
    channelName = channelName.substring(1);
  }
  
  // Find channel by name
  const listResult = await client.conversations.list({
    types,
    exclude_archived: !includeArchived,
    limit: 1000
  });
  
  if (listResult.ok && listResult.channels) {
    const channel = listResult.channels.find(
      (c: any) => c.name === channelName || c.name === channelName.toLowerCase()
    );
    
    if (channel && channel.id) {
      console.log(`🔍 Resolved channel name "${channelName}" to ID "${channel.id}"`);
      return channel.id;
    } else {
      throw new SlackAPIError(`Could not find channel with name: ${channelName}`, 'CHANNEL_NOT_FOUND');
    }
  } else {
    throw new SlackAPIError(`Failed to list channels: ${listResult.error}`, 'API_ERROR');
  }
}

/**
 * Shared utility to resolve a username or display name to a user ID
 */
export async function resolveUsernameToId(
  client: any,
  userIdentifier: string
): Promise<string> {
  // If it's already a valid user ID, return it directly
  if (userIdentifier.match(/^U[A-Z0-9]{8,}$/)) {
    return userIdentifier;
  }
  
  // Strip @ if present
  let username = userIdentifier;
  if (username.startsWith('@')) {
    username = username.substring(1);
  }
  
  // Search for user by name or display name
  const listResult = await client.users.list({
    limit: 1000
  });
  
  if (listResult.ok && listResult.members) {
    const foundUser = listResult.members.find((member: any) => 
      member.name === username || 
      member.name === username.toLowerCase() ||
      member.real_name === username ||
      member.profile?.display_name === username ||
      member.profile?.display_name_normalized === username
    );
    
    if (foundUser && foundUser.id) {
      console.log(`🔍 Resolved username "${username}" to user ID "${foundUser.id}"`);
      return foundUser.id;
    } else {
      throw new SlackAPIError(`Could not find user with username: ${username}`, 'USER_NOT_FOUND');
    }
  } else {
    throw new SlackAPIError(`Failed to list users: ${listResult.error}`, 'API_ERROR');
  }
}

/**
 * Resolve conversation identifier which could be:
 * - Channel ID (C1234567890)
 * - DM ID (D1234567890) 
 * - Channel name (#general or general)
 * - User ID for DM (U1234567890)
 * - Username for DM (@john.doe or john.doe)
 */
export async function resolveConversationId(
  client: any,
  conversationIdentifier: string,
  options: {
    includePrivate?: boolean,
    includeArchived?: boolean,
    allowDMs?: boolean
  } = {}
): Promise<string> {
  const { includePrivate = true, includeArchived = false, allowDMs = true } = options;

  // If it's already a valid conversation ID (channel or DM), return it directly
  if (conversationIdentifier.match(/^[CD][A-Z0-9]{8,}$/)) {
    return conversationIdentifier;
  }

  // If it looks like a user ID and DMs are allowed, try to open/find DM
  if (conversationIdentifier.match(/^U[A-Z0-9]{8,}$/) && allowDMs) {
    try {
      const dmResult = await client.conversations.open({
        users: conversationIdentifier
      });
      
      if (dmResult.ok && dmResult.channel?.id) {
        console.log(`🔍 Opened DM with user ${conversationIdentifier}, conversation ID: ${dmResult.channel.id}`);
        return dmResult.channel.id;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to open DM with user ${conversationIdentifier}:`, error);
    }
  }

  // If it starts with @ or looks like a username and DMs are allowed, resolve to user ID first
  if (allowDMs && (conversationIdentifier.startsWith('@') || conversationIdentifier.match(/^[a-zA-Z0-9._-]+$/))) {
    try {
      const userId = await resolveUsernameToId(client, conversationIdentifier);
      const dmResult = await client.conversations.open({
        users: userId
      });
      
      if (dmResult.ok && dmResult.channel?.id) {
        console.log(`🔍 Opened DM with username ${conversationIdentifier} (${userId}), conversation ID: ${dmResult.channel.id}`);
        return dmResult.channel.id;
      }
    } catch (error) {
      console.warn(`⚠️ Failed to resolve username ${conversationIdentifier} to DM:`, error);
      // Fall through to try channel resolution
    }
  }

  // Try channel resolution
  try {
    return await resolveChannelNameToId(client, conversationIdentifier, {
      includePrivate,
      includeArchived
    });
  } catch (error) {
    // If we couldn't find a channel and DMs weren't allowed, give a more specific error
    if (!allowDMs && conversationIdentifier.match(/^[@a-zA-Z0-9._-]+$/)) {
      throw new SlackAPIError(
        `Could not find channel "${conversationIdentifier}". If you meant to open a DM, this function doesn't support DMs.`,
        'CHANNEL_NOT_FOUND'
      );
    }
    throw error;
  }
} 