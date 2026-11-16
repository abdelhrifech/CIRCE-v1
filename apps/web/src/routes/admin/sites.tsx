import { createFileRoute } from '@tanstack/react-router'
import { SitesAdminSchema } from '@circe/shared'
import { ErrorMessage } from '../../components/error-message.tsx'
import { Pastille } from '../../components/ui/pastille.tsx'
import { Button } from '../../components/button.tsx'
import { apiRequest } from '../../lib/api-client.ts'
import { requirePermission } from '../../lib/session.ts'
import { useApi } from '../../lib/use-api.ts'
import { useState } from 'react'

// Étape 8 (D-02) — ECR-ADM-01 « Sites, ateliers et gammes » : lecture seule (pas de CRUD dans la maquette). Les
// formats, machines et gammes de fabrication ne sont pas modélisés (ECARTS). Hypothèses : Q-406.

export const Route = createFileRoute('/admin/sites')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Sites,
})

function Sites() {
  const [recherche, setRecherche] = useState('')
  const [q, setQ] = useState('')
  const { etat, recharger } = useApi(`admin-sites-${q}`, (signal) =>
    apiRequest('GET', `/api/admin/sites${q ? `?q=${encodeURIComponent(q)}` : ''}`, {
      schema: SitesAdminSchema,
      signal,
    }),
  )
  return (
    <main className="mx-auto max-w-5xl p-6">
      <p className="text-sm text-slate-500">Administration › Paramétrage</p>
      <h1 className="text-2xl font-semibold">Sites et ateliers</h1>
      <p className="mt-3 text-sm text-slate-600">
        Lecture seule. Mode « Trains » = atelier déroulant ; mode « Unitaire » = atelier fixe,
        pliage ou bus. L’identifiant d’un atelier sert à renseigner les paramètres de la page «
        Règles métier ».
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3 text-sm"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(recherche.trim())
        }}
        aria-label="Recherche"
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
      <section className="mt-4" aria-label="Sites">
        {etat.kind === 'loading' && <p>Chargement…</p>}
        {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
        {etat.kind === 'ready' &&
          (etat.data.sites.length === 0 ? (
            <p className="text-sm text-slate-600">Aucun site pour cette recherche.</p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {etat.data.sites.length} site(s) affiché(s) sur {etat.data.total}. Affinez la
                recherche pour voir les autres.
              </p>
              <table className="w-full text-sm" aria-label="Ateliers par site">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th>Site</th>
                    <th>Atelier</th>
                    <th>Identifiant</th>
                    <th>Mode</th>
                    <th>Code AMT</th>
                  </tr>
                </thead>
                <tbody>
                  {etat.data.sites.flatMap((s) =>
                    s.ateliers.length === 0
                      ? [
                          <tr key={`s${String(s.id)}`} className="border-b">
                            <td className="py-1">
                              {s.nom}
                              {s.localite ? ` · ${s.localite}` : ''}
                            </td>
                            <td className="text-slate-500" colSpan={4}>
                              Aucun atelier
                            </td>
                          </tr>,
                        ]
                      : s.ateliers.map((a) => (
                          <tr key={`a${String(a.id)}`} className="border-b">
                            <td className="py-1">
                              {s.nom}
                              {s.localite ? ` · ${s.localite}` : ''}
                            </td>
                            <td>{a.libelle}</td>
                            <td>{a.id}</td>
                            <td>
                              <Pastille ton={a.type === 'SCROLL' ? 'info' : 'neutre'}>
                                {a.type === 'SCROLL' ? 'Trains (déroulant)' : 'Unitaire'}
                              </Pastille>
                            </td>
                            <td>{a.codeAmt ?? '—'}</td>
                          </tr>
                        )),
                  )}
                </tbody>
              </table>
            </>
          ))}
      </section>
    </main>
  )
}
