import { components as Anti, type AntispaceContext } from "@antispace/sdk"
import type { SlackUIActions } from "../../types"
import { isUserAuthenticated, getUser, clearUserTokens } from "../util"
import { BASE_URL } from "../config/simple"
import React from "react"

/**
 * Safely format result objects for display
 * Now shows both summary and detailed view in a more user-friendly format
 */
function safeStringifyResult(result: any): { summary: string; details: string } {
  try {
    if (!result) {
      return { summary: "No result returned", details: "null" }
    }
    
    if (typeof result === 'string') {
      const isTruncated = result.length > 150
      return {
        summary: isTruncated ? result.substring(0, 150) + "..." : result,
        details: result
      }
    }
    
    if (typeof result === 'object') {
      let summary = ""
      let details = ""
      
      try {
        details = JSON.stringify(result, (key, value) => {
          if (typeof value === 'function') return '[Function]'
          if (value instanceof Date) return value.toISOString()
          return value
        }, 2)
      } catch (e) {
        details = "Could not serialize object safely"
      }
      
      // Create meaningful summaries
      if (result.conversations && Array.isArray(result.conversations)) {
        summary = `Found ${result.conversations.length} conversations`
        if (result.conversations.length > 0) {
          const channels = result.conversations.filter(c => c.type === 'channel' && c.is_member).length
          const dms = result.conversations.filter(c => c.type === 'im').length
          summary += `\n${channels} channels (member), ${dms} direct messages`
          
          // Show first few channel names
          const memberChannels = result.conversations
            .filter(c => c.type === 'channel' && c.is_member)
            .slice(0, 3)
            .map(c => c.name)
          if (memberChannels.length > 0) {
            summary += `\nChannels: ${memberChannels.join(', ')}${channels > 3 ? '...' : ''}`
          }
        }
      } else if (result.messages && Array.isArray(result.messages)) {
        summary = `Found ${result.messages.length} messages`
        if (result.messages.length > 0) {
          const first = result.messages[0]
          const preview = first.text?.substring(0, 80) || first.user || 'No preview'
          summary += `\nLatest: ${preview}...`
        }
      } else if (result.matches && Array.isArray(result.matches)) {
        summary = `Search found ${result.matches.length} matches`
        if (result.matches.length > 0) {
          summary += `\nFirst match: ${result.matches[0].text?.substring(0, 50) || 'No preview'}...`
        }
      } else if (result.ok === true || result.success === true) {
        summary = "✅ Operation completed successfully"
        if (result.message) {
          summary += `\n${result.message}`
        }
      } else {
        const keys = Object.keys(result)
        summary = `Object with ${keys.length} properties`
        if (keys.length <= 5) {
          summary += `\nKeys: ${keys.join(', ')}`
        }
      }
      
      return { summary, details }
    }
    
    const str = String(result)
    return { summary: str, details: str }
  } catch (error) {
    return { 
      summary: "Result could not be displayed safely", 
      details: "Error displaying result" 
    }
  }
}

/**
 * Create result display component with toggle for full/brief view
 */
function ResultDisplay({ result, isError = false }: { result: any, isError?: boolean }) {
  const [showFull, setShowFull] = React.useState(false)
  
  if (isError) {
    return (
      <Anti.Column>
        <Anti.Text type="caption" align="center">❌ Error: {result.error}</Anti.Text>
        {result.suggestion && (
          <Anti.Text type="caption" align="center">💡 {result.suggestion}</Anti.Text>
        )}
        {result.details && (
          <Anti.Text type="caption" align="center">Details: {result.details}</Anti.Text>
        )}
      </Anti.Column>
    )
  }
  
  return (
    <Anti.Column>
              <Anti.Text type="caption" align="center">✅ Success</Anti.Text>
        <Anti.Text type="caption" align="center">
          {safeStringifyResult(result).details}
        </Anti.Text>
    </Anti.Column>
  )
}

/**
 * Main widget UI component that handles Slack authentication and basic functionality
 * @param anti - Antispace Context object containing request details
 * @returns JSX markup string response
 */
