import { ModalePhotoBl } from './bon-livraison.tsx'
import {
  CandidatsSchema,
  FicheAfficheSchema,
  ReferentielsReceptionSchema,
  ResultatAfficheSchema,
  type FicheAffiche,
} from '@circe/shared'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { apiPatch, apiPost, apiRequest } from '../../lib/api-client.ts'
import { dateCourte } from '../../lib/duree.ts'
import { LIBELLE_MOUVEMENT, LIBELLE_TAG, departs } from '../../lib/libelles-affiche.ts'
import { can, getMe } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
import { Pastille } from '../ui/pastille.tsx'
import { ETAT_VALIDATION, MOTIF_DOUTE } from '../coordination/libelles.ts'
import { ApercuFeuilles } from './apercu-feuilles.tsx'
import { FicheReception } from './fiche-reception.tsx'

type Onglet = 'detail' | 'mouvements' | 'preparations' | 'historique'

/** ECR-REC-05 — fiche affiche, 4 onglets (RG-REC-130 à 145). Une lecture n'écrit jamais (RG-REC-142). */
export function FicheAfficheModale({
  afficheId,
  onFermer,
}: {
  afficheId: number
  onFermer: (modifiee: boolean) => void
}) {
  const [essai, setEssai] = useState(0)
  const [modifiee, setModifiee] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [onglet, setOnglet] = useState<Onglet>('detail')
  const { etat, recharger } = useApi(
    `fiche-affiche-${String(afficheId)}-${String(essai)}`,
    (signal) =>
      apiRequest('GET', `/api/affiches/${String(afficheId)}`, {
        schema: FicheAfficheSchema,
        signal,
      }),
  )
  // Le message d'une action survit au rechargement de la fiche (nouvelle version).
  const apresAction = (m?: string) => {
    setModifiee(true)
    setMessage(m ?? null)
    setEssai((e) => e + 1)
  }
  return (
    <Modale
      titre={`Affiche n° ${String(afficheId)}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(modifiee)
      }}
    >
      {message && (
        <p role="status" className="mb-2 text-sm text-emerald-700">
          {message}
        </p>
      )}
      {etat.kind === 'loading' && <p className="text-sm text-slate-500">Chargement de la fiche…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <ContenuFiche
          key={etat.data.version}
          a={etat.data}
          onglet={onglet}
          onOnglet={setOnglet}
          onAction={apresAction}
          onFermer={() => {
            onFermer(modifiee)
          }}
        />
      )}
    </Modale>
  )
}

function ContenuFiche({
  a,
  onglet,
  onOnglet: setOnglet,
  onAction,
  onFermer,
}: {
  a: FicheAffiche
  onglet: Onglet
  onOnglet: (o: Onglet) => void
  onAction: (message?: string) => void
  onFermer: () => void
}) {
  const [apercu, setApercu] = useState(false)
  const [reception, setReception] = useState<number | null>(null)
  const onglets: [Onglet, string][] = [
    ['detail', 'Détail'],
    ['mouvements', 'Mouvements'],
    ['preparations', `Préparations (${String(a.preparations.length)})`],
    ['historique', 'Historique'],
  ]
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1">
        <Pastille ton={a.statut === 'ORPHELINE' ? 'surveiller' : 'ok'}>
          {a.statut === 'ORPHELINE' ? 'Orpheline' : 'Identifiée'}
        </Pastille>
        {a.tags.map((t) => (
          <Pastille key={t} ton={LIBELLE_TAG[t]?.ton ?? 'neutre'}>
            {LIBELLE_TAG[t]?.libelle ?? t}
          </Pastille>
        ))}
        {a.fusionneeHeritee && <Pastille ton="important">Fusionnée (lecture seule)</Pastille>}
      </div>
      <div
        role="tablist"
        aria-label="Fiche affiche"
        className="mb-3 flex gap-1 border-b border-slate-200"
      >
        {onglets.map(([id, libelle]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={onglet === id}
            className={`px-3 py-1.5 text-sm ${onglet === id ? 'border-b-2 border-slate-900 font-medium' : 'text-slate-600'}`}
            onClick={() => {
              setOnglet(id)
            }}
          >
            {libelle}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {onglet === 'detail' && (
          <Detail
            a={a}
            onAction={onAction}
            onReception={setReception}
            onImprimer={() => {
              setApercu(true)
            }}
            onFermer={onFermer}
          />
        )}
        {onglet === 'mouvements' && <Mouvements a={a} onReception={setReception} />}
        {onglet === 'preparations' && <Preparations a={a} onAction={onAction} />}
        {onglet === 'historique' && <Historique a={a} />}
      </div>
      {apercu && (
        <ApercuFeuilles
          afficheIds={[a.id]}
          onFermer={(imprime) => {
            setApercu(false)
            if (imprime) onAction()
          }}
        />
      )}
      {reception !== null && (
        <FicheReception
          receptionId={reception}
          onFermer={() => {
            setReception(null)
          }}
        />
      )}
    </>
  )
}

function Detail({
  a,
  onAction,
  onReception,
  onImprimer,
  onFermer,
}: {
  a: FicheAffiche
  onAction: (message?: string) => void
  onReception: (id: number) => void
  onImprimer: () => void
  onFermer: () => void
}) {
  const { etat: moi } = useApi('moi', () => getMe())
  const { etat: refs } = useApi('referentiels-reception', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  const [f, setF] = useState({
    annonceur: a.annonceur ?? '',
    theme: a.theme ?? '',
    imprimeurId: a.imprimeurId === null ? '' : String(a.imprimeurId),
    allee: a.allee ?? '',
    rayon: a.rayon ?? '',
    aConserver: a.aConserver,
    commentaire: a.commentaire ?? '',
    repiquage: a.repiquage ?? '',
    conservation: a.conservation,
    zonePicking: a.zonePicking ?? false,
    photoId: a.photoId ?? null,
  })
  const [envoi, setEnvoi] = useState<
    { kind: 'repos' | 'en-cours' | 'ok' } | { kind: 'erreur'; error: unknown }
  >({ kind: 'repos' })
  const [photoOuverte, setPhotoOuverte] = useState(false)
  const peutModifier =
    moi.kind === 'ready' && can(moi.data, 'affiche.modifier') && !a.fusionneeHeritee
  const peutValider = moi.kind === 'ready' && can(moi.data, 'validation_admin.valider')

  async function enregistrer() {
    setEnvoi({ kind: 'en-cours' })
    try {
      await apiPatch(`/api/affiches/${String(a.id)}`, {
        schema: ResultatAfficheSchema,
        body: {
          version: a.version,
          ...f,
          imprimeurId: f.imprimeurId ? Number(f.imprimeurId) : null,
        },
      })
      setEnvoi({ kind: 'repos' })
      onAction('Fiche affiche modifiée.')
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }

  async function validation(valider: boolean) {
    setEnvoi({ kind: 'en-cours' })
    try {
      const r = await apiPost(`/api/affiches/${String(a.id)}/validation-admin`, {
        schema: ResultatAfficheSchema,
        body: { version: a.version, valider },
      })
      onAction(r.message)
    } catch (error) {
      setEnvoi({ kind: 'erreur', error })
    }
  }

  const champ =
    'mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-sm disabled:bg-slate-50'
  const enAttente = a.tags.includes('A_CONTROLER')
  const receptionAControler = a.receptions.find((r) => r.statut === 'A_CONTROLER')
  return (
    <div className="text-sm">
      <p>
        <span className="font-medium">Réception(s) : </span>
        {a.receptions.map((r) => (
          <button
            key={r.id}
            type="button"
            className="mr-2 underline"
            onClick={() => {
              onReception(r.id)
            }}
          >
            R{r.id} du {dateCourte(r.arrivee)} (ouvrir)
          </button>
        ))}
        {a.receptions.length > 1 && <span>· livraison en {a.receptions.length} fois</span>}
      </p>
      {enAttente && receptionAControler && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2">
          <strong>Palette à contrôler</strong> — Quantité du BL, en zone tampon : le comptage et
          l’emplacement se saisissent au contrôle.{' '}
          <Link className="underline" to="/reception" search={{ palette: receptionAControler.id }}>
            Contrôler la palette
          </Link>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {f.photoId != null && (
          <img
            src={`/api/photos/${f.photoId}`}
            alt="Visuel de l’affiche"
            className="h-36 w-44 rounded border object-contain"
          />
        )}
        {peutModifier && (
          <button
            type="button"
            className="underline"
            onClick={() => {
              setPhotoOuverte(true)
            }}
          >
            {f.photoId == null
              ? 'Ajouter une photo de l’affiche'
              : 'Remplacer la photo de l’affiche'}
          </button>
        )}
        <p>
          Date d’entrée : {dateCourte(a.recueLe)} · Format : {a.format} · Semaines :{' '}
          {a.departs.join(' + ') || '—'}
        </p>
      </div>
      {photoOuverte && (
        <ModalePhotoBl
          titre="Photo de l’affiche"
          onFermer={() => {
            setPhotoOuverte(false)
          }}
          onJointe={(p) => {
            setF((x) => ({ ...x, photoId: p.id }))
            setPhotoOuverte(false)
          }}
        />
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="font-medium">
          Annonceur saisi
          <input
            className={champ}
            disabled={!peutModifier}
            value={f.annonceur}
            onChange={(e) => {
              setF({ ...f, annonceur: e.target.value })
            }}
          />
        </label>
        <label className="font-medium">
          Thème saisi
          <input
            className={champ}
            disabled={!peutModifier}
            value={f.theme}
            onChange={(e) => {
              setF({ ...f, theme: e.target.value })
            }}
          />
        </label>
        <label className="font-medium">
          Imprimeur
          <select
            className={champ}
            disabled={!peutModifier}
            value={f.imprimeurId}
            onChange={(e) => {
              setF({ ...f, imprimeurId: e.target.value })
            }}
          >
            <option value="">—</option>
            {a.imprimeurId !== null &&
              refs.kind === 'ready' &&
              !refs.data.imprimeurs.some((i) => i.id === a.imprimeurId) && (
                <option value={a.imprimeurId}>{a.imprimeur ?? a.imprimeurId}</option>
              )}
            {refs.kind === 'ready' &&
              refs.data.imprimeurs.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.libelle}
                </option>
              ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="font-medium">
            Allée
            <input
              className={champ}
              disabled={!peutModifier}
              value={f.allee}
              onChange={(e) => {
                setF({ ...f, allee: e.target.value.toUpperCase() })
              }}
            />
          </label>
          <label className="font-medium">
            Rayon
            <input
              className={champ}
              disabled={!peutModifier}
              value={f.rayon}
              onChange={(e) => {
                setF({ ...f, rayon: e.target.value })
              }}
            />
          </label>
        </div>
        <p>
          <span className="font-medium">Quantité reçue : </span>
          {a.recu}
        </p>
        <p>
          <span className="font-medium">Stock disponible : </span>
          {a.enStock} {a.rebut > 0 && <Pastille ton="important">{a.rebut} rebut</Pastille>}
        </p>
        <p>
          <span className="font-medium">Feuille de stock : </span>
          {a.feuille === 'DEFINITIVE'
            ? 'définitive'
            : a.feuille === 'TEMPORAIRE'
              ? a.statut === 'ORPHELINE'
                ? 'temporaire (réception inconnue)'
                : 'temporaire posée : imprimer la définitive'
              : '—'}
        </p>
        {a.surplusEntretien !== null && a.surplusEntretien > 0 && (
          <p>
            <span className="font-medium">Entretien reçu en plus : </span>
            {a.surplusEntretien}
          </p>
        )}
        <p>
          <span className="font-medium">Dernier départ : </span>
          {a.dateDernierDepart ? new Date(a.dateDernierDepart).toLocaleDateString('fr-FR') : '—'}
          {a.dernierDepartDepasse && <Pastille ton="important">dernier départ dépassé</Pastille>}
        </p>
        <label className="flex items-center gap-2 font-medium">
          <input
            type="checkbox"
            disabled={!peutModifier}
            checked={f.aConserver}
            onChange={(e) => {
              setF({ ...f, aConserver: e.target.checked })
            }}
          />
          Affiche à conserver (reliquat d’entretien)
        </label>
        <label className="font-medium">
          Repiquage
          <input
            className={champ}
            disabled={!peutModifier}
            value={f.repiquage}
            onChange={(e) => {
              setF({ ...f, repiquage: e.target.value })
            }}
          />
        </label>
        <label className="font-medium">
          Conservation (semaines)
          <input
            type="number"
            min={1}

            className={champ}
            disabled={!peutModifier}
            value={f.conservation}
            onChange={(e) => {
              setF({ ...f, conservation: Number(e.target.value) })
            }}
          />
        </label>
        <label className="font-medium">
          <input
            type="checkbox"
            disabled={!peutModifier}
            checked={f.zonePicking}
            onChange={(e) => {
              setF({ ...f, zonePicking: e.target.checked })
            }}
          />{' '}
          Zone picking
        </label>
        <label className="font-medium sm:col-span-2">
          Commentaire
          <textarea
            className={champ}
            disabled={!peutModifier}
            value={f.commentaire}
            onChange={(e) => {
              setF({ ...f, commentaire: e.target.value })
            }}
          />
        </label>
      </div>
      <section
        className="mt-3 rounded-md border border-slate-200 p-2"
        aria-label="Validation admin"
      >
        <h4 className="font-medium">Validation admin</h4>
        {a.validation.etat === 'RECEPTION_INCONNUE' ? (
          <Pastille ton="important">
            Réception inconnue : à rattacher d’abord (Réceptions inconnues)
          </Pastille>
        ) : a.validation.validee ? (
          <Pastille ton="ok">
            Validée par {a.validation.par ?? '—'}, le{' '}
            {a.validation.le ? dateCourte(a.validation.le) : '—'}
          </Pastille>
        ) : (
          // RG-COO-007 / RG-COO-006 : proposé (cas sûr) ou doute, avec ses motifs (maquette ECR-REC-05).
          <>
            <Pastille ton={ETAT_VALIDATION[a.validation.etat]?.ton ?? 'info'}>
              {ETAT_VALIDATION[a.validation.etat]?.libelle ?? 'À confirmer par la Coordination'}
            </Pastille>
            <p className="mt-1 text-xs text-slate-600">
              {a.preparations
                .map(
                  (p) =>
                    `Rattachement proposé au dossier ${String(p.dossier ?? '—')} · « ${p.theme ?? 'IP non saisies'} »`,
                )
                .join(' ; ')}
              {a.validation.motifs.length > 0 &&
                ` · doute : ${a.validation.motifs.map((m) => MOTIF_DOUTE[m] ?? m).join(' ; ')}`}
            </p>
          </>
        )}
        {peutValider && a.validation.etat !== 'RECEPTION_INCONNUE' ? (
          <div className="mt-2">
            {a.validation.validee ? (
              <button
                type="button"
                className="underline disabled:opacity-50"
                disabled={envoi.kind === 'en-cours'}
                onClick={() => void validation(false)}
              >
                Annuler la validation
              </button>
            ) : a.validation.motifs.length === 0 ? (
              // Maquette : « Valider » primaire seulement sans doute.
              <Button
                type="button"
                disabled={envoi.kind === 'en-cours'}
                onClick={() => void validation(true)}
              >
                Valider
              </Button>
            ) : (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                disabled={envoi.kind === 'en-cours'}
                onClick={() => void validation(true)}
              >
                Valider
              </button>
            )}
          </div>
        ) : (
          !peutValider && (
            <p className="mt-1 text-slate-600">
              Aucune validation sans la Coordination : à confirmer dans Pré-production › Validation
              admin et Instruction OK, sans attendre la préparation.
            </p>
          )
        )}
      </section>
      {envoi.kind === 'erreur' && (
        <div className="mt-2">
          <ErrorMessage error={envoi.error} />
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="underline" onClick={onFermer}>
          Fermer
        </button>
        <Button type="button" onClick={onImprimer}>
          Imprimer la feuille de stock
        </Button>
        {peutModifier && (
          <Button
            type="button"
            disabled={envoi.kind === 'en-cours'}
            onClick={() => void enregistrer()}
          >
            Enregistrer
          </Button>
        )}
      </div>
    </div>
  )
}

function Mouvements({ a, onReception }: { a: FicheAffiche; onReception: (id: number) => void }) {
  if (a.mouvements.length === 0) return <p className="text-sm text-slate-600">Aucun mouvement.</p>
  return (
    <table className="w-full text-sm" aria-label="Mouvements">
      <thead className="bg-slate-50 text-slate-600">
        <tr>
          {['Date', 'Mouvement', 'Quantité', 'Par', 'Auto'].map((h) => (
            <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {a.mouvements.map((m) => (
          <tr key={m.id} className="border-t border-slate-100">
            <td className="px-2 py-1">{dateCourte(m.date)}</td>
            <td className="px-2 py-1">
              {LIBELLE_MOUVEMENT[m.type] ?? m.type}
              {m.motif ? ` — ${m.motif}` : ''}
              {m.receptionId !== null && (
                <button
                  type="button"
                  className="ml-1 underline"
                  onClick={() => {
                    if (m.receptionId !== null) onReception(m.receptionId)
                  }}
                >
                  R{m.receptionId}
                </button>
              )}
            </td>
            <td className="px-2 py-1">
              {m.quantite > 0 ? '+' : ''}
              {m.quantite}
            </td>
            <td className="px-2 py-1">{m.par ?? '—'}</td>
            <td className="px-2 py-1">{m.auto ? 'oui' : ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Preparations({ a, onAction }: { a: FicheAffiche; onAction: (message?: string) => void }) {
  const { etat: moi } = useApi('moi', () => getMe())
  const peut =
    moi.kind === 'ready' && can(moi.data, 'affiche.rattachement.modifier') && !a.fusionneeHeritee
  const [erreur, setErreur] = useState<unknown>(null)
  const [changer, setChanger] = useState<number | null>(null)
  const [ajout, setAjout] = useState(false)

  async function action(chemin: string, body: unknown) {
    setErreur(null)
    try {
      const r = await apiPost(chemin, { schema: ResultatAfficheSchema, body })
      onAction(r.message)
    } catch (e) {
      setErreur(e)
    }
  }

  return (
    <div className="text-sm">
      <p className="mb-2 text-slate-600">
        Une affiche peut servir plusieurs dossiers et semaines, sans limite. Chaque changement pose
        « Feuille à refaire ».
      </p>
      {a.preparations.length === 0 ? (
        <p className="text-slate-600">Aucun dossier rattaché.</p>
      ) : (
        <table className="w-full" aria-label="Préparations">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              {['Dossier', 'Annonceur', 'Thème', 'Départ', 'Quantité', ''].map((h) => (
                <th key={h} scope="col" className="px-2 py-1 text-left font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.preparations.map((p) => (
              <tr key={p.lienId} className="border-t border-slate-100">
                <td className="px-2 py-1 font-mono">{p.dossier ?? '—'}</td>
                <td className="px-2 py-1">{p.annonceur ?? '—'}</td>
                <td className="px-2 py-1">{p.theme ?? '—'}</td>
                <td className="px-2 py-1">{departs([p.depart])}</td>
                <td className="px-2 py-1">{p.quantite}</td>
                <td className="px-2 py-1 text-right">
                  {peut && (
                    <>
                      <button
                        type="button"
                        className="mr-2 underline"
                        onClick={() => {
                          setChanger(p.lienId)
                        }}
                      >
                        Changer de thème…
                      </button>
                      <button
                        type="button"
                        className="underline"
                        onClick={() =>
                          void action(`/api/rattachements/${String(p.lienId)}/retrait`, {
                            lienVersion: p.lienVersion,
                          })
                        }
                      >
                        Retirer
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {changer !== null && (
        <ChangerTheme
          a={a}
          lienId={changer}
          onChoisir={(nouvelleLigneId) => {
            setChanger(null)
            void action(`/api/affiches/${String(a.id)}/changer-theme`, {
              version: a.version,
              lienId: changer,
              nouvelleLigneId,
            })
          }}
          onAnnuler={() => {
            setChanger(null)
          }}
        />
      )}
      {peut && !ajout && (
        <button
          type="button"
          className="mt-2 underline"
          onClick={() => {
            setAjout(true)
          }}
        >
          + Rattacher à un autre dossier
        </button>
      )}
      {ajout && (
        <RechercheDossiers
          afficheId={a.id}
          qInitial={a.annonceur ?? ''}
          max={6}
          tri="reste"
          onRattacher={(ligneAttendueId, quantite) => {
            void action(`/api/affiches/${String(a.id)}/rattachements`, {
              version: a.version,
              ligneAttendueId,
              quantite,
            })
          }}
        />
      )}
      {erreur !== null && (
        <div className="mt-2">
          <ErrorMessage error={erreur} />
        </div>
      )}
    </div>
  )
}

/** RG-REC-135 : les autres thèmes du MÊME dossier. */
function ChangerTheme({
  a,
  lienId,
  onChoisir,
  onAnnuler,
}: {
  a: FicheAffiche
  lienId: number
  onChoisir: (ligneId: number) => void
  onAnnuler: () => void
}) {
  const lien = a.preparations.find((p) => p.lienId === lienId)
  const dossier = lien?.dossier ?? null
  const { etat } = useApi(`themes-${String(a.id)}-${String(dossier)}`, (signal) =>
    dossier === null
      ? Promise.resolve({ candidats: [] })
      : apiRequest('GET', `/api/affiches/${String(a.id)}/candidats?q=${String(dossier)}&max=20`, {
          schema: CandidatsSchema,
          signal,
        }),
  )
  const autres =
    etat.kind === 'ready'
      ? etat.data.candidats.filter(
          (c) => c.dossier === dossier && c.ligneAttendueId !== lien?.ligneAttendueId,
        )
      : []
  return (
    <div className="mt-2 rounded-md border border-slate-200 p-2">
      <p className="font-medium">Changer de thème (dossier {dossier ?? '—'})</p>
      {etat.kind === 'loading' && <p className="text-slate-500">Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} />}
      {etat.kind === 'ready' && autres.length === 0 && (
        <p className="text-slate-600">Aucun autre thème pour ce dossier.</p>
      )}
      <ul>
        {autres.map((c) => (
          <li key={c.ligneAttendueId}>
            <button
              type="button"
              className="underline"
              onClick={() => {
                onChoisir(c.ligneAttendueId)
              }}
            >
              {c.theme ?? '(IP non saisies)'} — départ {departs([c.depart])}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-1 text-slate-600 underline" onClick={onAnnuler}>
        Annuler
      </button>
    </div>
  )
}

/** RG-REC-105 / RG-REC-136 : recherche de dossiers (n° de dossier, DA, annonceur, thème ; ≥ 2 caractères). */
export function RechercheDossiers({
  afficheId,
  qInitial,
  max,
  onRattacher,
  multiple = false,
  quantiteDefaut = 1,
  onSelection,
  tri,
}: {
  afficheId: number
  qInitial: string
  max: number
  onRattacher?: (ligneAttendueId: number, quantite: number) => void
  multiple?: boolean
  quantiteDefaut?: number
  onSelection?: (s: { ligneAttendueId: number; quantite: number }[]) => void
  /** RG-REC-136 : propositions triées par reste décroissant (tri fait par l'API). */
  tri?: 'reste'
}) {
  const [q, setQ] = useState(qInitial)
  const [qtes, setQtes] = useState<Record<number, number>>({})
  const [coches, setCoches] = useState<number[]>([])
  const terme = q.trim()
  const params = `q=${encodeURIComponent(terme)}&max=${String(max)}${tri ? `&tri=${tri}` : ''}`
  const { etat } = useApi(`candidats-${String(afficheId)}-${params}`, (signal) =>
    terme.length < 2
      ? Promise.resolve({ candidats: [] })
      : apiRequest('GET', `/api/affiches/${String(afficheId)}/candidats?${params}`, {
          schema: CandidatsSchema,
          signal,
        }),
  )
  const candidats = etat.kind === 'ready' ? etat.data.candidats : []
  const qte = (id: number, attendu: number) =>
    qtes[id] ?? Math.max(1, Math.min(quantiteDefaut, attendu || quantiteDefaut))
  const publier = (c: number[], qs: Record<number, number>) => {
    onSelection?.(c.map((id) => ({ ligneAttendueId: id, quantite: qs[id] ?? qte(id, 0) })))
  }
  return (
    <div className="mt-2 rounded-md border border-slate-200 p-2 text-sm">
      <label className="font-medium">
        N° de dossier, DA, annonceur ou thème
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
          }}
        />
      </label>
      {terme.length < 2 && (
        <p className="mt-1 text-slate-600">
          Tapez un n° de dossier, de DA, un annonceur ou un thème.
        </p>
      )}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} />}
      {terme.length >= 2 && etat.kind === 'ready' && candidats.length === 0 && (
        <p className="mt-1 text-slate-600">Aucun dossier pour « {terme} » sur ce site.</p>
      )}
      <ul className="mt-2 space-y-1" aria-label="Dossiers proposés">
        {candidats.map((c) => (
          <li key={c.ligneAttendueId} className="flex flex-wrap items-center gap-2">
            {multiple && (
              <input
                type="checkbox"
                aria-label={`Choisir le dossier ${String(c.dossier ?? c.ligneAttendueId)}`}
                checked={coches.includes(c.ligneAttendueId)}
                onChange={(e) => {
                  const n = e.target.checked
                    ? [...coches, c.ligneAttendueId]
                    : coches.filter((x) => x !== c.ligneAttendueId)
                  const qs = { ...qtes, [c.ligneAttendueId]: qte(c.ligneAttendueId, c.attendu) }
                  setCoches(n)
                  setQtes(qs)
                  publier(n, qs)
                }}
              />
            )}
            <span className="flex-1">
              <strong>{c.annonceur ?? '—'}</strong> · « {c.theme ?? 'IP non saisies'} » — Dossier{' '}
              {c.dossier ?? '—'} · DA {c.da ?? '—'} · départ {departs([c.depart])} · attendu{' '}
              {c.attendu}, reste {c.reste}
            </span>
            <label>
              Qté{' '}
              <input
                type="number"
                min={1}
                aria-label={`Qté pour le dossier ${String(c.dossier ?? c.ligneAttendueId)}`}
                className="w-16 rounded border border-slate-300 px-1"
                value={qte(c.ligneAttendueId, c.attendu)}
                onChange={(e) => {
                  const qs = { ...qtes, [c.ligneAttendueId]: Math.trunc(Number(e.target.value)) }
                  setQtes(qs)
                  publier(coches, qs)
                }}
              />
            </label>
            {onRattacher && (
              <Button
                type="button"
                onClick={() => {
                  onRattacher(c.ligneAttendueId, qte(c.ligneAttendueId, c.attendu))
                }}
              >
                Rattacher
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Historique({ a }: { a: FicheAffiche }) {
  if (a.historique.length === 0) return <p className="text-sm text-slate-600">Aucun historique.</p>
  return (
    <ol className="space-y-1 text-sm" aria-label="Historique">
      {a.historique.map((h, i) => (
        <li key={i}>
          {dateCourte(h.le)} · {h.action}
          {h.ancien || h.nouveau ? ` : ${h.ancien ?? '—'} → ${h.nouveau ?? '—'}` : ''} ·{' '}
          {h.par ?? '—'}
        </li>
      ))}
    </ol>
  )
}
