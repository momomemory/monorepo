export type ErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "internal_error"
  | "not_implemented";

export class MomoError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly path?: string;
  readonly method?: string;

  constructor(opts: {
    status: number;
    code: ErrorCode;
    message: string;
    path?: string;
    method?: string;
  }) {
    super(opts.message);
    this.name = "MomoError";
    this.status = opts.status;
    this.code = opts.code;
    this.path = opts.path;
    this.method = opts.method;
  }
}
