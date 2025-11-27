import { Elysia } from 'elysia'

import { AppError } from '../constants/app-error.constant'
import JsonResponse from '../utils/response.util'
import logger from '../utils/logger.util'

export const onErrorHanler = (app: Elysia) => {
  return app.onError(({ request, error, set }) => {
    const responseJson = {
      ok: false,
      status: 500,
      message: error instanceof Error ? error.message : 'Internal Server Error',
      data: null,
    }

    if (error instanceof AppError) {
      responseJson.status = error.status
      responseJson.message = error.message
    } else if ((error as any).status && (error as any).message) {
      responseJson.status = (error as any).status
      responseJson.message = (error as any).message
    } else if (error instanceof Error) {
      responseJson.message = error.message
      responseJson.status = 400
    }

    logger.error(
      `[${request.method}] ${request.url} → ${responseJson.status}` +
        `\n\u001B[31m${error instanceof Error ? error.stack : 'N/A'}\u001B[0m`,
    )

    set.status = responseJson.status

    return responseJson
  })
}

export const onAfterHandler = (app: Elysia) => {
  return app.onAfterHandle(({ request, responseValue }) => {
    const appURL = new URL(request.url)

    if (!(appURL.pathname.startsWith('/api') || appURL.pathname.startsWith('/gateway'))) {
      return responseValue
    }

    if (responseValue instanceof JsonResponse) {
      return responseValue.toResponse()
    }

    const isResponseObj = responseValue && typeof responseValue === 'object'
    if (isResponseObj && 'ok' in responseValue && responseValue.ok === false) {
      return responseValue
    }

    return {
      ok: true,
      status: 200,
      message: null,
      data: responseValue,
    }
  })
}
