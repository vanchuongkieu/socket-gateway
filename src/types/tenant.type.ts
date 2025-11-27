import { Document } from 'mongoose'

export interface ITenant extends Document {
  name: string
  code: string
  secretKey?: string
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}

export interface NewTenantBody {
  name: string
  code: string
}
