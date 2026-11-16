// Étape 8 (D-03) — tests d'INTÉGRATION de l'administration des plateformes (RG-ADM-040 à 044 provisoires,
// legacy-admin.md §E) : coordonnées et mail de déblocage (plt_mail, id site CCF), mails de RÉCEPTION (liste) et
// imprimantes cibles. Droit `parametrage.gerer` (administrateur seul), verrou de version, idempotence, journal,
// concurrence, atomicité. Aucun envoi de mail ni impression (Q-375, Q-002). Hypothèses : Q-407. Aucun test unitaire.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PlateformeAdminSchema, PlateformesAdminSchema, type Role } from '@circe/shared'
import * as f from '../factories/index.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, envoyer, ROLES } from '../support/export-trains.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'
import { imprimantesCibles, mailsReception } from '../../src/modules/admin/plateformes.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>
const crees: number[] = []

beforeAll(() => ctx.demarrer())
afterAll(async () => {
  try {
    await db.plateformeMail.deleteMany({ where: { plateformeId: { in: crees } } })
    await db.plateformeImprimante.deleteMany({ where: { plateformeId: { in: crees } } })
  } catch {
    // purge au mieux
  }
  await ctx.arreter()
})

async function acteurs() {
  const plateforme = await f.createPlateforme(db, { localite: 'Nîmes', idSiteCcf: 39 })
  crees.push(plateforme.id)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}

const url = (id: number, suite = '') => `/api/admin/plateformes/${String(id)}${suite}`
const patch = (u: string, h: H, corps: unknown) =>
  ctx.app.inject({ method: 'PATCH', url: u, headers: h, payload: corps as object })
const supprimer = (u: string, h: H) => ctx.app.inject({ method: 'DELETE', url: u, headers: h })
const lire = async (h: H, id: number) => {
  const p = await db.plateforme.findUniqueOrThrow({ where: { id } })
  const r = await get(ctx, `/api/admin/plateformes?q=${encodeURIComponent(p.nom)}`, h)
  return PlateformesAdminSchema.parse(r.json()).plateformes.find((x) => x.id === id)
}
const ajouterMail = (id: number, h: H, adresse: unknown, cle: H = idem()) =>
  envoyer(ctx, url(id, '/adresses-reception'), h, { adresse }, cle)
const ajouterImprimante = (id: number, h: H, nom: unknown, cle: H = idem()) =>
  envoyer(ctx, url(id, '/imprimantes'), h, { nom }, cle)

