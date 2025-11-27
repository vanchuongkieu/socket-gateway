import { Schema, model } from 'mongoose'
import { IUser } from '../types/user.type'

const UserCollection = new Schema<IUser>(
  {
    name: { type: String, required: true },
    avatar: { type: String, required: false },
    externalId: { type: Number, required: true, index: true },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['online', 'offline', 'away', 'busy'],
      default: 'offline',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
      index: true,
    },
    settings: {
      notifications: {
        mentions: { type: Boolean, default: true },
        messages: { type: Boolean, default: true },
        sound: { type: Boolean, default: true },
      },
      privacy: {
        showLastSeen: { type: Boolean, default: true },
        showOnlineStatus: { type: Boolean, default: true },
      },
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

UserCollection.virtual('isOnline').get(function () {
  if (!this.lastSeen) return false
  return Date.now() - this.lastSeen.getTime() < 5 * 60 * 1000 // 5 minutes
})

export default model<IUser>('User', UserCollection)
