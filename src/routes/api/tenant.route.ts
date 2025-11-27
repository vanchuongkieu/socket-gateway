import { Elysia } from 'elysia'

import { createTenantSchema } from '../../schemas/tenant.schema'

import TenantService from '../../services/tenant.service'

const tenantService = new TenantService()

export const tenantRouter = new Elysia({
  prefix: '/tenant',
})
  .post(
    '/new',
    async ({ body }) => {
      const tenantInstance = await tenantService.createNew(body)
      return {
        id: tenantInstance._id.toString(),
        code: tenantInstance.code,
        secretKey: tenantInstance.secretKey,
      }
    },
    { body: createTenantSchema },
  )
  .get('/items', async () => {
    return tenantService.getTenants()
  })
