// REC-P08 — liste et fiche des affiches, rattachements, validation admin : tests COMPLÉMENTAIRES écrits
// depuis RECEPTION_REGLES_METIER.md (RG-REC-121 à 169 ; §2 matrice ; §3.2 AFFICHE, RATTACHEMENT,
// VALIDATION_ADMIN) et core/permissions/catalogue.ts. Ne duplique pas affiches.int.test.ts.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Role } from '@circe/shared'
import * as f from '../factories/index.ts'
import {
  autre,
  contexteReception,
  erreur,
  get,
  idem,
  ligne,
  post,
  receptionValidee,
  site,
} from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())

const patch = (id: number, headers: Record<string, string>, payload: object) =>
  ctx.app.inject({ method: 'PATCH', url: `/api/affiches/${String(id)}`, headers, payload })

async function affiche(qte = 4) {
  const s = await site(ctx)
  const rv = await receptionValidee(ctx, s.headers, s.plateforme.id, qte)
  const a = await db.affiche.findUniqueOrThrow({ where: { id: rv.afficheId } })
  return { ...s, ...rv, a }
}

const validationAdmin = (
  id: number,
  headers: Record<string, string>,
  version: number,
  valider: boolean,
) => post(ctx, `/api/affiches/${String(id)}/validation-admin`, headers, { version, valider })

describe('REC-P08 consultation : permissions (§2 « Consulter la Liste des affiches, la fiche »)', () => {
  it.each([['coord'], ['cheq'], ['recep'], ['com']] as const)(
    'RG-REC-002 le profil %s consulte la liste et la fiche',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      expect((await get(ctx, '/api/affiches', u.headers)).statusCode).toBe(200)
      expect((await get(ctx, `/api/affiches/${String(p.afficheId)}`, u.headers)).statusCode).toBe(
        200,
      )
    },
  )

  it.each([['expe']] as const)(
    'RG-REC-002 le profil %s ne consulte pas la fiche affiche (403)',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      expect((await get(ctx, `/api/affiches/${String(p.afficheId)}`, u.headers)).statusCode).toBe(
        403,
      )
    },
  )

  it('RG-REC-002 le profil expe ne consulte pas la liste des affiches (403)', async () => {
    const s = await site(ctx, ['expe'])
    expect((await get(ctx, '/api/affiches', s.headers)).statusCode).toBe(403)
  })
})

describe('REC-P08 modifier la fiche (RG-REC-131 / 145 / 006)', () => {
  it.each([['coord'], ['cheq'], ['recep']] as const)(
    'RG-REC-131 le profil %s modifie la fiche',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      expect(
        (await patch(p.a.id, u.headers, { version: p.a.version, commentaire: 'ok' })).statusCode,
      ).toBe(200)
    },
  )

  it.each([['expe'], ['com']] as const)(
    'RG-REC-131 / RG-REC-002 le profil %s ne modifie pas la fiche (403), rien n’est écrit',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      const r = await patch(p.a.id, u.headers, { version: p.a.version, commentaire: 'x' })
      expect(r.statusCode).toBe(403)
      expect((await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).commentaire).toBeNull()
    },
  )

  it.each([['coord'], ['cheq']] as const)(
    'RG-REC-145 le profil %s coche « Affiche à conserver »',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      expect(
        (await patch(p.a.id, u.headers, { version: p.a.version, aConserver: true })).statusCode,
      ).toBe(200)
      expect((await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).aConserver).toBe(true)
    },
  )

  it('RG-REC-006 une valeur inchangée n’est pas historisée', async () => {
    const p = await affiche()
    const r = await patch(p.a.id, p.headers, {
      version: p.a.version,
      annonceur: p.a.contAnnonc ?? '',
      theme: p.a.theme ?? '',
    })
    expect(r.statusCode).toBe(200)
    expect(
      await db.journalAudit.count({
        where: {
          entiteId: String(p.a.id),
          action: { in: ['MODIFICATION_ANNONCEUR', 'MODIFICATION_THEME'] },
        },
      }),
    ).toBe(0)
  })

  it('RG-REC-006 l’historique garde l’ancienne et la nouvelle valeur, avec l’auteur', async () => {
    const p = await affiche()
    await patch(p.a.id, p.headers, { version: p.a.version, annonceur: 'NOUVEAU' })
    const j = await db.journalAudit.findFirstOrThrow({
      where: { entiteId: String(p.a.id), action: 'MODIFICATION_ANNONCEUR' },
    })
    expect(j).toMatchObject({
      ancienneValeur: p.a.contAnnonc,
      nouvelleValeur: 'NOUVEAU',
      parId: p.user.id,
    })
  })

  it('RG-REC-001 modifier une affiche hors périmètre : 403', async () => {
    const s = await site(ctx)
    const a = await f.createAffiche(db)
    expect(
      (await patch(a.id, s.headers, { version: a.version, commentaire: 'x' })).statusCode,
    ).toBe(403)
  })

  it('RG-REC-009 deux modifications avec la même version : une seule réussit, l’autre 409', async () => {
    const p = await affiche()
    const u = await autre(ctx, p.plateforme.id, ['recep'])
    const [r1, r2] = await Promise.all([
      patch(p.a.id, p.headers, { version: p.a.version, commentaire: 'A' }),
      patch(p.a.id, u.headers, { version: p.a.version, commentaire: 'B' }),
    ])
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409])
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(p.a.id), action: 'MODIFICATION_COMMENTAIRE' },
      }),
    ).toBe(1)
  })

  it('RG-REC-176 un tag ou un statut ne s’écrit pas par la fiche (champs ignorés)', async () => {
    const p = await affiche()
    await patch(p.a.id, p.headers, {
      version: p.a.version,
      statut: 'ORPHELINE',
      feuilleARefaire: true,
      validationAdmin: true,
    })
    expect(await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).toMatchObject({
      statut: 'IDENTIFIEE',
      feuilleARefaire: false,
      validationAdmin: false,
    })
  })
})

