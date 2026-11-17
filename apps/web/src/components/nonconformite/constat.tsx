import { lireBase64 } from '../reception/bon-livraison.tsx'
import { useState, useRef, useEffect } from 'react'
import { NcSchema, type ConstatNc } from '@circe/shared'
import { ChoixPortee } from './ecrans.tsx'
import { apiPost } from '../../lib/api-client.ts'
import { Button } from '../button.tsx'
import { Modale } from '../ui/modale.tsx'
import { ErrorMessage } from '../error-message.tsx'
export function SaisieConstat({
  value,
  onChange,
}: {
  value: ConstatNc
  onChange: (v: ConstatNc) => void
}) {
  const dernier = useRef(value)
  useEffect(() => {
    dernier.current = value
  }, [value])
  const [erreur, setErreur] = useState<unknown>(null)
  return (
    <div className="space-y-4">
      <ChoixPortee
        types={value.types}
        bloquante={value.bloquante}
        onTypes={(types) => {
          onChange({ ...value, types: types as ConstatNc['types'] })
        }}
        onPortee={(bloquante) => {
          onChange({ ...value, bloquante })
        }}
      />
      <label className="block text-sm font-medium">
        Commentaire de non-conformité
        <textarea
          className="mt-1 w-full rounded border p-3"
          rows={4}
          value={value.commentaire}
          onChange={(e) => {
            onChange({ ...value, commentaire: e.target.value })
          }}
        />
      </label>
      <label className="block">
        Prendre ou joindre une photo de preuve (facultatif)
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? [])
            e.target.value = ''
            setErreur(null)
            void Promise.all(
              fs.map(async (f) => {
                if (f.size > 10 * 1024 * 1024) throw new Error('Photo supérieure à 10 Mo.')
                return { nom: f.name, mimeType: f.type, contenuBase64: await lireBase64(f) }
              }),
            )
              .then((fs) => {
                if ((dernier.current.fichiers?.length ?? 0) + fs.length > 10)
                  throw new Error('Maximum 10 photos.')
                onChange({
                  ...dernier.current,
                  fichiers: [...(dernier.current.fichiers ?? []), ...fs],
                })
              })
              .catch(setErreur)
          }}
        />
      </label>
      <ul>
        {value.fichiers?.map((f, i) => (
          <li key={i}>
            {f.nom}{' '}
            <button
              type="button"
              className="underline"
              onClick={() => {
                onChange({ ...value, fichiers: value.fichiers?.filter((_, j) => j !== i) })
              }}
            >
              Retirer
            </button>
          </li>
        ))}
      </ul>
      {erreur !== null && <ErrorMessage error={erreur} />}
    </div>
  )
}
export function DeclarerConstat({
  receptionId,
  plateformeId,
  affiches,
  onDeclaree,
}: {
  receptionId: number
  plateformeId: number
  affiches: {
    id: number
    annonceur: string | null
    theme: string | null
    dossier?: number | null
  }[]
  onDeclaree?: () => void
}) {
  const [ouverte, setOuverte] = useState(false),
    [constat, setConstat] = useState<ConstatNc>({ types: [], bloquante: null, commentaire: '' }),
    [selection, setSelection] = useState(affiches.map((a) => a.id)),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [message, setMessage] = useState('')
  async function declarer() {
    setEnvoi(true)
    setErreur(null)
    const prises = affiches.filter((a) => selection.includes(a.id))
    try {
      const n = await apiPost('/api/non-conformites', {
        schema: NcSchema,
        body: {
          fichiers: constat.fichiers ?? [],
          type: 'RECEPTION',
          plateformeId,
          receptionId,
          afficheIds: selection,
          bloquante: constat.bloquante,
          donnees: {
            types: constat.types,
            annonceur: prises.map((a) => a.annonceur || 'Non lisible').join(' / '),
            theme: prises.map((a) => a.theme || 'À identifier').join(' / '),
            dossier: prises.flatMap((a) => (a.dossier ? [a.dossier] : [])).join(' / '),
            commentaireNC: constat.commentaire,
          },
        },
      })
      setMessage(`NC n° ${n.id} · ${n.statut}`)
      setOuverte(false)
      onDeclaree?.()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <>
      <button
        type="button"
        className="rounded border border-amber-300 px-3 py-1.5 text-sm"
        onClick={() => {
          setOuverte(true)
        }}
      >
        Non-conformité
      </button>
      {message && (
        <a className="ml-2 text-sm underline" href="/non-conformite?tab=suivi">
          {message}
        </a>
      )}
      {ouverte && (
        <Modale
          titre={`Non-conformité · réception R${receptionId}`}
          ouverte
          large
          onOuverture={setOuverte}
        >
          <fieldset className="mb-4">
            <legend className="mb-2 text-sm font-medium">Affiches concernées</legend>
            {affiches.map((a) => (
              <label key={a.id} className="mb-2 block text-sm">
                <input
                  type="checkbox"
                  checked={selection.includes(a.id)}
                  onChange={(e) => {
                    setSelection((s) =>
                      e.target.checked ? [...s, a.id] : s.filter((id) => id !== a.id),
                    )
                  }}
                />{' '}
                {a.id} · {a.annonceur} · {a.theme}
              </label>
            ))}
          </fieldset>
          <SaisieConstat value={constat} onChange={setConstat} />
          {erreur !== null && <ErrorMessage error={erreur} />}
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setOuverte(false)
              }}
            >
              Annuler
            </button>
            <Button
              type="button"
              disabled={envoi || !selection.length || !constat.types.length}
              onClick={() => void declarer()}
            >
              Déclarer la non-conformité
            </Button>
          </div>
        </Modale>
      )}
    </>
  )
}
