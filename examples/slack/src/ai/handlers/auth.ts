import { updateUserTokens } from "../../util"
import type { User } from "../../util"
import { BASE_URL, IS_PRODUCTION } from "../../config/simple"

/**
 * Authentication action handlers
 */

export async function handleAuthenticationActions(
  name: string,
  parsedParams: any,
  user: User,
  userId: string
): Promise<any> {
  
  switch (name) {
    case "getAuthUrl": {
      // Instead of generating OAuth URL directly, redirect through our initiation endpoint
      // This ensures the userId cookie gets set properly
      const authInitUrl = `${BASE_URL}/authenticate-slack?userId=${encodeURIComponent(userId)}`

      return {
        success: true,
        auth_url: authInitUrl,
        instructions: [
          "1. Click or copy the URL above and open it in your browser",
          "2. You'll be automatically redirected to Slack for authorization",
          "3. Select your Slack workspace and click 'Allow'", 
          "4. You'll be redirected back automatically",
          "5. Use 'checkAuthStatus' to verify authentication worked"
        ],
        note: IS_PRODUCTION ? "🔒 Using HTTPS for production" : "🔧 Using HTTP for development",
        technical_note: "This URL will set necessary cookies and then redirect you to Slack"
      }
    }

    case "checkAuthStatus": {
      if (!user.accessToken) {
        return {
          authenticated: false,
          message: "Not authenticated with Slack",
          next_step: "Use 'getAuthUrl' to get authentication URL, or 'manualAuth' with a bot token"
        }
      }

      return {
        authenticated: true,
        message: "Successfully authenticated with Slack!",
        team_name: user.teamName || "Unknown",
        team_id: user.teamId || "Unknown", 
        user_name: user.slackUserName || "Unknown",
        slack_user_id: user.slackUserId || "Unknown",
        token_preview: user.accessToken ? `${user.accessToken.substring(0, 12)}...` : "No token",
        next_steps: [
          "You can now use Slack functions like:",
          "• listConversations - List your channels and DMs",
          "• sendMessage - Send messages to channels",
          "• getMessages - Read message history"
        ]
      }
    }

    case "manualAuth": {
      const { accessToken, teamName } = parsedParams as any
      
      if (!accessToken.startsWith("xoxp-") && !accessToken.startsWith("xoxb-")) {
        return {
          error: "Invalid token format", 
          message: "Slack tokens should start with 'xoxp-' (user token) or 'xoxb-' (bot token)",
          help: "Get your token from: Slack App Settings → OAuth & Permissions → User OAuth Token or Bot User OAuth Token"
        }
      }

      try {
        // Test the token by making a simple API call
        const testClient = new (await import("@slack/web-api")).WebClient(accessToken)
        const authTest = await testClient.auth.test()
        
        if (!authTest.ok) {
          throw new Error(`Invalid token: ${authTest.error}`)
        }

        // Update user with token info
        await updateUserTokens(
          userId,
          accessToken,
          undefined, // no refresh token for manual auth
          authTest.team_id,
          teamName || authTest.team,
          authTest.user_id,
          authTest.user
        )

        const tokenType = accessToken.startsWith("xoxp-") ? "User Token" : "Bot Token"

        return {
          success: true,
          message: "Manual authentication successful!",
          token_type: tokenType,
          team: authTest.team,
          user: authTest.user,
          team_id: authTest.team_id,
          user_id: authTest.user_id,
          note: tokenType === "User Token" ? "Messages will be sent as your user account" : "Messages will be sent as bot",
          next_steps: [
            "Authentication complete! You can now use:",
            "• listConversations",
            "• sendMessage", 
            "• getMessages",
            "• And other Slack functions"
          ]
        }
      } catch (error: any) {
        return {
          error: "Authentication failed",
          message: error.message,
          help: "Verify your token is correct and has the required scopes"
        }
      }
    }

    default: {
      return { 
        error: `Unknown authentication function: ${name}` 
      }
    }
  }
} 