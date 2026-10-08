// Gateway/server failures may arrive after the server accepted a candidature.
// Only explicit client/authentication rejections prove that a new submission can be allowed.
export function isDefinitiveSubmissionRejection(status: unknown): boolean {
  return typeof status === 'number' && status >= 400 && status < 500;
}
