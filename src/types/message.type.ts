import { Types } from 'mongoose'

export type MessageEvents =
  | 'message.send'
  | 'message.read'
  | 'message.delete'
  | 'message.edit'
  | 'message.react'
  | 'typing.start'
  | 'typing.stop'
  | 'conversation.create'
  | 'conversation.join'
  | 'conversation.leave'
  | 'user.update'
  | 'ping'

export interface IClientDataPayload {
  senderId?: number
  senderName?: string
  senderAvatar?: string
  recipientIds?: number[]
  recipientId?: number | null
  conversationId: string | null
  content?: string
  images?: string[]
  mentions?: number[]
  mentionAll?: boolean
  replyTo?: {
    messageId: string
    content: string
    senderName: string
  }
  messageId?: string
  emoji?: string
  timestamp?: number
  [x: string]: any
}

export interface IClientPayload {
  event: MessageEvents
  data: IClientDataPayload
  [x: string]: any
}

export interface IMessageReaction {
  userId: Types.ObjectId
  externalId: number
  emoji: string
  createdAt: Date
}

export interface IMessageReadBy {
  userId: Types.ObjectId
  externalId: number
  readAt: Date
}

export interface IMessageReply {
  messageId: Types.ObjectId
  content: string
  senderName: string
}

export interface IMessage {
  _id?: Types.ObjectId
  conversationId: Types.ObjectId
  tenantId: Types.ObjectId
  userId: Types.ObjectId
  senderName: string
  senderId: number
  content?: string
  images?: string[]
  mentions?: number[]
  mentionAll?: boolean
  replyTo?: IMessageReply
  readBy?: IMessageReadBy[]
  reactions?: IMessageReaction[]
  status?: 'sent' | 'delivered' | 'read' | 'failed'
  deletedAt?: Date | null
  deletedBy?: number | null
  createdAt?: Date
  updatedAt?: Date
  readByMe?: boolean
  readByMeAt?: Date | null
  readByMore?: number
  isDeleted?: boolean
  [x: string]: any
}