describe('REC-P08 « + Rattacher à un autre dossier » (RG-REC-136)', () => {
  async function avecPlace() {
    const p = await affiche(4)
    await db.afficheAttendue.updateMany({
      where: { afficheId: p.afficheId },
      data: { quantite: 2 },
    })
    const l2 = await ligne(ctx, p.plateforme.id)
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })
    return { ...p, a, l2 }
  }

  it.each([['coord'], ['admin'], ['recep']] as const)(
    'RG-REC-136 le profil %s rattache à un autre dossier',
    async (role: Role) => {
      const p = await avecPlace()
      const u = await autre(ctx, p.plateforme.id, [role])
      const r = await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, u.headers, {
        version: p.a.version,
        ligneAttendueId: p.l2.id,
        quantite: 1,
      })
      expect(r.statusCode).toBe(200)
    },
  )

  it.each([['cheq'], ['expe'], ['com']] as const)(
    'RG-REC-136 / RG-REC-002 le profil %s ne rattache pas (403), aucun lien',
    async (role) => {
      const p = await avecPlace()
      const u = await autre(ctx, p.plateforme.id, [role])
      const r = await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, u.headers, {
        version: p.a.version,
        ligneAttendueId: p.l2.id,
        quantite: 1,
      })
      expect(r.statusCode).toBe(403)
      expect(await db.afficheAttendue.count({ where: { ligneAttendueId: p.l2.id } })).toBe(0)
    },
  )

  it('RG-REC-111 rattacher par coord vaut validation ; par recep l’affiche redevient « à confirmer »', async () => {
    const p = await avecPlace()
    const coord = await autre(ctx, p.plateforme.id, ['coord'])
    await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, coord.headers, {
      version: p.a.version,
      ligneAttendueId: p.l2.id,
      quantite: 1,
    })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).validationAdmin).toBe(
      true,
    )
    const l3 = await ligne(ctx, p.plateforme.id)
    const b = await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })
    await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, p.headers, {
      version: b.version,
      ligneAttendueId: l3.id,
      quantite: 1,
    })
    expect((await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).validationAdmin).toBe(
      false,
    )
  })

  it('RG-REC-001 rattacher à une ligne d’un autre site : 403', async () => {
    const p = await avecPlace()
    const dehors = await f.createReceptionAttendue(db)
    const r = await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, p.headers, {
      version: p.a.version,
      ligneAttendueId: dehors.id,
      quantite: 1,
    })
    expect(r.statusCode).toBe(403)
  })

  it('RG-REC-009 rattacher avec une version d’affiche périmée : 409, aucun lien', async () => {
    const p = await avecPlace()
    const r = await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, p.headers, {
      version: p.a.version - 1,
      ligneAttendueId: p.l2.id,
      quantite: 1,
    })
    expect(r.statusCode).toBe(409)
    expect(await db.afficheAttendue.count({ where: { ligneAttendueId: p.l2.id } })).toBe(0)
  })

  it('RG-REC-169 rattacher une affiche fusionnée héritée : 409, aucun lien', async () => {
    const s = await site(ctx)
    const fille = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createMouvement(db, {
      afficheId: fille.id,
      type: 'RECEPTION',
      quantite: 5,
      date: new Date(),
    })
    await f.createFusionAffiche(db, {
      afficheId: fille.id,
      afficheChapeauId: (await f.createAffiche(db, { plateformeId: s.plateforme.id })).id,
    })
    const l = await ligne(ctx, s.plateforme.id)
    const r = await post(ctx, `/api/affiches/${String(fille.id)}/rattachements`, s.headers, {
      version: fille.version,
      ligneAttendueId: l.id,
      quantite: 1,
    })
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-169')
    expect(await db.afficheAttendue.count({ where: { afficheId: fille.id } })).toBe(0)
  })
})

