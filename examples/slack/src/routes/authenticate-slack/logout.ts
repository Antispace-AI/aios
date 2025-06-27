import type { Context } from "hono"
import { setCookie } from "hono/cookie"
import { clearUserTokens, getUser } from "../../util"
import { ANTISPACE_URL } from "../../config/simple"

/**
 * Logout endpoint for Slack authentication
 * This endpoint clears the user's stored Slack tokens and redirects back to Antispace
 */
export default async function handler(c: Context) {
  try {
    // Get userId from query parameter
    const userId = c.req.query("userId")
    
    if (!userId) {
      return c.json({ error: "Missing userId parameter" }, 400)
    }

    console.log(`Processing logout for user ${userId}`)

    // Get user from database
    const user = await getUser(userId)
    
    if (!user || !user.accessToken) {
      console.log(`User ${userId} not found or not authenticated`)
      return c.redirect(`${ANTISPACE_URL}/me?info=not_authenticated`)
    }

    // Clear the user's tokens
    await clearUserTokens(userId)

    console.log(`Successfully logged out user ${userId} from Slack`)

    // Clear any cookies (though we mainly use them for OAuth flow)
    setCookie(c, "antispace_user_id", "", {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 0, // Expire immediately
    })

    // Redirect back to Antispace with success message
    return c.redirect(`${ANTISPACE_URL}/me?success=slack_disconnected`)

  } catch (error) {
    console.error("Logout error:", error)
    return c.redirect(`${ANTISPACE_URL}/me?error=logout_failed`)
  }
} 