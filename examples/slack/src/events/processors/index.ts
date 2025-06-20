import { handleMessageEvent, setDataStore as setMessageDataStore } from './message'
import { SlackDataStore } from '../../storage/interfaces/slack-data-store'
import { logger } from '../../util/logger'

/**
 * Initialize event processors with data store
 */
export function initializeEventProcessors(store: SlackDataStore): void {
  // Initialize all processors with the data store
  setMessageDataStore(store)
  
  logger.info('Event processors initialized with data store')
} 