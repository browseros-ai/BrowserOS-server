/**
 * @license
 * Copyright 2025 BrowserOS
 */

import { isUtf8 } from 'node:buffer'
import { CONTENT_LIMITS } from '@browseros/shared/limits'

import type { HTTPRequest, HTTPResponse } from 'puppeteer-core'

export function getShortDescriptionForRequest(request: HTTPRequest): string {
  return `${request.url()} ${request.method()} ${getStatusFromRequest(request)}`
}

export function getStatusFromRequest(request: HTTPRequest): string {
  const httpResponse = request.response()
  const failure = request.failure()
  let status: string
  if (httpResponse) {
    const responseStatus = httpResponse.status()
    status =
      responseStatus >= 200 && responseStatus <= 299
        ? `[success - ${responseStatus}]`
        : `[failed - ${responseStatus}]`
  } else if (failure) {
    status = `[failed - ${failure.errorText}]`
  } else {
    status = '[pending]'
  }
  return status
}

export function getFormattedHeaderValue(
  headers: Record<string, string>,
): string[] {
  const response: string[] = []
  for (const [name, value] of Object.entries(headers)) {
    response.push(`- ${name}:${value}`)
  }
  return response
}

export async function getFormattedResponseBody(
  httpResponse: HTTPResponse,
  sizeLimit = CONTENT_LIMITS.BODY_CONTEXT_SIZE,
): Promise<string | undefined> {
  try {
    const responseBuffer = await httpResponse.buffer()

    if (isUtf8(responseBuffer)) {
      const responseAsTest = responseBuffer.toString('utf-8')

      if (responseAsTest.length === 0) {
        return `<empty response>`
      }

      return `${getSizeLimitedString(responseAsTest, sizeLimit)}`
    }

    return `<binary data>`
  } catch {
    // buffer() call might fail with CDP exception, in this case we don't print anything in the context
    return
  }
}

export async function getFormattedRequestBody(
  httpRequest: HTTPRequest,
  sizeLimit: number = CONTENT_LIMITS.BODY_CONTEXT_SIZE,
): Promise<string | undefined> {
  if (httpRequest.hasPostData()) {
    const data = httpRequest.postData()

    if (data) {
      return `${getSizeLimitedString(data, sizeLimit)}`
    }

    try {
      const fetchData = await httpRequest.fetchPostData()

      if (fetchData) {
        return `${getSizeLimitedString(fetchData, sizeLimit)}`
      }
    } catch {
      // fetchPostData() call might fail with CDP exception, in this case we don't print anything in the context
      return
    }
  }

  return
}

function getSizeLimitedString(text: string, sizeLimit: number) {
  if (text.length > sizeLimit) {
    return `${`${text.substring(0, sizeLimit)}... <truncated>`}`
  }

  return `${text}`
}
