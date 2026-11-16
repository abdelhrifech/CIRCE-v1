// ANO-042 : une semaine ISO inexistante (AAAA-W00, AAAA-W54, 2027-W53) est refusée en 400 par TOUTES les routes
// dont un paramètre est une semaine ISO (CLAUDE.md §6 : 400 = validation) ; une semaine réelle (2026-W53) passe.
// Routes : Pilotage › Alertes, vérification des thèmes (3 vues), état des réservations, trains (création,
// annulation d'un thème, déblocage d'une semaine). Source : RG-COO-066 / 069 / 107 / 224 / 219 / 220.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { devHeaders } from '../support/identite.ts'
import * as f from '../factories/index.ts'
import { contexteReception, get, post } from '../support/reception.ts'

const ctx = contexteReception()
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const INVALIDES = ['2026-W00', '2026-W54', '2027-W53', '2026-W99']

async function coord() {
  const plateforme = await f.createPlateforme(ctx.db)
  const atelier = await f.createAtelier(ctx.db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const u = await f.createUtilisateurAvecRoles(ctx.db, ['coord'], [{ plateformeId: plateforme.id }])
  return { atelier, headers: devHeaders(u.identifiantExterne) }
}

describe('Semaines ISO réelles dans les paramètres (ANO-042)', () => {
  const GET_ROUTES = [
    '/api/alertes?depart=',
    '/api/coordination/themes/proches?depart=',
    '/api/coordination/themes/annonceurs?depart=',
    '/api/coordination/themes/broadcast?depart=',
    '/api/coordination/reservations?depart=',
    '/api/coordination/trains?depart=',
  ]

  it.each(GET_ROUTES)(
    'RG-COO-066 / 069 / 107 / 228 %s : semaine inexistante ⇒ 400',
    async (base) => {
      const c = await coord()
      for (const semaine of INVALIDES)
        expect((await get(ctx, `${base}${semaine}`, c.headers)).statusCode, semaine).toBe(400)
    },
  )

  it.each(GET_ROUTES)(
    'RG-COO-066 / 069 / 107 / 228 %s : semaine réelle (2026-W53) acceptée',
    async (base) => {
      const c = await coord()
      expect((await get(ctx, `${base}2026-W53`, c.headers)).statusCode).toBe(200)
    },
  )

  it.each([
    ['/api/coordination/trains', { type: 'PRE_TEST', nombre: 1, visuelId: 1, destinataireId: 1 }],
    ['/api/coordination/trains/annuler-theme', { contNum: 1, theme: 'X' }],
    ['/api/coordination/trains/debloquer-semaine', {}],
  ] as const)(
    'RG-COO-224 / 219 / 220 POST %s : semaine inexistante ⇒ 400, rien d’écrit',
    async (url, corps) => {
      const c = await coord()
      for (const semaine of INVALIDES) {
        const r = await post(ctx, url, c.headers, {
          ...corps,
          atelierId: c.atelier.id,
          depart: semaine,
        })
        expect(r.statusCode, `${url} ${semaine}`).toBe(400)
      }
    },
  )
})
