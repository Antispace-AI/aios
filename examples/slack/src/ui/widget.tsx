import { components as Anti, type AntispaceContext } from "@antispace/sdk"
import type { SlackUIActions } from "../../types"
import { isUserAuthenticated, getUser, clearUserTokens } from "../util"
import { BASE_URL } from "../config/simple"

// Import live widget services
import { fetchLiveWidgetData, checkSyncStatus, handleQuickAction } from "./services/liveWidgetService"
import { generateLiveConversationList, generateLiveHeader, generateLiveFooter } from "./components/LiveConversationList.js"
import { generateLoadingState, generateErrorState, generateEmptyState } from "./components/LiveStates.js"

/**
 * Live Widget UI with Automatic Refresh Support
 * 
 * This widget is optimized for Antispace's automatic refresh capability:
 * - Fresh data fetched on every automatic refresh
 * - No client-side state management needed
 * - Server-side JSX generation for optimal performance
 * - Real-time coordination with Phase 2 infrastructure
 */
export default async function liveWidgetUI(anti: AntispaceContext<SlackUIActions>) {
  const { action, values, meta } = anti
  const userId = meta.user.id
  const timestamp = new Date().toLocaleTimeString()

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
            action="checkAuthStatus" 
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
            action="checkAuthStatus" 
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

  try {
    // Handle user quick actions first (if any)
    if (action && values && action !== "checkAuthStatus") {
      await handleQuickAction(action, values, userId)
    }

    // Check authentication status
    const isAuthenticated = await isUserAuthenticated(userId)
    
    if (!isAuthenticated) {
      return generateLoginPrompt(userId)
    }

    // Fetch live data optimized for automatic refresh
    const [widgetData, syncStatus] = await Promise.all([
      fetchLiveWidgetData(userId),
      checkSyncStatus(userId)
    ])

    // Handle different live states
    if (syncStatus.isFirstSync && syncStatus.progress < 100) {
      return generateLoadingState(syncStatus, timestamp)
    }

    if (widgetData.error) {
      return generateErrorState(widgetData.error, timestamp)
    }

    if (widgetData.conversations.length === 0 && !syncStatus.isFirstSync) {
      return generateEmptyState(syncStatus, timestamp)
    }

    // Generate main live conversation list
    return generateLiveConversationList(widgetData, syncStatus, timestamp)

  } catch (error) {
    console.error('Live widget error:', error)
    return generateErrorState(
      error instanceof Error ? error.message : 'Unknown error',
      timestamp,
      'Widget will retry automatically on next refresh'
    )
  }
}

/**
 * Generate login prompt for unauthenticated users
 */
function generateLoginPrompt(userId: string) {
  return (
    <Anti.Column align="center" justify="center">
      <Anti.Text type="heading2">🔗 Slack</Anti.Text>
      <Anti.Text type="dim" align="center">
        Connect your Slack workspace for live updates
      </Anti.Text>
      <Anti.Button 
        action={`antispace:open_external_url:${BASE_URL}/authenticate-slack?userId=${userId}`}
        text="Connect Slack Account"
      />
      <Anti.Text type="caption" align="center">
        Once connected, this widget will show live notifications automatically
      </Anti.Text>
    </Anti.Column>
  )
}

/**
 * Handle logout action
 */
export async function handleLogout(userId: string) {
  const success = await clearUserTokens(userId)
  
  return (
    <Anti.Column align="center" justify="center">
      <Anti.Text type="heading3">
        {success ? "🔐 Disconnected Successfully" : "❌ Logout Failed"}
      </Anti.Text>
      <Anti.Text type="dim" align="center">
        {success 
          ? "Slack account disconnected. Widget will update automatically."
          : "Error disconnecting account. Will retry automatically."
        }
      </Anti.Text>
    </Anti.Column>
  )
} 