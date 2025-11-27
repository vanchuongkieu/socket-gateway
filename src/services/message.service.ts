import { Types } from 'mongoose'
import Redis from 'ioredis'

import logger from '../utils/logger.util'
import { getRedisPubSub } from '../config/ioredis.config'

import { IClientPayload } from '../types/message.type'
import { ITenant } from '../types/tenant.type'
import { IUser } from '../types/user.type'

import ConversationCollection from '../models/conversation.model'
import MessageCollection from '../models/message.model'

const { redis, redisPub, redisSub } = getRedisPubSub()

export default class MessageService {
  redisInstance: Redis = redis!
  redisSubInstance: Redis = redisSub!
  redisPubInstance: Redis = redisPub!

  MAX_INTERVAL_S: number = 2 // second
  MAX_INTERVAL_MS: number = this.MAX_INTERVAL_S * 1000 // second
  MAX_INTERVAL_PARTICIPANT_MS: number = this.MAX_INTERVAL_MS * 10 // second
  MAX_BATCH_SIZE: number = 100 // Flush khi đạt 100 messages

  private participantCache = new Map<string, { participants: Set<number>; expiry: number }>()
  private PARTICIPANT_CACHE_TTL = 300000 // 5 minutes

  async getConversationParticipants(tenantCode: string, conversationId: string): Promise<Set<number>> {
    const cacheKey = `${tenantCode}:${conversationId}`
    const cached = this.participantCache.get(cacheKey)

    if (cached && Date.now() < cached.expiry) {
      return cached.participants
    }

    const participantsKey = `${tenantCode}:participants:${conversationId}`
    const participantRaws = await this.redisPubInstance?.lrange(participantsKey, 0, -1)

    if (participantRaws && participantRaws.length > 0) {
      const participants = new Set(participantRaws.map(Number))
      this.participantCache.set(cacheKey, {
        participants,
        expiry: Date.now() + this.PARTICIPANT_CACHE_TTL,
      })
      return participants
    }

    const conversation = await ConversationCollection.findById(conversationId).select('participants').lean()

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const participants = new Set(conversation.participants)

    await this.redisPubInstance?.rpush(participantsKey, ...conversation.participants)
    await this.redisPubInstance?.pexpire(participantsKey, this.MAX_INTERVAL_PARTICIPANT_MS)

    this.participantCache.set(cacheKey, {
      participants,
      expiry: Date.now() + this.PARTICIPANT_CACHE_TTL,
    })

    return participants
  }

  async markReadMessages(tenant: ITenant, user: IUser, conversationId: string | null, participants: Set<number>) {
    if (!conversationId) return

    const currentTimestamp = Date.now()

    const messageData = {
      event: 'message.read',
      data: {
        senderId: user.externalId,
        conversationId,
        tenantId: tenant._id,
        senderName: user?.name,
        timestamp: currentTimestamp,
      },
    }

    const pipeline = this.redisPubInstance.pipeline()
    participants?.forEach(participantId => {
      if (participantId !== user.externalId) {
        pipeline.publish(`${tenant.code}:connection:${participantId}`, JSON.stringify(messageData))
      }
    })
    await pipeline.exec()

    MessageCollection.updateMany(
      {
        tenantId: tenant._id,
        conversationId: new Types.ObjectId(conversationId),
        senderId: { $ne: user.externalId },
        'readBy.externalId': { $ne: user.externalId },
      },
      {
        $push: {
          readBy: {
            userId: user._id,
            readAt: new Date(currentTimestamp),
            externalId: user.externalId,
          },
        },
      },
    ).catch(err => logger.error({ err }, 'Failed to update read status'))
  }

