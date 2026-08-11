const BASE_URL = (() => { const u = process.env.TEST_BASE_URL; if (!u) throw new Error('TEST_BASE_URL env var is required'); return u })()

interface RequestOptions {
  headers?: Record<string, string>
  query?: Record<string, string>
}

interface ResponseData {
  status: number
  body: unknown
}

function buildUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(path, BASE_URL)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }

  return url.toString()
}

export async function get(
  path: string,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path, options?.query)

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    credentials: 'include'
  })

  let body: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    body = await response.json()
  } else {
    body = await response.text()
  }

  return {
    status: response.status,
    body
  }
}

export async function patch(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path)

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: JSON.stringify(body),
    credentials: 'include'
  })

  let responseBody: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    responseBody = await response.json()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody
  }
}

export async function post(
  path: string,
  body: unknown,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    body: JSON.stringify(body),
    credentials: 'include'
  })

  let responseBody: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    responseBody = await response.json()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody
  }
}

export async function del(
  path: string,
  options?: RequestOptions
): Promise<ResponseData> {
  const url = buildUrl(path)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    },
    credentials: 'include'
  })

  let responseBody: unknown
  const contentType = response.headers.get('content-type')

  if (contentType?.includes('application/json')) {
    responseBody = await response.json()
  } else {
    responseBody = await response.text()
  }

  return {
    status: response.status,
    body: responseBody
  }
}