export const generateSecretKey = async () => {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)

  const randomPart = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  const uuid = crypto.randomUUID()

  const encoder = new TextEncoder()
  const data = encoder.encode(uuid + randomPart)

  return crypto.subtle.digest('SHA-256', data).then(buffer => {
    const bytes = new Uint8Array(buffer)
    const b64 = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
    return b64
  })
}
