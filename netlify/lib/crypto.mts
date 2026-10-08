import { createCipheriv, createDecipheriv, createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'

function requiredSecret(name: string) {
  const value = process.env[name]
  if (!value || value.length < 32) throw new Error(`Missing server configuration: ${name} must contain at least 32 characters.`)
  return value
}

export function encryptToken(token: string) {
  const key = createHash('sha256').update(requiredSecret('GMAIL_TOKEN_ENCRYPTION_KEY')).digest()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}

export function decryptToken(value: { ciphertext: string; iv: string; tag: string }) {
  const key = createHash('sha256').update(requiredSecret('GMAIL_TOKEN_ENCRYPTION_KEY')).digest()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(value.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, 'base64')), decipher.final()]).toString('utf8')
}

export function signState(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', requiredSecret('GMAIL_STATE_SECRET')).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyState<T>(state: string): T {
  const [encoded, signature, extra] = state.split('.')
  if (!encoded || !signature || extra) throw new Error('Gmail authorization state is invalid. Start the connection again.')
  const expected = createHmac('sha256', requiredSecret('GMAIL_STATE_SECRET')).update(encoded).digest()
  const received = Buffer.from(signature, 'base64url')
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error('Gmail authorization state is invalid. Start the connection again.')
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as T & { expiresAt?: number }
  if (!payload.expiresAt || payload.expiresAt < Date.now()) throw new Error('Gmail authorization expired. Start the connection again.')
  return payload
}
