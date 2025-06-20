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