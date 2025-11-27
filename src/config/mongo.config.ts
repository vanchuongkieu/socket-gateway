import mongoose from 'mongoose'

import logger from '../utils/logger.util'
import { env } from './env.config'

export const initializeMongo = async (): Promise<'connected' | 'disconnected'> => {
  if (!env.MONGO_URI) {
    logger.fatal('Missing MONGO_URI')
    return 'disconnected'
  }

  mongoose.set('strictQuery', true)

  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    })
    logger.info('[MongoDB] Connected')
    return 'connected'
  } catch (err) {
    logger.fatal({ err }, `[MongoDB] Connection error`)
    return 'disconnected'
  }
}
