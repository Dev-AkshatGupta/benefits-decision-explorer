import { describe, expect, it } from 'vitest';
import { ApiError, ApiResponseError } from './errors';
import { retryApiRead } from './query-retry';
describe('API read retry policy', () => {
  it.each([400, 404, 409, 422])(
    'does not repeat permanent %s responses',
    (status) => {
      expect(
        retryApiRead(
          0,
          new ApiError(status, 'INVALID_REQUEST', 'Correct the request.'),
        ),
      ).toBe(false);
    },
  );
  it('does not retry malformed contracts or canceled reads', () => {
    expect(retryApiRead(0, new ApiResponseError('Invalid contract'))).toBe(
      false,
    );
    expect(retryApiRead(0, new DOMException('Canceled', 'AbortError'))).toBe(
      false,
    );
  });
  it.each([
    new TypeError('Failed to fetch'),
    new ApiError(503, 'HTTP_ERROR', 'Unavailable'),
  ])('retries transient reads once', (error) => {
    expect(retryApiRead(0, error)).toBe(true);
    expect(retryApiRead(1, error)).toBe(false);
  });
});
