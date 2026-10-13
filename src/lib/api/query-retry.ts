import { ApiError, ApiResponseError } from './errors';
/** Retry a transient read once; invalid contracts and permanent client errors need correction. */
export function retryApiRead(failureCount: number, error: Error): boolean {
  return (
    !(error instanceof ApiResponseError) &&
    !(error instanceof ApiError && error.status < 500) &&
    error.name !== 'AbortError' &&
    failureCount < 1
  );
}
