import {
  DoutesAConfirmerSchema,
  ValiderSelectionResultatSchema,
  type ValiderSelection,
} from '@circe/shared'
import { useState } from 'react'
import type { z } from 'zod'
import { ApiError, apiPost } from '../../lib/api-client.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { MOTIF_DOUTE } from './libelles.ts'

type Doutes = z.infer<typeof DoutesAConfirmerSchema>

// RG-COO-010 / 012 / 013 : « Valider la sélection » / « Valider (n affiches) ». Si la sélection contient
// des doutes, le serveur refuse (422 RG-COO-012) et renvoie la liste : la modale ECR-COO-03 demande une
// confirmation explicite. Seuls les doutes AFFICHÉS (id + version) sont confirmés.
export function useValiderSelection(onSucces: (message: string) => void) {
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<unknown>(null)
  const [modale, setModale] = useState<{
    dossierIds: number[]
    afficheIds?: number[]
    doutes: Doutes
  } | null>(null)

  async function envoyer(body: Partial<ValiderSelection> & { dossierIds: number[] }) {
    setErreur(null)
    setEnvoi(true)
    try {
      const r = await apiPost('/api/coordination/validation-admin', {
        schema: ValiderSelectionResultatSchema,
        body,
      })
      setModale(null)
      onSucces(r.message)
    } catch (e) {
      const doutes =
        e instanceof ApiError && e.body.code === 'COO_DOUTES_A_CONFIRMER'
          ? DoutesAConfirmerSchema.safeParse(e.body.details)
          : null
      if (doutes?.success)
        setModale({ dossierIds: body.dossierIds, afficheIds: body.afficheIds, doutes: doutes.data })
      else setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  const element = modale && (
    <Modale
      titre="Confirmer aussi les affiches à doute ?"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) setModale(null)
      }}
    >
      <p className="text-sm">
        {modale.doutes.sansDoute} affiche(s) sans doute et {modale.doutes.doutes.length} affiche(s)
        à doute sont dans la sélection. Rien n’est validé sans vous : les doutes se confirment après
        vérification du motif.
      </p>
      <ul className="mt-3 space-y-1 text-sm" aria-label="Affiches à doute">
        {modale.doutes.doutes.map((a) => (
          <li key={`${String(a.dossier)}-${String(a.id)}`}>
            <b className="font-mono">{a.id}</b> · « {a.theme ?? '—'} » (dossier {a.dossier}) :{' '}
            {a.motifs.map((m) => MOTIF_DOUTE[m] ?? m).join(' ; ')}
          </li>
        ))}
      </ul>
      {erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={erreur} />
        </div>
      )}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          className="text-sm underline"
          onClick={() => {
            setModale(null)
          }}
        >
          Annuler
        </button>
        {modale.doutes.sansDoute > 0 && (
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            disabled={envoi}
            onClick={() =>
              void envoyer({
                dossierIds: modale.dossierIds,
                afficheIds: modale.afficheIds,
                sansDouteSeulement: true,
              })
            }
          >
            Confirmer les {modale.doutes.sansDoute} sans doute seulement
          </button>
        )}
        <Button
          type="button"
          disabled={envoi}
          onClick={() =>
            void envoyer({
              dossierIds: modale.dossierIds,
              afficheIds: modale.afficheIds,
              confirmerDoutes: true,
              doutes: modale.doutes.doutes.map((a) => ({ id: a.id, version: a.version })),
            })
          }
        >
          Confirmer tout ({modale.doutes.sansDoute + modale.doutes.doutes.length})
        </Button>
      </div>
    </Modale>
  )

  return {
    valider: (dossierIds: number[]) => envoyer({ dossierIds }),
    validerAffiches: (afficheIds: number[]) => envoyer({ dossierIds: [], afficheIds }),
    envoi,
    erreur: modale ? null : erreur,
    modale: element,
  }
}
