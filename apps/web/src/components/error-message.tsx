import { ApiError } from '../lib/api-client.ts'
import { describeError } from '../lib/error-text.ts'
import { Button } from './button.tsx'

interface ErrorMessageProps {
  error: unknown
  onRetry?: () => void
}

/** Affichage normalisé d'une erreur d'API : titre selon le statut, message serveur, règle violée. */
export function ErrorMessage({ error, onRetry }: ErrorMessageProps) {
  const apiError =
    error instanceof ApiError
      ? error
      : new ApiError(0, { code: 'ERREUR', message: 'Erreur inattendue' })
  const { titre, conseil } = describeError(apiError)
  return (
    <div
      role="alert"
      data-testid="error-message"
      className="rounded-md border border-red-200 bg-red-50 p-3"
    >
      <p className="font-medium text-red-800">{titre}</p>
      <p className="text-sm text-red-700">{apiError.body.message}</p>
      {conseil && <p className="mt-1 text-sm text-red-700">{conseil}</p>}
      {erreursChamps(apiError.body.details).length > 0 && (
        <ul className="mt-1 list-disc pl-5 text-sm text-red-700" data-testid="error-champs">
          {erreursChamps(apiError.body.details).map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
      {apiError.body.regle && (
        <p className="mt-1 text-xs text-red-600" data-testid="error-regle">
          Règle : {apiError.body.regle}
        </p>
      )}
      {onRetry && (
        <Button className="mt-3" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  )
}

/** Messages des champs refusés par la validation (400 : liste d'anomalies Zod `details[].message`). */
function erreursChamps(details: unknown): string[] {
  if (!Array.isArray(details)) return []
  const messages = details.flatMap((d: unknown) =>
    typeof d === 'object' && d !== null && 'message' in d && typeof d.message === 'string'
      ? [d.message]
      : [],
  )
  return [...new Set(messages)].slice(0, 5)
}
