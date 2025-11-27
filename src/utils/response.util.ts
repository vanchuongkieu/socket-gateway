import { IResponse } from '../types/response.type'

class JsonResponse {
  responseContext: IResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    message: null,
    data: null,
    metadata: undefined,
  }
  constructor(context: IResponse) {
    this.responseContext = { ...this.responseContext, ...context }
  }

  toResponse() {
    return this.responseContext
  }
}

export default JsonResponse