describe('REC-P08 changer de thème (RG-REC-135)', () => {
  async function deuxThemes() {
    const p = await affiche(4)
    const nouvelle = await ligne(ctx, p.plateforme.id, {
      contNum: p.ligne.contNum,
      theme: 'Thème B',
      themeCle: 'THEME B',
    })
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    return { ...p, nouvelle, lien }
  }

  it('RG-REC-135 changer de thème par coord : la validation admin reste acquise (§3.2)', async () => {
    const p = await deuxThemes()
    const coord = await autre(ctx, p.plateforme.id, ['coord'])
    await db.affiche.update({ where: { id: p.a.id }, data: { validationAdmin: true } })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, coord.headers, {
      version: a.version,
      lienId: p.lien.id,
      nouvelleLigneId: p.nouvelle.id,
    })
    expect(r.statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).validationAdmin).toBe(true)
  })

  it.each([['cheq'], ['com']] as const)(
    'RG-REC-135 / RG-REC-002 le profil %s ne change pas le thème (403)',
    async (role) => {
      const p = await deuxThemes()
      const u = await autre(ctx, p.plateforme.id, [role])
      const r = await post(ctx, `/api/affiches/${String(p.a.id)}/changer-theme`, u.headers, {
        version: p.a.version,
        lienId: p.lien.id,
        nouvelleLigneId: p.nouvelle.id,
      })
      expect(r.statusCode).toBe(403)
      expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: p.lien.id } })).actif).toBe(
        true,
      )
    },
  )

  it('RG-REC-009 changer de thème avec une version périmée : 409, le lien reste actif', async () => {
    const p = await deuxThemes()
    const r = await post(ctx, `/api/affiches/${String(p.a.id)}/changer-theme`, p.headers, {
      version: p.a.version - 1,
      lienId: p.lien.id,
      nouvelleLigneId: p.nouvelle.id,
    })
    expect(r.statusCode).toBe(409)
    expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: p.lien.id } })).actif).toBe(
      true,
    )
  })

  it('RG-REC-137 changer le thème d’un lien déjà RETIRE : 409', async () => {
    const p = await deuxThemes()
    const autreLigne = await ligne(ctx, p.plateforme.id)
    await db.afficheAttendue.updateMany({
      where: { afficheId: p.afficheId },
      data: { quantite: 2 },
    })
    await post(ctx, `/api/affiches/${String(p.a.id)}/rattachements`, p.headers, {
      version: p.a.version,
      ligneAttendueId: autreLigne.id,
      quantite: 2,
    })
    const l = await db.afficheAttendue.findUniqueOrThrow({ where: { id: p.lien.id } })
    await post(ctx, `/api/rattachements/${String(l.id)}/retrait`, p.headers, {
      lienVersion: l.version,
    })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })
    const r = await post(ctx, `/api/affiches/${String(a.id)}/changer-theme`, p.headers, {
      version: a.version,
      lienId: p.lien.id,
      nouvelleLigneId: p.nouvelle.id,
    })
    expect(r.statusCode).toBe(409)
  })
})

