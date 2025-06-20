import { components as Anti } from "@antispace/sdk"
import type { SyncStatus } from "../services/liveWidgetService"

/**
 * Generate loading state for initial sync
 */
export function generateLoadingState(syncStatus: SyncStatus, timestamp: string) {
  return (
    <Anti.Column align="center" justify="center">
      <Anti.Text type="heading2">🔗 Slack</Anti.Text>
      <Anti.Text type="caption" align="center">
        Syncing your workspace...
      </Anti.Text>
      {syncStatus.progress > 0 && (
        <Anti.Text type="small" align="center">
          {syncStatus.progress}% complete
        </Anti.Text>
      )}
      <Anti.Text type="caption" align="center">
        This widget will update automatically when sync completes
      </Anti.Text>
      <Anti.Text type="caption" align="center">
        Updated {timestamp}
      </Anti.Text>
    </Anti.Column>
  )
}

/**
 * Generate error state with automatic retry messaging
 */
export function generateErrorState(
  error: string, 
  timestamp: string, 
  retryMessage: string = "Will retry automatically"
) {
  return (
    <Anti.Column align="center" justify="center">
      <Anti.Text type="heading3">🔗 Slack</Anti.Text>
      <Anti.Text type="caption" align="center">
        ⚠️ {error}
      </Anti.Text>
      <Anti.Text type="small" align="center">
        {retryMessage}
      </Anti.Text>
      <Anti.Text type="caption" align="center">
        Updated {timestamp}
      </Anti.Text>
    </Anti.Column>
  )
}

/**
 * Generate empty state when no conversations are found
 */
export function generateEmptyState(syncStatus: SyncStatus, timestamp: string) {
  return (
    <Anti.Column align="center" justify="center">
      <Anti.Text type="heading2">🔗 Slack</Anti.Text>
      <Anti.Text type="caption" align="center">
        No conversations found
      </Anti.Text>
      {syncStatus.isLive ? (
        <Anti.Text type="small" align="center">
          You're all caught up! New messages will appear automatically.
        </Anti.Text>
      ) : (
        <Anti.Text type="small" align="center">
          Checking for new messages...
        </Anti.Text>
      )}
      <Anti.Text type="caption" align="center">
        Updated {timestamp}
      </Anti.Text>
    </Anti.Column>
  )
} 