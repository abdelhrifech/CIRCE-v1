// COO-P10 — tests d'INTÉGRATION du suivi par thème (RG-COO-230 à 233, ECR-COO-06), de la vue Préparation
// (RG-COO-235, ECR-COO-07) et du générateur de fichiers (ECR-GEN-01 choix des trains, GEN-03 envoi à la machine).
// Source de l'attendu : docs/COORDINATION_REGLES_METIER.md (règles citées) ; hypothèses Q-193, Q-254, Q-262, Q-263,
// Q-280 ; ECR-GEN-01 : « n / 20 tiroirs, bloquant au-delà ». Le fichier de production réel (.ini, D-15) est simulé.
// RG-X : les trains ne sont « prêts » (générateur) que si la Réception a reçu leurs visuels (RG-COO-208) ; le
// pré-assemblage et l'export ne modifient jamais la réception.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  BesoinThemeSchema,
  type BesoinTheme,
  GenerationSchema,
  ListeTrainsSchema,
  TrainsGenerationSchema,
} from '@circe/shared'
import { dbIdentityLoader } from '../../src/core/identity.ts'
import type { MachinePort } from '../../src/core/ports/machine.ts'
import { withTransaction } from '../../src/core/transaction.ts'
import { envoyerGeneration } from '../../src/modules/coordination/generation-fichiers.ts'
import * as f from '../factories/index.ts'
import { contexteReception, erreur, get, idem } from '../support/reception.ts'
import {
  avecEchec,
  DEPART_TXT,
  envoyer,
  parametre,
  recu,
  restaurerParametres,
  ROLES_SANS_ADMIN,
  SEM,
  siteDeroulant,
  trainExportable,
  versions,
  type SiteD,
} from '../support/export-trains.ts'

const ctx = contexteReception()
const { db } = ctx
beforeAll(() => ctx.demarrer())
afterAll(() => ctx.arreter())
afterEach(restaurerParametres)

const site = () => siteDeroulant(ctx)
const faceDe = (id: number) => db.faceTrain.findUniqueOrThrow({ where: { id } })
const besoin = async (s: SiteD, qs = '', headers = s.users.coord.headers) => {
  const r = await get(ctx, `/api/coordination/trains/besoin?depart=${DEPART_TXT}${qs}`, headers)
  expect(r.statusCode, r.body).toBe(200)
  return BesoinThemeSchema.parse(r.json())
}
const themeDe = (b: BesoinTheme, t: string) => b.lignes.find((l) => l.theme === t)

// ───────────────────────── RG-COO-230 / 231 / 232 suivi par thème (besoin) ─────────────────────────

