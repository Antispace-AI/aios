/**
 * Parameter parsing utility for AI function calls
 * Handles the complex parameter formats that come from the AI system
 */

export function parseParameters(parameters: any): any {
  // Return early for null/undefined
  if (!parameters) {
    return {}
  }

  try {
    // If already an object, return as-is
    if (typeof parameters === 'object' && !Array.isArray(parameters)) {
      return parameters
    }

    // Handle array format - check if first element is a JSON string
    if (Array.isArray(parameters) && parameters.length > 0) {
      const firstParam = parameters[0]
      if (typeof firstParam === 'string') {
        try {
          return JSON.parse(firstParam)
        } catch {
          // If parsing fails, return the array as-is
          return parameters
        }
      }
      return parameters
    }

    // Handle string format - try to parse as JSON
    if (typeof parameters === 'string') {
      try {
        const parsed = JSON.parse(parameters)
        // If parsed result is an array with a string, parse that string too
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
          try {
            return JSON.parse(parsed[0])
          } catch {
            return parsed
          }
        }
        return parsed
      } catch {
        // If parsing fails, return original string
        return { raw: parameters }
      }
    }

    // Handle array-like objects (has length property)
    if (parameters && typeof parameters.length === 'number' && parameters['0']) {
      try {
        return JSON.parse(parameters['0'])
      } catch {
        return parameters
      }
    }

    // Fallback: return as-is
    return parameters

  } catch (error) {
    console.warn('Parameter parsing failed, using original:', error)
    return parameters
  }
} 