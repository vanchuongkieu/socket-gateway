import Redis from 'ioredis'
import { env } from './env.config'
import logger from '../utils/logger.util'

export const getRedisPubSub = () => {
  if (!env.REDIS_URI) {
    logger.fatal('Missing REDIS_URI')
    return { redis: null, redisPub: null, redisSub: null }
  }

  try {
    const redis = new Redis(env.REDIS_URI, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    const redisPub = new Redis(env.REDIS_URI, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    const redisSub = new Redis(env.REDIS_URI, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    redis.config('SET', 'notify-keyspace-events', 'Ex').catch(err => logger.fatal({ err }, 'Cannot enable keyspace events'))
    redis.on('connect', () => logger.info('[Redis] Connected'))
    redis.on('error', err => logger.fatal({ err }, '[Redis] Error'))
    redisPub.on('error', err => logger.fatal({ err }, '[RedisPub] Error'))
    redisSub.on('error', err => logger.fatal({ err }, '[RedisSub] Error'))

    return { redis, redisPub, redisSub }
  } catch (err) {
    logger.fatal({ err }, `[Redis] Connection error`)
    return { redis: null, redisPub: null, redisSub: null }
  }
}

export const getRedis = () => {
  if (!env.REDIS_URI) {
    logger.fatal('Missing REDIS_URI')
    return null
  }

  try {
    return new Redis(env.REDIS_URI)
  } catch (err) {
    logger.fatal({ err }, `[Redis] Connection error`)
    return null
  }
}
