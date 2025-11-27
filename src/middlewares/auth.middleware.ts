import TenantCollection from '../models/tenant.model'
import UserCollection from '../models/user.model'

export const authTenantMiddleware = async ({ body, params }: any) => {
  const payload = {
    uid: body?.uid,
    sid: body?.sid,
    code: params?.tenantCode,
  }
  if (!payload.uid) throw new Error('Missing "uid" in query parameters')
  if (!payload.code || !payload.sid) throw new Error('Missing "code" in params or "sid" in query')

  const tenantInstance = await TenantCollection.findOne({ tenantCode: payload.code, secretKey: payload.sid })
  if (!tenantInstance) throw new Error('Invalid "code" or "sid"')

  const userInstance = await UserCollection.findOne({ externalId: payload.uid, tenantId: tenantInstance._id })
  if (!userInstance) throw new Error('Invalid "uid"')

  return {
    user: userInstance,
    tenant: tenantInstance,
  }
}

export const onVerifySecretKey = async (secretKey?: string) => {
  if (!secretKey) throw new Error('Missing "sid" in query parameters')
  const secretKeyExists = await TenantCollection.exists({ secretKey })
  if (!secretKeyExists) throw new Error('Invalid "sid"')
}
