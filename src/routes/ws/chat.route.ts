import { Elysia } from 'elysia'
import { Types } from 'mongoose'

import { IClientPayload } from '../../types/message.type'
import { ITenant } from '@server/types/tenant.type'
import { IUser } from '@server/types/user.type'

import logger from '../../utils/logger.util'

import MessageService from '../../services/message.service'

import ConversationCollection from '../../models/conversation.model'
import MessageCollection from '../../models/message.model'
import TenantCollection from '../../models/tenant.model'
import UserCollection from '../../models/user.model'

const messageService = new MessageService()

if (messageService.redisSubInstance && messageService.redisInstance) {
  messageService.redisSubInstance.psubscribe('__keyevent@0__:expired')

  messageService.redisSubInstance.on('pmessage', async (_, __, expiredKey) => {
    if (!expiredKey.endsWith(':ttl')) return

    const lockKey = `lock:${expiredKey}`
    const bufferKey = expiredKey.replace(/:ttl$/, '')

    const gotLock = await messageService.redisInstance.set(lockKey, '1', 'EX', 3, 'NX')
    if (!gotLock) return

    const messages = await messageService.redisInstance.lrange(bufferKey, 0, -1)

    if (messages.length === 0) {
      await messageService.redisInstance.del(lockKey)
      return
    }

    let docs: Record<string, any>[]
    try {
      docs = messages.map(m => {
        const msg = JSON.parse(m)
        return typeof msg === 'string' ? JSON.parse(msg) : 'data' in msg ? msg.data : msg
      })
    } catch (err) {
      logger.error({ err }, '[RedisSub] JSON parse error')
      await messageService.redisInstance.del(lockKey)
      return
    }

    try {
      await MessageCollection.insertMany(docs)
      await messageService.redisInstance.del(bufferKey)
      logger.info(`[RedisSub] Flushed ${docs.length} messages`)
    } catch (err) {
      logger.error({ err }, '[MongoDB] Flush error')
    } finally {
      await messageService.redisInstance.del(lockKey)
    }
  })
}

export const chatRouter = new Elysia({
  prefix: '/:tenantCode',
}).ws('/conversation', {
  idleTimeout: 120,
  maxPayloadLength: 1024 * 1000, // 1MB max payload

  async beforeHandle(ws) {
    const userId = ws.query?.uid
    const secretKey = ws.query?.sid
    const tenantCode = ws.params?.tenantCode

    if (!userId || !tenantCode || !secretKey) {
      throw new Error('Missing required parameters')
    }

    const tenantInstance = await TenantCollection.findOne({ code: tenantCode, secretKey, isActive: true }).lean()

    if (!tenantInstance) {
      throw new Error('Invalid tenant or secret key')
    }

    const userFilter = {
      tenantId: tenantInstance._id,
      externalId: Number(userId),
    }

    const userInstance = await UserCollection.findOneAndUpdate(
      userFilter,
      {
        $setOnInsert: userFilter,
        $set: { lastSeen: new Date() },
      },
      { new: true, upsert: true },
    )

    ws.store = { tenant: tenantInstance, user: userInstance }
  },
  async open(ws) {
    const userId = ws.data.query?.uid
    const tenantCode = ws.data.params?.tenantCode
    const connectionKey = `${tenantCode}:connection:${userId}`

    await messageService.setUserOnline(tenantCode, Number(userId), true)

    const heartbeatId = setInterval(() => {
      messageService.setUserOnline(tenantCode, Number(userId), true)
    }, 25000) // 25s Keep-alive heartbeat

    const redisListener = async (channel: string, message: string) => {
      if (channel === connectionKey) {
        try {
          ws.send(message)
        } catch (err) {
          logger.error({ err }, '[RedisSub] WS send error')
        }
      }
    }

    await messageService.redisSubInstance?.subscribe(connectionKey)
    messageService.redisSubInstance?.on('message', redisListener)

    Object.assign(ws.data.store, { redisListener, connectionKey, heartbeatId })
  },
  async message(ws, clientPayload: IClientPayload) {
    const tenantInstance = (ws.data.store as any)?.tenant
    const userInstance = (ws.data.store as any)?.user

    if (!tenantInstance || !userInstance) {
      ws.send(
        JSON.stringify({
          event: 'error',
          data: { message: 'Invalid session' },
        }),
      )
      return
    }

    const userId = ws.data.query?.uid
    const tenantCode = ws.data.params?.tenantCode

    try {
      switch (clientPayload.event) {
        case 'message.send':
          await handleMessageSend(ws, clientPayload, {
            tenantInstance,
            userInstance,
            tenantCode,
            userId,
          })
          break

        case 'message.read':
          await handleMessageRead(ws, clientPayload, {
            tenantInstance,
            userInstance,
            tenantCode,
          })
          break

        case 'user.update':
          await hanldeUpdateUser(clientPayload, tenantInstance, userInstance)
          break

        case 'ping':
          ws.send(JSON.stringify({ event: 'pong', data: { timestamp: Date.now() } }))
          break

        default:
          ws.send(
            JSON.stringify({
              event: 'error',
              data: { message: `[WS] Unknown event: ${clientPayload.event}` },
            }),
          )
      }
    } catch (err) {
      ws.send(
        JSON.stringify({
          event: 'error',
          data: { message: err instanceof Error ? err.message : 'Unknown error' },
        }),
      )
    }
  },
  async close(ws) {
    const tenantCode = ws.data.params?.tenantCode
    const userId = ws.data.query?.uid
    const store: any = ws.data.store

    if (store.heartbeatId) {
      clearInterval(store.heartbeatId)
    }

    await messageService.setUserOnline(tenantCode, Number(userId), false)
    await messageService.redisSubInstance?.unsubscribe(store.connectionKey)

    if (store.redisListener) {
      messageService.redisSubInstance?.removeListener('message', store.redisListener)
    }

    await UserCollection.updateOne({ externalId: Number(userId) }, { $set: { lastSeen: new Date() } })
  },
})