describe('REC-P08 retirer un rattachement (RG-REC-137 / 114)', () => {
  it.each([['coord'], ['admin']] as const)(
    'RG-REC-137 le profil %s retire un lien',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      const lien = await db.afficheAttendue.findFirstOrThrow({
        where: { afficheId: p.afficheId, actif: true },
      })
      expect(
        (
          await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, u.headers, {
            lienVersion: lien.version,
          })
        ).statusCode,
      ).toBe(200)
    },
  )

  it('RG-REC-137 le profil expe ne retire pas (403)', async () => {
    const p = await affiche()
    const u = await autre(ctx, p.plateforme.id, ['expe'])
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    expect(
      (
        await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, u.headers, {
          lienVersion: lien.version,
        })
      ).statusCode,
    ).toBe(403)
  })

  it('RG-REC-137 / RG-REC-017 le retrait recalcule le reçu de la ligne (→ Attendue)', async () => {
    const p = await affiche(10)
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: p.ligne.id } })).statut,
    ).toBe('COMPLETE')
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, p.headers, {
      lienVersion: lien.version,
    })
    expect(
      (await db.receptionAttendue.findUniqueOrThrow({ where: { id: p.ligne.id } })).statut,
    ).toBe('ATTENDUE')
  })

  it('RG-REC-114 retirer le dernier dossier d’une palette À contrôler : réception A_IDENTIFIER, affiche ORPHELINE', async () => {
    const p = await affiche()
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, p.headers, {
      lienVersion: lien.version,
    })
    expect((await db.reception.findUniqueOrThrow({ where: { id: p.receptionId } })).statut).toBe(
      'A_IDENTIFIER',
    )
    expect((await db.affiche.findUniqueOrThrow({ where: { id: p.afficheId } })).statut).toBe(
      'ORPHELINE',
    )
  })

  it('RG-REC-009 retrait avec une version de lien périmée : 409, lien toujours actif', async () => {
    const p = await affiche()
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    const r = await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, p.headers, {
      lienVersion: lien.version - 1,
    })
    expect(r.statusCode).toBe(409)
    expect((await db.afficheAttendue.findUniqueOrThrow({ where: { id: lien.id } })).actif).toBe(
      true,
    )
  })

  it('RG-REC-001 retirer un lien d’une affiche hors périmètre : 403', async () => {
    const p = await affiche()
    const intrus = await site(ctx)
    const lien = await db.afficheAttendue.findFirstOrThrow({
      where: { afficheId: p.afficheId, actif: true },
    })
    expect(
      (
        await post(ctx, `/api/rattachements/${String(lien.id)}/retrait`, intrus.headers, {
          lienVersion: lien.version,
        })
      ).statusCode,
    ).toBe(403)
  })
})

