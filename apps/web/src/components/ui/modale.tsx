import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

interface ModaleProps {
  titre: string
  ouverte: boolean
  onOuverture: (ouverte: boolean) => void
  children: ReactNode
  large?: boolean
}

/** Modale accessible (Radix Dialog : focus piégé, Échap, titre annoncé). */
export function Modale({ titre, ouverte, onOuverture, children, large = false }: ModaleProps) {
  return (
    <Dialog.Root open={ouverte} onOpenChange={onOuverture}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg bg-white p-5 shadow-xl ${large ? 'max-w-3xl' : 'max-w-lg'}`}
        >
          <div className="mb-3 flex items-start justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{titre}</Dialog.Title>
            <Dialog.Close
              className="rounded px-2 text-slate-500 hover:bg-slate-100"
              aria-label="Fermer"
            >
              ×
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