describe('D-03 RG-ADM-040 liste et coordonnées', () => {
  it('RG-ADM-040 l’administrateur lit la plateforme avec ses coordonnées, mails et imprimantes (filtre texte)', async () => {
    const { users, plateforme } = await acteurs()
    await ajouterMail(plateforme.id, users.admin, 'Reception@Site.FR')
    await ajouterImprimante(plateforme.id, users.admin, 'IMP-RACK-1')
    const p = await lire(users.admin, plateforme.id)
    expect(p).toMatchObject({
      nom: plateforme.nom,
      localite: 'Nîmes',
      idSiteCcf: 39,
      mailsReception: [{ adresse: 'reception@site.fr' }],
      imprimantes: [{ nom: 'IMP-RACK-1', actif: true }],
    })
    const vide = PlateformesAdminSchema.parse(
      (await get(ctx, '/api/admin/plateformes?q=zzz-introuvable-zzz', users.admin)).json(),
    )
    expect(vide).toEqual({ plateformes: [], total: 0 })
  })

  it.each(ROLES.filter((r) => r !== 'admin'))(
    'RG-REC-002 le rôle %s n’administre pas les plateformes : 403 sur toutes les actions',
    async (role) => {
      const { users, plateforme } = await acteurs()
      const h = users[role]
      const reponses = [
        await get(ctx, '/api/admin/plateformes', h),
        await patch(url(plateforme.id), h, { version: 1, localite: 'X' }),
        await ajouterMail(plateforme.id, h, 'a@b.fr'),
        await supprimer(url(plateforme.id, '/adresses-reception/1'), h),
        await ajouterImprimante(plateforme.id, h, 'IMP'),
        await patch(url(plateforme.id, '/imprimantes/1'), h, { actif: false, version: 1 }),
      ]
      expect(reponses.map((r) => r.statusCode)).toEqual([403, 403, 403, 403, 403, 403])
      expect(erreur(reponses[1] as never).regle).toBe('RG-REC-002')
      expect(
        await db.plateforme
          .findUniqueOrThrow({ where: { id: plateforme.id } })
          .then((p) => p.localite),
      ).toBe('Nîmes')
    },
  )

  it('RG-REC-004 sans identité : 401', async () => {
    expect((await get(ctx, '/api/admin/plateformes', {})).statusCode).toBe(401)
    expect((await patch(url(1), {}, { version: 1 })).statusCode).toBe(401)
  })

  it('RG-ADM-040 modification des coordonnées : champs absents conservés, vide = effacé, version incrémentée, journal', async () => {
    const { users, plateforme } = await acteurs()
    const r = await patch(url(plateforme.id), users.admin, {
      version: plateforme.version,
      adresse1: ' 1 rue du Test ',
      codePostal: '30000',
      telephone: '0466000000',
      mailDeblocage: 'a@site.fr, b@site.fr',
      idSiteCcf: 41,
    })
    expect(r.statusCode, r.body).toBe(200)
    expect(PlateformeAdminSchema.parse(r.json())).toMatchObject({
      nom: plateforme.nom,
      localite: 'Nîmes',
      adresse1: '1 rue du Test',
      codePostal: '30000',
      telephone: '0466000000',
      mailDeblocage: 'a@site.fr, b@site.fr',
      idSiteCcf: 41,
      version: plateforme.version + 1,
    })
    const efface = await patch(url(plateforme.id), users.admin, {
      version: plateforme.version + 1,
      localite: '  ',
      idSiteCcf: null,
    })
    expect(PlateformeAdminSchema.parse(efface.json())).toMatchObject({
      localite: null,
      idSiteCcf: null,
      adresse1: '1 rue du Test',
    })
    const journal = await db.journalAudit.findMany({
      where: {
        typeEntite: 'PLATEFORME',
        entiteId: String(plateforme.id),
        action: 'MODIFICATION_PLATEFORME',
      },
    })
    expect(journal).toHaveLength(2)
  })

  it.each([
    ['code postal de plus de 5 caractères (RG-ADM-040)', { codePostal: '300000' }],
    ['téléphone de plus de 14 caractères (RG-ADM-040)', { telephone: '0'.repeat(15) }],
    ['mail de déblocage invalide (RG-ADM-044)', { mailDeblocage: 'pas-une-adresse' }],
    [
      'mail de déblocage de plus de 500 caractères (RG-ADM-040)',
      { mailDeblocage: `${'a'.repeat(500)}@b.fr` },
    ],
    ['nom vide (RG-ADM-040)', { nom: '   ' }],
    ['champ inconnu', { couleur: 'rouge' }],
    ['id site CCF négatif', { idSiteCcf: -1 }],
  ])('RG-ADM-040 refus 400 : %s', async (_, corps) => {
    const { users, plateforme } = await acteurs()
    const r = await patch(url(plateforme.id), users.admin, {
      version: plateforme.version,
      ...corps,
    })
    expect(r.statusCode).toBe(400)
    expect((await db.plateforme.findUniqueOrThrow({ where: { id: plateforme.id } })).version).toBe(
      plateforme.version,
    )
  })

  it('RG-REC-009 version périmée : 409 ; plateforme inconnue : 404', async () => {
    const { users, plateforme } = await acteurs()
    expect(
      (await patch(url(plateforme.id), users.admin, { version: plateforme.version, localite: 'A' }))
        .statusCode,
    ).toBe(200)
    const perime = await patch(url(plateforme.id), users.admin, {
      version: plateforme.version,
      localite: 'B',
    })
    expect(perime.statusCode).toBe(409)
    expect(erreur(perime).code).toBe('ADM_CONFLIT_VERSION')
    expect(
      (await patch(url(999_999_999), users.admin, { version: 1, localite: 'C' })).statusCode,
    ).toBe(404)
  })

  it('concurrence : deux modifications avec la même version : 200 + 409, une seule appliquée', async () => {
    const { users, plateforme } = await acteurs()
    const [a, b] = await Promise.all([
      patch(url(plateforme.id), users.admin, { version: plateforme.version, localite: 'Lyon' }),
      patch(url(plateforme.id), users.admin, { version: plateforme.version, localite: 'Paris' }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(
      await db.plateforme
        .findUniqueOrThrow({ where: { id: plateforme.id } })
        .then((p) => p.version),
    ).toBe(plateforme.version + 1)
  })

  it('atomicité : une panne du journal annule la modification', async () => {
    const { users, plateforme } = await acteurs()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      patch(url(plateforme.id), users.admin, { version: plateforme.version, localite: 'Perdue' }),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.plateforme.findUniqueOrThrow({ where: { id: plateforme.id } })).toMatchObject({
      localite: 'Nîmes',
      version: plateforme.version,
    })
  })
})

describe('D-03 RG-ADM-042 / 043 mails de réception', () => {
  it('RG-ADM-042 ajout (minuscules, espaces retirés), lecture pour le futur mail de réception, journal', async () => {
    const { users, plateforme } = await acteurs()
    const r = await ajouterMail(plateforme.id, users.admin, '  Chef.Atelier@Site.FR ')
    expect(r.statusCode, r.body).toBe(200)
    expect(PlateformeAdminSchema.parse(r.json()).mailsReception.map((m) => m.adresse)).toEqual([
      'chef.atelier@site.fr',
    ])
    await ajouterMail(plateforme.id, users.admin, 'autre@site.fr')
    // RG-ADM-043 : lecture des destinataires d'une plateforme (aucun envoi : Q-375).
    expect(await mailsReception(db, plateforme.id)).toEqual([
      'autre@site.fr',
      'chef.atelier@site.fr',
    ])
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'PLATEFORME',
          entiteId: String(plateforme.id),
          action: 'CREATION_MAIL_PLATEFORME',
        },
      }),
    ).toBe(2)
  })

  it.each([
    ['vide', ''],
    ['sans arobase', 'sans-arobase'],
    ['plusieurs adresses', 'a@b.fr,c@d.fr'],
    ['avec espace', 'a b@c.fr'],
    ['trop longue', `${'a'.repeat(250)}@b.fr`],
    ['absente', undefined],
  ])(
    'RG-ADM-042 adresse %s : 400 (l’existant n’imposait aucun contrôle, Q-407)',
    async (_, adresse) => {
      const { users, plateforme } = await acteurs()
      expect((await ajouterMail(plateforme.id, users.admin, adresse)).statusCode).toBe(400)
      expect(await db.plateformeMail.count({ where: { plateformeId: plateforme.id } })).toBe(0)
    },
  )

  it('RG-ADM-042 doublon sur la plateforme (casse ignorée) : 409 ; la même adresse sur une autre plateforme est permise', async () => {
    const { users, plateforme } = await acteurs()
    const autre = await f.createPlateforme(db)
    crees.push(autre.id)
    await ajouterMail(plateforme.id, users.admin, 'dup@site.fr')
    const d = await ajouterMail(plateforme.id, users.admin, 'DUP@site.fr')
    expect(d.statusCode).toBe(409)
    expect(erreur(d)).toMatchObject({ code: 'ADM_MAIL_EXISTE', regle: 'RG-ADM-042' })
    expect((await ajouterMail(autre.id, users.admin, 'dup@site.fr')).statusCode).toBe(200)
  })

  it('RG-ADM-042 plateforme inconnue : 404', async () => {
    const { users } = await acteurs()
    expect((await ajouterMail(999_999_999, users.admin, 'a@b.fr')).statusCode).toBe(404)
  })

  it('RG-ADM-042 suppression d’une adresse de la plateforme ; une adresse d’une autre plateforme ou inconnue : 404 (contrôle absent de l’existant)', async () => {
    const { users, plateforme } = await acteurs()
    const autre = await f.createPlateforme(db)
    crees.push(autre.id)
    const a = PlateformeAdminSchema.parse(
      (await ajouterMail(plateforme.id, users.admin, 'x@site.fr')).json(),
    )
    const b = PlateformeAdminSchema.parse(
      (await ajouterMail(autre.id, users.admin, 'y@site.fr')).json(),
    )
    const idAutre = b.mailsReception[0]?.id ?? 0
    expect(
      (await supprimer(url(plateforme.id, `/adresses-reception/${String(idAutre)}`), users.admin))
        .statusCode,
    ).toBe(404)
    expect(
      (await supprimer(url(plateforme.id, '/adresses-reception/999999999'), users.admin))
        .statusCode,
    ).toBe(404)
    expect(await db.plateformeMail.count({ where: { id: idAutre } })).toBe(1)
    const ok = await supprimer(
      url(plateforme.id, `/adresses-reception/${String(a.mailsReception[0]?.id)}`),
      users.admin,
    )
    expect(ok.statusCode).toBe(200)
    expect(PlateformeAdminSchema.parse(ok.json()).mailsReception).toEqual([])
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'PLATEFORME',
          entiteId: String(plateforme.id),
          action: 'SUPPRESSION_MAIL_PLATEFORME',
          ancienneValeur: 'x@site.fr',
        },
      }),
    ).toBe(1)
  })

  it('RG-REC-008 idempotence : même clé rejoue sans doublon, même clé avec un autre corps : 409 ; sans clé : 400', async () => {
    const { users, plateforme } = await acteurs()
    const cle = idem()
    const a = await ajouterMail(plateforme.id, users.admin, 'idem@site.fr', cle)
    const b = await ajouterMail(plateforme.id, users.admin, 'idem@site.fr', cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(await db.plateformeMail.count({ where: { plateformeId: plateforme.id } })).toBe(1)
    const autre = await ajouterMail(plateforme.id, users.admin, 'autre@site.fr', cle)
    expect(autre.statusCode).toBe(409)
    expect(erreur(autre).code).toBe('ADM_IDEMPOTENCE_CONFLIT')
    const sans = await ctx.app.inject({
      method: 'POST',
      url: url(plateforme.id, '/adresses-reception'),
      headers: users.admin,
      payload: { adresse: 'z@site.fr' },
    })
    expect(sans.statusCode).toBe(400)
  })

  it('concurrence : deux ajouts simultanés de la même adresse : une seule ligne (200 + 409)', async () => {
    const { users, plateforme } = await acteurs()
    const [a, b] = await Promise.all([
      ajouterMail(plateforme.id, users.admin, 'course@site.fr'),
      ajouterMail(plateforme.id, users.admin, 'course@site.fr'),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    expect(await db.plateformeMail.count({ where: { plateformeId: plateforme.id } })).toBe(1)
  })

  it('atomicité : une panne du journal annule l’ajout (aucune adresse)', async () => {
    const { users, plateforme } = await acteurs()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      ajouterMail(plateforme.id, users.admin, 'perdue@site.fr'),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.plateformeMail.count({ where: { plateformeId: plateforme.id } })).toBe(0)
  })

  it('RG-ADM-044 le mail de déblocage (plt_mail) et la liste des mails de réception sont deux champs distincts', async () => {
    const { users, plateforme } = await acteurs()
    await patch(url(plateforme.id), users.admin, {
      version: plateforme.version,
      mailDeblocage: 'deblocage@site.fr',
    })
    await ajouterMail(plateforme.id, users.admin, 'reception@site.fr')
    const p = await lire(users.admin, plateforme.id)
    expect(p?.mailDeblocage).toBe('deblocage@site.fr')
    expect(p?.mailsReception.map((m) => m.adresse)).toEqual(['reception@site.fr'])
  })
})

