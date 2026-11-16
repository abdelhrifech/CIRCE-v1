import {
  type ConstatNc,
  InconnueCreeeSchema,
  ReferentielsReceptionSchema,
  SuggestionsIntitulesSchema,
} from '@circe/shared'
import { SaisieConstat } from '../nonconformite/constat.tsx'
import { useState } from 'react'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { ApercuFeuilles } from './apercu-feuilles.tsx'
import { ModalePhotoBl } from './bon-livraison.tsx'

interface Props {
  siteParDefaut: number | null
  onFermer: () => void
  onCreee: (message: string) => void
}

/**
 * ECR-REC-08 — « Réception inconnue… » (RG-REC-095 à 100). Les contrôles (quantité > 0, allée et rayon,
 * photo du BL) sont faits par l'API ; l'écran affiche son message.
 */
export function ModaleReceptionInconnue({ siteParDefaut, onFermer, onCreee }: Props) {
  const { etat: refs, recharger } = useApi('referentiels-reception', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  const [site, setSite] = useState<string>('')
  const [format, setFormat] = useState('')
  const [annonceur, setAnnonceur] = useState('')
  const [theme, setTheme] = useState('')
  const [imprimeur, setImprimeur] = useState('')
  const [quantite, setQuantite] = useState(20)
  const [allee, setAllee] = useState<string | null>(null)
  const [rayon, setRayon] = useState('')
  const [photoAffiche, setPhotoAffiche] = useState<{ id: number; intitule: string | null } | null>(
    null,
  )
  const [photoBl, setPhotoBl] = useState<{ id: number; intitule: string | null } | null>(null)
  const [sansBl, setSansBl] = useState(false)
  const [nc, setNc] = useState<ConstatNc | null>(null)
  const [numeroBl, setNumeroBl] = useState('')
  const [photo, setPhoto] = useState<'bl' | 'affiche' | null>(null)
  const [envoi, setEnvoi] = useState<
    { kind: 'repos' | 'en-cours' } | { kind: 'erreur'; error: unknown }
  >({ kind: 'repos' })
  const [apercu, setApercu] = useState<{ afficheId: number; message: string } | null>(null)

  const data = refs.kind === 'ready' ? refs.data : null
  const siteChoisi = site || String(siteParDefaut ?? data?.plateformes[0]?.id ?? '')
  const plateforme = data?.plateformes.find((p) => String(p.id) === siteChoisi)
  const formatChoisi = format || String(data?.formats[0]?.id ?? '')
  // RG-REC-097 : allée tampon par défaut (paramètre du site).
  const alleeEffective = allee ?? plateforme?.alleeInconnues ?? ''

  // RG-REC-100 : suggestions d'intitulés de l'autre plateforme dès 3 caractères.
  const { etat: sugg } = useApi(`suggestions-${siteChoisi}-${annonceur.trim()}`, (signal) =>
    annonceur.trim().length < 3 || !siteChoisi
      ? Promise.resolve({ suggestions: [] })
      : apiRequest(
          'GET',
          `/api/receptions-inconnues/suggestions?plateformeId=${siteChoisi}&annonceur=${encodeURIComponent(annonceur.trim())}`,
          { schema: SuggestionsIntitulesSchema, signal },
        ),
  )

  async function creer() {
    setEnvoi({ kind: 'en-cours' })
    try {
      const r = await apiPost('/api/receptions-inconnues', {
        schema: InconnueCreeeSchema,
        body: {
          plateformeId: Number(siteChoisi),
          supportId: Number(formatChoisi),
          annonceur,
          theme,
          imprimeurId: imprimeur ? Number(imprimeur) : null,
          quantite,
          allee: alleeEffective,
          rayon,
          photoAfficheId: photoAffiche?.id ?? null,
          photoBlId: sansBl ? null : (photoBl?.id ?? null),
          sansBl,
          nonConformite: nc ?? undefined,
          numeroBl: sansBl ? '' : numeroBl,
        },
      })
      setEnvoi({ kind: 'repos' })
      // RG-REC-099 : « Créer, ranger et imprimer la feuille temporaire ».
      setApercu({ afficheId: r.afficheId, message: r.message })
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }

  if (apercu) {
    return (
      <ApercuFeuilles
        afficheIds={[apercu.afficheId]}
        onFermer={() => {
          onCreee(apercu.message)
        }}
      />
    )
  }
  if (photo) {
    return (
      <ModalePhotoBl
        titre={photo === 'bl' ? 'Photo du BL' : 'Photo d’une affiche'}
        onJointe={(p) => {
          if (photo === 'bl') setPhotoBl(p)
          else setPhotoAffiche(p)
          setPhoto(null)
        }}
        onFermer={() => {
          setPhoto(null)
        }}
      />
    )
  }
  const champ = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm'
  return (
    <Modale
      titre="Réception inconnue"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      {refs.kind === 'loading' && <p className="text-sm text-slate-500">Chargement des listes…</p>}
      {refs.kind === 'error' && <ErrorMessage error={refs.error} onRetry={recharger} />}
      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Site
            <select
              className={champ}
              value={siteChoisi}
              onChange={(e) => {
                setSite(e.target.value)
                setAllee(null)
              }}
            >
              {data.plateformes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Format
            <select
              className={champ}
              value={formatChoisi}
              onChange={(e) => {
                setFormat(e.target.value)
              }}
            >
              {data.formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Annonceur lu sur l’affiche
            <input
              className={champ}
              value={annonceur}
              onChange={(e) => {
                setAnnonceur(e.target.value)
              }}
            />
          </label>
          <div className="text-sm font-medium">
            <label>
              Thème ou description
              <input
                className={champ}
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value)
                }}
              />
            </label>
            {sugg.kind === 'ready' && sugg.data.suggestions.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {sugg.data.suggestions.map((s) => (
                  <button
                    key={s.afficheId}
                    type="button"
                    className="rounded border border-slate-300 px-1 text-xs font-normal"
                    onClick={() => {
                      setTheme(s.intitule)
                    }}
                  >
                    « {s.intitule} » ({s.site}, {s.afficheId})
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="text-sm font-medium">
            Imprimeur
            <select
              className={champ}
              value={imprimeur}
              onChange={(e) => {
                setImprimeur(e.target.value)
              }}
            >
              <option value="">—</option>
              {data.imprimeurs.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.libelle}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Quantité comptée
            <input
              type="number"
              min={1}
              className={champ}
              value={quantite}
              onChange={(e) => {
                setQuantite(Math.trunc(Number(e.target.value)))
              }}
            />
          </label>
          <label className="text-sm font-medium">
            Allée (zone tampon des réceptions inconnues)
            <input
              className={champ}
              value={alleeEffective}
              onChange={(e) => {
                setAllee(e.target.value.toUpperCase())
              }}
            />
          </label>
          <label className="text-sm font-medium">
            Rayon (obligatoire)
            <input
              className={champ}
              placeholder="1-12"
              value={rayon}
              onChange={(e) => {
                setRayon(e.target.value)
              }}
            />
          </label>
          <div className="text-sm">
            <span className="font-medium">Photo de l’affiche</span>
            <p className="mt-1">
              {photoAffiche ? `Photo jointe (${photoAffiche.intitule ?? 'photo'}). ` : ''}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setPhoto('affiche')
                }}
              >
                {photoAffiche ? 'Reprendre la photo' : 'Prendre une photo'}
              </button>
            </p>
          </div>
          <div className="text-sm">
            <span className="font-medium">Photo du BL</span>
            <p className="text-xs text-slate-600">
              à joindre dans tous les cas, sauf palette arrivée sans BL
            </p>
            {!sansBl && (
              <p className="mt-1">
                {photoBl ? `BL photographié, joint (${photoBl.intitule ?? 'photo'}). ` : ''}
                <button
                  type="button"
                  className="underline"
                  onClick={() => {
                    setPhoto('bl')
                  }}
                >
                  {photoBl ? 'Reprendre la photo' : 'Photographier le BL'}
                </button>
              </p>
            )}
            {!sansBl && (
              <input
                aria-label="N° de BL"
                placeholder="N° de BL"
                className={champ}
                value={numeroBl}
                onChange={(e) => {
                  setNumeroBl(e.target.value)
                }}
              />
            )}
            <label className="mt-1 flex items-center gap-1">
              <input
                type="checkbox"
                checked={sansBl}
                onChange={(e) => {
                  setSansBl(e.target.checked)
                }}
              />
              Palette arrivée sans BL
            </label>
          </div>
        </div>
      )}
      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={nc !== null}
          onChange={(e) => {
            setNc(e.target.checked ? { types: [], bloquante: null, commentaire: '' } : null)
          }}
        />
        Non-conformité constatée
      </label>
      {nc && <SaisieConstat value={nc} onChange={setNc} />}
      {envoi.kind === 'erreur' && (
        <div className="mt-3">
          <ErrorMessage error={envoi.error} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="text-sm underline" onClick={onFermer}>
          Annuler
        </button>
        <Button
          type="button"
          disabled={!data || envoi.kind === 'en-cours'}
          onClick={() => void creer()}
        >
          Créer, ranger et imprimer la feuille temporaire
        </Button>
      </div>
    </Modale>
  )
}
