import { Elysia } from 'elysia'

import ConversationService from '../../services/conversation.service'
import { authTenantMiddleware } from '../../middlewares/auth.middleware'
import { getUserConversationSchema } from '../../schemas/conversation.schema'

export const conversationRouter = new Elysia({
  prefix: '/:tenantCode/conversation',
})
  .derive(authTenantMiddleware)
  .post(
    '/items',
    async ({ body, user, tenant, request }) => {
      const page = body?.page ?? 1
      const limit = body?.limit ?? 5
      const skip = (page - 1) * limit

      const messageService = new ConversationService(request)

      if (body?.cid) {
        const conversationId = await messageService.conversationExists(body?.cid)
        const messagePayload = {
          limit,
          skip,
          page,
          user,
          conversationId,
          tenantId: tenant._id,
          search: body?.search,
          beforeDate: body?.beforeDate,
          afterDate: body?.afterDate,
        }
        if (body?.scrollable) return messageService.getMessages(messagePayload)
        return messageService.getMessagesWithoutScrollable(messagePayload)
      }

      const conversationPayload = {
        userExternalId: user.externalId,
        tenantId: tenant._id,
        limit,
        skip,
        page,
        search: body?.search,
        unreadOnly: body?.unreadOnly,
      }
      if (body?.scrollable) return messageService.getConversations(conversationPayload)
      return messageService.getConversationsWithoutScrollable(conversationPayload)
    },
    {
      body: getUserConversationSchema,
    },
  )
