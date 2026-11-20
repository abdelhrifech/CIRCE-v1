import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ListeMailsSchema, STATUTS_MAIL, TYPES_MAIL, type MailFile } from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { PageAdmin } from '../../components/admin/page.tsx'
export const Route = createFileRoute('/admin/mails')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Page,
})
function Page() {
  const [statut, setStatut] = useState(''),
    [type, setType] = useState(''),
    [detail, setDetail] = useState<MailFile | null>(null)
  const qs = new URLSearchParams({
    limite: '200',
    ...(statut ? { statut } : {}),
    ...(type ? { type } : {}),
  })
  const { etat, recharger } = useApi(`file-mails-${qs}`, (signal) =>
    apiRequest('GET', `/api/admin/file-envoi?${qs}`, { schema: ListeMailsSchema, signal }),
  )
  return (
    <PageAdmin titre="Mails">
      <div className="my-4 flex gap-4">
        <label>
          Statut
          <select
            className="ml-2 rounded border p-2"
            value={statut}
            onChange={(e) => {
              setStatut(e.target.value)
            }}
          >
            <option value="">Tous</option>
            {STATUTS_MAIL.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            className="ml-2 rounded border p-2"
            value={type}
            onChange={(e) => {
              setType(e.target.value)
            }}
          >
            <option value="">Tous</option>
            {TYPES_MAIL.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="button" className="underline" onClick={recharger}>
          Actualiser
        </button>
      </div>
      {etat.kind === 'loading' && <p>Chargement des mails…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <p className="my-3 rounded border p-3">
            {etat.data.canalActif === 'SIMULE'
              ? 'Boîte de développement : les envois sont simulés.'
              : 'Canal SMTP configuré.'}{' '}
            {etat.data.mails.length} mail(s) affiché(s) sur {etat.data.total}.
          </p>
          <TableMetier
            nom="File des mails"
            lignes={etat.data.mails}
            cle={(m) => m.id}
            onOuvrir={(m) => {
              setDetail(m)
            }}
            colonnes={[
              {
                id: 'date',
                titre: 'Créé le',
                valeur: (m) => new Date(m.creeLe).toLocaleString('fr-FR'),
              },
              { id: 'dest', titre: 'Destinataires', valeur: (m) => m.destinataires.join(', ') },
              { id: 'sujet', titre: 'Sujet', valeur: (m) => m.sujet },
              { id: 'type', titre: 'Type', valeur: (m) => m.type },
              { id: 'statut', titre: 'Statut', valeur: (m) => m.statut },
              { id: 'canal', titre: 'Canal', valeur: (m) => m.canal },
              { id: 'erreur', titre: 'Dernière erreur', valeur: (m) => m.derniereErreur },
              { id: 'tentatives', titre: 'Tentatives', valeur: (m) => m.tentatives, cachee: true },
            ]}
          />
        </>
      )}
      {detail && (
        <Modale
          titre={detail.sujet}
          ouverte
          large
          onOuverture={(o) => {
            if (!o) setDetail(null)
          }}
        >
          <p>À : {detail.destinataires.join(', ')}</p>
          <p className="my-3">
            {detail.statut} · {detail.canal ?? 'En attente'} · {detail.tentatives} tentative(s)
          </p>
          <pre className="whitespace-pre-wrap rounded border bg-slate-50 p-4 font-sans">
            {detail.corps}
          </pre>
          <button
            type="button"
            className="mt-4 underline"
            onClick={() => {
              setDetail(null)
            }}
          >
            Fermer
          </button>
        </Modale>
      )}
    </PageAdmin>
  )
}
