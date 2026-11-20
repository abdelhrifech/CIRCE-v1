import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  MachinesAdminSchema,
  MachineConfigurationSchema,
  MachineConfigurationInputSchema,
} from '@circe/shared'
import { requirePermission } from '../../lib/session.ts'
import { apiRequest, apiPost } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { TableMetier } from '../../components/ui/table-metier.tsx'
import { Modale } from '../../components/ui/modale.tsx'
import { Button } from '../../components/button.tsx'
import { ErrorMessage } from '../../components/error-message.tsx'
import { PageAdmin } from '../../components/admin/page.tsx'
export const Route = createFileRoute('/admin/machines')({
  beforeLoad: requirePermission('parametrage.gerer'),
  component: Page,
})
const vide = {
  version: 0,
  nom: '',
  type: '',
  fichier: false,
  tiroirsMax: null,
  sortie: null,
  repertoire: null,
  bagues: null,
}
type Machine = ReturnType<typeof MachineConfigurationSchema.parse>
function Page() {
  const { etat, recharger } = useApi('machines-admin', (signal) =>
    apiRequest('GET', '/api/admin/machines', { schema: MachinesAdminSchema, signal }),
  )
  const [edition, setEdition] = useState<Machine | null | false>(false),
    [message, setMessage] = useState('')
  return (
    <PageAdmin titre="Machines et fichiers">
      <Button
        onClick={() => {
          setEdition(null)
        }}
      >
        Ajouter une machine
      </Button>
      {message && (
        <p role="status" className="my-3">
          {message}
        </p>
      )}
      {etat.kind === 'loading' && <p>Chargement des machines…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && (
        <>
          <h2 className="my-3 text-lg font-semibold">Machines</h2>
          <TableMetier
            nom="Machines"
            lignes={etat.data.machines}
            cle={(r) => r.id}
            vide="Aucune machine référencée. Ajoutez une machine pour renseigner ses caractéristiques."
            colonnes={[
              { id: 'nom', titre: 'Machine', valeur: (r) => r.nom },
              { id: 'type', titre: 'Type', valeur: (r) => r.type },
              { id: 'fichier', titre: 'Fichier', valeur: (r) => (r.fichier ? 'Oui' : 'Non') },
              { id: 'tiroirs', titre: 'Tiroirs max', valeur: (r) => r.tiroirsMax },
              { id: 'sortie', titre: 'Format de sortie', valeur: (r) => r.sortie },
              { id: 'depot', titre: 'Dépôt', valeur: (r) => r.repertoire },
              { id: 'bagues', titre: 'Bagues', valeur: (r) => r.bagues },
            ]}
            actions={(r) => (
              <button
                className="underline"
                onClick={() => {
                  setEdition(r)
                }}
              >
                Modifier
              </button>
            )}
          />
          <h2 className="my-5 text-lg font-semibold">Paramètres du générateur existant</h2>
          <TableMetier
            nom="Paramètres des fichiers"
            lignes={etat.data.parametres}
            cle={(r) => r.cle}
            colonnes={[
              { id: 'cle', titre: 'Paramètre', valeur: (r) => r.cle },
              { id: 'valeur', titre: 'Valeur', valeur: (r) => r.valeur },
            ]}
          />
          <p className="my-3 text-sm text-slate-600">
            Le référentiel décrit les machines. Le raccordement à chaque machine et l’application de
            ses caractéristiques aux traitements de production font l’objet d’une validation
            séparée.
          </p>
        </>
      )}
      {edition !== false && (
        <Edition
          initial={edition}
          onFermer={() => {
            setEdition(false)
          }}
          onSauvee={() => {
            setMessage('Machine enregistrée.')
            setEdition(false)
            recharger()
          }}
        />
      )}
    </PageAdmin>
  )
}
function Edition({
  initial,
  onFermer,
  onSauvee,
}: {
  initial: Machine | null
  onFermer: () => void
  onSauvee: () => void
}) {
  const [f, setF] = useState<ReturnType<typeof MachineConfigurationInputSchema.parse>>(
      initial ?? vide,
    ),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false)
  async function sauver() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost(initial ? `/api/admin/machines/${initial.id}` : '/api/admin/machines', {
        schema: MachineConfigurationSchema,
        body: MachineConfigurationInputSchema.parse(f),
      })
      onSauvee()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <Modale
      titre={initial ? 'Modifier la machine' : 'Ajouter une machine'}
      ouverte
      onOuverture={(o) => {
        if (!o && !envoi) onFermer()
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void sauver()
        }}
        className="space-y-3"
      >
        {(['nom', 'type', 'sortie', 'repertoire', 'bagues'] as const).map((k) => (
          <label key={k} className="block">
            {
              {
                nom: 'Machine *',
                type: 'Type *',
                sortie: 'Format de sortie',
                repertoire: 'Dépôt',
                bagues: 'Bagues',
              }[k]
            }
            <input
              required={k === 'nom' || k === 'type'}
              className="block w-full rounded border p-2"
              value={f[k] ?? ''}
              onChange={(e) => {
                setF({
                  ...f,
                  [k]: k === 'nom' || k === 'type' ? e.target.value : e.target.value || null,
                })
              }}
            />
          </label>
        ))}
        <label className="block">
          Tiroirs max
          <input
            type="number"
            min={1}
            max={1000}
            className="block rounded border p-2"
            value={f.tiroirsMax ?? ''}
            onChange={(e) => {
              setF({ ...f, tiroirsMax: e.target.value ? Number(e.target.value) : null })
            }}
          />
        </label>
        <label className="block">
          <input
            type="checkbox"
            checked={f.fichier}
            onChange={(e) => {
              setF({ ...f, fichier: e.target.checked })
            }}
          />{' '}
          Fichier nécessaire
        </label>
        {erreur !== null && <ErrorMessage error={erreur} />}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={envoi} onClick={onFermer}>
            Annuler
          </button>
          <Button type="submit" disabled={envoi}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Modale>
  )
}