describe('RG-COO-230 suivi par thème : besoin, couvert, entretien, emplacement', () => {
  it('RG-COO-230 une ligne par thème : besoin = nombre de trains, reçu / couvert / emplacement de la Réception, entretien', async () => {
    const s = await site()
    const c = 710_000 + Math.floor(Math.random() * 100_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Gris'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c, ftType: 'entretien' },
    })
    await recu(ctx, s, c, 'Rose', 2)
    const b = await besoin(s)
    const rose = themeDe(b, 'Rose')
    expect(rose).toMatchObject({
      contNum: c,
      besoin: 3,
      entretien: 1,
      recu: 2,
      attendu: 3,
      couvert: false,
      emplacement: 'B-12',
      preAssemble: false,
      exclu: false,
    })
    expect(themeDe(b, 'Gris')).toMatchObject({
      besoin: 1,
      recu: 0,
      attendu: 1,
      couvert: false,
      emplacement: null,
    })
    await recu(ctx, s, c, 'Rose', 1)
    expect(themeDe(await besoin(s), 'Rose')).toMatchObject({ recu: 3, couvert: true })
  })

  it('RG-COO-230 un thème d’un autre dossier ou d’une autre semaine n’est pas mélangé ; casse et accents ignorés', async () => {
    const s = await site()
    const c = 720_000 + Math.floor(Math.random() * 100_000)
    await trainExportable(ctx, s, ['Été'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['ÉTÉ'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Été'], { statut: 'A_IMPRIMER', extra: { contNum: c + 1 } })
    const b = await besoin(s)
    expect(b.lignes.filter((l) => l.contNum === c)).toHaveLength(1)
    expect(b.lignes.find((l) => l.contNum === c)?.besoin).toBe(2)
    expect(b.lignes.find((l) => l.contNum === c + 1)?.besoin).toBe(1)
  })

  it('RG-COO-230 filtres (dossier, annonceur, thème) côté API ; le filtre Statut n’existe pas : le besoin l’ignore ; semaine par défaut = suivante', async () => {
    const s = await site()
    const c = 730_000 + Math.floor(Math.random() * 100_000)
    await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      annonceur: 'ALPHA',
      extra: { contNum: c },
    })
    await trainExportable(ctx, s, ['Gris'], {
      statut: 'AU_ROULAGE',
      annonceur: 'BETA',
      extra: { contNum: c + 1 },
    })
    expect((await besoin(s)).lignes).toHaveLength(2)
    expect((await besoin(s, `&dossier=${String(c)}`)).lignes.map((l) => l.theme)).toEqual(['Rose'])
    expect((await besoin(s, '&annonceur=beta')).lignes.map((l) => l.theme)).toEqual(['Gris'])
    expect((await besoin(s, '&theme=gris,inconnu')).lignes.map((l) => l.theme)).toEqual(['Gris'])
    expect((await besoin(s, '&statut=PRET')).lignes).toHaveLength(2)
    const defaut = BesoinThemeSchema.parse(
      (await get(ctx, '/api/coordination/trains/besoin', s.users.coord.headers)).json(),
    )
    expect(defaut.semaine).toEqual(SEM)
    expect(
      (await get(ctx, '/api/coordination/trains/besoin?depart=2026-W54', s.users.coord.headers))
        .statusCode,
    ).toBe(400)
  })

  it('RG-COO-231 thèmes « ne pas afficher » / « reste en place » exclus du besoin, listés en annotation', async () => {
    const s = await site()
    const c = 740_000 + Math.floor(Math.random() * 100_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    await trainExportable(ctx, s, ['Paris Privatisé'], {
      statut: 'A_IMPRIMER',
      annonceur: 'VILLE',
      extra: { contNum: c, contAnnonc: 'VILLE' },
    })
    await recu(ctx, s, c, 'Paris Privatisé', 0, { exclu: true })
    const b = await besoin(s)
    expect(b.lignes.map((l) => l.theme)).toEqual(['Rose'])
    expect(b.exclus).toEqual(['VILLE · Paris Privatisé'])
    // Rejet : la ligne exclue d’un autre site ne masque pas le thème de ce site.
    const autre = await site()
    await recu(ctx, autre, c, 'Rose', 0, { exclu: true })
    expect(themeDe(await besoin(s), 'Rose')).toBeDefined()
  })

  it('RG-COO-232 le suivi liste tous les thèmes des trains (Q-263 non tranchée : pas de restriction aux dossiers avec commentaire de prépa)', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'A_IMPRIMER' })
    expect(t.dossiers.every((d) => d.annonceur === 'ANNONCEUR')).toBe(true)
    expect((await besoin(s)).lignes).toHaveLength(2)
  })

  it('RG-COO-167 périmètre : un autre site ne voit rien ; permissions : consultation réservée à coord et cheq', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const autre = await site()
    expect((await besoin(autre, '', autre.users.coord.headers)).lignes).toHaveLength(0)
    for (const role of ROLES_SANS_ADMIN) {
      const r = await get(
        ctx,
        `/api/coordination/trains/besoin?depart=${DEPART_TXT}`,
        s.users[role].headers,
      )
      expect(r.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
    }
    expect(
      (await ctx.app.inject({ method: 'GET', url: '/api/coordination/trains/besoin' })).statusCode,
    ).toBe(401)
  })
})

// ───────────────────────── RG-COO-233 pré-assemblage ─────────────────────────

