import { t } from 'elysia'

export const getUserConversationSchema = t.Object(
  {
    uid: t.Number({
      minimum: 1,
      error: '"uid" must not be empty',
    }),
    sid: t.String({
      minLength: 1,
      error: '"sid" must not be empty',
    }),
    cid: t.Optional(t.String()),
    page: t.Optional(
      t.Number({
        minimum: 1,
        error: '"page" must be at least 1',
      }),
    ),
    limit: t.Optional(
      t.Number({
        minimum: 1,
        error: '"limit" must be at least 1',
      }),
    ),
    scrollable: t.Optional(t.Boolean({ default: true })),
    search: t.Optional(t.String()),
    unreadOnly: t.Optional(t.Boolean()),
    beforeDate: t.Optional(t.Date()),
    afterDate: t.Optional(t.Date()),
  },
  {
    description: 'Schema for get conversation for user tenant',
  },
)
