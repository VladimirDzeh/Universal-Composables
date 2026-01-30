import { computed, ref, shallowRef, unref } from 'vue'
import type { ComputedRef, Ref } from 'vue'

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export type QueryParams = Record<string, string | number | boolean | null | undefined>

export type UseHttpOptions = {
  url: string
  method?: HttpMethod
  headers?: Record<string, string>
  body?: unknown
  query?: QueryParams
  credentials?: RequestCredentials
  signal?: AbortSignal | null
  immediate?: boolean
}

export type HttpResult<TData> = {
  data: TData | null
  status: number | null
  error: unknown
}

const buildQueryString = (query?: QueryParams) => {
  if (!query) return ''

  const params = new URLSearchParams()

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined) return
    params.append(key, String(value))
  })

  const queryString = params.toString()
  return queryString ? `?${queryString}` : ''
}

const withQuery = (url: string, query?: QueryParams) => {
  const queryString = buildQueryString(query)
  if (!queryString) return url
  return url.includes('?') ? `${url}&${queryString.slice(1)}` : `${url}${queryString}`
}

const resolveBody = (
  body: unknown,
  headers: Record<string, string>
) => {
  if (!body) return undefined
  if (body instanceof FormData) return body
  if (typeof body === 'string') return body

  headers['Content-Type'] = headers['Content-Type'] ?? 'application/json'
  return JSON.stringify(body)
}

const parseResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return response.json()
  return response.text()
}

export const useHttp = <TData = unknown>(options: MaybeRef<UseHttpOptions>) => {
  const resolveOptions = () => unref(options) as UseHttpOptions
  const data = shallowRef<TData | null>(null)
  const error = ref<unknown>(null)
  const status = ref<number | null>(null)
  const isLoading = ref(false)

  const isSuccess = computed(
    () => status.value !== null && status.value >= 200 && status.value < 300
  )

  const isError = computed(() => error.value !== null)

  const execute = async (
    override?: Partial<UseHttpOptions>
  ): Promise<HttpResult<TData>> => {
    const base = resolveOptions()
    const request = { ...base, ...override }
    const headers = { ...(request.headers ?? {}) }

    const finalUrl = withQuery(request.url, request.query)

    isLoading.value = true
    error.value = null
    status.value = null

    try {
      const response = await fetch(finalUrl, {
        method: request.method ?? 'GET',
        headers,
        body: resolveBody(request.body, headers),
        credentials: request.credentials,
        signal: request.signal ?? undefined
      })

      status.value = response.status
      const payload = (await parseResponse(response)) as TData
      data.value = payload

      if (!response.ok) {
        error.value = {
          status: response.status,
          data: payload
        }
      }
    } catch (err) {
      error.value = err
    } finally {
      isLoading.value = false
    }

    return {
      data: data.value,
      status: status.value,
      error: error.value
    }
  }

  const isReady = computed(() => !isLoading.value && status.value !== null)

  const initialOptions = resolveOptions()

  if (initialOptions.immediate) execute()

  return {
    data,
    error,
    status,
    isLoading,
    isSuccess,
    isError,
    isReady,
    execute
  }
}
