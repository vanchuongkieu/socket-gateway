import { join as pathJoin } from 'path'

import { Elysia } from 'elysia'
import cors from '@elysiajs/cors'
import swagger from '@elysiajs/swagger'

import { env } from './config/env.config'
import { initializeMongo } from './config/mongo.config'
import { AppError } from './constants/app-error.constant'
import * as responseHandler from './middlewares/response.middleware'
import logger from './utils/logger.util'

import { conversationRouter } from './routes/api/conversation.route'
import { tenantRouter } from './routes/api/tenant.route'
import { chatRouter } from './routes/ws/chat.route'
import staticPlugin from '@elysiajs/static'

await initializeMongo()

const gatewayInstance = new Elysia()
  .use(cors({ origin: '*' }))
  .use(swagger({ exclude: [''] }))
  .error({ AppError })
  .use(responseHandler.onErrorHanler)
  .use(responseHandler.onAfterHandler)
  .group('gateway', gateway => gateway.use(chatRouter))
  .group('/api', group => group.use(tenantRouter).use(conversationRouter))
  .use(
    staticPlugin({
      prefix: '/',
      alwaysStatic: true,
      assets: pathJoin(process.cwd(), 'client'),
    }),
  )
  .listen(env.PORT ?? 3000)

logger.info(`[APP] Socket Gateway is running at "${gatewayInstance.server?.url}"`)

export type GatewayInstance = typeof gatewayInstance
