// COO-P10 — fichier CSV d'export des trains (RG-COO-213, 215) : reprend la mise en forme du legacy
// (`PreparationDeroulantsService.cs:AppendDataEnTete` / `AppendDataContract` / `FormateThemeRepiquage`,
// 30 caractères par champ, séparateur « ; », 6 contrats au maximum) avec les colonnes disponibles en V2.
// HYPOTHÈSE Q-193 : ce n'est PAS le fichier de production réel (format Vendôme .ini, D-15) ; les colonnes que le
// modèle V2 ne porte pas (adresse 2 / commune, type de réseau, réseau du contrat) sont vides.

export interface ContratExport {
  contrat: number | null
  annonceur: string | null
  theme: string | null
  repiquage: string | null
  /** Lettre de la position dans le train (A à F), tf_train_export (RG-COO-213). */
  lettre: string
  /** Nom du rouleur de la face, s'il est affecté (RG-COO-213, RG-COO-236). */
  rouleur: string | null
}

export interface TrainExporte {
  trainId: string
  /** Statut de la face au moment de l'export (code legacy). */
  statut: number
  format: string | null
  origine: string
  afficheur: string | null
  destinataire: string | null
  adresse1: string | null
  depart: Date
  /** Atelier de 2 m² (5 ou 6 en legacy) : le thème et le repiquage sont concaténés dans le même champ. */
  deuxM2: boolean
  contrats: ContratExport[]
}

/** Caractères retirés d'un champ (legacy `lstCarToRemove`). */
const A_RETIRER = /[:,;*’'`]/g
const nettoyer = (v: string | null | undefined): string => (v ?? '').replace(A_RETIRER, '').trim()
/** Legacy `PadRightOrSubstring(v, 30, ' ')`. */
const champ30 = (v: string | null | undefined): string => nettoyer(v).slice(0, 30).padEnd(30, ' ')

/** Horodatage du nom de fichier (legacy `yyyyMMddHHmmssfff`). */
export function horodatage(d: Date): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${String(d.getUTCFullYear())}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${p(d.getUTCMilliseconds(), 3)}`
}

/** Legacy `FormateThemeRepiquage` : en 2 m², « repiquage - thème », complété par « --- » sous 3 caractères, coupé à 30. */
function themeFormate(c: ContratExport, deuxM2: boolean): string[] {
  if (!deuxM2) return [nettoyer(c.theme), nettoyer(c.repiquage)]
  const rep = (c.repiquage ?? '').trim()
  let t = rep === '' ? (c.theme ?? '') : `${rep} - ${c.theme ?? ''}`
  if (t.trim().length < 3) t = `${t.trim()}---`.slice(0, 3)
  return [nettoyer(t.slice(0, 30))]
}

/** Une ligne CSV par train (en-tête puis jusqu'à `contratsMax` contrats). */
export function ligneCsv(t: TrainExporte, contratsMax: number): string {
  const jour = String(t.depart.getUTCDay())
  const date = t.depart.toISOString().slice(0, 10)
  const entete = [
    t.trainId,
    nettoyer(t.format),
    String(t.statut),
    nettoyer(t.origine),
    champ30(t.afficheur),
    '3',
    champ30(t.destinataire),
    champ30(t.adresse1),
    champ30(null),
    champ30(`(${jour}) ${date}`),
    champ30(null),
  ]
  const contrats = t.contrats
    .slice(0, contratsMax)
    .flatMap((c) => [
      nettoyer(c.contrat === null ? '' : String(c.contrat)),
      '',
      nettoyer(c.annonceur),
      ...themeFormate(c, t.deuxM2),
    ])
  return [...entete, ...contrats].join(';')
}

export function contenuCsv(trains: readonly TrainExporte[], contratsMax: number): string {
  return trains.map((t) => ligneCsv(t, contratsMax)).join('\r\n') + '\r\n'
}
