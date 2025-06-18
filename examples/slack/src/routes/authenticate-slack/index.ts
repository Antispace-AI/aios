import type { Context } from "hono"
import { setCookie } from "hono/cookie"
import { BASE_URL, IS_PRODUCTION, SLACK_CLIENT_ID } from "../../config/simple"

/**
 * OAuth initiation endpoint for Slack authentication
 * This endpoint receives the userId from Antispace and initiates the OAuth flow
 * 
 * IMPORTANT: Slack requires HTTPS redirect URIs for production apps.
 * For local development, HTTP localhost URLs may be acceptable.
 */
export default async function handler(c: Context) {
  // Get userId from Antispace
  const userId = c.req.query("userId")
  
  if (!userId) {
    return c.json({ error: "Missing userId parameter" }, 400)
  }

  // Validate HTTPS requirement for production
  if (IS_PRODUCTION && !BASE_URL.startsWith("https://")) {
    console.error("Production environment requires HTTPS BASE_URL")
    return c.json({ error: "HTTPS required for production" }, 500)
  }

  const redirectUri = `${BASE_URL}/authenticate-slack/callback`

  // Store userId in cookies for retrieval in callback
  setCookie(c, "antispace_user_id", userId as string, {
    httpOnly: true,
    secure: IS_PRODUCTION, // Use secure cookies in production
    sameSite: "Lax",
    maxAge: 60 * 10, // 10 minutes
  })

  // Slack OAuth scopes (USER scopes - no bot required)
  const scopes = [
    "channels:read",
    "groups:read", 
    "im:read",
    "mpim:read",
    "users:read",
    "channels:history",
    "groups:history",
    "im:history",
    "mpim:history",
    "chat:write",  // FIXED: User scope for sending messages as user
    // Write scopes needed for marking conversations as read
    "channels:write",  // For marking channels as read
    "groups:write",    // For marking private channels as read
    "im:write",        // For marking DMs as read
    "mpim:write",      // For marking group DMs as read
    // Reaction scopes for emoji reactions
    "reactions:read",  // Required for reaction_added and reaction_removed events
    "reactions:write"  // Optional: for adding/removing reactions via API
  ].join(" ")

  // Construct Slack OAuth URL
  const slackAuthUrl = new URL("https://slack.com/oauth/v2/authorize")
  slackAuthUrl.searchParams.set("client_id", SLACK_CLIENT_ID)
  slackAuthUrl.searchParams.set("user_scope", scopes)  // FIXED: Use user_scope for user tokens
  slackAuthUrl.searchParams.set("redirect_uri", redirectUri)
  slackAuthUrl.searchParams.set("response_type", "code")
  slackAuthUrl.searchParams.set("state", userId as string) // Additional security

  console.log(`Initiating Slack OAuth for user ${userId}`)
  console.log(`Redirect URI: ${redirectUri}`)
  
  // Log warning if using HTTP in what might be production
  if (!redirectUri.startsWith("https://") && !redirectUri.includes("localhost")) {
    console.warn("⚠️  WARNING: Using HTTP redirect URI. Slack requires HTTPS for production apps!")
  }
  
  return c.redirect(slackAuthUrl.toString())
} 