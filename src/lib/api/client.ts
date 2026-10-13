import { z } from 'zod';
import { ApiError, ApiResponseError } from './errors';
import { apiErrorSchema } from './error-schema';
export async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok)
      throw new ApiError(response.status, 'HTTP_ERROR', 'The request failed.');
    throw new ApiResponseError('The API returned invalid JSON.');
  }
  if (!response.ok) {
    const error = apiErrorSchema.safeParse(body);
    if (error.success)
      throw new ApiError(
        response.status,
        error.data.error.code,
        error.data.error.message,
        error.data.error.issues,
      );
    throw new ApiError(response.status, 'HTTP_ERROR', 'The request failed.');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiResponseError('The API response does not match its contract.');
  return parsed.data;
}
