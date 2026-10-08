import { timingSafeEqual } from 'node:crypto'

export function safeWorkerSecret(request: Request) {
  const expected = process.env.WORKER_SECRET || ''
  const received = request.headers.get('x-worker-secret') || ''
  if (!expected || !received) return false
  const left = Buffer.from(expected)
  const right = Buffer.from(received)
  return left.length === right.length && timingSafeEqual(left, right)
}
