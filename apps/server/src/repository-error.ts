// The house Result-error shape (`docs/CONVENTIONS.md` §Error Handling) every `@moe/core`
// repository error independently conforms to — shared here since `handle-inbound-message.ts` and
// `check-cost-cap.ts` both format `HistoryStore`/`CostStore`/`CapStore` errors the same way,
// rather than naming one repository's own error type or duplicating the formatter per module.
export type RepositoryError =
  | { readonly kind: 'validation-failed'; readonly issues: string }
  | { readonly kind: 'unknown'; readonly cause: unknown };

export function repositoryErrorMessage(error: RepositoryError): string {
  return error.kind === 'validation-failed'
    ? error.issues
    : String(error.cause);
}
