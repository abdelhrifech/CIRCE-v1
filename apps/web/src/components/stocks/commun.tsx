import type { ReactNode } from 'react'
export const champStock = 'rounded border border-slate-300 bg-white px-3 py-2 text-sm'
export function PageStocks({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1700px] p-6">
      <p className="mb-1 text-sm text-slate-500">Stocks</p>
      <h1 className="mb-5 text-2xl font-semibold">{titre}</h1>
      {children}
    </main>
  )
}
export function IndicateursStocks({
  items,
}: {
  items: { titre: string; valeur: number; detail?: string; onClick?: () => void }[]
}) {
  return (
    <div className="my-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
      {items.map((k) => (
        <button
          type="button"
          key={k.titre}
          onClick={k.onClick}
          className="rounded-lg border bg-white p-4 text-left shadow-sm"
        >
          <span className="text-sm text-slate-600">{k.titre}</span>
          <strong className="my-1 block text-3xl text-sky-900">
            {k.valeur.toLocaleString('fr-FR')}
          </strong>
          {k.detail && <span className="text-xs text-slate-500">{k.detail}</span>}
        </button>
      ))}
    </div>
  )
}
export const cibleFin = (r: {
  plateformeId: number
  dossier: number
  version: number
  empreinte: string
}) => ({
  plateformeId: r.plateformeId,
  dossier: r.dossier,
  version: r.version,
  empreinte: r.empreinte,
})
