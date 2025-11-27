import { Schema, model } from 'mongoose'

import { ITenant } from '../types/tenant.type'
import { generateSecretKey } from '../utils/generate.util'

const TenantCollection = new Schema<ITenant>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    secretKey: { type: String, required: false, unique: true },
    isActive: { type: Boolean, required: false, default: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

TenantCollection.pre('save', async function (next) {
  if (!this.secretKey) {
    let secretKey: string
    let secretKeyExists: any = null

    do {
      secretKey = await generateSecretKey()
      secretKeyExists = await model('Tenant').findOne({ secretKey })
    } while (secretKeyExists)

    this.secretKey = secretKey
  }
  next()
})

export default model<ITenant>('Tenant', TenantCollection)
