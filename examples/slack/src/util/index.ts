// Import PostgreSQL storage directly instead of using adapter
import { createStorageContainer } from '../storage'
import { SlackDataStore } from '../storage/interfaces/slack-data-store'
import type { User } from '../storage/schema/types/database'

// Re-export User type for backward compatibility
export type { User }

// Lazy-load storage instance to avoid circular dependencies
let dataStore: SlackDataStore | null = null

function getDataStore(): SlackDataStore {
  if (!dataStore) {
    const { dataStore: ds } = createStorageContainer()
    dataStore = ds
  }
  return dataStore
}

/**
 * Get or create a user by their Antispace user ID
 * Also touches user activity for session management
 */
export const getUser = async (userID: string): Promise<any> => {
  const store = getDataStore()
  
  // First, try to get existing user
  const existingUser = await store.getUser(userID)

  if (existingUser) {
    // Touch user activity for session management (Week 4)
    try {
      await store.touchUserActivity(userID)
    } catch (error) {
      console.warn(`Failed to touch activity for user ${userID}:`, error)
    }
    return existingUser
  }

  // User doesn't exist, create a new one
  console.log(`Creating new user record for ${userID}`)
  return await store.createUser({ antiId: userID })
}

/**
 * Check if a user is authenticated with Slack
 */
export const isUserAuthenticated = async (userID: string): Promise<boolean> => {
  try {
    const store = getDataStore()
    const user = await store.getUser(userID)
    return !!(user && user.accessToken && user.accessToken.trim().length > 0)
  } catch (error) {
    console.error(`Error checking authentication for user ${userID}:`, error)
    return false
  }
}

/**
 * Clear user's Slack authentication tokens (logout)
 */
export const clearUserTokens = async (userID: string): Promise<boolean> => {
  try {
    const store = getDataStore()
    const user = await store.getUser(userID)
    if (!user) {
      return false // User doesn't exist
    }

    // Clear auth-related fields
    await store.updateUser(userID, {
      accessToken: undefined,
      refreshToken: undefined,
      teamId: undefined,
      teamName: undefined,
      slackUserId: undefined,
      slackUserName: undefined,
    })

    console.log(`Successfully cleared tokens for user ${userID}`)
    return true
  } catch (error) {
    console.error(`Error clearing tokens for user ${userID}:`, error)
    return false
  }
}

/**
 * Update user's Slack authentication tokens
 */
export const updateUserTokens = async (
  userID: string, 
  accessToken: string, 
  refreshToken?: string,
  teamId?: string,
  teamName?: string,
  slackUserId?: string,
  slackUserName?: string
): Promise<any> => {
  try {
    const store = getDataStore()
    return await store.updateUser(userID, {
      accessToken,
      refreshToken,
      teamId,
      teamName,
      slackUserId,
      slackUserName,
    })
  } catch (error) {
    // If user doesn't exist, create them first
    if (error instanceof Error && error.message.includes("not found")) {
      console.log(`User ${userID} not found, creating new user`)
      const store = getDataStore()
      await store.createUser({ antiId: userID })
      return await store.updateUser(userID, {
        accessToken,
        refreshToken,
        teamId,
        teamName,
        slackUserId,
        slackUserName,
      })
    }
    throw error
  }
} 