describe('REC-P08 validation admin (RG-REC-003, §3.2 VALIDATION_ADMIN)', () => {
  it('RG-REC-003 le profil admin valide une affiche', async () => {
    const p = await affiche()
    const admin = await autre(ctx, p.plateforme.id, ['admin'])
    const r = await validationAdmin(p.a.id, admin.headers, p.a.version, true)
    expect(r.statusCode).toBe(200)
    expect(await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).toMatchObject({
      validationAdmin: true,
      validationAdminParId: admin.user.id,
    })
  })

  it.each([['expe'], ['com']] as const)(
    'RG-REC-003 le profil %s ne valide pas (403 REC_VALIDATION_RESERVEE)',
    async (role) => {
      const p = await affiche()
      const u = await autre(ctx, p.plateforme.id, [role])
      const r = await validationAdmin(p.a.id, u.headers, p.a.version, true)
      expect(r.statusCode).toBe(403)
      expect(erreur(r)).toMatchObject({ code: 'REC_VALIDATION_RESERVEE', regle: 'RG-REC-003' })
    },
  )

  it('RG-REC-003 le profil recep n’annule pas une validation (403)', async () => {
    const p = await affiche()
    await db.affiche.update({ where: { id: p.a.id }, data: { validationAdmin: true } })
    const a = await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })
    const r = await validationAdmin(a.id, p.headers, a.version, false)
    expect(r.statusCode).toBe(403)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).validationAdmin).toBe(true)
  })

  // Règle citée alignée sur RG-COO-014 (audit COO-P04, RG-X-015 : même action que la Coordination).
  it('RG-REC-003 / RG-COO-014 annuler la validation d’une affiche non validée : 409', async () => {
    const p = await affiche()
    const coord = await autre(ctx, p.plateforme.id, ['coord'])
    const r = await validationAdmin(p.a.id, coord.headers, p.a.version, false)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-COO-014')
  })

  it('RG-REC-003 ANNULEE → VALIDEE : une validation annulée peut être revalidée', async () => {
    const p = await affiche()
    const coord = await autre(ctx, p.plateforme.id, ['coord'])
    await validationAdmin(p.a.id, coord.headers, p.a.version, true)
    let a = await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })
    expect((await validationAdmin(a.id, coord.headers, a.version, false)).statusCode).toBe(200)
    a = await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })
    expect((await validationAdmin(a.id, coord.headers, a.version, true)).statusCode).toBe(200)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: a.id } })).validationAdmin).toBe(true)
  })

  it('RG-REC-009 deux validations avec la même version : une seule réussit, l’autre 409', async () => {
    const p = await affiche()
    const [c1, c2] = await Promise.all([
      autre(ctx, p.plateforme.id, ['coord']),
      autre(ctx, p.plateforme.id, ['admin']),
    ])
    const [r1, r2] = await Promise.all([
      validationAdmin(p.a.id, c1.headers, p.a.version, true),
      validationAdmin(p.a.id, c2.headers, p.a.version, true),
    ])
    expect([r1.statusCode, r2.statusCode].sort()).toEqual([200, 409])
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(p.a.id), action: 'VALIDATION_ADMIN' },
      }),
    ).toBe(1)
  })

  it('RG-REC-009 annuler la validation avec une version périmée : 409, la validation reste', async () => {
    const p = await affiche()
    const coord = await autre(ctx, p.plateforme.id, ['coord'])
    await validationAdmin(p.a.id, coord.headers, p.a.version, true)
    const r = await validationAdmin(p.a.id, coord.headers, p.a.version, false)
    expect(r.statusCode).toBe(409)
    expect((await db.affiche.findUniqueOrThrow({ where: { id: p.a.id } })).validationAdmin).toBe(
      true,
    )
  })

  it('RG-REC-008 rejeu de la validation avec la même clé : 200 rejoué, une seule écriture', async () => {
    const p = await affiche()
    const coord = await autre(ctx, p.plateforme.id, ['coord'])
    const h = { ...coord.headers, ...idem() }
    const url = `/api/affiches/${String(p.a.id)}/validation-admin`
    const corps = { version: p.a.version, valider: true }
    const r1 = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    const r2 = await ctx.app.inject({ method: 'POST', url, headers: h, payload: corps })
    expect([r1.statusCode, r2.statusCode]).toEqual([200, 200])
    expect(r2.headers['idempotent-replayed']).toBe('true')
    expect(
      await db.journalAudit.count({
        where: { entiteId: String(p.a.id), action: 'VALIDATION_ADMIN' },
      }),
    ).toBe(1)
  })

  it('RG-REC-001 valider une affiche hors périmètre : 403', async () => {
    const s = await site(ctx, ['coord'])
    const a = await f.createAffiche(db)
    expect((await validationAdmin(a.id, s.headers, a.version, true)).statusCode).toBe(403)
  })

  it('RG-REC-169 valider une affiche fusionnée héritée : 409', async () => {
    const s = await site(ctx, ['coord'])
    const fille = await f.createAffiche(db, { plateformeId: s.plateforme.id })
    await f.createFusionAffiche(db, {
      afficheId: fille.id,
      afficheChapeauId: (await f.createAffiche(db, { plateformeId: s.plateforme.id })).id,
    })
    const r = await validationAdmin(fille.id, s.headers, fille.version, true)
    expect(r.statusCode).toBe(409)
    expect(erreur(r).regle).toBe('RG-REC-169')
  })
})
