import { DemandeCorrectionResultatSchema } from '@circe/shared'
import { useState } from 'react'
import { apiPost } from '../../lib/api-client.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'

/** ECR-COO-04 — « Demander une correction à Broadcast · dossier n » (RG-COO-057). */
export function ModaleCorrection({
  dossierId,
  dossier,
  dejaDemandeeLe,
  onFermer,
}: {
  dossierId: number
  dossier: number
  dejaDemandeeLe: string | null
  onFermer: (message: string | null) => void
}) {
  const [note, setNote] = useState('')
  const [envoi, setEnvoi] = useState<
    { kind: 'repos' | 'en-cours' } | { kind: 'erreur'; error: unknown }
  >({ kind: 'repos' })
  async function envoyer() {
    setEnvoi({ kind: 'en-cours' })
    try {
      const r = await apiPost(`/api/coordination/dossiers/${String(dossierId)}/corrections`, {
        schema: DemandeCorrectionResultatSchema,
        body: { note },
      })
      onFermer(r.message)
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }
  return (
    <Modale
      titre={`Demander une correction à Broadcast · dossier ${String(dossier)}`}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      {dejaDemandeeLe && (
        <p className="mb-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm" role="note">
          Une demande est déjà enregistrée le{' '}
          {new Date(dejaDemandeeLe).toLocaleString('fr-FR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })}
          . Une nouvelle demande la renouvelle (le mail à la Pré-Prod est mis en file d’envoi,
          Q-409).
        </p>
      )}
      <label className="block text-sm font-medium">
        Qu’y a-t-il à corriger ?
        <textarea
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
          }}
        />
      </label>
      {envoi.kind === 'erreur' && (
        <div className="mt-2">
          <ErrorMessage error={envoi.error} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            onFermer(null)
          }}
        >
          Annuler
        </button>
        <Button type="button" disabled={envoi.kind === 'en-cours'} onClick={() => void envoyer()}>
          Envoyer la demande
        </Button>
      </div>
    </Modale>
  )
}