describe('RG-COO-233 pré-assemblage : marquer / désassembler par thème', () => {
  const marquer = (s: SiteD, themes: unknown[], valeur: boolean, headers = s.users.cheq.headers) =>
    envoyer(ctx, '/api/coordination/trains/pre-assemblage', headers, { themes, valeur })
  const cible = async (s: SiteD, contNum: number, theme: string) => {
    const l = themeDe(await besoin(s, `&dossier=${String(contNum)}`), theme)
    if (!l) throw new Error('thème absent du besoin')
    return { atelierId: l.atelierId, depart: DEPART_TXT, contNum, theme, version: l.version }
  }

  it('RG-COO-233 nominal : « Marquer pré-assemblé » puis « Désassembler » : toutes les faces du thème, journal, version +1', async () => {
    const s = await site()
    const c = 750_000 + Math.floor(Math.random() * 100_000)
    const a = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const b = await trainExportable(ctx, s, ['Rose', 'Gris'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const r = await marquer(s, [await cible(s, c, 'Rose')], true)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ message: string }>().message).toBe('2 visuel(s) pré-assemblé(s).')
    expect(await faceDe(a.faces[0]?.id ?? 0)).toMatchObject({ preAssemblage: true, version: 2 })
    expect((await faceDe(b.faces[0]?.id ?? 0)).preAssemblage).toBe(true)
    expect((await faceDe(b.faces[1]?.id ?? 0)).preAssemblage).toBe(false)
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(true)
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TRAIN', entiteId: a.trainId, action: 'PRE_ASSEMBLAGE' },
      }),
    ).toBe(1)
    const off = await marquer(s, [await cible(s, c, 'Rose')], false, s.users.coord.headers)
    expect(off.json<{ message: string }>().message).toBe('2 visuel(s) désassemblé(s).')
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(false)
  })

  it('RG-COO-233 initialisé à « Fait » dès qu’un train du thème est en production (HYPOTHÈSE Q-193) ; la Réception n’est pas modifiée', async () => {
    const s = await site()
    const c = 760_000 + Math.floor(Math.random() * 100_000)
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER', extra: { contNum: c } })
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(false)
    await trainExportable(ctx, s, ['Rose'], { statut: 'AU_ROULAGE', extra: { contNum: c } })
    expect(themeDe(await besoin(s), 'Rose')?.preAssemble).toBe(true)
    const avant = [
      await db.affiche.count(),
      await db.mouvement.count(),
      await db.afficheAttendue.count(),
    ]
    await marquer(s, [await cible(s, c, 'Rose')], true)
    expect([
      await db.affiche.count(),
      await db.mouvement.count(),
      await db.afficheAttendue.count(),
    ]).toEqual(avant)
  })

  it('RG-COO-308 version périmée → 409, rien d’écrit ; thème inconnu → 404 ; autre site → 403 ; liste vide / valeur absente → 400', async () => {
    const s = await site()
    const c = 770_000 + Math.floor(Math.random() * 100_000)
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const cb = await cible(s, c, 'Rose')
    const perimee = await marquer(s, [{ ...cb, version: '9.9.9' }], true)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    expect((await marquer(s, [{ ...cb, theme: 'Inconnu' }], true)).statusCode).toBe(404)
    const autre = await site()
    expect((await marquer(autre, [cb], true, autre.users.cheq.headers)).statusCode).toBe(403)
    expect((await marquer(s, [], true)).statusCode).toBe(400)
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/pre-assemblage', s.users.cheq.headers, {
          themes: [cb],
        })
      ).statusCode,
    ).toBe(400)
    expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(false)
  })

  it.each(ROLES_SANS_ADMIN)(
    'RG-COO-233 permissions : pré-assemblage pour le rôle %s',
    async (role) => {
      const s = await site()
      const c = 780_000 + Math.floor(Math.random() * 100_000)
      const t = await trainExportable(ctx, s, ['Rose'], {
        statut: 'A_IMPRIMER',
        extra: { contNum: c },
      })
      const r = await marquer(s, [await cible(s, c, 'Rose')], true, s.users[role].headers)
      const autorise = role === 'coord' || role === 'cheq'
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      expect((await faceDe(t.faces[0]?.id ?? 0)).preAssemblage).toBe(autorise)
    },
  )

  it('RG-COO-233 atomicité (échec du journal du 2e thème : le 1er n’est pas marqué), concurrence (un 200, un 409) et idempotence', async () => {
    const s = await site()
    const c = 790_000 + Math.floor(Math.random() * 100_000)
    const a = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const b = await trainExportable(ctx, s, ['Gris'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const themes = [await cible(s, c, 'Rose'), await cible(s, c, 'Gris')]
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.entite_id = '${b.trainId}' AND NEW.action = 'PRE_ASSEMBLAGE'`,
      () => marquer(s, themes, true),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect((await faceDe(a.faces[0]?.id ?? 0)).preAssemblage).toBe(false)
    const [x, y] = await Promise.all([marquer(s, themes, true), marquer(s, themes, true)])
    expect([x.statusCode, y.statusCode].sort()).toEqual([200, 409])
    const cle = idem()
    const corps = { themes: [await cible(s, c, 'Rose')], valeur: false }
    const un = await envoyer(
      ctx,
      '/api/coordination/trains/pre-assemblage',
      s.users.cheq.headers,
      corps,
      cle,
    )
    const deux = await envoyer(
      ctx,
      '/api/coordination/trains/pre-assemblage',
      s.users.cheq.headers,
      corps,
      cle,
    )
    expect(un.statusCode).toBe(200)
    expect(deux.json()).toEqual(un.json())
  })
})

// ───────────────────────── RG-COO-235 vue Préparation ─────────────────────────

describe('RG-COO-235 vue Préparation : rouleur, pré-assemblage, fichier, modifications', () => {
  it('RG-COO-235 la liste porte le rouleur (nom), le pré-assemblage « Fait », le lot de fichier et le nombre de modifications tracées', async () => {
    const s = await site()
    const c = 800_000 + Math.floor(Math.random() * 100_000)
    const t = await trainExportable(ctx, s, ['Rose'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    await recu(ctx, s, c, 'Rose', 1)
    const liste = async () => {
      const r = await get(
        ctx,
        `/api/coordination/trains?depart=${DEPART_TXT}`,
        s.users.cheq.headers,
      )
      expect(r.statusCode, r.body).toBe(200)
      return ListeTrainsSchema.parse(r.json()).lignes.find((l) => l.cle === t.trainId)
    }
    expect(await liste()).toMatchObject({
      rouleur: null,
      preAssemble: false,
      fichier: null,
      modifications: 0,
    })
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur N1' })
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/rouleur', s.users.cheq.headers, {
          trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
          rouleurId: rouleur.id,
        })
      ).statusCode,
    ).toBe(200)
    const l = themeDe(await besoin(s, `&dossier=${String(c)}`), 'Rose')
    expect(l).toBeDefined()
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/pre-assemblage', s.users.cheq.headers, {
          themes: [
            {
              atelierId: s.atelier.id,
              depart: DEPART_TXT,
              contNum: c,
              theme: 'Rose',
              version: l?.version,
            },
          ],
          valeur: true,
        })
      ).statusCode,
    ).toBe(200)
    const prepare = await envoyer(ctx, '/api/coordination/generateur', s.users.cheq.headers, {
      depart: DEPART_TXT,
      trains: await versions(ctx, s.users.coord.headers, [t.trainId]),
    })
    expect(prepare.statusCode, prepare.body).toBe(200)
    const apres = await liste()
    expect(apres).toMatchObject({
      rouleur: 'Rouleur N1',
      preAssemble: true,
      fichier: GenerationSchema.parse(prepare.json()).lot,
    })
    expect(apres?.modifications).toBeGreaterThanOrEqual(2)
  })
})

// ───────────────────────── ECR-GEN-01 / GEN-03 générateur de fichiers ─────────────────────────

describe('ECR-GEN-01 choix des trains : prêts, en attente, déjà envoyés, tiroirs', () => {
  const generation = async (s: SiteD, qs = '', headers = s.users.cheq.headers) => {
    const r = await get(ctx, `/api/coordination/generateur?depart=${DEPART_TXT}${qs}`, headers)
    expect(r.statusCode, r.body).toBe(200)
    return TrainsGenerationSchema.parse(r.json())
  }

  it('ECR-GEN-01 les trains couverts sont « PRET », les autres « EN_ATTENTE » (exclus), ceux en production « DEJA_ENVOYE » ; tiroirs = visuels distincts, fractionnés exclus', async () => {
    const s = await site()
    const prets = await trainExportable(ctx, s, ['Rose', 'Gris'], { statut: 'A_IMPRIMER' })
    for (const d of prets.dossiers) {
      const face = prets.faces.find((x) => x.contNum === d.contNum)
      await recu(ctx, s, d.contNum, face?.theme ?? '', 1)
    }
    const attente = await trainExportable(ctx, s, ['Bleu'], { statut: 'A_IMPRIMER' })
    const envoye = await trainExportable(ctx, s, ['Vert'], { statut: 'AU_ROULAGE' })
    const fractionne = await trainExportable(ctx, s, ['Noir', 'Blanc'], {
      statut: 'A_IMPRIMER',
      extra: {},
    })
    await db.faceTrain.update({
      where: { id: fractionne.faces[1]?.id ?? 0 },
      data: { fractionnee: true },
    })
    const g = await generation(s)
    const ligne = (id: string) => g.trains.find((t) => t.trainId === id)
    expect(ligne(prets.trainId)).toMatchObject({ statut: 'PRET', tiroirs: 2 })
    expect(ligne(attente.trainId)).toMatchObject({ statut: 'EN_ATTENTE', tiroirs: 1 })
    expect(ligne(envoye.trainId)?.statut).toBe('DEJA_ENVOYE')
    expect(ligne(fractionne.trainId)?.tiroirs).toBe(1)
    expect(g.tiroirsMax).toBe(20)
    expect(g.indicateurs.prets).toBeGreaterThanOrEqual(1)
    expect(g.indicateurs.enAttente).toBeGreaterThanOrEqual(1)
    expect(g.indicateurs.dejaEnvoyes).toBeGreaterThanOrEqual(1)
    const filtre = await generation(s, `&atelier=${String(s.atelier2.id)}`)
    expect(filtre.trains).toHaveLength(0)
  })

  it('ECR-GEN-01 droits : coord et cheq ; autres rôles refusés (403) ; autre site : aucun train ; semaine inexistante : 400', async () => {
    const s = await site()
    await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    for (const role of ROLES_SANS_ADMIN) {
      const r = await get(
        ctx,
        `/api/coordination/generateur?depart=${DEPART_TXT}`,
        s.users[role].headers,
      )
      expect(r.statusCode, role).toBe(role === 'coord' || role === 'cheq' ? 200 : 403)
    }
    const autre = await site()
    expect((await generation(autre, '', autre.users.cheq.headers)).trains).toHaveLength(0)
    expect(
      (await get(ctx, '/api/coordination/generateur?depart=2026-W54', s.users.cheq.headers))
        .statusCode,
    ).toBe(400)
  })
})

describe('ECR-GEN-01 / GEN-03 préparer le fichier, 20 tiroirs, envoyer à la machine', () => {
  const preparer = (
    s: SiteD,
    trains: { trainId: string; version: string }[],
    headers = s.users.cheq.headers,
    depart = DEPART_TXT,
  ) => envoyer(ctx, '/api/coordination/generateur', headers, { depart, trains })
  const envoi = (s: SiteD, id: number, version: number, headers = s.users.cheq.headers) =>
    envoyer(ctx, '/api/coordination/generateur/envoyer', headers, { id, version })
  /** Train prêt : tous ses visuels reçus. */
  const pret = async (
    s: SiteD,
    themes: string[],
    statut: 'A_IMPRIMER' | 'INSTRUCTION_OK' = 'A_IMPRIMER',
  ) => {
    const t = await trainExportable(ctx, s, themes, { statut })
    for (const face of t.faces) await recu(ctx, s, face.contNum ?? 0, face.theme ?? '', 1)
    return t
  }

  it('ECR-GEN-01 nominal : lot « G-nnnn » versionné, fichier SIMULÉ marqué, tiroirs comptés, journal ; aucun statut de face modifié', async () => {
    const s = await site()
    const t = await pret(s, ['Rose', 'Gris'])
    const r = await preparer(s, await versions(ctx, s.users.coord.headers, [t.trainId]))
    expect(r.statusCode, r.body).toBe(200)
    const g = GenerationSchema.parse(r.json())
    expect(g).toMatchObject({ trains: 1, tiroirs: 2, statut: 'PREPARE', version: 1 })
    expect(g.lot).toMatch(/^G-\d{4}$/)
    expect(g.contenu.startsWith('# SIMULATION')).toBe(true)
    expect(g.contenu).toContain(t.trainId)
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('A_IMPRIMER')
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'GENERATION_FICHIERS',
          entiteId: String(g.id),
          action: 'GENERATION_FICHIERS',
          parId: s.users.cheq.id,
        },
      }),
    ).toBe(1)
    const h = TrainsGenerationSchema.parse(
      (
        await get(ctx, `/api/coordination/generateur?depart=${DEPART_TXT}`, s.users.cheq.headers)
      ).json(),
    )
    expect(h.historique.find((x) => x.id === g.id)).toMatchObject({
      lot: g.lot,
      statut: 'PREPARE',
      trains: 1,
      version: 1,
    })
    const fichier = await get(
      ctx,
      `/api/coordination/generateur/${String(g.id)}/fichier`,
      s.users.cheq.headers,
    )
    expect(fichier.json()).toEqual({ nomFichier: g.nomFichier, contenu: g.contenu })
    expect(
      (await get(ctx, '/api/coordination/generateur/99999999/fichier', s.users.cheq.headers))
        .statusCode,
    ).toBe(404)
    expect(
      (
        await get(
          ctx,
          `/api/coordination/generateur/${String(g.id)}/fichier`,
          s.users.recep.headers,
        )
      ).statusCode,
    ).toBe(403)
  })

  it('RG-X / RG-COO-208 rejet : la Réception n’a pas reçu tous les visuels (train EN_ATTENTE) → 409, aucun lot ; une fois reçu → accepté', async () => {
    const s = await site()
    const t = await trainExportable(ctx, s, ['Rose'], { statut: 'A_IMPRIMER' })
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const r = await preparer(s, v)
    expect(r.statusCode).toBe(409)
    expect(erreur(r)).toMatchObject({ code: 'COO_TRAIN_NON_PRET', regle: 'RG-COO-208' })
    expect(await db.generationFichiers.count({ where: { parId: s.users.cheq.id } })).toBe(0)
    await recu(ctx, s, t.faces[0]?.contNum ?? 0, 'Rose', 1)
    expect(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [t.trainId]))).statusCode,
    ).toBe(200)
  })

  it('ECR-GEN-01 / Q-254 plafond de tiroirs : au-delà → 422 « n tiroirs : la Vendôme en a 20. Retirez des trains (bloquant). », aucun lot ; limite acceptée ; un visuel commun compte une fois', async () => {
    const s = await site()
    await parametre(ctx, 'trains.tiroirsMax', '2')
    const a = await pret(s, ['Rose', 'Gris', 'Bleu'])
    const r = await preparer(s, await versions(ctx, s.users.coord.headers, [a.trainId]))
    expect(r.statusCode).toBe(422)
    expect(erreur(r)).toMatchObject({
      code: 'COO_TIROIRS_DEPASSES',
      regle: 'RG-COO-216',
      message: '3 tiroirs : la Vendôme en a 2. Retirez des trains (bloquant).',
    })
    expect(await db.generationFichiers.count({ where: { parId: s.users.cheq.id } })).toBe(0)
    const deux = await pret(s, ['Rose', 'Gris'])
    expect(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [deux.trainId]))).statusCode,
    ).toBe(200)
    const c = 810_000 + Math.floor(Math.random() * 100_000)
    const x = await trainExportable(ctx, s, ['Commun'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    const y = await trainExportable(ctx, s, ['Commun'], {
      statut: 'A_IMPRIMER',
      extra: { contNum: c },
    })
    await recu(ctx, s, c, 'Commun', 2)
    const commun = await preparer(
      s,
      await versions(ctx, s.users.coord.headers, [x.trainId, y.trainId]),
    )
    expect(commun.statusCode, commun.body).toBe(200)
    expect(GenerationSchema.parse(commun.json()).tiroirs).toBe(1)
  })

  it('RG-COO-228 / RG-COO-308 rejets : train d’une autre semaine (409), version périmée (409), train inconnu (404), autre site (403), liste vide (400)', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const semaineSuivante =
      SEM.semaine === 52
        ? '2027-W01'
        : `${String(SEM.annee)}-W${String(SEM.semaine + 1).padStart(2, '0')}`
    const autreSemaine = await preparer(s, v, s.users.cheq.headers, semaineSuivante)
    expect(autreSemaine.statusCode).toBe(409)
    expect(erreur(autreSemaine).code).toBe('COO_TRAIN_AUTRE_SEMAINE')
    const perimee = await preparer(s, [{ trainId: t.trainId, version: '9.9.9' }])
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    expect(
      (await preparer(s, [{ trainId: '7000000000000000', version: '1.1.1' }])).statusCode,
    ).toBe(404)
    const autre = await site()
    expect((await preparer(autre, v, autre.users.cheq.headers)).statusCode).toBe(403)
    expect((await preparer(s, [])).statusCode).toBe(400)
    expect(await db.generationFichiers.count({ where: { parId: s.users.cheq.id } })).toBe(0)
  })

  it.each(ROLES_SANS_ADMIN)(
    'ECR-GEN-01 permissions : préparer et envoyer pour le rôle %s',
    async (role) => {
      const s = await site()
      const t = await pret(s, ['Rose'])
      const v = await versions(ctx, s.users.coord.headers, [t.trainId])
      const autorise = role === 'coord' || role === 'cheq'
      const r = await preparer(s, v, s.users[role].headers)
      expect(r.statusCode, r.body).toBe(autorise ? 200 : 403)
      const e = await envoi(s, 99_999_999, 1, s.users[role].headers)
      expect(e.statusCode).toBe(autorise ? 404 : 403)
    },
  )

  it('GEN-03 envoi à la machine : lot « Envoyé » (version +1), machine tracée, faces INCHANGÉES (« Au roulage » exige un rouleur, RG-COO-217 ; audit B2), journal', async () => {
    const s = await site()
    const t = await pret(s, ['Rose', 'Gris'])
    const g = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [t.trainId]))).json(),
    )
    const avant = await Promise.all(t.faces.map((face) => faceDe(face.id)))
    const r = await envoi(s, g.id, g.version)
    expect(r.statusCode, r.body).toBe(200)
    const e = GenerationSchema.parse(r.json())
    expect(e).toMatchObject({ statut: 'ENVOYE', version: 2, machine: 'simulee' })
    expect(e.message).toBe(
      `${g.lot} envoyé à la machine « simulee » (envoi simulé, D-15 : aucun fichier n’a quitté Circé) : 1 train(s). Les faces gardent leur statut (« Au roulage » exige un rouleur, RG-COO-217).`,
    )
    // B2 : aucune face ne passe « Au roulage » à l'envoi (pas de rouleur) : statut, version et historique inchangés.
    for (const [k, face] of t.faces.entries()) {
      const apres = await faceDe(face.id)
      expect(apres.statut).toBe('A_IMPRIMER')
      expect(apres.version).toBe(avant[k]?.version)
      expect(apres.rouleurId).toBeNull()
      expect(
        await db.statutHistorique.count({
          where: { typeEntite: 'FACE_TRAIN', entiteId: String(face.id), nouveau: 'AU_ROULAGE' },
        }),
      ).toBe(0)
    }
    const lot = await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })
    expect(lot).toMatchObject({
      statut: 'ENVOYE',
      version: 2,
      envoyeParId: s.users.cheq.id,
      machineEnvoi: 'simulee',
    })
    expect(lot.envoyeLe).toBeInstanceOf(Date)
    expect(
      await db.journalAudit.count({
        where: {
          typeEntite: 'GENERATION_FICHIERS',
          entiteId: String(g.id),
          action: 'ENVOI_MACHINE',
          nouvelleValeur: 'ENVOYE (machine « simulee », envoi simulé, D-15)',
        },
      }),
    ).toBe(1)
    // L'historique de la génération porte la machine de l'envoi.
    const h = await get(
      ctx,
      `/api/coordination/generateur?depart=${DEPART_TXT}`,
      s.users.cheq.headers,
    )
    expect(
      TrainsGenerationSchema.parse(h.json()).historique.find((x) => x.id === g.id)?.machine,
    ).toBe('simulee')
  })

  it('GEN-03 rejets : deuxième envoi (409), version périmée (409), lot inconnu (404) ; audit B3 : train modifié depuis le « Préparer » (409), train plus prêt (409) : rien écrit, rien envoyé', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [t.trainId]))).json(),
    )
    const perimee = await envoi(s, g.id, 9)
    expect(perimee.statusCode).toBe(409)
    expect(erreur(perimee).regle).toBe('RG-COO-308')
    expect((await envoi(s, 99_999_999, 1)).statusCode).toBe(404)
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
    const deux = await envoi(s, g.id, 2)
    expect(deux.statusCode).toBe(409)
    expect(erreur(deux).code).toBe('TRANSITION_INTERDITE')

    // B3 : un train modifié (ici : rouleur affecté, RG-COO-236) entre « Préparer » et « Envoyer » rend le fichier périmé.
    const modifie = await pret(s, ['Gris'])
    const g2 = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [modifie.trainId]))).json(),
    )
    const rouleur = await f.createRouleur(db, { atelierId: s.atelier.id, nom: 'Rouleur B3' })
    expect(
      (
        await envoyer(ctx, '/api/coordination/trains/rouleur', s.users.cheq.headers, {
          trains: await versions(ctx, s.users.coord.headers, [modifie.trainId]),
          rouleurId: rouleur.id,
        })
      ).statusCode,
    ).toBe(200)
    const r2 = await envoi(s, g2.id, g2.version)
    expect(r2.statusCode, r2.body).toBe(409)
    expect(erreur(r2)).toMatchObject({ code: 'COO_TRAIN_MODIFIE', regle: 'RG-COO-308' })
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g2.id } })).statut).toBe(
      'PREPARE',
    )
    expect((await faceDe(modifie.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')

    // B3 : un train dont les visuels ne sont plus tous reçus n'est plus PRET : envoi refusé (409 RG-COO-208).
    const perdu = await pret(s, ['Bleu'])
    const g3 = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [perdu.trainId]))).json(),
    )
    await db.afficheAttendue.updateMany({
      where: { ligneAttendue: { contNum: perdu.faces[0]?.contNum ?? 0, theme: 'Bleu' } },
      data: { actif: false },
    })
    const r3 = await envoi(s, g3.id, g3.version)
    expect(r3.statusCode, r3.body).toBe(409)
    expect(erreur(r3)).toMatchObject({ code: 'COO_TRAIN_NON_PRET', regle: 'RG-COO-208' })
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g3.id } })).statut).toBe(
      'PREPARE',
    )

    // Q-251 : l'envoi n'exige PAS que le train soit exporté (faces « Instruction ok » acceptées, jamais modifiées).
    const nonExporte = await pret(s, ['Vert'], 'INSTRUCTION_OK')
    const g4 = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [nonExporte.trainId]))).json(),
    )
    expect((await envoi(s, g4.id, g4.version)).statusCode).toBe(200)
    expect((await faceDe(nonExporte.faces[0]?.id ?? 0)).statut).toBe('INSTRUCTION_OK')
  })

  it('GEN-03 la machine refuse l’envoi : 422 explicite, le lot reste « Préparé », aucune face ne change (rollback)', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const g = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [t.trainId]))).json(),
    )
    const charge = await dbIdentityLoader(db)(s.users.cheq.ext)
    if (!charge) throw new Error('identité introuvable')
    const identity = { ...charge, siteId: null }
    const machineKO: MachinePort = {
      nom: 'ko',
      envoyer: () => Promise.reject(new Error('machine hors service')),
    }
    await expect(
      withTransaction(db, (tx) =>
        envoyerGeneration(tx, identity, { id: g.id, version: g.version }, machineKO),
      ),
    ).rejects.toMatchObject({ code: 'COO_ENVOI_MACHINE_ECHEC', regle: 'RG-COO-217' })
    expect((await faceDe(t.faces[0]?.id ?? 0)).statut).toBe('A_IMPRIMER')
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).statut).toBe(
      'PREPARE',
    )
    expect((await envoi(s, g.id, g.version)).statusCode).toBe(200)
  })

  it('GEN-03 / RG-COO-308 atomicité (échec de la mise à jour du lot : rien écrit), concurrence (un 200, un 409), idempotence', async () => {
    const s = await site()
    const t = await pret(s, ['Rose', 'Gris'])
    const g = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [t.trainId]))).json(),
    )
    const r = await avecEchec(
      ctx,
      "BEFORE UPDATE ON generation_fichiers WHEN NEW.statut = 'ENVOYE'",
      () => envoi(s, g.id, g.version),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    for (const face of t.faces) expect((await faceDe(face.id)).statut).toBe('A_IMPRIMER')
    expect((await db.generationFichiers.findUniqueOrThrow({ where: { id: g.id } })).statut).toBe(
      'PREPARE',
    )
    const [a, b] = await Promise.all([envoi(s, g.id, g.version), envoi(s, g.id, g.version)])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
    const cle = idem()
    const t2 = await pret(s, ['Bleu'])
    const g2 = GenerationSchema.parse(
      (await preparer(s, await versions(ctx, s.users.coord.headers, [t2.trainId]))).json(),
    )
    const un = await envoyer(
      ctx,
      '/api/coordination/generateur/envoyer',
      s.users.cheq.headers,
      { id: g2.id, version: g2.version },
      cle,
    )
    const deux = await envoyer(
      ctx,
      '/api/coordination/generateur/envoyer',
      s.users.cheq.headers,
      { id: g2.id, version: g2.version },
      cle,
    )
    expect(un.statusCode).toBe(200)
    expect(deux.json()).toEqual(un.json())
  })

  it('ECR-GEN-01 atomicité de la préparation : un échec d’écriture du journal annule le lot ; idempotence de la préparation (même clé : un seul lot)', async () => {
    const s = await site()
    const t = await pret(s, ['Rose'])
    const v = await versions(ctx, s.users.coord.headers, [t.trainId])
    const r = await avecEchec(
      ctx,
      "BEFORE INSERT ON journal_audit WHEN NEW.action = 'GENERATION_FICHIERS'",
      () => preparer(s, v),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(400)
    expect(await db.generationFichiers.count({ where: { parId: s.users.cheq.id } })).toBe(0)
    const cle = idem()
    const un = await envoyer(
      ctx,
      '/api/coordination/generateur',
      s.users.cheq.headers,
      { depart: DEPART_TXT, trains: v },
      cle,
    )
    const deux = await envoyer(
      ctx,
      '/api/coordination/generateur',
      s.users.cheq.headers,
      { depart: DEPART_TXT, trains: v },
      cle,
    )
    expect(deux.json()).toEqual(un.json())
    expect(await db.generationFichiers.count({ where: { parId: s.users.cheq.id } })).toBe(1)
  })
})
