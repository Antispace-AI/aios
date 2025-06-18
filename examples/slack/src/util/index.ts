// Import PostgreSQL storage directly instead of using adapter
import { createStorageContainer } from '../storage'
import { SlackDataStore } from '../cache/interfaces/slack-data-store'
import type { User } from '../cache/schema/types/database'

// Re-export User type for backward compatibility
export type { User }

// Create storage instance
const { dataStore } = createStorageContainer()

/**
 * Get or create a user by their Antispace user ID
 */
export const getUser = async (userID: string): Promise<any> => {
  // First, try to get existing user
  const existingUser = await dataStore.getUser(userID)

  if (existingUser) {
    return existingUser
  }

  // User doesn't exist, create a new one
  console.log(`Creating new user record for ${userID}`)
  return await dataStore.createUser({ antiId: userID })
}

/**
 * Check if a user is authenticated with Slack
 */
export const isUserAuthenticated = async (userID: string): Promise<boolean> => {
  try {
    const user = await dataStore.getUser(userID)
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
    const user = await dataStore.getUser(userID)
    if (!user) {
      return false // User doesn't exist
    }

    // Clear auth-related fields
    await dataStore.updateUser(userID, {
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
    return await dataStore.updateUser(userID, {
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
      await dataStore.createUser({ antiId: userID })
      return await dataStore.updateUser(userID, {
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