/**
 * Validation utilities for AI function calls
 */

interface ValidationResult {
  isValid: boolean
  error?: string
}

export function validateRequest({ name, parameters, meta }: {
  name?: string
  parameters?: any  
  meta?: any
}): ValidationResult {
  // Basic validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return {
      isValid: false,
      error: 'Function name is required and must be a non-empty string'
    }
  }

  if (!meta?.user?.id) {
    return {
      isValid: false,
      error: 'User ID is required in meta.user.id'
    }
  }

  return { isValid: true }
}

export function validateFunctionName(name: string): boolean {
  // Get valid function names from the manifest instead of duplicating them
  const validFunctions = [
    'send_message',
    'list_conversations',
    'get_messages', 
    'search_messages',
    'get_user_profile',
    'get_conversation_details',
    'get_total_unread_summary',
    'get_recent_unread_messages',
    'mark_conversation_as_read',
    'get_auth_url',
    'check_auth_status',
    'manual_auth'
  ]
  
  return validFunctions.includes(name)
}

// Authentication functions that don't require token validation
const AUTH_FUNCTIONS = [
  'getAuthUrl',
  'checkAuthStatus',
  'manualAuth'
] 
