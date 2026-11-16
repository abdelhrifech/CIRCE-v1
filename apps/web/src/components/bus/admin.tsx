import { useState } from 'react'
import {
  BUS_FORMATS,
  BusReferencesVersionSchema,
  ReferentielsReceptionSchema,
  type BusReferences,
} from '@circe/shared'
import { apiPost, apiRequest } from '../../lib/api-client.ts'
import { useApi } from '../../lib/use-api.ts'
import { Button } from '../button.tsx'
import { ErrorMessage } from '../error-message.tsx'
import { TableMetier } from '../ui/table-metier.tsx'
const champ = 'w-full min-w-20 rounded border px-2 py-1.5 text-sm'
export function AdminBus() {
  const { etat, recharger } = useApi('bus-referentiel', (signal) =>
    apiRequest('GET', '/api/bus/referentiel', { schema: BusReferencesVersionSchema, signal }),
  )
  const { etat: refs } = useApi('bus-admin-ref', (signal) =>
    apiRequest('GET', '/api/reception/referentiels', {
      schema: ReferentielsReceptionSchema,
      signal,
    }),
  )
  return (
    <main className="mx-auto max-w-[1600px] p-6">
      <p className="text-sm text-slate-500">Administration</p>
      <h1 className="mb-5 text-2xl font-semibold">Référentiel Bus</h1>
      {etat.kind === 'loading' && <p>Chargement…</p>}
      {etat.kind === 'error' && <ErrorMessage error={etat.error} onRetry={recharger} />}
      {etat.kind === 'ready' && refs.kind === 'ready' && (
        <Edition
          key={etat.data.version}
          initial={etat.data}
          plateformes={refs.data.plateformes}
          supports={refs.data.formats}
          onSauvee={recharger}
        />
      )}
      {refs.kind === 'error' && <ErrorMessage error={refs.error} />}
    </main>
  )
}
function Edition({
  initial,
  plateformes,
  supports,
  onSauvee,
}: {
  initial: BusReferences & { version: number }
  plateformes: { id: number; nom: string }[]
  supports: { id: number; nom: string }[]
  onSauvee: () => void
}) {
  const [ref, setRef] = useState<BusReferences>({
      dsps: initial.dsps,
      centres: initial.centres,
      parcs: initial.parcs,
      formats: BUS_FORMATS.map(
        (f) =>
          initial.formats.find((x) => x.code === f.code) ?? {
            code: f.code,
            supportId: 0,
            patrimoineCode: '',
            libelleBroadcast: '',
          },
      ),
    }),
    [erreur, setErreur] = useState<unknown>(null),
    [envoi, setEnvoi] = useState(false),
    [message, setMessage] = useState('')
  const [dsp, setDsp] = useState({ code: '', nom: '', plateformeId: '' }),
    [centre, setCentre] = useState({ code: '', nom: '', dspCode: '' }),
    [parc, setParc] = useState({
      centreCode: '',
      parc: 'A',
      formatCode: 'AR1',
      cadastre: 0,
      terrain: 0,
    })
  async function sauver() {
    setEnvoi(true)
    setErreur(null)
    try {
      await apiPost('/api/bus/referentiel', {
        schema: BusReferencesVersionSchema,
        body: { ...ref, version: initial.version },
      })
      setMessage('Référentiel Bus enregistré.')
      onSauvee()
    } catch (e) {
      setErreur(e)
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">DSP et plateforme</h2>
          <TableMetier
            nom="bus-dsp"
            cle={(d) => d.code}
            lignes={ref.dsps}
            colonnes={[
              { id: 'nom', titre: 'DSP', valeur: (d) => d.nom },
              {
                id: 'plateforme',
                titre: 'Plateforme',
                valeur: (d) =>
                  plateformes.find((p) => p.id === d.plateformeId)?.nom ?? 'Aucune (sous-traitant)',
              },
              {
                id: 'centres',
                titre: 'Centres bus',
                valeur: (d) =>
                  ref.centres
                    .filter((c) => c.dspCode === d.code)
                    .map((c) => c.nom)
                    .join(', '),
              },
            ]}
            actions={(d) => (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setRef((r) => ({ ...r, dsps: r.dsps.filter((x) => x.code !== d.code) }))
                }}
              >
                Retirer
              </button>
            )}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className={champ}
              aria-label="Code de la DSP"
              placeholder="Code de la DSP"
              value={dsp.code}
              onChange={(e) => {
                setDsp((d) => ({ ...d, code: e.target.value }))
              }}
            />
            <input
              className={champ}
              aria-label="Nom de la DSP"
              placeholder="Nom de la DSP"
              value={dsp.nom}
              onChange={(e) => {
                setDsp((d) => ({ ...d, nom: e.target.value }))
              }}
            />
            <select
              className={champ}
              aria-label="Plateforme de la DSP"
              value={dsp.plateformeId}
              onChange={(e) => {
                setDsp((d) => ({ ...d, plateformeId: e.target.value }))
              }}
            >
              <option value="">Aucune (sous-traitant)</option>
              {plateformes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={!dsp.code.trim() || !dsp.nom.trim()}
              onClick={() => {
                setRef((r) => ({
                  ...r,
                  dsps: [
                    ...r.dsps,
                    {
                      code: dsp.code.trim(),
                      nom: dsp.nom.trim(),
                      plateformeId: dsp.plateformeId ? Number(dsp.plateformeId) : null,
                    },
                  ],
                }))
                setDsp({ code: '', nom: '', plateformeId: '' })
              }}
            >
              Ajouter une DSP
            </Button>
          </div>
        </section>
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold">Centres bus</h2>
          <TableMetier
            nom="bus-centres"
            cle={(c) => c.code}
            lignes={ref.centres}
            colonnes={[
              { id: 'code', titre: 'Code', valeur: (c) => c.code },
              { id: 'nom', titre: 'Centre bus', valeur: (c) => c.nom },
              {
                id: 'dsp',
                titre: 'DSP',
                valeur: (c) => ref.dsps.find((d) => d.code === c.dspCode)?.nom,
              },
            ]}
            actions={(c) => (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  setRef((r) => ({ ...r, centres: r.centres.filter((x) => x.code !== c.code) }))
                }}
              >
                Retirer
              </button>
            )}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              className={champ}
              aria-label="Code centre bus"
              placeholder="Code centre bus"
              value={centre.code}
              onChange={(e) => {
                setCentre((c) => ({ ...c, code: e.target.value }))
              }}
            />
            <input
              className={champ}
              aria-label="Nom centre bus"
              placeholder="Nom centre bus"
              value={centre.nom}
              onChange={(e) => {
                setCentre((c) => ({ ...c, nom: e.target.value }))
              }}
            />
            <select
              aria-label="DSP du centre bus"
              className={champ}
              value={centre.dspCode}
              onChange={(e) => {
                setCentre((c) => ({ ...c, dspCode: e.target.value }))
              }}
            >
              <option value="">DSP</option>
              {ref.dsps.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.nom}
                </option>
              ))}
            </select>
            <Button
              type="button"
              disabled={!centre.code.trim() || !centre.nom.trim() || !centre.dspCode}
              onClick={() => {
                setRef((r) => ({
                  ...r,
                  centres: [
                    ...r.centres,
                    { ...centre, code: centre.code.trim(), nom: centre.nom.trim() },
                  ],
                }))
                setCentre({ code: '', nom: '', dspCode: '' })
              }}
            >
              Ajouter un centre
            </Button>
          </div>
        </section>
      </div>
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">Les cinq formats Bus</h2>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {[
                  'Format',
                  'Support Circé',
                  'Code de composition du patrimoine',
                  'Sur la feuille de route Broadcast',
                  'Vernis',
                ].map((t) => (
                  <th key={t} className="p-2 text-left">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ref.formats.map((f, index) => (
                <tr key={f.code} className="border-t">
                  <td className="p-2">{BUS_FORMATS.find((x) => x.code === f.code)?.nom}</td>
                  <td className="p-2">
                    <select
                      className={champ}
                      aria-label={`Support ${f.code}`}
                      value={f.supportId}
                      onChange={(e) => {
                        setRef((r) => ({
                          ...r,
                          formats: r.formats.map((x, i) =>
                            i === index ? { ...x, supportId: Number(e.target.value) } : x,
                          ),
                        }))
                      }}
                    >
                      <option value={0}>Sélectionner</option>
                      {supports.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nom}
                        </option>
                      ))}
                    </select>
                  </td>
                  {(['patrimoineCode', 'libelleBroadcast'] as const).map((k) => (
                    <td key={k} className="p-2">
                      <input
                        className={champ}
                        aria-label={`${k === 'patrimoineCode' ? 'Code patrimoine' : 'Libellé Broadcast'} ${f.code}`}
                        value={f[k]}
                        onChange={(e) => {
                          setRef((r) => ({
                            ...r,
                            formats: r.formats.map((x, i) =>
                              i === index ? { ...x, [k]: e.target.value } : x,
                            ),
                          }))
                        }}
                      />
                    </td>
                  ))}
                  <td className="p-2">
                    {f.code === 'AV' ? 'Oui : +48 h en Dernière Minute' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold">
          Plaques par centre bus, parc et format : cadastre et terrain
        </h2>
        <TableMetier
          nom="bus-referentiel-parcs"
          cle={(p) => `${p.centreCode}|${p.parc}|${p.formatCode}`}
          lignes={ref.parcs}
          colonnes={[
            {
              id: 'centre',
              titre: 'Centre bus',
              valeur: (p) => ref.centres.find((c) => c.code === p.centreCode)?.nom,
            },
            {
              id: 'dsp',
              titre: 'DSP',
              valeur: (p) =>
                ref.dsps.find(
                  (d) => d.code === ref.centres.find((c) => c.code === p.centreCode)?.dspCode,
                )?.nom,
            },
            { id: 'parc', titre: 'Parc', valeur: (p) => p.parc },
            {
              id: 'format',
              titre: 'Format',
              valeur: (p) => BUS_FORMATS.find((f) => f.code === p.formatCode)?.nom,
            },
            { id: 'cadastre', titre: 'Cadastre', valeur: (p) => p.cadastre },
            { id: 'terrain', titre: 'Terrain', valeur: (p) => p.terrain },
          ]}
          actions={(p) => (
            <button
              type="button"
              className="underline"
              onClick={() => {
                setParc({ ...p })
                setRef((r) => ({ ...r, parcs: r.parcs.filter((x) => x !== p) }))
              }}
            >
              Modifier
            </button>
          )}
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select
            className={champ}
            aria-label="Centre du parc"
            value={parc.centreCode}
            onChange={(e) => {
              setParc((p) => ({ ...p, centreCode: e.target.value }))
            }}
          >
            <option value="">Centre bus</option>
            {ref.centres.map((c) => (
              <option key={c.code} value={c.code}>
                {c.nom}
              </option>
            ))}
          </select>
          <input
            className={champ}
            aria-label="Parc"
            placeholder="A, B…"
            value={parc.parc}
            onChange={(e) => {
              setParc((p) => ({ ...p, parc: e.target.value }))
            }}
          />
          <select
            className={champ}
            aria-label="Format du parc"
            value={parc.formatCode}
            onChange={(e) => {
              setParc((p) => ({ ...p, formatCode: e.target.value }))
            }}
          >
            {BUS_FORMATS.map((f) => (
              <option key={f.code} value={f.code}>
                {f.nom}
              </option>
            ))}
          </select>
          {(['cadastre', 'terrain'] as const).map((k) => (
            <label key={k} className="text-xs">
              {k}
              <input
                className={champ}
                type="number"
                min={0}
                value={parc[k]}
                onChange={(e) => {
                  setParc((p) => ({ ...p, [k]: Number(e.target.value) }))
                }}
              />
            </label>
          ))}
          <Button
            type="button"
            disabled={!parc.centreCode || !parc.parc.trim()}
            onClick={() => {
              setRef((r) => ({
                ...r,
                parcs: [
                  ...r.parcs,
                  {
                    ...parc,
                    parc: parc.parc.trim(),
                    formatCode: parc.formatCode as BusReferences['parcs'][number]['formatCode'],
                  },
                ],
              }))
              setParc({ centreCode: '', parc: 'A', formatCode: 'AR1', cadastre: 0, terrain: 0 })
            }}
          >
            Ajouter au parc
          </Button>
        </div>
      </section>
      {message && <p role="status">{message}</p>}
      {erreur !== null && <ErrorMessage error={erreur} />}
      <div className="flex justify-end">
        <Button type="button" disabled={envoi} onClick={() => void sauver()}>
          {envoi ? 'Enregistrement…' : 'Enregistrer le référentiel Bus'}
        </Button>
      </div>
    </div>
  )
}
