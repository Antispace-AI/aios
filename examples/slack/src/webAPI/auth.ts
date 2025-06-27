/**
 * Slack Authentication Module - Phase 1 Implementation
 * Implements: AUTH-001, AUTH-002, AUTH-003
 */

import { WebClient } from '@slack/web-api'
import type { User } from '../util'
import type { 
  OAuthResponse, 
  AuthStatusResponse, 
  SlackAPIResponse,
  SlackConfig 
} from './types'

// Configuration - should be moved to environment variables
const SLACK_CONFIG: SlackConfig = {
  clientId: process.env.SLACK_CLIENT_ID || '',
  clientSecret: process.env.SLACK_CLIENT_SECRET || '',
  appToken: process.env.SLACK_APP_TOKEN || '',
  signingSecret: process.env.SLACK_SIGNING_SECRET || '',
  redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/auth/slack/callback',
  scopes: [
    'channels:read',
    'channels:history',
    'groups:read',
    'groups:history',
    'im:read',
    'im:history',
    'mpim:read',
    'mpim:history',
    'chat:write',
    'users:read',
    'users.profile:read',
    'files:read'
  ]
}

class SlackAuthError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly retryable: boolean = false
  ) {
    super(message)
    this.name = 'SlackAuthError'
  }
}

/**
 * AUTH-001: Generate OAuth URL for Slack authentication
 */
