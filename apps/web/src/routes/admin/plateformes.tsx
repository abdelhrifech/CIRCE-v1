import { createFileRoute } from '@tanstack/react-router'
import {
  PlateformeAdminSchema,
  PlateformesAdminSchema,
  type ModifierPlateforme,
  type PlateformeAdmin,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Étape 8 (D-03) — Plateformes (RG-ADM-040 à 044 provisoires) : coordonnées, mail de déblocage, id site CCF, adresses
// de réception (ajout, suppression) et imprimantes cibles de l'étiquette rack (ajout, désactivation). Pas de
// création ni de suppression de plateforme (existant). Aucun mail ni impression n'est déclenché d'ici (Q-375, Q-002).
// Hypothèses : Q-407.

export const Route = createFileRoute('/admin/plateformes')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Plateformes,
})

function Plateformes() {
  const [recherche, setRecherche] = useState('')
  const [q, setQ] = useState('')
  const { etat, recharger } = useApi(`admin-plateformes-${q}`, (signal) =>
    apiRequest('GET', `/api/admin/plateformes${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      schema: PlateformesAdminSchema,
      signal,
    }),
  )
  // La plateforme en édition est conservée à part : la liste repasse par « chargement » à chaque rechargement.
  const [edition, setEdition] = useState<PlateformeAdmin | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Administration › Paramétrage › Plateformes</p>
      <h1 className="text-2xl font-semibold">Plateformes</h1>
      <p className="mt-3 text-sm text-slate-600">
        Coordonnées, mail de déblocage, adresses du mail de réception d’affiches et imprimantes
        cibles de l’étiquette rack. Les deux listes de mails sont distinctes (déblocage de
        préparation, réception).
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        aria-label="Recherche"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(recherche.trim())
        }}
      >
        <label>
          Rechercher
          <input
            className="ml-1 w-56 rounded-md border border-slate-300 px-2 py-1"
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value)
            }}
          />
        </label>
        <Button type="submit">Filtrer</Button>
      </form>
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      <section className="mt-4" aria-label="Plateformes">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (etat.data.plateformes.length === 0 ? (
            <p className="text-sm text-slate-600">Aucune plateforme pour cette recherche.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {etat.data.plateformes.length} plateforme(s) affichée(s) sur {etat.data.total}.
              </p>
              <table className="mt-1 w-full text-sm" aria-label="Liste des plateformes">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Plateforme</th>
                    <th>Adresse</th>
                    <th>Téléphone</th>
                    <th>Mail de déblocage</th>
                    <th>Mails de réception</th>
                    <th>Imprimantes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {etat.data.plateformes.map((p) => (
                    <tr key={p.id} className="border-b align-top">
                      <td className="py-1">
                        {p.nom}
                        {p.idSiteCcf !== null ? ` (site CCF ${String(p.idSiteCcf)})` : ''}
                      </td>
                      <td>
                        {[
                          p.adresse1,
                          p.adresse2,
                          [p.codePostal, p.localite].filter(Boolean).join(' '),
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'}
                      </td>
                      <td>{p.telephone ?? '—'}</td>
                      <td>{p.mailDeblocage ?? '—'}</td>
                      <td>{p.mailsReception.map((m) => m.adresse).join(', ') || '—'}</td>
                      <td>
                        {p.imprimantes.length === 0
                          ? 'Aucune'
                          : p.imprimantes
                              .map((i) => (i.actif ? i.nom : `${i.nom} (inactive)`))
                              .join(', ')}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="underline"
                          aria-label={`Modifier ${p.nom}`}
                          onClick={() => {
                            setMessage(null)
                            setEdition(p)
                          }}
                        >
                          Modifier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ))}
      </section>
      {edition && (
        <ModalePlateforme
          plateforme={edition}
          onMessage={setMessage}
          onFermer={() => {
            setEdition(null)
            recharger()
          }}
        />
      )}
    </main>
  )
}

function ModalePlateforme({
  plateforme: initiale,
  onMessage,
  onFermer,
}: {
  plateforme: PlateformeAdmin
  onMessage: (m: string) => void
  onFermer: () => void
}) {
  const [plateforme, setPlateforme] = useState(initiale)
  const [champs, setChamps] = useState({
    nom: plateforme.nom,
    adresse1: plateforme.adresse1 ?? '',
    adresse2: plateforme.adresse2 ?? '',
    codePostal: plateforme.codePostal ?? '',
    localite: plateforme.localite ?? '',
    telephone: plateforme.telephone ?? '',
    mailDeblocage: plateforme.mailDeblocage ?? '',
    idSiteCcf: plateforme.idSiteCcf === null ? '' : String(plateforme.idSiteCcf),
  })
  const [adresse, setAdresse] = useState('')
  const [imprimante, setImprimante] = useState('')
  const [erreur, setErreur] = useState<unknown>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const base = `/api/admin/plateformes/${String(plateforme.id)}`

  async function agir(action: () => Promise<PlateformeAdmin>, message: string) {
    setEnvoi(true)
    setErreur(null)
    setInfo(null)
    try {
      setPlateforme(await action())
      setInfo(message)
      onMessage(message)
      return true
    } catch (e) {
      setErreur(e)
      return false
    } finally {
      setEnvoi(false)
    }
  }
  function enregistrer(e: SyntheticEvent) {
    e.preventDefault()
    const corps: ModifierPlateforme = {
      version: plateforme.version,
      nom: champs.nom,
      adresse1: champs.adresse1,
      adresse2: champs.adresse2,
      codePostal: champs.codePostal,
      localite: champs.localite,
      telephone: champs.telephone,
      mailDeblocage: champs.mailDeblocage,
      idSiteCcf: champs.idSiteCcf.trim() === '' ? null : Number(champs.idSiteCcf),
    }
    void agir(
      () => apiRequest('PATCH', base, { schema: PlateformeAdminSchema, body: corps }),
      `Plateforme « ${champs.nom} » enregistrée.`,
    ).then((ok) => {
      if (ok) onFermer()
    })
  }
  const champ = (cle: keyof typeof champs, libelle: string, max: number) => (
    <label className="block">
      {libelle}
      <input
        className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
        value={champs[cle]}
        maxLength={max}
        onChange={(e) => {
          setChamps({ ...champs, [cle]: e.target.value })
        }}
      />
    </label>
  )

  return (
    <Modale
      titre={`Modifier ${plateforme.nom}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <form
        className="grid gap-2 text-sm md:grid-cols-2"
        aria-label="Coordonnées"
        onSubmit={enregistrer}
      >
        {champ('nom', 'Nom', 150)}
        {champ('adresse1', 'Adresse 1', 150)}
        {champ('adresse2', 'Adresse 2', 150)}
        {champ('codePostal', 'Code postal', 5)}
        {champ('localite', 'Localité', 100)}
        {champ('telephone', 'Téléphone', 14)}
        {champ('mailDeblocage', 'Mail de déblocage (adresses séparées par des virgules)', 500)}
        {champ('idSiteCcf', 'Identifiant du site CCF', 9)}
        <div className="md:col-span-2">
          <Button type="submit" disabled={envoi || !champs.nom.trim()}>
            Enregistrer les coordonnées
          </Button>
        </div>
      </form>

      <section className="mt-4 text-sm" aria-label="Mails de réception">
        <h3 className="font-semibold">Mails de réception d’affiches</h3>
        {plateforme.mailsReception.length === 0 ? (
          <p className="mt-1 text-slate-600">Aucune adresse.</p>
        ) : (
          <ul className="mt-1" aria-label="Adresses de réception">
            {plateforme.mailsReception.map((m) => (
              <li key={m.id} className="flex gap-2">
                <span>{m.adresse}</span>
                <button
                  type="button"
                  className="underline"
                  disabled={envoi}
                  aria-label={`Supprimer ${m.adresse}`}
                  onClick={() => {
                    void agir(
                      () =>
                        apiRequest('DELETE', `${base}/adresses-reception/${String(m.id)}`, {
                          schema: PlateformeAdminSchema,
                        }),
                      `Adresse « ${m.adresse} » supprimée.`,
                    )
                  }}
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label>
            Nouvelle adresse
            <input
              className="ml-1 w-64 rounded-md border border-slate-300 px-2 py-1"
              value={adresse}
              maxLength={254}
              onChange={(e) => {
                setAdresse(e.target.value)
              }}
            />
          </label>
          <Button
            type="button"
            disabled={envoi || !adresse.trim()}
            onClick={() => {
              void agir(
                () =>
                  apiPost(`${base}/adresses-reception`, {
                    schema: PlateformeAdminSchema,
                    body: { adresse },
                  }),
                `Adresse « ${adresse.trim().toLowerCase()} » ajoutée.`,
              ).then((ok) => {
                if (ok) setAdresse('')
              })
            }}
          >
            Ajouter l’adresse
          </Button>
        </div>
      </section>

      <section className="mt-4 text-sm" aria-label="Imprimantes">
        <h3 className="font-semibold">Imprimantes (étiquette rack)</h3>
        {plateforme.imprimantes.length === 0 ? (
          <p className="mt-1 text-slate-600">Aucune imprimante : aucune impression directe.</p>
        ) : (
          <ul className="mt-1" aria-label="Imprimantes de la plateforme">
            {plateforme.imprimantes.map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <span className={i.actif ? '' : 'text-slate-500 line-through'}>{i.nom}</span>
                {!i.actif && <Pastille ton="neutre">Désactivée</Pastille>}
                <button
                  type="button"
                  className="underline"
                  disabled={envoi}
                  aria-label={`${i.actif ? 'Désactiver' : 'Réactiver'} ${i.nom}`}
                  onClick={() => {
                    void agir(
                      () =>
                        apiRequest('PATCH', `${base}/imprimantes/${String(i.id)}`, {
                          schema: PlateformeAdminSchema,
                          body: { actif: !i.actif, version: i.version },
                        }),
                      i.actif
                        ? `Imprimante « ${i.nom} » désactivée.`
                        : `Imprimante « ${i.nom} » réactivée.`,
                    )
                  }}
                >
                  {i.actif ? 'Désactiver' : 'Réactiver'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label>
            Nouvelle imprimante
            <input
              className="ml-1 w-64 rounded-md border border-slate-300 px-2 py-1"
              value={imprimante}
              maxLength={150}
              onChange={(e) => {
                setImprimante(e.target.value)
              }}
            />
          </label>
          <Button
            type="button"
            disabled={envoi || !imprimante.trim()}
            onClick={() => {
              void agir(
                () =>
                  apiPost(`${base}/imprimantes`, {
                    schema: PlateformeAdminSchema,
                    body: { nom: imprimante },
                  }),
                `Imprimante « ${imprimante.trim()} » ajoutée.`,
              ).then((ok) => {
                if (ok) setImprimante('')
              })
            }}
          >
            Ajouter l’imprimante
          </Button>
        </div>
      </section>
      {info && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {info}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={onFermer}>
          Fermer
        </Button>
      </div>
    </Modale>
  )
}
