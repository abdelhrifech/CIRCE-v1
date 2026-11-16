import {
  type ConstatNc,
  PhotoSchema,
  ReceptionCreeeSchema,
  ReferentielsReceptionSchema,
} from '@circe/shared'
import { useState } from 'react'
import { ApiError, apiPost, apiRequest } from '../../lib/api-client.ts'
import type { LignePanier } from '../../lib/panier.ts'
import { useApi } from '../../lib/use-api.ts'
import { ErrorMessage } from '../error-message.tsx'
import { Button } from '../button.tsx'
import { SaisieConstat } from '../nonconformite/constat.tsx'
import { Modale } from '../ui/modale.tsx'

interface Photo {
  id: number
  intitule: string | null
}

export function lireBase64(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader()
    lecteur.onload = () => {
      const url = typeof lecteur.result === 'string' ? lecteur.result : ''
      resolve(url.slice(url.indexOf(',') + 1))
    }
    lecteur.onerror = () => {
      reject(new Error('Lecture du fichier impossible'))
    }
    lecteur.readAsDataURL(fichier)
  })
}

/**
 * ECR-REC-07 (mode BL) : la photo est jointe au bon de livraison. HYPOTHÈSE Q-112 : pas de lecture
 * automatique du BL en V1 (aucun pré-remplissage, aucune proposition de lignes).
 */
