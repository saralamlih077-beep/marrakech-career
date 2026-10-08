// Gateway/server failures may arrive after the server accepted a candidature.
// Client rejections or an explicit server proof of failure before dispatch allow a new submission.
export function isDefinitiveSubmissionRejection(status: unknown, submissionAccepted?: unknown): boolean {
  return typeof status === 'number' && (
    (status >= 400 && status < 500)
    || (status >= 500 && status < 600 && submissionAccepted === false)
  );
}
