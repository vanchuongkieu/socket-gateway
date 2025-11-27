import 'dotenv/config'

interface Env {
  PORT: number
  MONGO_URI?: string
  REDIS_URI?: string
  NODE_ENV: 'development' | 'production' | 'test'
  [x: string]: any
}

export const env: Env = {
  NODE_ENV: (process.env.NODE_ENV as Env['NODE_ENV']) ?? 'development',
  PORT: parseInt(process.env.PORT ?? '3000', 10),
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URI: process.env.REDIS_URI,
  LOG_LEVEL: 'info',
}

export const isDev = env.NODE_ENV === 'development'

const requiredKeys: (keyof Env)[] = ['MONGO_URI', 'REDIS_URI']

for (const key of requiredKeys) {
  if (!env[key]) {
    console.error(`[ENV] Missing required env: ${key}`)
    process.exit(1)
  }
}
