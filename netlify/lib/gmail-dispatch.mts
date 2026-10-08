export type DispatchResult =
  | { kind: 'response'; response: Response; accessToken: string }
  | { kind: 'refresh_failed'; error: unknown }
  | { kind: 'ambiguous'; error: unknown }

export async function dispatchWithRefresh(
  initialAccessToken: string,
  send: (accessToken: string) => Promise<Response>,
  refresh: () => Promise<string>,
): Promise<DispatchResult> {
  let response: Response
  try {
    response = await send(initialAccessToken)
  } catch (error) {
    return { kind: 'ambiguous', error }
  }

  if (response.status !== 401) return { kind: 'response', response, accessToken: initialAccessToken }

  let accessToken: string
  try {
    accessToken = await refresh()
  } catch (error) {
    return { kind: 'refresh_failed', error }
  }

  try {
    response = await send(accessToken)
  } catch (error) {
    return { kind: 'ambiguous', error }
  }

  return { kind: 'response', response, accessToken }
}
