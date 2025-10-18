// Database connection utility for PlanetScale
import { connect } from '@planetscale/database'

export interface DatabaseConfig {
  host: string
  username: string
  password: string
}

// Create connection from environment variables
export function createConnection() {
  const config = {
    host: process.env.DATABASE_HOST!,
    username: process.env.DATABASE_USERNAME!,
    password: process.env.DATABASE_PASSWORD!
  }

  if (!config.host || !config.username || !config.password) {
    throw new Error('Database configuration missing. Please set DATABASE_HOST, DATABASE_USERNAME, and DATABASE_PASSWORD environment variables.')
  }

  return connect(config)
}

// For Cloudflare Workers environment
export function createConnectionFromEnv(env: any) {
  const config = {
    host: env.DATABASE_HOST,
    username: env.DATABASE_USERNAME,
    password: env.DATABASE_PASSWORD
  }

  if (!config.host || !config.username || !config.password) {
    throw new Error('Database configuration missing in Cloudflare Workers environment.')
  }

  return connect(config)
}

// Helper function to generate unique IDs
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2)
  return `${prefix}_${timestamp}${random}`
}