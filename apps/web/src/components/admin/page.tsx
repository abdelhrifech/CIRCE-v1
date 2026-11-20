import type { ReactNode } from 'react'
export function PageAdmin({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <p className="text-sm text-slate-500">Administration · Paramétrage</p>
      <h1 className="mb-5 text-2xl font-semibold">{titre}</h1>
      {children}
    </main>
  )
}
