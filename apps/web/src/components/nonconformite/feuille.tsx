import { ImpressionNcResultatSchema, type Nc } from '@circe/shared'
import { useState, useEffect, useRef } from 'react'
import { apiPost } from '../../lib/api-client.ts'
import { ErrorMessage } from '../error-message.tsx'
import { Modale } from '../ui/modale.tsx'
// EX-NEW16-REC-001 — une feuille pour les NC d’une palette, réimprimable depuis le suivi.
export function FeuilleNc({ items }: { items: Nc[] }) {
  const bloquante = items.some((n) => n.bloquante === true)
  const page = useRef<HTMLElement>(null)
  useEffect(() => {
    const ajuster = () => {
      const el = page.current
      if (!el) return
      el.style.zoom = '1'
      el.style.zoom = String(Math.min(1, 1000 / el.scrollHeight))
    }
    const restaurer = () => {
      if (page.current) page.current.style.zoom = '1'
    }
    window.addEventListener('beforeprint', ajuster)
    window.addEventListener('afterprint', restaurer)
    return () => {
      window.removeEventListener('beforeprint', ajuster)
      window.removeEventListener('afterprint', restaurer)
    }
  }, [])

  return (
    <article
      ref={page}
      data-testid="feuille-nc"
      className="break-before-page bg-white p-6 text-black"
      style={{ width: '190mm', breakInside: 'avoid' }}
    >
      <header
        className="mb-5 border-4 p-4 text-center"
        style={{
          borderStyle: bloquante ? 'dashed' : 'solid',
          borderColor: bloquante ? '#b42318' : '#111',
        }}
      >
        <h2 className="text-3xl font-extrabold">NON-CONFORMITÉ</h2>
        <p className="text-xl font-bold">
          {bloquante
            ? 'BLOQUANTE(S)'
            : items.every((n) => n.bloquante === false)
              ? 'NON BLOQUANTE(S) — UTILISABLES'
              : 'PORTÉE NON PRÉCISÉE'}
        </p>
      </header>
      <p className="text-2xl font-bold">
        NC {items.map((n) => n.id).join(', ')} · {items[0]?.plateforme}
      </p>
      <p>
        Réception(s) :{' '}
        {[...new Set(items.flatMap((n) => (n.receptionId === null ? [] : [n.receptionId])))].join(
          ', ',
        ) || '—'}
      </p>
      <p>Affiches : {[...new Set(items.flatMap((n) => n.afficheIds))].join(', ') || '—'}</p>
      {items.map((n) => (
        <section key={n.id} className="my-4 border p-3">
          <h3 className="font-bold">
            NC {n.id} · {n.donnees.dossier} · {n.donnees.annonceur}
          </h3>
          <p>
            {n.donnees.theme} · {n.donnees.formats.join(', ')} · {n.donnees.semaine}
          </p>
          <p>Quantité : {n.donnees.quantite || n.donnees.qteRecue || '—'}</p>
          <p>
            Imprimeur :{' '}
            {n.donnees.imprimeur === 'AUTRE'
              ? n.donnees.imprimeurAutre
              : n.donnees.imprimeur || '—'}{' '}
            · Transporteur :{' '}
            {n.donnees.transporteur === 'AUTRE'
              ? n.donnees.transporteurAutre
              : n.donnees.transporteur || '—'}
          </p>
          <p>Justificatifs : {n.fichiers.length}</p>
          <p>{n.donnees.types.join(' · ')}</p>
          <p className="whitespace-pre-wrap">{n.donnees.commentaireNC || n.donnees.commentaire}</p>
          <p>
            {n.statut} · {n.decisions.join(' · ')}
          </p>
          <p>
            Déclarée le {new Date(n.creeLe).toLocaleString('fr-FR')} par {n.auteur}
          </p>
        </section>
      ))}
      <p className="mt-8">
        Quantité mise de côté : _________________________________________________
      </p>
      <p className="mt-8">
        Décision / consignes : __________________________________________________
      </p>
      <p className="mt-8">
        Date et visa : __________________________________________________________
      </p>
    </article>
  )
}
export function ApercuNc({ items, onFermer }: { items: Nc[]; onFermer: () => void }) {
  const [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  async function imprimer() {
    setEnvoi(true)
    setErreur(null)
    try {
      await enregistrerImpressionNc(items)
      window.print()
      onFermer()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre="Feuille de non-conformité"
      ouverte
      large
      onOuverture={(o) => {
        if (!o) onFermer()
      }}
    >
      <div className="zone-impression max-h-[60vh] overflow-auto">
        <FeuilleNc items={items} />
      </div>
      {erreur !== null && <ErrorMessage error={erreur} />}
      <button
        disabled={envoi}
        className="mt-3 rounded border px-4 py-2"
        onClick={() => {
          void imprimer()
        }}
      >
        Imprimer la feuille de non-conformité
      </button>
    </Modale>
  )
}

export async function enregistrerImpressionNc(items: Nc[]) {
  if (!items.length) return
  await apiPost('/api/non-conformites/impressions', {
    schema: ImpressionNcResultatSchema,
    body: { ncs: items.map((n) => ({ id: n.id, version: n.version })) },
  })
}
