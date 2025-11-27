export class AppError extends Error {
  public code: string
  public status: number

  constructor(message: string, code = 'APP_ERROR', status = 500) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}
