export type EligibilityErrorCode =
  | 'INVALID_CONTEXT'
  | 'MALFORMED_POLICY'
  | 'UNSUPPORTED_OPERATOR'
  | 'AMBIGUOUS_POLICY_VERSION'
  | 'POLICY_NOT_APPLICABLE';
export class EligibilityEngineError extends Error {
  constructor(
    public readonly code: EligibilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'EligibilityEngineError';
  }
}
