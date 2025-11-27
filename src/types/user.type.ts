import { Document, Types } from 'mongoose'

export interface IUserSettings {
  notifications: {
    mentions: boolean
    messages: boolean
    sound: boolean
  }
  privacy: {
    showLastSeen: boolean
    showOnlineStatus: boolean
  }
}

export interface IUser extends Document {
  _id: Types.ObjectId
  name: string
  avatar?: string
  externalId: number
  tenantId: Types.ObjectId
  status?: 'online' | 'offline' | 'away' | 'busy'
  lastSeen?: Date
  settings?: IUserSettings
  metadata?: Map<string, any>
  createdAt?: Date
  updatedAt?: Date
  isOnline?: boolean
}

export interface IUserResponse {
  id: string
  name: string
  avatar?: string
  externalId: number
  status?: string
  lastSeen?: Date
  isOnline?: boolean
}
