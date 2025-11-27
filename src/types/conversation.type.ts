import { Document, Types } from 'mongoose'

export interface IConversation extends Document {
  tenantId: Types.ObjectId
  participants: number[]
  externalId?: number
  createdAt?: Date
  updatedAt?: Date
}
