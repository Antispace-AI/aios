import { components as Anti } from "@antispace/sdk"
import type { LiveWidgetData, SyncStatus } from "../services/liveWidgetService"

/**
 * Generate live conversation list with automatic refresh optimization
 */
export function generateLiveConversationList(
  widgetData: LiveWidgetData,
  syncStatus: SyncStatus,
  timestamp: string
) {
  const conversations = widgetData.conversations
    .sort((a, b) => {
      // Live sorting: unread first, then by recent activity
      if (a.hasUnread !== b.hasUnread) return b.hasUnread ? 1 : -1
      if (a.lastActivity && b.lastActivity) {
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      }
      return 0
    })

  return (
    <Anti.Column>
      {generateLiveHeader(widgetData.totalUnread, syncStatus, timestamp)}
      <Anti.Divider />
      {conversations.map(conv => generateLiveConversationItem(conv))}
      {generateLiveFooter(syncStatus)}
    </Anti.Column>
  )
}

/**
 * Generate live header with real-time status
 */
export function generateLiveHeader(
  totalUnread: number,
  syncStatus: SyncStatus,
  timestamp: string
) {
  const statusColor = syncStatus.isLive ? 'success' : 'warning'
  const statusText = syncStatus.isLive ? 'Live' : 'Syncing'
  const statusIcon = syncStatus.isLive ? '🔴' : '🔄'

  return (
    <Anti.Row justify="space-between" align="center">
      <Anti.Row align="center">
        <Anti.Text type="heading2">Slack</Anti.Text>
        {totalUnread > 0 && (
          <Anti.Badge text={String(totalUnread)} type="primary" />
        )}
      </Anti.Row>
      <Anti.Column align="right">
        <Anti.Row align="center">
          <Anti.Badge 
            text={`${statusIcon} ${statusText}`} 
            type="primary" 
          />
        </Anti.Row>
        <Anti.Text type="caption">
          Updated {timestamp}
        </Anti.Text>
      </Anti.Column>
    </Anti.Row>
  )
}

/**
 * Generate individual conversation item with quick actions
 */
export function generateLiveConversationItem(conversation: {
  id: string
  displayName: string
  type: string
  unreadCount: number
  lastMessage?: string
  lastActivity?: string
  hasUnread: boolean
  isNew?: boolean
  slackChannelId?: string
}) {
  const borderType = conversation.isNew ? 'highlighted' : 'normal'

  return (
    <Anti.Row 
      key={conversation.id}
      justify="space-between" 
      align="center"
    >
      <Anti.Column>
        <Anti.Row align="center">
          <Anti.Text weight="medium">{conversation.displayName}</Anti.Text>
          {conversation.isNew && (
            <Anti.Badge text="NEW" type="accent" />
          )}
        </Anti.Row>
        {conversation.lastMessage && (
          <Anti.Text type="caption">
            {conversation.lastMessage}
          </Anti.Text>
        )}
        {conversation.lastActivity && (
          <Anti.Text type="small">
            {conversation.lastActivity}
          </Anti.Text>
        )}
      </Anti.Column>
      {conversation.unreadCount > 0 && (
        <Anti.Badge 
          text={String(conversation.unreadCount)} 
          type="primary" 
        />
      )}
      {conversation.hasUnread && conversation.slackChannelId && (
        <Anti.Button 
          action="mark_as_read" 
          size="small"
          text="✓"
        />
      )}
    </Anti.Row>
  )
}

/**
 * Generate live footer with connection status
 */
export function generateLiveFooter(syncStatus: SyncStatus) {
  if (syncStatus.error) {
    return (
      <Anti.Column align="center">
        <Anti.Text type="caption">
          ⚠️ {syncStatus.error}
        </Anti.Text>
        <Anti.Text type="small">
          Will retry automatically
        </Anti.Text>
      </Anti.Column>
    )
  }

  return (
    <Anti.Column align="center">
      <Anti.Text type="caption">
        {syncStatus.isLive ? '🔄 Live updates active' : '⏳ Connecting...'}
      </Anti.Text>
      {syncStatus.lastSync && (
        <Anti.Text type="caption">
          Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}
        </Anti.Text>
      )}
    </Anti.Column>
  )
} 