import { Schema, model } from 'mongoose'
import { IMessage } from '../types/message.type'

const MessageCollection = new Schema<IMessage>(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Conversation',
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'Tenant',
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    senderName: { type: String, required: true },
    senderId: { type: Number, required: true, index: true },
    content: { type: String },
    images: { type: [String], default: [] },
    mentions: {
      type: [Number],
      default: [],
      index: true,
    },
    mentionAll: {
      type: Boolean,
      default: false,
      index: true,
    },
    replyTo: {
      messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
      content: String,
      senderName: String,
    },
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        externalId: { type: Number, required: true },
        readAt: { type: Date, default: Date.now },
      },
    ],
    reactions: [
      {
        userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
        externalId: { type: Number, required: true },
        emoji: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'failed'],
      default: 'sent',
    },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Number, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
  },
)

export default model<IMessage>('Message', MessageCollection)
