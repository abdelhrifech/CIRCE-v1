/** RG-COO-061 / RG-COO-160 : acteur des traitements automatiques. */
export const CIRCE_AUTOMATIQUE = 'Circé (automatique)'

const entier = (x: string | undefined) => (x !== undefined && /^\d+$/.test(x) ? Number(x) : null)

export interface TypesVisuels {
  visuel: { typePreparationId: number | null; supportId: number | null }
  bdx: number | null
  venusial: { type: number; typePreparationId: number; supportId: number } | null
  detail: number | null
}

/** RG-COO-128 : « visuel:10:26;bdx:2;detail21:11:1026;detail:10 » (HYPOTHÈSE de format, Q-188 (6)). */
export function lireTypesVisuels(valeur: string): TypesVisuels {
  const t: TypesVisuels = {
    visuel: { typePreparationId: null, supportId: null },
    bdx: null,
    venusial: null,
    detail: null,
  }
  for (const p of valeur.split(';')) {
    const [cle, ...v] = p.split(':').map((x) => x.trim())
    const n = v.map(entier)
    if (cle === 'visuel') t.visuel = { typePreparationId: n[0] ?? null, supportId: n[1] ?? null }
    else if (cle === 'bdx') t.bdx = n[0] ?? null
    else if (cle === 'detail') t.detail = n[0] ?? null
    else if (cle?.startsWith('detail')) {
      const type = entier(cle.slice('detail'.length))
      if (type !== null && n[0] != null && n[1] != null)
        t.venusial = { type, typePreparationId: n[0], supportId: n[1] }
    }
  }
  return t
}
