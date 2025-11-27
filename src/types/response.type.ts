export interface IResponse<T = unknown> {
  ok?: boolean
  status?: number
  statusText?: string
  message?: string | null
  data?: T
  metadata?: Record<string, any>
}
