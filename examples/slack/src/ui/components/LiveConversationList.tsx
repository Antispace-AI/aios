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
  // Separate and sort conversations by type
  const directMessages = widgetData.conversations
    .filter(conv => conv.displayName.startsWith('@'))
    .sort((a, b) => {
      // DMs: unread first, then by recent activity
      if (a.hasUnread !== b.hasUnread) return b.hasUnread ? 1 : -1
      if (a.lastActivity && b.lastActivity) {
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
      }
      return 0
    })

  const channels = widgetData.conversations
    .filter(conv => conv.displayName.startsWith('#') || (!conv.displayName.startsWith('@')))
    .sort((a, b) => {
      // Channels: unread first, then by recent activity
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
      
      {/* Direct Messages Section */}
      {directMessages.length > 0 && (
        <>
          <Anti.Text type="caption" weight="medium">Direct Messages</Anti.Text>
          {directMessages.map(conv => generateLiveConversationItem(conv))}
          {channels.length > 0 && <Anti.Divider />}
        </>
      )}
      
      {/* Channels Section */}
      {channels.length > 0 && (
        <>
          <Anti.Text type="caption" weight="medium">Channels</Anti.Text>
          {channels.map(conv => generateLiveConversationItem(conv))}
        </>
      )}
      
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
  const statusIcon = syncStatus.isLive ? '🔴' : '🔄'
  const statusText = syncStatus.isLive ? 'LIVE' : 'Syncing'

  return (
    <Anti.Row justify="space-between" align="center">
      <Anti.Row align="center">
        <Anti.Text type="heading2">SLACK</Anti.Text>
        {totalUnread > 0 && (
          <Anti.Badge text={String(totalUnread)} type="primary" />
        )}
      </Anti.Row>
      <Anti.Row align="center">
        <Anti.Button 
          action="toggleDeveloperMode" 
          text="Dev Mode"
          size="small"
        />
        <Anti.Column align="right">
          <Anti.Badge 
            text={`${statusIcon} ${statusText}`} 
            type={syncStatus.isLive ? "primary" : "secondary"} 
          />
          <Anti.Text type="caption">
            Updated {timestamp}
          </Anti.Text>
        </Anti.Column>
      </Anti.Row>
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
  const weight = conversation.hasUnread ? "bold" : "medium"
  
  // Smart message preview with fallbacks
  const getMessagePreview = () => {
    if (conversation.lastMessage && conversation.lastMessage.trim()) {
      // Truncate long messages with smart cutoff
      if (conversation.lastMessage.length > 80) {
        return conversation.lastMessage.substring(0, 77) + "..."
      }
      return conversation.lastMessage
    }
    
    // Contextual fallbacks based on conversation type
    if (conversation.type === 'im') {
      return "Start a conversation"
    } else if (conversation.type === 'channel') {
      return "No recent messages"
    } else {
      return "No activity yet"
    }
  }

  // Visual indicator for conversation type
  const getTypeIcon = () => {
    if (conversation.displayName.startsWith('@')) return '👤 '
    if (conversation.displayName.startsWith('#')) return '📢 '
    return '💬 '
  }

  // Unread indicator
  const unreadIndicator = conversation.hasUnread ? ' ●' : ''

  return (
    <Anti.Row 
      key={conversation.id}
      justify="space-between" 
      align="center"
    >
      <Anti.Column>
        <Anti.Row align="center">
          <Anti.Text weight={weight}>
            {getTypeIcon()}{conversation.displayName}{unreadIndicator}
          </Anti.Text>
          {conversation.isNew && (
            <Anti.Badge text="NEW" type="accent" />
          )}
        </Anti.Row>
        <Anti.Text 
          type="caption"
        >
          {getMessagePreview()}
        </Anti.Text>
        {conversation.lastActivity && (
          <Anti.Text type="small">
            {conversation.lastActivity}
          </Anti.Text>
        )}
      </Anti.Column>
      
      <Anti.Column align="right">
        {conversation.unreadCount > 0 && (
          <Anti.Badge 
            text={String(conversation.unreadCount)} 
            type="primary" 
          />
        )}
        {/* Quick Actions - Show for all conversations for testing */}
        <Anti.Row align="center">
          {/* Mark as Read - show for all conversations with slackChannelId */}
          {conversation.slackChannelId && (
            <Anti.Button 
              action={`mark_as_read:${conversation.slackChannelId}`}
              size="small"
              text="✓"
              type="secondary"
            />
          )}
          {/* Mute/Unmute Action */}
          {conversation.slackChannelId && (
            <Anti.Button 
              action={`toggle_mute:${conversation.slackChannelId}`}
              size="small"
              text="🔕"
              type="secondary"
            />
          )}
          {/* Open in Slack Action */}
          {conversation.slackChannelId && (
            <Anti.Button 
              action={`open_in_slack:${conversation.slackChannelId}`}
              size="small"
              text="↗"
              type="secondary"
            />
          )}
        </Anti.Row>
      </Anti.Column>
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
          ⚠️ Connection issue: {syncStatus.error}
        </Anti.Text>
        <Anti.Text type="caption">
          Retrying automatically...
        </Anti.Text>
      </Anti.Column>
    )
  }

  const getConnectionStatus = () => {
    if (syncStatus.isLive) {
      return '🔄 Live updates active'
    } else {
      return '⏳ Connecting to Slack...'
    }
  }

  return (
    <Anti.Column align="center">
      <Anti.Text type="caption">
        {getConnectionStatus()}
      </Anti.Text>
      {syncStatus.lastSync && (
        <Anti.Text type="caption">
          Last sync: {new Date(syncStatus.lastSync).toLocaleTimeString()}
        </Anti.Text>
      )}
      {syncStatus.isLive && (
        <Anti.Text type="caption">
          Connected to workspace
        </Anti.Text>
      )}
    </Anti.Column>
  )
} 