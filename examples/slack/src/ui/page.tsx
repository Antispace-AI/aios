import { components as Anti, type AntispaceContext } from "@antispace/sdk"
import type { SlackUIActions } from "../../types"
import { isUserAuthenticated, getUser, clearUserTokens } from "../util"

/**
 * Main page UI component that handles Slack authentication and displays detailed information
 * @param anti - Antispace Context object containing request details
 * @returns JSX markup string response
 */
export default async function pageUI(anti: AntispaceContext<SlackUIActions>) {
  const { action, values, meta } = anti
  const userId = meta.user.id

  console.log({ action, values, meta })

  // Handle logout action directly
  if (action === "logoutSlack") {
    // Clear tokens immediately
    const success = await clearUserTokens(userId)
    
    return (
      <Anti.Column>
        <Anti.Text type="heading1">🔗 Slack Integration</Anti.Text>
        <Anti.Text align="center" type="heading2">
          {success ? "🔐 Disconnected Successfully" : "❌ Logout Failed"}
        </Anti.Text>
        <Anti.Text type="dim" align="center">
          {success 
            ? "Your Slack account has been disconnected. You can now connect a different account or refresh to see the login interface."
            : "There was an error disconnecting your account. Please try again or use the manual logout URL if needed."
          }
        </Anti.Text>
        {success && (
          <Anti.Column>
            <Anti.Text type="caption" align="center">
              ✅ All authentication tokens have been cleared from our database.
            </Anti.Text>
            <Anti.Text type="caption" align="center">
              🔄 Refresh this page to see the updated interface.
            </Anti.Text>
          </Anti.Column>
        )}
      </Anti.Column>
    )
  }

  // Check authentication status
  const isAuthenticated = await isUserAuthenticated(userId)
  
  if (!isAuthenticated) {
    // Show login interface with automatic redirect
    return (
      <Anti.Column>
        <Anti.Text type="heading1">🔗 Slack Integration</Anti.Text>
        <Anti.Text type="subheading">Connect Your Slack Workspace</Anti.Text>
        <Anti.Text type="dim">
          Connect your Slack account to send messages, read conversations, and interact with your workspace through AI commands.
        </Anti.Text>
        
        <Anti.Text type="heading3">Features:</Anti.Text>
        <Anti.Column>
          <Anti.Text type="caption">• Send messages to channels and direct messages</Anti.Text>
          <Anti.Text type="caption">• Read recent messages from any accessible channel</Anti.Text>
          <Anti.Text type="caption">• Search for messages across your workspace</Anti.Text>
          <Anti.Text type="caption">• Get information about users and channels</Anti.Text>
          <Anti.Text type="caption">• View your conversations and workspace details</Anti.Text>
        </Anti.Column>
        
        <Anti.Button 
          action={`antispace:open_external_url:http://localhost:6100/authenticate-slack?userId=${userId}`}
          text="Connect Slack Account"
        />
        
        <Anti.Button 
          action="check_auth_status" 
          text="Refresh Status"
          size="small"
        />
      </Anti.Column>
    )
  }

  // User is authenticated - show detailed interface
  const user = await getUser(userId)
  
  return (
    <Anti.Column>
      <Anti.Text type="heading1">🔗 Slack Integration</Anti.Text>
      
      <Anti.Row justify="space-between" align="center">
        <Anti.Text type="heading2">Account Status: Connected ✅</Anti.Text>
        <Anti.Button 
          action="logoutSlack" 
          text="Disconnect Account"
          size="small"
        />
      </Anti.Row>

      {user.teamName && (
        <Anti.Row>
          <Anti.Text type="subheading">Workspace: </Anti.Text>
          <Anti.Text>{user.teamName}</Anti.Text>
        </Anti.Row>
      )}
      
      {user.userName && (
        <Anti.Row>
          <Anti.Text type="subheading">Logged in as: </Anti.Text>
          <Anti.Text>{user.userName}</Anti.Text>
        </Anti.Row>
      )}

      <Anti.Text type="heading3">Available AI Commands:</Anti.Text>
      <Anti.Column>
        <Anti.Text type="caption">💬 <strong>Send Messages:</strong></Anti.Text>
        <Anti.Text type="caption">   "Send a message to #general saying hello"</Anti.Text>
        <Anti.Text type="caption">   "Tell @john about the meeting"</Anti.Text>
        
        <Anti.Text type="caption">📖 <strong>Read Messages:</strong></Anti.Text>
        <Anti.Text type="caption">   "Show me recent messages from #random"</Anti.Text>
        <Anti.Text type="caption">   "What are the latest messages in #project"</Anti.Text>
        
        <Anti.Text type="caption">🔍 <strong>Search & Info:</strong></Anti.Text>
        <Anti.Text type="caption">   "Search for messages about deadline"</Anti.Text>
        <Anti.Text type="caption">   "Get my Slack conversations"</Anti.Text>
        <Anti.Text type="caption">   "Show user info for @alice"</Anti.Text>
      </Anti.Column>

      <Anti.Button 
        action="check_auth_status" 
        text="Refresh Status"
        size="small"
      />
    </Anti.Column>
  )
}
