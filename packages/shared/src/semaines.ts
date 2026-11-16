import { z } from 'zod'

// Semaines ISO 8601 (RG-COO-083, RG-REC-015 : semaines ISO partout ; le legacy mélangeait DATEPART(wk)).

export interface SemaineIso {
  annee: number
  semaine: number
}

/** Semaine ISO d'une date (UTC) : la semaine 1 contient le premier jeudi de l'année. */
export function semaineIsoDe(date: Date): SemaineIso {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const jour = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - jour)
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const semaine = Math.ceil(((d.getTime() - debutAnnee.getTime()) / 86_400_000 + 1) / 7)
  return { annee: d.getUTCFullYear(), semaine }
}

/** Lundi (UTC, 00:00) de la semaine ISO donnée. */
export function lundiSemaineIso({ annee, semaine }: SemaineIso): Date {
  const quatreJanvier = new Date(Date.UTC(annee, 0, 4))
  const jour = quatreJanvier.getUTCDay() || 7
  const lundiS1 = new Date(quatreJanvier)
  lundiS1.setUTCDate(quatreJanvier.getUTCDate() - jour + 1)
  const lundi = new Date(lundiS1)
  lundi.setUTCDate(lundiS1.getUTCDate() + (semaine - 1) * 7)
  return lundi
}

export function formatSemaineIso({ annee, semaine }: SemaineIso): string {
  return `${annee}-W${String(semaine).padStart(2, '0')}`
}

export function lireSemaineIso(valeur: string): SemaineIso {
  return { annee: Number(valeur.slice(0, 4)), semaine: Number(valeur.slice(6)) }
}

export function comparerSemaines(a: SemaineIso, b: SemaineIso): number {
  return a.annee - b.annee || a.semaine - b.semaine
}

/** Date calendaire « AAAA-MM-JJ » réelle (refuse 2026-02-30, 2026-13-01…) : ANO-039. */
export function estDateJour(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(a, mo - 1, j))
  return d.getUTCFullYear() === a && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j
}
export const DateJourSchema = z
  .string()
  .refine(estDateJour, { message: 'Date invalide (attendu : AAAA-MM-JJ, date réelle).' })

/** Semaine ISO « AAAA-Wss » réelle (refuse 2026-W00, 2026-W54 ; 2026 a 53 semaines, 2027 en a 52) : ANO-042. */
export function estSemaineIso(s: string): boolean {
  if (!/^\d{4}-W\d{2}$/.test(s)) return false
  const lue = lireSemaineIso(s)
  if (lue.semaine < 1 || lue.semaine > 53) return false
  return comparerSemaines(semaineIsoDe(lundiSemaineIso(lue)), lue) === 0
}
