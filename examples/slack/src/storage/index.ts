// Main storage module exports
// This file provides the public interface for all storage operations

// Storage interfaces (moved to cache)
export * from '../cache/interfaces'

// Database types and schemas (moved to cache)
export * from '../cache/schema/types'

// PostgreSQL implementation
export { PostgreSQLConnection } from './implementations/postgres/connection'
export { PostgreSQLSlackDataStore } from './implementations/postgres/postgres-data-store'
export { createStorageContainer } from './implementations/postgres/container'
export type { StorageContainer } from './implementations/postgres/container' 