export async function getOAuthURL(
  redirectUri?: string, 
  scopes?: string[]
): Promise<OAuthResponse> {
  try {
    if (!SLACK_CONFIG.clientId) {
      throw new SlackAuthError('Slack client ID not configured', 'MISSING_CLIENT_ID')
    }

    const finalRedirectUri = redirectUri || SLACK_CONFIG.redirectUri
    const finalScopes = scopes || SLACK_CONFIG.scopes
    
    // Generate state parameter for security (optional but recommended)
    const state = Math.random().toString(36).substring(2, 15)
    
    const oauthURL = new URL('https://slack.com/oauth/v2/authorize')
    oauthURL.searchParams.set('client_id', SLACK_CONFIG.clientId)
    oauthURL.searchParams.set('scope', finalScopes.join(','))
    oauthURL.searchParams.set('redirect_uri', finalRedirectUri)
    oauthURL.searchParams.set('state', state)
    oauthURL.searchParams.set('user_scope', 'users:read,users.profile:read,users.profile:write')

    console.log('🔑 Generated OAuth URL:', {
      clientId: SLACK_CONFIG.clientId,
      scopes: finalScopes,
      redirectUri: finalRedirectUri,
      state
    })

    return {
      success: true,
      oauthURL: oauthURL.toString()
    }

  } catch (error) {
    console.error('❌ Failed to generate OAuth URL:', error)
    
    if (error instanceof SlackAuthError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Failed to generate OAuth URL: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * AUTH-002: Handle OAuth callback from Slack
 */
export async function handleOAuthCallback(
  code: string,
  redirectUri?: string
): Promise<OAuthResponse> {
  try {
    if (!SLACK_CONFIG.clientId || !SLACK_CONFIG.clientSecret) {
      throw new SlackAuthError('Slack client credentials not configured', 'MISSING_CREDENTIALS')
    }

    if (!code) {
      throw new SlackAuthError('Authorization code is required', 'MISSING_CODE')
    }

    const finalRedirectUri = redirectUri || SLACK_CONFIG.redirectUri

    console.log('🔄 Processing OAuth callback:', {
      codeLength: code.length,
      redirectUri: finalRedirectUri
    })

    // Exchange code for access token using Slack Web API
    const client = new WebClient()
    
    const result = await client.oauth.v2.access({
      client_id: SLACK_CONFIG.clientId,
      client_secret: SLACK_CONFIG.clientSecret,
      code,
      redirect_uri: finalRedirectUri
    })

    if (!result.ok) {
      throw new SlackAuthError(`OAuth exchange failed: ${result.error}`, 'OAUTH_FAILED')
    }

    const accessToken = result.access_token
    const userId = result.authed_user?.id
    const teamId = result.team?.id

    if (!accessToken || !userId) {
      throw new SlackAuthError('Invalid OAuth response: missing token or user ID', 'INVALID_RESPONSE')
    }

    console.log('✅ OAuth callback successful:', {
      userId,
      teamId,
      scope: result.scope,
      tokenType: result.token_type
    })

    // TODO: Store the tokens securely in your database
    // This is where you would save the user's Slack tokens
    // await storeUserTokens(userId, {
    //   accessToken,
    //   teamId,
    //   scope: result.scope
    // })

    return {
      success: true,
      userId
    }

  } catch (error) {
    console.error('❌ OAuth callback failed:', error)
    
    if (error instanceof SlackAuthError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `OAuth callback failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * AUTH-003: Check authentication status for a user
 */
export async function checkAuthenticationStatus(userId: string): Promise<AuthStatusResponse> {
  try {
    if (!userId) {
      throw new SlackAuthError('User ID is required', 'MISSING_USER_ID')
    }

    // TODO: Retrieve user's access token from your database
    // const userTokens = await getUserTokens(userId)
    // For now, we'll use the User object structure from the existing code
    
    // This is a placeholder - you'll need to implement actual token retrieval
    // For now, check if the user has the accessToken property (from existing code)
    const user = { id: userId } as User
    
    if (!user.accessToken) {
      return {
        success: true,
        isAuthenticated: false
      }
    }

    // Verify token is still valid by making a simple API call
    const client = new WebClient(user.accessToken)
    
    try {
      const authTest = await client.auth.test()
      
      if (!authTest.ok) {
        console.warn('🔒 Token validation failed:', authTest.error)
        return {
          success: true,
          isAuthenticated: false,
          error: 'Invalid or expired token'
        }
      }

      console.log('✅ User authentication verified:', {
        userId,
        slackUserId: authTest.user_id,
        teamId: authTest.team_id
      })

      return {
        success: true,
        isAuthenticated: true,
        slackUserId: authTest.user_id
      }

    } catch (apiError) {
      console.warn('🔒 Token validation API error:', apiError)
      return {
        success: true,
        isAuthenticated: false,
        error: 'Token validation failed'
      }
    }

  } catch (error) {
    console.error('❌ Authentication status check failed:', error)
    
    if (error instanceof SlackAuthError) {
      return {
        success: false,
        isAuthenticated: false,
        error: error.message
      }
    }

    return {
      success: false,
      isAuthenticated: false,
      error: `Authentication check failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * AUTH-004: Revoke authentication - Phase 2A Implementation
 */
export async function revokeAuthentication(userId: string): Promise<SlackAPIResponse> {
  try {
    if (!userId) {
      throw new SlackAuthError('User ID is required', 'MISSING_USER_ID')
    }

    console.log('🚫 Revoking authentication for user:', userId)

    // TODO: Retrieve user's access token from your database
    // const userTokens = await getUserTokens(userId)
    // For now, we'll use the User object structure from the existing code
    const user = { id: userId } as User
    
    if (!user.accessToken) {
      console.log('ℹ️ User not authenticated, nothing to revoke')
      return {
        success: true
      }
    }

    // Revoke token with Slack API
    const client = new WebClient(user.accessToken)
    
    try {
      const revokeResult = await client.auth.revoke()
      
      if (!revokeResult.ok) {
        console.warn('⚠️ Slack token revocation failed:', revokeResult.error)
        // Continue with cleanup even if Slack revocation failed
      } else {
        console.log('✅ Slack token revoked successfully')
      }

    } catch (apiError) {
      console.warn('⚠️ Slack API error during revocation:', apiError)
      // Continue with cleanup even if API call failed
    }

    // TODO: Remove tokens from database
    // await removeUserTokens(userId)
    
    // TODO: Clear any cached data
    // await clearUserSlackCache(userId)
    
    console.log('✅ Authentication revocation completed for user:', userId)

    return {
      success: true
    }

  } catch (error) {
    console.error('❌ Token revocation failed:', error)
    
    if (error instanceof SlackAuthError) {
      return {
        success: false,
        error: error.message
      }
    }

    return {
      success: false,
      error: `Token revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Utility function to validate user authentication for other modules
 */
export function validateUserAuth(user: User): void {
  if (!user.accessToken) {
    throw new SlackAuthError('User is not authenticated with Slack', 'NO_AUTH')
  }
  
  if (!user.accessToken.startsWith('xox')) {
    throw new SlackAuthError('Invalid access token format', 'INVALID_TOKEN')
  }
} 