describe('D-03 RG-ADM-040 / 041 imprimantes cibles', () => {
  it('RG-ADM-040 ajout d’une imprimante ; RG-ADM-041 seules les imprimantes actives sont des cibles ; jamais de suppression', async () => {
    const { users, plateforme } = await acteurs()
    const r = await ajouterImprimante(plateforme.id, users.admin, '  IMP-A ')
    expect(r.statusCode, r.body).toBe(200)
    const p = PlateformeAdminSchema.parse(
      (await ajouterImprimante(plateforme.id, users.admin, 'IMP-B')).json(),
    )
    expect(await imprimantesCibles(db, plateforme.id)).toEqual(['IMP-A', 'IMP-B'])
    const b = p.imprimantes.find((i) => i.nom === 'IMP-B')
    const off = await patch(url(plateforme.id, `/imprimantes/${String(b?.id)}`), users.admin, {
      actif: false,
      version: b?.version,
    })
    expect(off.statusCode, off.body).toBe(200)
    expect(await imprimantesCibles(db, plateforme.id)).toEqual(['IMP-A'])
    expect(
      (await supprimer(url(plateforme.id, `/imprimantes/${String(b?.id)}`), users.admin))
        .statusCode,
    ).toBe(404)
    expect(await db.plateformeImprimante.count({ where: { plateformeId: plateforme.id } })).toBe(2)
    const journal = await db.journalAudit.findMany({
      where: {
        typeEntite: 'PLATEFORME',
        entiteId: String(plateforme.id),
        action: { in: ['CREATION_IMPRIMANTE', 'MODIFICATION_IMPRIMANTE'] },
      },
    })
    expect(journal).toHaveLength(3)
  })

  it('RG-ADM-041 une plateforme sans imprimante n’a aucune cible (aucune impression, aucune alerte)', async () => {
    const { plateforme } = await acteurs()
    expect(await imprimantesCibles(db, plateforme.id)).toEqual([])
  })

  it.each([
    ['vide', ''],
    ['espaces', '   '],
    ['trop long', 'x'.repeat(151)],
    ['absent', undefined],
  ])(
    'RG-ADM-040 nom d’imprimante %s : 400 (l’existant insérait même un nom vide, Q-407)',
    async (_, nom) => {
      const { users, plateforme } = await acteurs()
      expect((await ajouterImprimante(plateforme.id, users.admin, nom)).statusCode).toBe(400)
      expect(await db.plateformeImprimante.count({ where: { plateformeId: plateforme.id } })).toBe(
        0,
      )
    },
  )

  it('RG-ADM-040 doublon de nom sur la plateforme (casse ignorée) : 409 ; plateforme inconnue : 404', async () => {
    const { users, plateforme } = await acteurs()
    await ajouterImprimante(plateforme.id, users.admin, 'IMP-1')
    const d = await ajouterImprimante(plateforme.id, users.admin, 'imp-1')
    expect(d.statusCode).toBe(409)
    expect(erreur(d)).toMatchObject({ code: 'ADM_IMPRIMANTE_EXISTE', regle: 'RG-ADM-040' })
    expect((await ajouterImprimante(999_999_999, users.admin, 'IMP')).statusCode).toBe(404)
  })

  it('RG-REC-009 version périmée : 409 ; imprimante d’une autre plateforme ou inconnue : 404 ; corps invalide : 400', async () => {
    const { users, plateforme } = await acteurs()
    const autre = await f.createPlateforme(db)
    crees.push(autre.id)
    const p = PlateformeAdminSchema.parse(
      (await ajouterImprimante(plateforme.id, users.admin, 'IMP-V')).json(),
    )
    const i = p.imprimantes[0]
    const chemin = url(plateforme.id, `/imprimantes/${String(i?.id)}`)
    expect(
      (await patch(chemin, users.admin, { actif: false, version: i?.version })).statusCode,
    ).toBe(200)
    const perime = await patch(chemin, users.admin, { actif: true, version: i?.version })
    expect(perime.statusCode).toBe(409)
    expect(erreur(perime).code).toBe('ADM_CONFLIT_VERSION')
    expect(
      (
        await patch(url(autre.id, `/imprimantes/${String(i?.id)}`), users.admin, {
          actif: true,
          version: 2,
        })
      ).statusCode,
    ).toBe(404)
    expect(
      (
        await patch(url(plateforme.id, '/imprimantes/999999999'), users.admin, {
          actif: true,
          version: 1,
        })
      ).statusCode,
    ).toBe(404)
    expect((await patch(chemin, users.admin, { actif: 'oui', version: 2 })).statusCode).toBe(400)
  })

  it('RG-REC-008 idempotence et concurrence : même clé rejouée sans doublon ; deux ajouts simultanés du même nom : 200 + 409', async () => {
    const { users, plateforme } = await acteurs()
    const cle = idem()
    const a = await ajouterImprimante(plateforme.id, users.admin, 'IMP-I', cle)
    const b = await ajouterImprimante(plateforme.id, users.admin, 'IMP-I', cle)
    expect([a.statusCode, b.statusCode]).toEqual([200, 200])
    expect(await db.plateformeImprimante.count({ where: { plateformeId: plateforme.id } })).toBe(1)
    const [c, d] = await Promise.all([
      ajouterImprimante(plateforme.id, users.admin, 'IMP-C'),
      ajouterImprimante(plateforme.id, users.admin, 'IMP-C'),
    ])
    expect([c.statusCode, d.statusCode].sort()).toEqual([200, 409])
  })

  it('atomicité : une panne du journal annule l’ajout d’imprimante', async () => {
    const { users, plateforme } = await acteurs()
    const r = await avecEchec(ctx, 'BEFORE INSERT ON journal_audit', () =>
      ajouterImprimante(plateforme.id, users.admin, 'IMP-X'),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect(await db.plateformeImprimante.count({ where: { plateformeId: plateforme.id } })).toBe(0)
  })
})
