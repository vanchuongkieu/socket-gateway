import { t } from 'elysia'

export const createTenantSchema = t.Object(
  {
    code: t.String({
      minLength: 1,
      error: 'Tenant code must not be empty',
    }),
    name: t.String({
      minLength: 1,
      error: 'Tenant name must not be empty',
    }),
  },
  {
    description: 'Schema for creating a tenant',
  },
)
export const getTenantSchema = t.Object(
  {
    sid: t.String({
      minLength: 1,
      error: '"sid" must not be empty',
    }),
  },
  {
    description: 'Schema for get a tenant',
  },
)
