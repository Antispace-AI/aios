// Storage container for dependency injection
// Sets up PostgreSQL connection and data store

import { PostgreSQLConnection, DatabaseConfig } from './connection'
import { PostgreSQLSlackDataStore } from './postgres-data-store'
import { logger } from '../../../util/logger'

export interface StorageContainer {
  dataStore: PostgreSQLSlackDataStore
  connection: PostgreSQLConnection
}

// Singleton pattern to avoid multiple container creation
let _storageContainer: StorageContainer | null = null

export function createStorageContainer(config?: DatabaseConfig): StorageContainer {
  // Return existing container if available
  if (_storageContainer) {
    return _storageContainer
  }

  // Use environment variables by default
  const dbConfig: DatabaseConfig = {
    host: config?.host || process.env.POSTGRES_HOST || 'localhost',
    port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
    database: config?.database || process.env.POSTGRES_DB || 'slack_app',
    user: config?.user || process.env.POSTGRES_USER || 'postgres',
    password: config?.password || process.env.POSTGRES_PASSWORD,
    ssl: config?.ssl || process.env.POSTGRES_SSL === 'true',
    maxConnections: config?.maxConnections || 20,
    idleTimeoutMs: config?.idleTimeoutMs || 30000,
    connectionTimeoutMs: config?.connectionTimeoutMs || 2000
  }

  logger.info('Creating storage container', {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    ssl: dbConfig.ssl
  })

  const connection = new PostgreSQLConnection(dbConfig)
  const dataStore = new PostgreSQLSlackDataStore(connection)

  _storageContainer = { dataStore, connection }
  return _storageContainer
}

// Function to reset singleton (useful for testing)
export function resetStorageContainer(): void {
  _storageContainer = null
} 