export default async function widgetUI(anti: AntispaceContext<SlackUIActions>) {
  const { action, values, meta } = anti
  const userId = meta.user.id

  // Handle developer mode actions
  if (action === "executeNaturalLanguage") {
    try {
      const command = values?.naturalLanguageCommand as string
      if (!command?.trim()) {
        return (
          <Anti.Column align="center" justify="center">
            <Anti.Text align="center" type="heading3">❌ Error</Anti.Text>
            <Anti.Text type="dim" align="center">No command provided</Anti.Text>
            <Anti.Button 
              action="toggleDeveloperMode" 
              text="Back to Developer Mode"
              size="small"
            />
          </Anti.Column>
        )
      }

      // Get user and execute with bypass
      const user = await getUser(userId)
      const { executeNaturalLanguageBypass } = await import("../ai/handlers/slack.js")
      const result = await executeNaturalLanguageBypass(command, user)

      console.log("🔧 WIDGET DEBUG: Result received:", typeof result, result ? Object.keys(result).length : 'null')

      return (
        <Anti.Column>
          <Anti.Text align="center" type="heading3">✅ Command Executed</Anti.Text>
          <Anti.Text type="dim" align="center">Command: "{command}"</Anti.Text>
          
          {result?.error ? (
            <Anti.Column>
              <Anti.Text type="caption" align="center">❌ Error: {result.error}</Anti.Text>
              {result.suggestion && (
                <Anti.Text type="caption" align="center">💡 {result.suggestion}</Anti.Text>
              )}
            </Anti.Column>
          ) : (
            <Anti.Column>
              <Anti.Text type="caption" align="center">✅ Success</Anti.Text>
              <Anti.Text type="caption" align="center">
                {result ? safeStringifyResult(result).summary : "No result data"}
              </Anti.Text>
              <Anti.Text type="caption" align="center">
                ✅ Function executed successfully. Use console logs for full details.
              </Anti.Text>
            </Anti.Column>
          )}
          
          <Anti.Button 
            action="toggleDeveloperMode" 
            text="Back to Developer Mode"
            size="small"
          />
        </Anti.Column>
      )
    } catch (error: any) {
      return (
        <Anti.Column align="center" justify="center">
          <Anti.Text align="center" type="heading3">❌ Execution Failed</Anti.Text>
          <Anti.Text type="dim" align="center">{error?.message || "Unknown error occurred"}</Anti.Text>
          <Anti.Button 
            action="toggleDeveloperMode" 
            text="Back to Developer Mode"
            size="small"
          />
        </Anti.Column>
      )
    }
  }

  // Handle function selector
  if (action === "executeSlackFunction") {
    try {
      const selectedFunction = values?.functionName as string
      const functionParams = values?.functionParams as string || "{}"
      
      if (!selectedFunction?.trim()) {
        return (
          <Anti.Column align="center" justify="center">
            <Anti.Text align="center" type="heading3">❌ Error</Anti.Text>
            <Anti.Text type="dim" align="center">No function name provided</Anti.Text>
            <Anti.Button 
              action="toggleDeveloperMode" 
              text="Back to Developer Mode"
              size="small"
            />
          </Anti.Column>
        )
      }

      // Parse parameters
      let parsedParams
      try {
        parsedParams = JSON.parse(functionParams)
      } catch (e) {
        return (
          <Anti.Column align="center" justify="center">
            <Anti.Text align="center" type="heading3">❌ Invalid JSON</Anti.Text>
            <Anti.Text type="dim" align="center">Could not parse parameters: {functionParams}</Anti.Text>
            <Anti.Button 
              action="toggleDeveloperMode" 
              text="Back to Developer Mode"
              size="small"
            />
          </Anti.Column>
        )
      }

      // Get user and execute with bypass
      const user = await getUser(userId)
      const { executeSlackFunctionBypass } = await import("../ai/handlers/slack.js")
      const result = await executeSlackFunctionBypass(selectedFunction, parsedParams, user)

      console.log("🔧 WIDGET DEBUG: Direct function result:", typeof result, result ? Object.keys(result).length : 'null')

      return (
        <Anti.Column>
          <Anti.Text align="center" type="heading3">✅ Function Executed</Anti.Text>
          <Anti.Text type="dim" align="center">Function: {selectedFunction}</Anti.Text>
          <Anti.Text type="caption" align="center">Parameters: {functionParams}</Anti.Text>
          
          {result?.error ? (
            <Anti.Column>
              <Anti.Text type="caption" align="center">❌ Error: {result.error}</Anti.Text>
              {result.details && (
                <Anti.Text type="caption" align="center">Details: {result.details}</Anti.Text>
              )}
            </Anti.Column>
          ) : (
            <Anti.Column>
              <Anti.Text type="caption" align="center">✅ Success</Anti.Text>
              <Anti.Text type="caption" align="center">
                {result ? safeStringifyResult(result).summary : "No result data"}
              </Anti.Text>
              <Anti.Text type="caption" align="center">
                ✅ Function executed successfully. Use console logs for full details.
              </Anti.Text>
            </Anti.Column>
          )}
          
          <Anti.Button 
            action="toggleDeveloperMode" 
            text="Back to Developer Mode"
            size="small"
          />
        </Anti.Column>
      )
    } catch (error: any) {
      return (
        <Anti.Column align="center" justify="center">
          <Anti.Text align="center" type="heading3">❌ Execution Failed</Anti.Text>
          <Anti.Text type="dim" align="center">{error?.message || "Unknown error occurred"}</Anti.Text>
          <Anti.Button 
            action="toggleDeveloperMode" 
            text="Back to Developer Mode"
            size="small"
          />
        </Anti.Column>
      )
    }
  }

  // Handle developer mode toggle
  if (action === "toggleDeveloperMode") {
    const isAuthenticated = await isUserAuthenticated(userId)
    
    if (!isAuthenticated) {
      return (
        <Anti.Column align="center" justify="center">
          <Anti.Text align="center" type="heading3">🔐 Authentication Required</Anti.Text>
          <Anti.Text type="dim" align="center">
            You must be authenticated to use Developer Mode
          </Anti.Text>
          <Anti.Button 
            action="check_auth_status" 
            text="Back to Main"
            size="small"
          />
        </Anti.Column>
      )
    }

    return (
      <Anti.Column>
        <Anti.Row justify="space-between" align="center">
          <Anti.Text type="heading2">🚀 Developer Mode</Anti.Text>
          <Anti.Button 
            action="check_auth_status" 
            text="Exit Dev Mode"
            size="small"
          />
        </Anti.Row>

        <Anti.Text type="dim" align="center">
          Rate limiting bypassed - Direct function execution
        </Anti.Text>

        {/* Natural Language Interface */}
        <Anti.Column>
          <Anti.Text type="heading3">💬 Natural Language Commands</Anti.Text>
          <Anti.Textarea
            name="naturalLanguageCommand"
            placeholder="Enter a command like 'send a message to #general saying hello' or 'get recent messages from #random'"
          />
          <Anti.Button 
            action="executeNaturalLanguage" 
            text="Execute Command"
          />
        </Anti.Column>

        {/* Function Selector */}
        <Anti.Column>
          <Anti.Text type="heading3">🔧 Direct Function Calls</Anti.Text>
          <Anti.Text type="caption">Enter function name and parameters manually:</Anti.Text>
          
          <Anti.Textarea
            name="functionName"
            placeholder="Function name (e.g., sendMessage, getMessages, listConversations)"
          />
          
          <Anti.Textarea
            name="functionParams"
            placeholder="JSON parameters: {'channel': '#general', 'text': 'hello'}"
          />
          
          <Anti.Button 
            action="executeSlackFunction" 
            text="Execute Function"
          />
          
          <Anti.Text type="caption">Available functions: sendMessage, getMessages, listConversations, searchMessages, getUserProfile, getConversationDetails, getTotalUnreadSummary, getRecentUnreadMessages, markConversationAsRead, updateMessage, deleteMessage, createConversation, joinConversation, leaveConversation, getConversationMembers, listFiles, uploadFile, getMessagePermalink</Anti.Text>
        </Anti.Column>

        {/* Rate Limiting Status */}
        <Anti.Column>
          <Anti.Text type="caption" align="center">
            ⚠️ Rate limiting is currently DISABLED in development mode
          </Anti.Text>
          <Anti.Text type="caption" align="center">
            All functions will execute immediately without throttling
          </Anti.Text>
        </Anti.Column>
      </Anti.Column>
    )
  }

  // Handle logout action directly
  if (action === "logoutSlack") {
    // Clear tokens immediately
    const success = await clearUserTokens(userId)
    
    return (
      <Anti.Column align="center" justify="center">
        <Anti.Text align="center" type="heading3">
          {success ? "🔐 Disconnected Successfully" : "❌ Logout Failed"}
        </Anti.Text>
        <Anti.Text type="dim" align="center">
          {success 
            ? "Your Slack account has been disconnected. Refresh to see the updated status."
            : "There was an error disconnecting your account. Please try again."
          }
        </Anti.Text>
        {success && (
          <Anti.Text type="caption" align="center">
            You can now connect a different Slack account or use the disconnect URL if needed.
          </Anti.Text>
        )}
      </Anti.Column>
    )
  }

  // Check authentication status
  const isAuthenticated = await isUserAuthenticated(userId)
  
  if (!isAuthenticated) {
    // Show login interface with automatic redirect
    return (
      <Anti.Column align="center" justify="center">
        <Anti.Text align="center" type="heading2">
          🔗 Slack Integration
        </Anti.Text>
        <Anti.Text align="center" type="dim">
          Connect your Slack account to send messages and interact with your workspace.
        </Anti.Text>
        <Anti.Button 
          action={`antispace:open_external_url:${BASE_URL}/authenticate-slack?userId=${userId}`}
          text="Connect Slack Account"
        />
        <Anti.Text type="caption" align="center">
          Or use AI command: "get me the Slack auth URL"
        </Anti.Text>
        <Anti.Button 
          action="check_auth_status" 
          text="Refresh Status"
          size="small"
        />
      </Anti.Column>
    )
  }

  // User is authenticated - show the main interface
  const user = await getUser(userId)
  
  return (
    <Anti.Column>
      <Anti.Row justify="space-between" align="center">
        <Anti.Column>
          <Anti.Text type="heading2">🔗 Slack</Anti.Text>
          {user.teamName && (
            <Anti.Text type="caption">
              Connected to {user.teamName}
            </Anti.Text>
          )}
          {user.userName && (
            <Anti.Text type="caption">
              Logged in as {user.userName}
            </Anti.Text>
          )}
        </Anti.Column>
        <Anti.Row>
          <Anti.Button 
            action="toggleDeveloperMode" 
            text="Dev Mode"
            size="small"
          />
          <Anti.Button 
            action="logoutSlack" 
            text="Disconnect"
            size="small"
          />
        </Anti.Row>
      </Anti.Row>

      <Anti.Text align="center" type="dim">
        You can now use AI commands to interact with Slack:
      </Anti.Text>
      
      <Anti.Column>
        <Anti.Text type="caption">• "Send a message to #general"</Anti.Text>
        <Anti.Text type="caption">• "Show me recent messages from #random"</Anti.Text>
        <Anti.Text type="caption">• "Get my Slack conversations"</Anti.Text>
        <Anti.Text type="caption">• "Search for messages about project"</Anti.Text>
      </Anti.Column>

      <Anti.Text type="caption" align="center">
        💡 Use "Dev Mode" to bypass rate limiting and test functions directly
      </Anti.Text>

      <Anti.Button 
        action="check_auth_status" 
        text="Refresh Status"
        size="small"
      />
    </Anti.Column>
  )
}