export function ModalePhotoBl({
  onJointe,
  onFermer,
  titre = 'Photo du BL',
}: {
  onJointe: (p: Photo) => void
  onFermer: () => void
  titre?: string
}) {
  const [fichier, setFichier] = useState<File | null>(null)
  const [envoi, setEnvoi] = useState<'repos' | 'en-cours'>('repos')
  const [erreur, setErreur] = useState<unknown>(null)

  async function joindre() {
    if (!fichier) return
    setEnvoi('en-cours')
    setErreur(null)
    try {
      const photo = await apiPost('/api/photos', {
        schema: PhotoSchema,
        body: {
          intitule: fichier.name,
          mimeType: fichier.type,
          contenuBase64: await lireBase64(fichier),
        },
      })
      onJointe({ id: photo.id, intitule: photo.intitule })
    } catch (e) {
      setErreur(e)
      setEnvoi('repos')
    }
  }

  return (
    <Modale
      titre={titre}
      ouverte
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <p className="text-sm text-slate-600">
        Prenez le bon de livraison en photo (ou choisissez le fichier) : il est joint à la
        réception. JPEG, PNG, WebP ou PDF, 10 Mo au plus.
      </p>
      <label className="mt-3 block text-sm font-medium" htmlFor="photo-bl">
        Fichier du BL (photo ou PDF)
      </label>
      <input
        id="photo-bl"
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture="environment"
        className="mt-1 block text-sm"
        onChange={(e) => {
          setFichier(e.target.files?.[0] ?? null)
        }}
      />
      {erreur !== null && (
        <div className="mt-3">
          <ErrorMessage error={erreur} />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          disabled={!fichier || envoi === 'en-cours'}
          onClick={() => void joindre()}
        >
          {envoi === 'en-cours' ? 'Envoi…' : 'Joindre le BL'}
        </Button>
      </div>
    </Modale>
  )
}

interface BonLivraisonProps {
  panier: LignePanier[]
  /** Modale « Photo du BL » : ouverte aussi depuis le bandeau « Trouver les dossiers du BL ». */
  modalePhoto: boolean
  onModalePhoto: (ouverte: boolean) => void
  /** RG-REC-045 : lignes validées (elles quittent le panier) et message de confirmation. */
  onValidee: (lignesValidees: number[], message: string) => void
}

/** RG-REC-026, 033 à 046 : carte « Bon de livraison » et « Valider la réception » (REC-P04). */
export function BonLivraison({
  panier,
  modalePhoto,
  onModalePhoto: setModalePhoto,
  onValidee,
}: BonLivraisonProps) {
  const { etat: refs, recharger } = useApi('referentiels-reception', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [voirBl, setVoirBl] = useState(false)
  const [numeroBl, setNumeroBl] = useState('')
  const [sansBl, setSansBl] = useState(false)
  const [nc, setNc] = useState<ConstatNc | null>(null)
  const [livreurId, setLivreurId] = useState('')
  const [imprimeurId, setImprimeurId] = useState('')
  const [nbColis, setNbColis] = useState(1)
  const [dechargeParId, setDechargeParId] = useState('')
  const [envoi, setEnvoi] = useState<
    | { kind: 'repos' }
    | { kind: 'en-cours' }
    | { kind: 'erreur'; error: unknown }
    | { kind: 'doublon'; message: string; cle: string }
  >({ kind: 'repos' })

  const cochees = panier.filter((p) => p.cochee)
  const affiches = cochees.reduce((s, p) => s + p.quantite, 0)
  const maintenant = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })

  // RG-REC-035 : « Déchargé par » ne propose que les agents de la plateforme des lignes cochées.
  const plateformesCochees = [...new Set(cochees.map((p) => p.plateformeId))]
  const agents =
    refs.kind === 'ready'
      ? refs.data.agents.filter((a) =>
          plateformesCochees.every((pl) => a.plateformeIds.includes(pl)),
        )
      : []
  // Un agent qui n'est plus proposé (lignes cochées changées) n'est pas envoyé.
  const dechargeEffectif = agents.some((a) => String(a.id) === dechargeParId) ? dechargeParId : ''

  const corps = {
    lignes: panier.map((p) => ({
      ligneAttendueId: p.ligneAttendueId,
      quantite: p.quantite,
      cochee: p.cochee,
      complementAfficheId: p.complementAfficheId,
      intituleSaisi: p.intituleSaisi.trim() === '' ? null : p.intituleSaisi.trim(),
    })),
    photoBlId: photo?.id ?? null,
    numeroBl,
    sansBl,
    nonConformite: nc ?? undefined,
    livreurId: livreurId ? Number(livreurId) : null,
    imprimeurId: imprimeurId ? Number(imprimeurId) : null,
    nbColis,
    dechargeParId: dechargeEffectif ? Number(dechargeEffectif) : null,
  }

  // RG-REC-008 : une clé par saisie (un double clic rejoue la même requête) ; RG-REC-036 : un BL déjà
  // réceptionné demande une confirmation explicite.
  async function valider(confirmerDoublon = false) {
    const cle = crypto.randomUUID()
    setEnvoi({ kind: 'en-cours' })
    try {
      const r = await apiPost('/api/receptions', {
        schema: ReceptionCreeeSchema,
        body: { ...corps, confirmerDoublon },
        idempotencyKey: cle,
      })
      // RG-REC-045 : BL, imprimeur, colis et photo remis à zéro ; transporteur et « Déchargé par » conservés.
      setNumeroBl('')
      setSansBl(false)
      setNc(null)
      setImprimeurId('')
      setNbColis(1)
      setPhoto(null)
      setEnvoi({ kind: 'repos' })
      onValidee(
        cochees.map((p) => p.ligneAttendueId),
        r.message,
      )
    } catch (error) {
      if (error instanceof ApiError && error.body.code === 'REC_BL_DOUBLON' && !confirmerDoublon) {
        setEnvoi({ kind: 'doublon', message: error.body.message, cle })
      } else {
        setEnvoi({ kind: 'erreur', error })
      }
    }
  }

  const champ = 'mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm'
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3" aria-labelledby="titre-bl">
      <h3 id="titre-bl" className="font-medium">
        Bon de livraison
      </h3>
      <p className="text-sm text-slate-600">Pour les {cochees.length} ligne(s) cochée(s).</p>

      {photo ? (
        <div
          className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-sm"
          data-testid="bl-photographie"
        >
          BL photographié ({photo.intitule ?? 'photo'}).{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setVoirBl(true)
            }}
          >
            Voir le BL
          </button>{' '}
          ·{' '}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setModalePhoto(true)
            }}
          >
            Reprendre la photo
          </button>
        </div>
      ) : (
        <div
          className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm"
          data-testid="bl-a-photographier"
        >
          <strong>{sansBl ? 'Palette arrivée sans BL' : 'BL à photographier'}</strong> :{' '}
          {sansBl
            ? 'Photo, numéro et imprimeur facultatifs. Le transporteur reste obligatoire.'
            : 'Photographiez le BL ou déclarez son absence.'}{' '}
          <Button
            type="button"
            className="ml-2"
            onClick={() => {
              setModalePhoto(true)
            }}
          >
            Photographier le BL
          </Button>
        </div>
      )}

      {!photo && (
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sansBl}
            onChange={(e) => {
              setSansBl(e.target.checked)
            }}
          />
          Palette arrivée sans BL
        </label>
      )}

      {refs.kind === 'loading' && (
        <p className="mt-2 text-sm text-slate-500">Chargement des listes…</p>
      )}
      {refs.kind === 'error' && (
        <div className="mt-2">
          <ErrorMessage error={refs.error} onRetry={recharger} />
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="text-sm">
          <span className="font-medium">Lignes de ce BL</span>
          <p className="mt-1">
            {cochees.length} ligne(s), {affiches} affiche(s)
          </p>
        </div>
        <div className="text-sm">
          <span className="font-medium">Date de livraison</span>
          <p className="mt-1">{maintenant}</p>
        </div>
        <label className="text-sm font-medium">
          {sansBl ? 'N° de BL : Sans BL' : 'N° de BL *'}
          <input
            className={champ}
            disabled={sansBl}
            value={numeroBl}
            onChange={(e) => {
              setNumeroBl(e.target.value)
            }}
            placeholder="BL imprimeur = BL transporteur"
          />
        </label>
        <label className="text-sm font-medium">
          Transporteur *
          <select
            className={champ}
            value={livreurId}
            onChange={(e) => {
              setLivreurId(e.target.value)
            }}
          >
            <option value="">— choisir —</option>
            {refs.kind === 'ready' &&
              refs.data.livreurs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.libelle}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {sansBl ? 'Imprimeur (facultatif sans BL)' : 'Imprimeur *'}
          <select
            className={champ}
            value={imprimeurId}
            onChange={(e) => {
              setImprimeurId(e.target.value)
            }}
          >
            <option value="">— choisir —</option>
            {refs.kind === 'ready' &&
              refs.data.imprimeurs.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.libelle}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Nombre de colis / palettes
          <input
            type="number"
            min={1}
            className={champ}
            value={nbColis}
            onChange={(e) => {
              setNbColis(Math.max(1, Math.trunc(Number(e.target.value) || 1)))
            }}
          />
        </label>
        <label className="text-sm font-medium">
          Déchargé par
          <select
            className={champ}
            value={dechargeEffectif}
            onChange={(e) => {
              setDechargeParId(e.target.value)
            }}
          >
            <option value="">—</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nom}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={nc !== null}
          onChange={(e) => {
            setNc(e.target.checked ? { types: [], bloquante: null, commentaire: '' } : null)
          }}
        />
        Non-conformité constatée sur cette livraison
      </label>
      {nc && (
        <div className="mt-3">
          <SaisieConstat value={nc} onChange={setNc} />
        </div>
      )}
      <div className="mt-4" aria-live="polite">
        {envoi.kind === 'erreur' && <ErrorMessage error={envoi.error} />}
        {envoi.kind === 'doublon' && (
          <div
            role="alert"
            className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm"
            data-testid="bl-doublon"
          >
            <p>{envoi.message}</p>
            <Button type="button" className="mt-2" onClick={() => void valider(true)}>
              Confirmer : valider quand même
            </Button>
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="button" disabled={envoi.kind === 'en-cours'} onClick={() => void valider()}>
          {envoi.kind === 'en-cours'
            ? 'Validation…'
            : `Valider la réception (${String(cochees.length)} ligne${cochees.length > 1 ? 's' : ''})`}
        </Button>
      </div>

      {modalePhoto && (
        <ModalePhotoBl
          onJointe={(p) => {
            setPhoto(p)
            setSansBl(false)
            setModalePhoto(false)
          }}
          onFermer={() => {
            setModalePhoto(false)
          }}
        />
      )}
      {voirBl && photo && (
        <Modale
          titre={`BL ${numeroBl || '—'}`}
          ouverte
          large
          onOuverture={(o) => {
            if (!o) setVoirBl(false)
          }}
        >
          <p className="mb-2 text-sm text-slate-600">
            Photo du BL prise à l’arrivée. Imprimeur :{' '}
            {(refs.kind === 'ready' &&
              refs.data.imprimeurs.find((i) => String(i.id) === imprimeurId)?.libelle) ||
              '—'}{' '}
            · Transporteur :{' '}
            {(refs.kind === 'ready' &&
              refs.data.livreurs.find((l) => String(l.id) === livreurId)?.libelle) ||
              '—'}{' '}
            · {cochees.length} ligne(s).
          </p>
          <object
            data={`/api/photos/${String(photo.id)}`}
            aria-label="Photo du BL"
            className="h-[60vh] w-full"
          />
        </Modale>
      )}
    </section>
  )
}