  async onMessageHandle(body: {
    userInstance: IUser
    tenantInstance: ITenant
    clientPayload: IClientPayload
    conversationId: string | null
    participants: Set<number>
    senderId?: number
  }) {
    if (!body.conversationId) return

    const messageId = new Types.ObjectId()
    const createdAt = Date.now()

    const messageData = {
      event: 'message.new',
      data: {
        _id: messageId.toString(),
        senderId: body.senderId,
        conversationId: body.conversationId,
        userId: body.userInstance._id.toString(),
        tenantId: body.tenantInstance._id.toString(),
        content: body.clientPayload.data?.content ?? null,
        images: body.clientPayload.data?.images ?? [],
        senderName: body.clientPayload.data?.senderName ?? body.userInstance.name,
        mentions: body.clientPayload.data?.mentions ?? [],
        mentionAll: body.clientPayload.data?.mentionAll ?? false,
        replyTo: body.clientPayload.data?.replyTo ?? null,
        createdAt,
        readBy: [
          {
            userId: body.userInstance._id.toString(),
            externalId: body.userInstance.externalId,
            readAt: new Date(createdAt),
          },
        ],
      },
    }

    const bufferKey = `buffer:${body.tenantInstance.code}:${body.conversationId}`
    const ttlBufferKey = `${bufferKey}:ttl`

    const pipeline = this.redisPubInstance.pipeline()
    pipeline.rpush(bufferKey, JSON.stringify(messageData.data))
    pipeline.llen(bufferKey)

    const ttlExists = await this.redisPubInstance.exists(ttlBufferKey)
    if (!ttlExists) {
      pipeline.set(ttlBufferKey, '1', 'EX', this.MAX_INTERVAL_S)
    }

    const results = await pipeline.exec()
    const bufferSize = results?.[1]?.[1] as number

    if (bufferSize >= this.MAX_BATCH_SIZE) {
      await this.flushBuffer(bufferKey, ttlBufferKey)
    }

    const broadcastPipeline = this.redisPubInstance.pipeline()

    body.participants?.forEach(participantId => {
      if (participantId !== body.senderId) {
        const shouldNotify = messageData.data.mentionAll || messageData.data.mentions.includes(participantId)

        const payload = {
          ...messageData,
          data: {
            ...messageData.data,
            priority: shouldNotify ? 'high' : 'normal',
          },
        }

        broadcastPipeline.publish(`${body.tenantInstance.code}:connection:${participantId}`, JSON.stringify(payload))
      }
    })

    await broadcastPipeline.exec()
  }

  private async flushBuffer(bufferKey: string, ttlKey: string) {
    const lockKey = `lock:${bufferKey}`
    const gotLock = await this.redisPubInstance.set(lockKey, '1', 'EX', 3, 'NX')

    if (!gotLock) return

    try {
      const messages = await this.redisPubInstance.lrange(bufferKey, 0, -1)

      if (messages.length === 0) return

      const docs = messages.map(m => {
        const msg = JSON.parse(m)
        return typeof msg === 'string' ? JSON.parse(msg) : 'data' in msg ? msg.data : msg
      })

      await MessageCollection.insertMany(docs, { ordered: false })
      await this.redisPubInstance.del(bufferKey, ttlKey)

      logger.info(`Flushed ${docs.length} messages to MongoDB`)
    } catch (err) {
      logger.error({ err }, 'Failed to flush buffer')
    } finally {
      await this.redisPubInstance.del(lockKey)
    }
  }

  async setTypingStatus(tenantCode: string, conversationId: string, userId: number, isTyping: boolean) {
    const key = `typing:${tenantCode}:${conversationId}`

    if (isTyping) {
      await this.redisPubInstance.sadd(key, userId)
      await this.redisPubInstance.pexpire(key, 5000) // 5s TTL
    } else {
      await this.redisPubInstance.srem(key, userId)
    }

    const typingUsers = await this.redisPubInstance.smembers(key)

    return typingUsers.map(Number).filter(id => id !== userId)
  }

  async setUserOnline(tenantCode: string, userId: number, isOnline: boolean) {
    const userOnlineKey = `${tenantCode}:connection:${userId}:online`

    if (isOnline) {
      await this.redisPubInstance.set(userOnlineKey, '1', 'EX', 30)
    } else {
      await this.redisPubInstance.del(userOnlineKey)
    }
  }
}
