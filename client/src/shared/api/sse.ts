import type { StreamEvent, PlaceMarker } from '@/shared/types/chat'

export interface SSEStreamOptions {
  onChunk?: (content: string) => void
  onDone?: (event: StreamEvent) => void
  onError?: (message: string, event?: StreamEvent) => void
  onPlaces?: (places: PlaceMarker[], event: StreamEvent) => void
  signal?: AbortSignal
}

export function streamChat(
  url: string,
  body: unknown,
  options: SSEStreamOptions,
): { abort: () => void } {
  const controller = new AbortController()
  const signal = controller.signal

  // Allow external stop via the signal passed in options
  const combinedSignal = options.signal
    ? combineSignals(options.signal, signal)
    : signal

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
    signal: combinedSignal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        options.onError?.(errData?.message || `请求失败 (${response.status})`)
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        options.onError?.('无法读取数据流')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue

          const data = trimmed.slice(6)
          try {
            const event: StreamEvent = JSON.parse(data)

            switch (event.type) {
              case 'chunk':
                if (event.content) options.onChunk?.(event.content)
                break
              case 'places':
                if (event.places && event.places.length > 0) {
                  options.onPlaces?.(event.places, event)
                }
                break
              case 'done':
                options.onDone?.(event)
                break
              case 'error':
                options.onError?.(event.message || '未知错误', event)
                break
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    })
    .catch((err: Error) => {
      if (err.name === 'AbortError') {
        // Intentional abort — don't treat as error
        return
      }
      options.onError?.(err.message || '网络异常')
    })

  return { abort: () => controller.abort() }
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      return signal
    }
    signal.addEventListener(
      'abort',
      () => controller.abort(signal.reason),
      { once: true },
    )
  }
  return controller.signal
}
