// Main storage module exports
// This file provides the public interface for all ephemeral Slack data storage operations
// All data is stored temporarily to optimize UI performance, with Slack remaining the source of truth

// Storage interfaces
export * from './interfaces'

// Database types and schemas
export * from './schema/types'

// PostgreSQL implementation
export { PostgreSQLConnection } from './implementations/postgres/connection'
export { PostgreSQLSlackDataStore } from './implementations/postgres/postgres-data-store'
export { createStorageContainer } from './implementations/postgres/container'
export type { StorageContainer } from './implementations/postgres/container' 