export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues: ReadonlyArray<{
      path: string;
      message: string;
    }> = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export class ApiResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiResponseError';
  }
}
