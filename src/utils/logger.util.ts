import pino from 'pino'

import { env } from '../config/env.config'

const isDevelopment = env.NODE_ENV === 'development'

export const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'yyyy-mm-dd HH:MM:ss',
    },
  },
  level: isDevelopment ? 'debug' : 'info',
})

export default logger
