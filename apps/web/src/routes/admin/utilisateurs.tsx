import { createFileRoute } from '@tanstack/react-router'
import {
  ROLES,
  SitesAdminSchema,
  UtilisateurAdminSchema,
  UtilisateursAdminSchema,
  type PerimetreEntree,
  type Role,
  type SiteAdmin,
  type UtilisateurAdmin,
} from '@circe/shared'
import { useState, type SyntheticEvent } from 'react'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { getMe, requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'

// Étape 8 (D-01) — Administration des utilisateurs (écran minimal : la maquette ne le montre pas, « phase 4 »,
// ECR-ADM-07 Q) : liste filtrable, création, modification (nom, rôles, périmètre site / atelier), désactivation.
// Aucun mot de passe (Q-001). Rôles provisoires (Q-003). Un administrateur ne modifie pas ses propres droits
// (le serveur refuse : Q-406). Hypothèses : Q-406.

export const Route = createFileRoute('/admin/utilisateurs')({
  beforeLoad: requirePermission('utilisateur.gerer'),
  component: Utilisateurs,
})

const LIBELLE_ROLE: Record<Role, string> = {
  coord: 'Coordination',
  cheq: 'Chef d’équipe',
  recep: 'Réception',
  expe: 'Expédition',
  admin: 'Administrateur',
  com: 'Commerce',
}

function Utilisateurs() {
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [actif, setActif] = useState('')
  const [filtre, setFiltre] = useState('')
  const { etat, recharger } = useApi(`admin-utilisateurs-${filtre}`, (signal) =>
    apiRequest('GET', `/api/admin/utilisateurs${filtre}`, {
      schema: UtilisateursAdminSchema,
      signal,
    }),
  )
  const sites = useApi('admin-sites-perimetre', (signal) =>
    apiRequest('GET', '/api/admin/sites', { schema: SitesAdminSchema, signal }),
  )
  const moi = useApi('admin-moi', () => getMe())
  const [message, setMessage] = useState<string | null>(null)
  const [erreur, setErreur] = useState<unknown>(null)
  const [edition, setEdition] = useState<UtilisateurAdmin | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const listeSites = sites.etat.kind === 'ready' ? sites.etat.data.sites : []
  const moiId = moi.etat.kind === 'ready' ? moi.etat.data.userId : null

  function filtrer(e: SyntheticEvent) {
    e.preventDefault()
    const p = new URLSearchParams()
    if (q.trim()) p.set('q', q.trim())
    if (role) p.set('role', role)
    if (actif) p.set('actif', actif)
    setFiltre(p.toString() ? `?${p.toString()}` : '')
  }
  async function changerEtat(u: UtilisateurAdmin, nouvelEtat: boolean) {
    setEnvoi(true)
    setErreur(null)
    setMessage(null)
    try {
      await apiRequest('PATCH', `/api/admin/utilisateurs/${String(u.id)}`, {
        schema: UtilisateurAdminSchema,
        body: { version: u.version, actif: nouvelEtat },
      })
      setMessage(
        nouvelEtat
          ? `Compte « ${u.identifiantExterne} » réactivé.`
          : `Compte « ${u.identifiantExterne} » désactivé.`,
      )
      recharger()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-sm text-slate-500">Administration › Utilisateurs</p>
      <h1 className="text-2xl font-semibold">Utilisateurs</h1>
      <p className="mt-3 text-sm text-slate-600">
        Rôles et périmètre (site, atelier) des comptes. L’authentification n’est pas gérée ici. Un
        compte désactivé ne peut plus se connecter ; il n’est jamais supprimé (traçabilité).
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={filtrer}
        aria-label="Filtres"
      >
        <label>
          Rechercher
          <input
            className="ml-1 w-56 rounded-md border border-slate-300 px-2 py-1"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
            }}
          />
        </label>
        <label>
          Rôle
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={role}
            onChange={(e) => {
              setRole(e.target.value)
            }}
          >
            <option value="">Tous</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {LIBELLE_ROLE[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          État
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={actif}
            onChange={(e) => {
              setActif(e.target.value)
            }}
          >
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Désactivés</option>
          </select>
        </label>
        <Button type="submit">Filtrer</Button>
      </form>
      <FormulaireCreation
        sites={listeSites}
        onCree={(msg) => {
          setErreur(null)
          setMessage(msg)
          recharger()
        }}
        onErreur={(e) => {
          setMessage(null)
          setErreur(e)
        }}
      />
      {message && (
        <p role="status" className="mt-3 rounded-md border border-sky-200 bg-sky-50 p-2 text-sm">
          {message}
        </p>
      )}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <section className="mt-4" aria-label="Utilisateurs">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (etat.data.utilisateurs.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun utilisateur pour ces filtres.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {etat.data.utilisateurs.length} affiché(s) sur {etat.data.total}. Affinez la
                recherche pour voir les autres.
              </p>
              <table className="mt-1 w-full text-sm" aria-label="Liste des utilisateurs">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Identifiant</th>
                    <th>Nom</th>
                    <th>Rôles</th>
                    <th>Périmètre</th>
                    <th>État</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {etat.data.utilisateurs.map((u) => (
                    <tr key={u.id} className="border-b align-top">
                      <td className="py-1">{u.identifiantExterne}</td>
                      <td>{u.nom ?? '—'}</td>
                      <td>{u.roles.map((r) => LIBELLE_ROLE[r]).join(', ')}</td>
                      <td>
                        {u.toutesPlateformes
                          ? 'Tous les sites'
                          : u.perimetre.length === 0
                            ? 'Aucun accès'
                            : u.perimetre
                                .map((p) =>
                                  p.atelier ? `${p.plateforme} · ${p.atelier}` : p.plateforme,
                                )
                                .join(' ; ')}
                      </td>
                      <td>
                        <Pastille ton={u.actif ? 'ok' : 'neutre'}>
                          {u.actif ? 'Actif' : 'Désactivé'}
                        </Pastille>
                      </td>
                      <td className="space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          className="underline"
                          aria-label={`Modifier ${u.identifiantExterne}`}
                          onClick={() => {
                            setEdition(u)
                          }}
                        >
                          Modifier
                        </button>
                        {u.id !== moiId && (
                          <button
                            type="button"
                            className="underline"
                            disabled={envoi}
                            aria-label={`${u.actif ? 'Désactiver' : 'Réactiver'} ${u.identifiantExterne}`}
                            onClick={() => {
                              void changerEtat(u, !u.actif)
                            }}
                          >
                            {u.actif ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ))}
      </section>
      {edition && (
        <ModaleModifier
          utilisateur={edition}
          estMoi={edition.id === moiId}
          sites={listeSites}
          onFermer={(msg) => {
            setEdition(null)
            if (msg) {
              setMessage(msg)
              recharger()
            }
          }}
        />
      )}
    </main>
  )
}

function SelecteurRoles({
  valeur,
  onChange,
  desactive = false,
}: {
  valeur: Role[]
  onChange: (r: Role[]) => void
  desactive?: boolean
}) {
  return (
    <fieldset className="mt-2" disabled={desactive}>
      <legend className="text-sm">Rôles</legend>
      <div className="mt-1 flex flex-wrap gap-3 text-sm">
        {ROLES.map((r) => (
          <label key={r} className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={valeur.includes(r)}
              onChange={(e) => {
                onChange(e.target.checked ? [...valeur, r] : valeur.filter((x) => x !== r))
              }}
            />
            {LIBELLE_ROLE[r]}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

function SelecteurPerimetre({
  sites,
  valeur,
  onChange,
  desactive = false,
}: {
  sites: SiteAdmin[]
  valeur: PerimetreEntree[]
  onChange: (p: PerimetreEntree[]) => void
  desactive?: boolean
}) {
  const [plateformeId, setPlateformeId] = useState('')
  const [atelierId, setAtelierId] = useState('')
  const site = sites.find((s) => String(s.id) === plateformeId)
  function ajouter() {
    if (!site) return
    onChange([
      ...valeur,
      { plateformeId: site.id, atelierId: atelierId ? Number(atelierId) : null },
    ])
    setAtelierId('')
  }
  const nomSite = (id: number) => sites.find((s) => s.id === id)?.nom ?? `Site ${String(id)}`
  const nomAtelier = (pid: number, id: number | null | undefined) =>
    id == null
      ? 'Tous les ateliers'
      : (sites.find((s) => s.id === pid)?.ateliers.find((a) => a.id === id)?.libelle ??
        `Atelier ${String(id)}`)
  return (
    <fieldset className="mt-3" disabled={desactive}>
      <legend className="text-sm">
        Périmètre (sans objet pour un administrateur : tous les sites)
      </legend>
      {valeur.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">Aucun accès.</p>
      ) : (
        <ul className="mt-1 text-sm" aria-label="Périmètre">
          {valeur.map((p, i) => (
            <li
              key={`${String(p.plateformeId)}-${String(p.atelierId ?? '')}`}
              className="flex gap-2"
            >
              <span>
                {nomSite(p.plateformeId)} · {nomAtelier(p.plateformeId, p.atelierId)}
              </span>
              <button
                type="button"
                className="underline"
                aria-label={`Retirer ${nomSite(p.plateformeId)}`}
                onClick={() => {
                  onChange(valeur.filter((_, j) => j !== i))
                }}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-end gap-2 text-sm">
        <label>
          Site
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={plateformeId}
            onChange={(e) => {
              setPlateformeId(e.target.value)
              setAtelierId('')
            }}
          >
            <option value="">Choisir…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nom}
              </option>
            ))}
          </select>
        </label>
        <label>
          Atelier
          <select
            className="ml-1 rounded-md border border-slate-300 px-2 py-1"
            value={atelierId}
            onChange={(e) => {
              setAtelierId(e.target.value)
            }}
          >
            <option value="">Tous les ateliers</option>
            {(site?.ateliers ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.libelle}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" disabled={!site} onClick={ajouter}>
          Ajouter au périmètre
        </Button>
      </div>
    </fieldset>
  )
}

function FormulaireCreation({
  sites,
  onCree,
  onErreur,
}: {
  sites: SiteAdmin[]
  onCree: (message: string) => void
  onErreur: (e: unknown) => void
}) {
  const [identifiantExterne, setIdentifiant] = useState('')
  const [nom, setNom] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [perimetre, setPerimetre] = useState<PerimetreEntree[]>([])
  const [envoi, setEnvoi] = useState(false)
  async function creer(e: SyntheticEvent) {
    e.preventDefault()
    setEnvoi(true)
    try {
      const u = await apiPost('/api/admin/utilisateurs', {
        schema: UtilisateurAdminSchema,
        body: {
          identifiantExterne,
          ...(nom.trim() ? { nom: nom.trim() } : {}),
          roles,
          perimetre,
        },
      })
      setIdentifiant('')
      setNom('')
      setRoles([])
      setPerimetre([])
      onCree(`Compte « ${u.identifiantExterne} » créé.`)
    } catch (err) {
      onErreur(err)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <form
      className="mt-4 rounded-md border border-slate-200 p-3 text-sm"
      aria-label="Nouvel utilisateur"
      onSubmit={(e) => {
        void creer(e)
      }}
    >
      <h2 className="font-semibold">Nouvel utilisateur</h2>
      <div className="mt-2 flex flex-wrap gap-3">
        <label>
          Identifiant
          <input
            className="ml-1 w-56 rounded-md border border-slate-300 px-2 py-1"
            value={identifiantExterne}
            maxLength={100}
            onChange={(e) => {
              setIdentifiant(e.target.value)
            }}
          />
        </label>
        <label>
          Nom
          <input
            className="ml-1 w-56 rounded-md border border-slate-300 px-2 py-1"
            value={nom}
            maxLength={100}
            onChange={(e) => {
              setNom(e.target.value)
            }}
          />
        </label>
      </div>
      <SelecteurRoles valeur={roles} onChange={setRoles} />
      <SelecteurPerimetre sites={sites} valeur={perimetre} onChange={setPerimetre} />
      <div className="mt-3">
        <Button type="submit" disabled={envoi || !identifiantExterne.trim() || roles.length === 0}>
          Créer le compte
        </Button>
      </div>
    </form>
  )
}

function ModaleModifier({
  utilisateur,
  estMoi,
  sites,
  onFermer,
}: {
  utilisateur: UtilisateurAdmin
  estMoi: boolean
  sites: SiteAdmin[]
  onFermer: (message: string | null) => void
}) {
  const [nom, setNom] = useState(utilisateur.nom ?? '')
  const [roles, setRoles] = useState<Role[]>(utilisateur.roles)
  const [perimetre, setPerimetre] = useState<PerimetreEntree[]>(
    utilisateur.perimetre.map((p) => ({ plateformeId: p.plateformeId, atelierId: p.atelierId })),
  )
  const [erreur, setErreur] = useState<unknown>(null)
  const [envoi, setEnvoi] = useState(false)
  async function enregistrer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiRequest('PATCH', `/api/admin/utilisateurs/${String(utilisateur.id)}`, {
        schema: UtilisateurAdminSchema,
        body: {
          version: utilisateur.version,
          nom: nom.trim() ? nom.trim() : null,
          ...(estMoi ? {} : { roles, perimetre }),
        },
      })
      onFermer(`Compte « ${utilisateur.identifiantExterne} » modifié.`)
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={`Modifier ${utilisateur.identifiantExterne}`}
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer(null)
      }}
    >
      <label className="block text-sm">
        Nom
        <input
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1"
          value={nom}
          maxLength={100}
          onChange={(e) => {
            setNom(e.target.value)
          }}
        />
      </label>
      {estMoi && (
        <p className="mt-2 text-sm text-slate-600">
          C’est votre compte : vos rôles et votre périmètre ne se modifient pas ici.
        </p>
      )}
      <SelecteurRoles valeur={roles} onChange={setRoles} desactive={estMoi} />
      <SelecteurPerimetre
        sites={sites}
        valeur={perimetre}
        onChange={setPerimetre}
        desactive={estMoi}
      />
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          onClick={() => {
            onFermer(null)
          }}
        >
          Annuler
        </Button>
        <Button
          type="button"
          disabled={envoi || roles.length === 0}
          onClick={() => {
            void enregistrer()
          }}
        >
          Enregistrer
        </Button>
      </div>
    </Modale>
  )
}
