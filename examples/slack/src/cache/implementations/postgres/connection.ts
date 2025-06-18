import { Pool, PoolConfig, PoolClient } from 'pg'
import { logger } from '../../../util/logger'

export interface DatabaseConfig {
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
  ssl?: boolean
  maxConnections?: number
  idleTimeoutMs?: number
  connectionTimeoutMs?: number
}

export class PostgreSQLConnection {
  private pool: Pool
  private isConnected = false

  constructor(config: DatabaseConfig) {
    const poolConfig: PoolConfig = {
      host: config.host || process.env.POSTGRES_HOST || 'localhost',
      port: config.port || parseInt(process.env.POSTGRES_PORT || '5432'),
      database: config.database || process.env.POSTGRES_DB || 'slack_app',
      user: config.user || process.env.POSTGRES_USER || 'postgres',
      password: config.password || process.env.POSTGRES_PASSWORD,
      ssl: config.ssl || process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: config.maxConnections || 20,        // Maximum 20 connections in pool
      idleTimeoutMillis: config.idleTimeoutMs || 30000,  // Close idle connections after 30s
      connectionTimeoutMillis: config.connectionTimeoutMs || 2000,  // Fail fast if can't connect
    }

    this.pool = new Pool(poolConfig)

    // Set up connection pool event handlers
    this.pool.on('connect', (client: PoolClient) => {
      logger.debug('New PostgreSQL client connected')
    })

    this.pool.on('error', (err: Error) => {
      logger.error('PostgreSQL pool error', err)
      this.isConnected = false
    })

    this.pool.on('remove', () => {
      logger.debug('PostgreSQL client removed from pool')
    })

    logger.info('PostgreSQL connection pool initialized', {
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      maxConnections: poolConfig.max
    })
  }

  /**
   * Execute a SQL query with optional parameters
   */
  async query(text: string, params?: any[]): Promise<any> {
    const client = await this.pool.connect()
    const start = Date.now()
    
    try {
      const result = await client.query(text, params)
      const duration = Date.now() - start
      
      logger.debug('Executed query', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        rows: result.rowCount
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error('Query execution failed', error instanceof Error ? error : new Error(String(error)), {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        params: params ? params.length : 0
      })
      throw error
    } finally {
      client.release()  // Always return connection to pool
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect()
    
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      
      logger.debug('Transaction completed successfully')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      logger.error('Transaction rolled back due to error', error instanceof Error ? error : new Error(String(error)))
      throw error
    } finally {
      client.release()
    }
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.query('SELECT 1 as health_check, NOW() as current_time')
      this.isConnected = true
      
      logger.debug('Database health check passed', {
        currentTime: result.rows[0]?.current_time
      })
      
      return true
    } catch (error) {
      this.isConnected = false
      logger.error('Database health check failed', error instanceof Error ? error : new Error(String(error)))
      return false
    }
  }

  /**
   * Get connection status
   */
  isHealthy(): boolean {
    return this.isConnected
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    }
  }

  /**
   * Close all connections and end the pool
   */
  async close(): Promise<void> {
    try {
      await this.pool.end()
      this.isConnected = false
      logger.info('PostgreSQL connection pool closed')
    } catch (error) {
      logger.error('Error closing PostgreSQL connection pool', error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }
} 