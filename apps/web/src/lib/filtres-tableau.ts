// EX-NEW16-TRA-001 — ui.js, opérateurs des colonnes, anciens raccourcis numériques conservés.
export const OPERATEURS = {
  contient: 'Contient',
  egal: 'Est égal à',
  different: 'N’est pas égal à',
  commence: 'Commence par',
  termine: 'Se termine par',
  necontient: 'Ne contient pas',
  sup: 'Est supérieur à',
  supeg: 'Est supérieur ou égal à',
  inf: 'Est inférieur à',
  infeg: 'Est inférieur ou égal à',
  vide: 'Est vide',
  nonvide: 'N’est pas vide',
} as const
export type Operateur = keyof typeof OPERATEURS
const normaliser = (v: unknown) =>
  (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
export function filtreTableau(
  valeur: unknown,
  saisie: string,
  op: Operateur = 'contient',
): boolean {
  const t = normaliser(valeur),
    q = normaliser(saisie),
    vide = !t || t === '—' || t === '-'
  if (op === 'vide') return vide
  if (op === 'nonvide') return !vide
  if (!q) return true
  const court = /^(>=|<=|>|<|=)\s*(-?\d+(?:[.,]\d+)?)$/.exec(q)
  if (op === 'contient' && court && typeof valeur === 'number') {
    const ops: Record<string, Operateur> = {
      '>': 'sup',
      '>=': 'supeg',
      '<': 'inf',
      '<=': 'infeg',
      '=': 'egal',
    }
    return filtreTableau(valeur, court[2] ?? '', ops[court[1] ?? ''] ?? 'contient')
  }
  if (
    ['sup', 'supeg', 'inf', 'infeg'].includes(op) ||
    (typeof valeur === 'number' && ['egal', 'different'].includes(op))
  ) {
    const v = Number(t.replace(/\s/g, '').replace(',', '.')),
      n = Number(q.replace(',', '.'))
    if (vide || !Number.isFinite(v) || !Number.isFinite(n)) return false
    return op === 'sup'
      ? v > n
      : op === 'supeg'
        ? v >= n
        : op === 'inf'
          ? v < n
          : op === 'infeg'
            ? v <= n
            : op === 'egal'
              ? v === n
              : v !== n
  }
  return op === 'egal'
    ? t === q
    : op === 'different'
      ? t !== q
      : op === 'commence'
        ? t.startsWith(q)
        : op === 'termine'
          ? t.endsWith(q)
          : op === 'necontient'
            ? !t.includes(q)
            : t.includes(q)
}