async function hanldeUpdateUser(payload: IClientPayload, tenantInstance: ITenant, userInstance: IUser) {
  try {
    if (!payload.data?.senderId) {
      throw new Error('Missing "senderId" data')
    }

    if (!userInstance) {
      return UserCollection.create({
        tenantId: tenantInstance._id,
        externalId: payload.data?.senderId,
        name: payload.data.senderName,
        avatar: payload.data.avatar || null,
        lastSeen: new Date(),
      })
    }

    const updateData: Record<string, any> = {
      lastSeen: new Date(),
    }

    if (!userInstance?.avatar) {
      updateData.avatar = payload.data.senderAvatar
    }

    if (!userInstance.name) {
      updateData.name = payload.data.senderName
    }

    return UserCollection.updateOne({ _id: userInstance._id }, { $set: updateData })
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Update user profile failed')
  }
}

async function handleMessageSend(ws: any, payload: IClientPayload, context: any) {
  const { tenantInstance, userInstance, tenantCode, userId } = context
  const { senderId, senderName } = payload.data

  const recipientId = payload.data?.recipientId
  const recipientIds = payload.data?.recipientIds ?? []
  const conversationId = payload.data?.conversationId ?? null

  let finalConversationId = conversationId

  const mappingRecipients = recipientId ? [recipientId] : recipientIds

  if (!finalConversationId && mappingRecipients.length > 0) {
    const existingConv = await ConversationCollection.findOne({
      participants: { $all: [senderId, ...mappingRecipients], $size: 2 },
      tenantId: tenantInstance._id,
    })

    if (existingConv) {
      finalConversationId = existingConv._id.toString()
    } else {
      const newConv = await ConversationCollection.create({
        participants: [senderId, ...mappingRecipients],
        tenantId: tenantInstance._id,
      })
      finalConversationId = newConv._id.toString()

      const participantsKey = `${tenantCode}:participants:${finalConversationId}`
      await messageService.redisPubInstance.rpush(participantsKey, ...newConv.participants)
      await messageService.redisPubInstance.pexpire(participantsKey, messageService.MAX_INTERVAL_PARTICIPANT_MS)

      ws.send(
        JSON.stringify({
          event: 'conversation.created',
          data: {
            conversationId: finalConversationId,
            participants: newConv.participants,
          },
        }),
      )
    }
  }

  if (!finalConversationId) {
    throw new Error('Conversation ID required')
  }

  const conversationExists = await ConversationCollection.exists({
    _id: new Types.ObjectId(finalConversationId),
    tenantId: tenantInstance._id,
  })

  if (!conversationExists) {
    throw new Error('Conversation not found')
  }

  const participants = await messageService.getConversationParticipants(tenantCode, finalConversationId)

  await messageService.onMessageHandle({
    userInstance,
    tenantInstance,
    clientPayload: payload,
    conversationId: finalConversationId,
    participants,
    senderId,
  })
}

async function handleMessageRead(ws: any, payload: IClientPayload, context: any) {
  const conversationId = payload.data?.conversationId

  if (!conversationId) return

  const participants = await messageService.getConversationParticipants(context.tenantCode, conversationId)

  await messageService.markReadMessages(context.tenantInstance, context.userInstance, conversationId, participants)
}
