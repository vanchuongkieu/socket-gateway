import { Schema, model } from 'mongoose'
import { IConversation } from '../types/conversation.type'

const ConversationCollection = new Schema<IConversation>(
  {
    participants: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr: number[]) => arr.length > 0,
        message: 'Participants array cannot be empty',
      },
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
    },
    externalId: {
      type: Number,
      required: false,
      unique: true,
      sparse: true,
    },
  },
  { timestamps: true },
)

export default model<IConversation>('Conversation', ConversationCollection)
