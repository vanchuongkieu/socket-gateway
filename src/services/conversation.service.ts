import { Types } from 'mongoose'
import { NewTenantBody } from '../types/tenant.type'
import ConversationCollection from '../models/conversation.model'
import MessageCollection from '../models/message.model'
import TenantCollection from '../models/tenant.model'
import JsonResponse from '../utils/response.util'
import { IUser } from '../types/user.type'

interface GetMessagePayload {
  conversationId: Types.ObjectId
  tenantId: Types.ObjectId
  limit: number
  skip: number
  page: number
  user?: IUser
  search?: string
  beforeDate?: Date
  afterDate?: Date
}

interface GetConversationPayload {
  tenantId: Types.ObjectId
  userExternalId: number
  limit: number
  skip: number
  page: number
  search?: string
  unreadOnly?: boolean
}

export default class ConversationService {
  request: Request
  serverURL: URL

  constructor(request: Request) {
    this.serverURL = new URL(request.url)
    this.request = request
  }

  async createNew(body: NewTenantBody) {
    return TenantCollection.create(body)
  }

  async conversationExists(cid: string) {
    const conversationId = new Types.ObjectId(cid)
    const conversationExists = await ConversationCollection.exists({ _id: conversationId })
    if (!conversationExists) throw new Error('Conversation not found')
    return conversationId
  }

  async getMessages(payload: GetMessagePayload) {
    const conversationExists = await ConversationCollection.exists({
      _id: payload.conversationId,
    })
    if (!conversationExists) throw new Error('Conversation not found')

    const filterObject: any = {
      conversationId: payload.conversationId,
      tenantId: payload.tenantId,
      deletedAt: null,
    }

    if (payload.search) {
      filterObject.$or = [{ content: { $regex: payload.search, $options: 'i' } }, { senderName: { $regex: payload.search, $options: 'i' } }]
    }

    if (payload.beforeDate || payload.afterDate) {
      filterObject.createdAt = {}
      if (payload.beforeDate) {
        filterObject.createdAt.$lt = payload.beforeDate
      }
      if (payload.afterDate) {
        filterObject.createdAt.$gt = payload.afterDate
      }
    }

    const messages = await MessageCollection.find(filterObject, { __v: 0 })
      .populate({
        path: 'readBy.userId',
        select: 'name avatar externalId',
      })
      .populate({
        path: 'userId',
        select: 'name avatar externalId',
        localField: 'user',
      })
      .populate({
        path: 'reactions.userId',
        select: 'name avatar externalId',
      })
      .sort({ createdAt: -1 })
      .skip(payload.skip)
      .limit(payload.limit)
      .lean()

    return messages.map(msg => {
      const excludeMe = msg.readBy?.filter(rb => rb?.externalId !== payload.user?.externalId)
      const moreReadByCount = Math.max((excludeMe?.length ?? 0) - 1, 0)
      const newestReadBys = excludeMe?.slice(0, 1).map((pu: any) => ({
        externalId: pu?.externalId,
        name: pu?.userId?.name,
        avatar: pu?.userId?.avatar ?? this.serverURL.origin + '/images/default-avatar-user.jpg',
        readAt: pu?.readAt,
      }))

      const readByMe = msg.readBy?.find(rb => rb?.externalId === payload.user?.externalId)

      const reactionsMap = new Map<string, any[]>()
      msg.reactions?.forEach((reaction: any) => {
        const emoji = reaction.emoji
        if (!reactionsMap.has(emoji)) {
          reactionsMap.set(emoji, [])
        }
        reactionsMap.get(emoji)?.push({
          userId: reaction.externalId,
          userName: reaction.userId?.name,
          avatar: reaction.userId?.avatar ?? this.serverURL.origin + '/images/default-avatar-user.jpg',
          createdAt: reaction.createdAt,
        })
      })

      const processedReactions = Array.from(reactionsMap.entries()).map(([emoji, users]) => ({
        emoji,
        count: users.length,
        users: users.slice(0, 3),
        hasMore: users.length > 3,
        myReaction: users.find(u => u.userId === payload.user?.externalId),
      }))

      const isSendByMe = msg?.senderId === payload.user?.externalId
      const isReadByMe = !!readByMe && !isSendByMe

      const user = msg.userId as any

      return {
        ...msg,
        user: {
          externalId: user?.externalId,
          name: user?.name,
          avatar: user?.avatar ?? this.serverURL.origin + '/images/default-avatar-user.jpg',
        },
        userId: msg.userId?._id,
        readByMeAt: !isSendByMe ? (readByMe?.readAt ?? null) : null,
        readByMore: moreReadByCount,
        isReadByMe,
        readBy: newestReadBys,
        reactions: processedReactions,
        isDeleted: !!msg.deletedAt,
      }
    })
  }

  async getMessagesWithoutScrollable(payload: GetMessagePayload) {
    const messages = await this.getMessages(payload)

    const filterObject: any = {
      conversationId: payload.conversationId,
      tenantId: payload.tenantId,
      deletedAt: null,
    }

    if (payload.search) {
      filterObject.$or = [{ content: { $regex: payload.search, $options: 'i' } }, { senderName: { $regex: payload.search, $options: 'i' } }]
    }

    const totalRecords = await MessageCollection.countDocuments(filterObject)
    const totalPages = Math.ceil(totalRecords / payload.limit)

    if (payload.page > totalPages && totalPages > 0) {
      throw new Error(`"page" number exceeds total pages (${totalPages})`)
    }

    return new JsonResponse({
      data: messages,
      metadata: {
        totalRecords,
        totalPages,
        page: payload.page,
        hasMore: payload.page < totalPages,
      },
    })
  }

  async getConversations(payload: GetConversationPayload) {
    const filterObject: any = {
      participants: { $in: [payload.userExternalId] },
      tenantId: payload.tenantId,
    }

    const conversationAggregates = await ConversationCollection.aggregate([
      { $match: filterObject },
      {
        $lookup: {
          from: 'users',
          let: { participantIds: '$participants' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $in: ['$externalId', '$$participantIds'] }],
                  // $and: [{ $in: ['$externalId', '$$participantIds'] }, { $ne: ['$externalId', payload.userExternalId] }],
                },
              },
            },
            {
              $project: {
                _id: 0,
                name: 1,
                avatar: 1,
                externalId: 1,
                lastSeen: 1,
                status: 1,
              },
            },
          ],
          as: 'participantUsers',
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { conversationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$conversationId', '$$conversationId'] }, { $eq: ['$deletedAt', null] }],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                content: 1,
                senderId: 1,
                senderName: 1,
                createdAt: 1,
                images: 1,
              },
            },
          ],
          as: 'lastMessage',
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { conversationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    { $ne: ['$senderId', payload.userExternalId] },
                    {
                      $not: {
                        $in: [payload.userExternalId, '$readBy.externalId'],
                      },
                    },
                    { $eq: ['$deletedAt', null] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'unreadCount',
        },
      },
      {
        $lookup: {
          from: 'messages',
          let: { conversationId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$conversationId'] },
                    {
                      $or: [{ $in: [payload.userExternalId, '$mentions'] }, { $eq: ['$mentionAll', true] }],
                    },
                    {
                      $not: {
                        $in: [payload.userExternalId, '$readBy.externalId'],
                      },
                    },
                    { $eq: ['$deletedAt', null] },
                  ],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'mentionCount',
        },
      },
      {
        $project: {
          _id: 1,
          createdAt: 1,
          participantUsers: 1,
          lastMessage: { $arrayElemAt: ['$lastMessage', 0] },
          unreadCount: {
            $ifNull: [{ $arrayElemAt: ['$unreadCount.count', 0] }, 0],
          },
          mentionCount: {
            $ifNull: [{ $arrayElemAt: ['$mentionCount.count', 0] }, 0],
          },
        },
      },
      ...(payload.unreadOnly ? [{ $match: { unreadCount: { $gt: 0 } } }] : []),
      {
        $sort: {
          'lastMessage.createdAt': -1,
          createdAt: -1,
        },
      },

      { $skip: payload.skip },
      { $limit: payload.limit },
    ])

    return conversationAggregates.map(conversation => {
      const participantUsers = (conversation.participantUsers ?? []).filter((e: any) => Object.keys(e).length > 0)
      const participantWithoutCurrentUsers = participantUsers.filter((e: any) => e?.externalId !== payload.userExternalId)

      const participantUserCount = participantUsers.filter((e: any) => e?.externalId !== payload.userExternalId)?.length || 0
      const newestParticipantUsers = participantWithoutCurrentUsers?.slice(0, 1)
      const moreParticipantUserCount = Math.max(participantUserCount - 1, 0)

      let conversationTitle = 'Không xác định'
      let conversationType: 'single' | 'group' = 'single'

      if (participantUserCount === 1) {
        conversationTitle = participantWithoutCurrentUsers[0]?.name || 'Unknown'
        conversationType = 'single'
      } else if (participantUserCount > 1) {
        conversationTitle = `${participantWithoutCurrentUsers[0]?.name} và ${moreParticipantUserCount} người khác`
        conversationType = 'group'
      }

      let lastMessagePreview = null
      if (conversation.lastMessage) {
        const msg = conversation.lastMessage
        if (msg.images && msg.images.length > 0) {
          lastMessagePreview = '📷 Hình ảnh'
        } else if (msg.content) {
          lastMessagePreview = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content
        }
      }

      return {
        _id: conversation._id,
        title: conversationTitle,
        type: conversationType,
        avatar: newestParticipantUsers[0]?.avatar ?? this.serverURL.origin + '/images/default-avatar-user.jpg',
        lastMessage: lastMessagePreview,
        lastMessageTime: conversation.lastMessage?.createdAt,
        unreadCount: conversation.unreadCount,
        mentionCount: conversation.mentionCount,
        createdAt: conversation.createdAt,
      }
    })
  }

  async getConversationsWithoutScrollable(payload: GetConversationPayload) {
    const conversations = await this.getConversations(payload)

    const filterObject: any = {
      participants: { $in: [payload.userExternalId] },
      tenantId: payload.tenantId,
    }

    const totalRecords = await ConversationCollection.countDocuments(filterObject)
    const totalPages = Math.ceil(totalRecords / payload.limit)

    if (payload.page > totalPages && totalPages > 0) {
      throw new Error(`"page" number exceeds total pages (${totalPages})`)
    }

    return new JsonResponse({
      data: conversations,
      metadata: {
        totalRecords,
        totalPages,
        page: payload.page,
        hasMore: payload.page < totalPages,
      },
    })
  }

  async deleteMessage(messageId: string, userId: number, tenantId: Types.ObjectId) {
    const message = await MessageCollection.findOne({
      _id: new Types.ObjectId(messageId),
      tenantId,
      senderId: userId,
    })

    if (!message) {
      throw new Error('Message not found or unauthorized')
    }

    message.deletedAt = new Date()
    message.deletedBy = userId
    await message.save()

    return message
  }

  async editMessage(messageId: string, userId: number, tenantId: Types.ObjectId, newContent: string) {
    const message = await MessageCollection.findOne({
      _id: new Types.ObjectId(messageId),
      tenantId,
      senderId: userId,
      deletedAt: null,
    })

    if (!message) {
      throw new Error('Message not found or unauthorized')
    }

    message.content = newContent
    await message.save()

    return message
  }
}
