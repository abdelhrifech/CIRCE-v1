// Étape 8, lot 4 (D-20) — tests d'INTÉGRATION des traitements planifiés (EX-REC-512, RG-REC-180 / 181 purge des attendues,
// RG-COO-269 fin de journée des colis, RG-COO-042 Instruction OK automatique, EX-TRA-030 envoi des mails ; Q-005,
// Q-006, Q-410) : exécution manuelle et planifiée, journal d'exécution, verrou anti double exécution, idempotence
// (relance sans double effet), atomicité, horaires D-06 (vides = désactivé), droits, 401, commande `taches:executer`.
// Aucun mail réel (boîte d'envoi simulée). API réelle, base de test.
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ErrorResponseSchema,
  ExecutionTacheSchema,
  ListeExecutionsSchema,
  ListeTachesSchema,
  ParametreAdminSchema,
  lundiSemaineIso,
  semaineIsoDe,
  type NomTache,
  type Role,
} from '@circe/shared'
import { MailBoiteEnvoi } from '../../src/core/ports/mail.ts'
import {
  executerEcheances,
  executerTache,
  horaireEchu,
  identiteSysteme,
} from '../../src/modules/taches/service.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, parametre, restaurerParametres, ROLES } from '../support/export-trains.ts'
import { contexteReception, get, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

beforeAll(async () => {
  await ctx.demarrer()
  // La base de test est partagée : les mails laissés en attente par les autres fichiers sont soldés (file de 100 lignes).
  await db.mailFile.updateMany({
    where: { statut: { in: ['EN_ATTENTE', 'EN_COURS'] } },
    data: { statut: 'ENVOYE', canal: 'SIMULE' },
  })
})
afterAll(async () => {
  await restaurerParametres()
  await ctx.arreter()
})

async function utilisateurs() {
  const plateforme = await f.createPlateforme(db)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}
const executer = (h: H, tache: string, cle = true) =>
  post(ctx, `/api/admin/taches/${tache}/executer`, h, {}, cle)
const derniere = (tache: NomTache) =>
  db.tacheExecution.findFirstOrThrow({ where: { tache }, orderBy: { id: 'desc' } })

/** Colis « A expédier » (UM liée) prêt pour la fin de journée. */
async function colisAExpedier(mail: string | null) {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const support = await f.createSupport(db, { poids: 2 })
  const dest = await f.createDestinataire(db, { nom: `Dest tâche ${String(next())}`, mail })
  const u = await f.createUniteManutention(db, {
    atelierId: atelier.id,
    supportId: support.id,
    destinataireId: dest.id,
    qte: 4,
    statut: 'A_EXPEDIER',
  })
  const colis = await db.colis.create({
    data: {
      plateformeId: plateforme.id,
      atelierId: atelier.id,
      destinataireId: dest.id,
      statut: 'A_EXPEDIER',
      codeColis: `C-${String(800_000_000 + next()).padStart(18, '0')}`,
    },
  })
  await db.uniteColis.create({ data: { uniteId: u.id, colisId: colis.id, quantite: 4 } })
  return { colis, u }
}

describe('D-20 liste des tâches et horaires (D-06)', () => {
  it('Q-410 par défaut aucun horaire n’est configuré : toutes les tâches sont désactivées ; l’administrateur lit leur état', async () => {
    const { users } = await utilisateurs()
    const r = await get(ctx, '/api/admin/taches', users.admin)
    expect(r.statusCode, r.body).toBe(200)
    const liste = ListeTachesSchema.parse(r.json())
    expect(liste.taches.map((t) => t.nom).sort()).toEqual([
      'ENVOI_MAILS',
      'FIN_JOURNEE_COLIS',
      'INSTRUCTION_OK_AUTO',
      'PURGE_ATTENDUES',
    ])
    expect(liste.taches.every((t) => !t.active && t.horaires.length === 0)).toBe(true)
    expect(liste.taches.find((t) => t.nom === 'FIN_JOURNEE_COLIS')?.regle).toBe('RG-COO-269')
  })

  it('Q-410 les horaires se règlent dans les paramètres (D-06) : « HH:MM » normalisés et triés ; format invalide, doublon : 400 ; vide : désactivé', async () => {
    const { users } = await utilisateurs()
    const cle = 'taches.finJourneeColis'
    await parametre(ctx, cle, '')
    const put = (valeur: string, version: number) =>
      ctx.app.inject({
        method: 'PUT',
        url: `/api/admin/parametres/${cle}`,
        headers: users.admin,
        payload: { valeur, version },
      })
    const lu = async () =>
      ParametreAdminSchema.parse(
        (await get(ctx, '/api/admin/parametres', users.admin))
          .json<{ parametres: unknown[] }>()
          .parametres.find((p) => (p as { cle: string }).cle === cle),
      )
    let p = await lu()
    expect(p.format.type).toBe('horaires')
    for (const mauvais of ['25:00', '12h30', '08:60', '08:00;08:00', '08:00,09:00']) {
      const r = await put(mauvais, p.version)
      expect(r.statusCode, mauvais).toBe(400)
      expect(ErrorResponseSchema.parse(r.json()).code).toBe('ADM_PARAMETRE_INVALIDE')
    }
    const ok = await put('18:30; 7:05', p.version)
    expect(ok.statusCode, ok.body).toBe(200)
    expect(ParametreAdminSchema.parse(ok.json()).valeur).toBe('07:05;18:30')
    p = await lu()
    const taches = ListeTachesSchema.parse(
      (await get(ctx, '/api/admin/taches', users.admin)).json(),
    )
    expect(taches.taches.find((t) => t.nom === 'FIN_JOURNEE_COLIS')).toMatchObject({
      active: true,
      horaires: ['07:05', '18:30'],
    })
    expect((await put('', p.version)).statusCode).toBe(200)
  })

  it('RG-REC-002 par profil : liste, journal et exécution manuelle réservés à l’administrateur ; 401 sans identité ; 400 sans clé ou tâche inconnue', async () => {
    const { users } = await utilisateurs()
    for (const role of ROLES) {
      const l = await get(ctx, '/api/admin/taches', users[role])
      const e = await get(ctx, '/api/admin/taches/executions', users[role])
      const x = await executer(users[role], 'ENVOI_MAILS')
      if (role === 'admin') {
        expect([l.statusCode, e.statusCode, x.statusCode], role).toEqual([200, 200, 200])
      } else {
        expect([l.statusCode, e.statusCode, x.statusCode], role).toEqual([403, 403, 403])
        expect(ErrorResponseSchema.parse(x.json()).regle).toBe('RG-REC-002')
      }
    }
    expect((await get(ctx, '/api/admin/taches', {})).statusCode).toBe(401)
    expect(
      (
        await ctx.app.inject({
          method: 'POST',
          url: '/api/admin/taches/ENVOI_MAILS/executer',
          payload: {},
        })
      ).statusCode,
    ).toBe(401)
    expect((await executer(users.admin, 'ENVOI_MAILS', false)).statusCode).toBe(400)
    expect((await executer(users.admin, 'INCONNUE')).statusCode).toBe(400)
  })
})

describe('D-20 RG-COO-269 fin de journée des colis (même logique que l’action manuelle)', () => {
  it('RG-COO-269 nominal : colis, UM → « Terminé », historique par l’acteur technique, journal d’exécution (tâche, début, fin, résultat), mail mis en file', async () => {
    const { users } = await utilisateurs()
    const { colis, u } = await colisAExpedier('tache@exemple.test')
    const r = await executer(users.admin, 'FIN_JOURNEE_COLIS')
    expect(r.statusCode, r.body).toBe(200)
    const e = ExecutionTacheSchema.parse(r.json())
    expect(e).toMatchObject({ tache: 'FIN_JOURNEE_COLIS', declencheur: 'MANUEL', statut: 'SUCCES' })
    expect(e.fin).not.toBeNull()
    expect((e.resultat as { colis: number }).colis).toBeGreaterThanOrEqual(1)
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).statut).toBe('TERMINE')
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: u.id } })).statut).toBe(
      'TERMINE',
    )
    const systeme = await identiteSysteme(db)
    expect(
      await db.statutHistorique.findFirstOrThrow({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'TERMINE' },
      }),
    ).toMatchObject({ parId: systeme.userId, regle: 'RG-COO-269' })
    expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'TACHE', entiteId: 'FIN_JOURNEE_COLIS', action: 'EXECUTION_TACHE' },
      }),
    ).toBeGreaterThanOrEqual(1)
    const journal = ListeExecutionsSchema.parse(
      (await get(ctx, '/api/admin/taches/executions?tache=FIN_JOURNEE_COLIS', users.admin)).json(),
    )
    expect(journal.executions[0]?.id).toBe(e.id)
  })

  it('RG-COO-269 idempotence : une relance ne touche plus rien (0 colis), ne double ni l’historique ni la file de mails', async () => {
    const { users } = await utilisateurs()
    const { colis } = await colisAExpedier('relance@exemple.test')
    await executer(users.admin, 'FIN_JOURNEE_COLIS')
    const avant = await db.statutHistorique.count({
      where: { typeEntite: 'COLIS', entiteId: String(colis.id) },
    })
    const r2 = ExecutionTacheSchema.parse((await executer(users.admin, 'FIN_JOURNEE_COLIS')).json())
    expect(r2.statut).toBe('SUCCES')
    expect((r2.resultat as { colis: number }).colis).toBe(0)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id) },
      }),
    ).toBe(avant)
    expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(1)
  })

  it('RG-COO-269 atomicité : un échec en cours de tâche annule toutes ses écritures ; l’exécution est « Échec » (verrou libéré) ; la relance aboutit', async () => {
    const { users } = await utilisateurs()
    const { colis, u } = await colisAExpedier('atomique@exemple.test')
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON mail_file WHEN NEW.cle = 'COLIS:${String(colis.id)}'`,
      () => executer(users.admin, 'FIN_JOURNEE_COLIS'),
    )
    expect(r.statusCode, r.body).toBe(200)
    const e = ExecutionTacheSchema.parse(r.json())
    expect(e.statut).toBe('ECHEC')
    expect(e.message).toBeTruthy()
    expect((await derniere('FIN_JOURNEE_COLIS')).verrou).toBeNull()
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).statut).toBe(
      'A_EXPEDIER',
    )
    expect((await db.uniteManutention.findUniqueOrThrow({ where: { id: u.id } })).statut).toBe(
      'A_EXPEDIER',
    )
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'TERMINE' },
      }),
    ).toBe(0)
    const ok = ExecutionTacheSchema.parse((await executer(users.admin, 'FIN_JOURNEE_COLIS')).json())
    expect(ok.statut).toBe('SUCCES')
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).statut).toBe('TERMINE')
  })

  it('Q-410 verrou : une tâche déjà en cours → 409 TACHE_DEJA_EN_COURS sans nouvelle exécution ; un verrou périmé (> 2 h) est libéré', async () => {
    const { users } = await utilisateurs()
    const verrou = await db.tacheExecution.create({
      data: {
        tache: 'PURGE_ATTENDUES',
        declencheur: 'PLANIFIE',
        statut: 'EN_COURS',
        verrou: 'PURGE_ATTENDUES',
      },
    })
    const avant = await db.tacheExecution.count({ where: { tache: 'PURGE_ATTENDUES' } })
    const r = await executer(users.admin, 'PURGE_ATTENDUES')
    expect(r.statusCode).toBe(409)
    expect(ErrorResponseSchema.parse(r.json()).code).toBe('TACHE_DEJA_EN_COURS')
    expect(await db.tacheExecution.count({ where: { tache: 'PURGE_ATTENDUES' } })).toBe(avant)
    // Une autre tâche n'est pas bloquée par ce verrou.
    expect((await executer(users.admin, 'ENVOI_MAILS')).statusCode).toBe(200)
    await db.tacheExecution.update({
      where: { id: verrou.id },
      data: { debut: new Date(Date.now() - 3 * 3_600_000) },
    })
    const libere = await executer(users.admin, 'PURGE_ATTENDUES')
    expect(libere.statusCode, libere.body).toBe(200)
    expect(await db.tacheExecution.findUniqueOrThrow({ where: { id: verrou.id } })).toMatchObject({
      verrou: null,
      statut: 'ECHEC',
    })
  })

  it('Q-410 concurrence : deux exécutions simultanées de la même tâche : au plus une travaille (l’autre 409 ou sans effet), le colis n’est traité qu’une fois', async () => {
    const { users } = await utilisateurs()
    const { colis } = await colisAExpedier('course@exemple.test')
    const [a, b] = await Promise.all([
      executer(users.admin, 'FIN_JOURNEE_COLIS'),
      executer(users.admin, 'FIN_JOURNEE_COLIS'),
    ])
    for (const r of [a, b]) expect([200, 409], r.body).toContain(r.statusCode)
    expect([a, b].some((r) => r.statusCode === 200)).toBe(true)
    for (const r of [a, b].filter((x) => x.statusCode === 409))
      expect(ErrorResponseSchema.parse(r.json()).code).toBe('TACHE_DEJA_EN_COURS')
    expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(1)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'TERMINE' },
      }),
    ).toBe(1)
    expect(
      await db.tacheExecution.findMany({ where: { verrou: 'FIN_JOURNEE_COLIS' } }),
    ).toHaveLength(0)
  })
})

describe('D-20 RG-REC-180 / 181 purge des attendues à 4 semaines', () => {
  const ilYa = (semaines: number) => semaineIsoDe(new Date(Date.now() - semaines * 7 * 86_400_000))

  it('RG-REC-180 nominal : seules les lignes Attendue / Partielle de plus de 4 semaines, non conservées, sont fermées ; idempotence ; une ligne au journal', async () => {
    const { users } = await utilisateurs()
    const plateforme = await f.createPlateforme(db)
    const vieille = ilYa(10)
    const recente = ilYa(1)
    const ligne = (o: Parameters<typeof f.createReceptionAttendue>[1]) =>
      f.createReceptionAttendue(db, { plateformeId: plateforme.id, ...o })
    const aPurger = await ligne({ semAnnee: vieille.annee, semNum: vieille.semaine })
    const partielle = await ligne({
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      statut: 'PARTIELLE',
    })
    const complete = await ligne({
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      statut: 'COMPLETE',
    })
    const conservee = await ligne({
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
      conserverAnnee: true,
    })
    const fraiche = await ligne({ semAnnee: recente.annee, semNum: recente.semaine })
    expect(lundiSemaineIso(vieille) < new Date()).toBe(true)
    const r = ExecutionTacheSchema.parse((await executer(users.admin, 'PURGE_ATTENDUES')).json())
    expect(r.statut).toBe('SUCCES')
    expect((r.resultat as { purgees: number }).purgees).toBeGreaterThanOrEqual(2)
    const etat = async (id: number) => db.receptionAttendue.findUniqueOrThrow({ where: { id } })
    expect(await etat(aPurger.id)).toMatchObject({ etatLigne: 'ANNULEE' })
    expect((await etat(aPurger.id)).purgeeLe).not.toBeNull()
    expect((await etat(partielle.id)).etatLigne).toBe('ANNULEE')
    for (const l of [complete, conservee, fraiche])
      expect((await etat(l.id)).etatLigne).toBe('ACTIVE')
    // RG-REC-181 : aucune alerte ni validation ; une ligne au journal de purge.
    expect(
      await db.journalAudit.count({ where: { action: 'PURGE_ATTENDUES' } }),
    ).toBeGreaterThanOrEqual(1)
    const version = (await etat(aPurger.id)).version
    const r2 = ExecutionTacheSchema.parse((await executer(users.admin, 'PURGE_ATTENDUES')).json())
    expect((r2.resultat as { purgees: number }).purgees).toBe(0)
    expect((await etat(aPurger.id)).version).toBe(version)
  })

  it('RG-REC-178 le délai vient du paramètre « purge après » (D-06) : 52 semaines → une ligne de 10 semaines n’est plus purgée', async () => {
    const { users } = await utilisateurs()
    await parametre(ctx, 'reception.purgeAttendues', '52')
    const vieille = ilYa(10)
    const l = await f.createReceptionAttendue(db, {
      plateformeId: (await f.createPlateforme(db)).id,
      semAnnee: vieille.annee,
      semNum: vieille.semaine,
    })
    await executer(users.admin, 'PURGE_ATTENDUES')
    expect((await db.receptionAttendue.findUniqueOrThrow({ where: { id: l.id } })).etatLigne).toBe(
      'ACTIVE',
    )
    await restaurerParametres()
  })
})

describe('D-20 RG-COO-042 Instruction OK automatique (rattrapage, désactivé par défaut : Q-006)', () => {
  async function instruction(
    o: { commentaire?: string | null; preparation?: 'PREPARATION_RECUE' | 'A_TRAITER' } = {},
  ) {
    const atelier = await f.createAtelier(db)
    const dossier = await f.createDossier(db, { statut: o.preparation ?? 'PREPARATION_RECUE' })
    const i = await f.createInstruction(db, {
      atelierId: atelier.id,
      statut: 'EN_COURS',
      dossierId: dossier.id,
      contNum: dossier.contNum,
      commentaire: o.commentaire ?? null,
      entretien: 8,
      tipInsCode: 0,
    })
    for (let k = 0; k < 2; k++) {
      await f.createInstructionDetail(db, { instructionCode: i.code, cadrIdent: k })
      await f.createFaceTrain(db, {
        instructionCode: i.code,
        ftType: 'contrat',
        statut: 'EN_COURS',
      })
    }
    await f.createInstructionVisuel(db, { instructionCode: i.code, pourcentage: 100 })
    return i
  }

  it('RG-COO-042 nominal : l’instruction conforme (prépa reçue, règle de Nariman) passe Instruction OK automatique, historique « règle automatique » ; relance sans double effet', async () => {
    const { users } = await utilisateurs()
    const i = await instruction()
    const e = ExecutionTacheSchema.parse(
      (await executer(users.admin, 'INSTRUCTION_OK_AUTO')).json(),
    )
    expect(e.statut, e.message ?? '').toBe('SUCCES')
    expect(await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).toMatchObject({
      statut: 'INSTRUCTION_OK',
      iokMode: 'AUTO',
      iokParId: null,
    })
    expect(
      await db.statutHistorique.count({ where: { entiteId: i.code, nouveau: 'INSTRUCTION_OK' } }),
    ).toBe(1)
    await executer(users.admin, 'INSTRUCTION_OK_AUTO')
    expect(
      await db.statutHistorique.count({ where: { entiteId: i.code, nouveau: 'INSTRUCTION_OK' } }),
    ).toBe(1)
    expect(
      await db.journalAudit.count({
        where: { entiteId: i.code, action: 'INSTRUCTION_OK_AUTOMATIQUE' },
      }),
    ).toBe(1)
  })

  it('RG-COO-042 rejet : un commentaire de prépa, ou une prépa non reçue, laisse l’instruction « En cours »', async () => {
    const { users } = await utilisateurs()
    const commentee = await instruction({ commentaire: 'Entretien de 15 % demandé' })
    const nonRecue = await instruction({ preparation: 'A_TRAITER' })
    await executer(users.admin, 'INSTRUCTION_OK_AUTO')
    for (const i of [commentee, nonRecue])
      expect((await db.instruction.findUniqueOrThrow({ where: { code: i.code } })).statut).toBe(
        'EN_COURS',
      )
  })

  it('RG-COO-042 atomicité : un échec sur une instruction annule SA transaction seulement ; l’exécution est « Échec » avec le détail, les autres sont traitées', async () => {
    const { users } = await utilisateurs()
    const mauvaise = await instruction()
    const bonne = await instruction()
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'INSTRUCTION_OK_AUTOMATIQUE' AND NEW.entite_id = '${mauvaise.code}'`,
      () => executer(users.admin, 'INSTRUCTION_OK_AUTO'),
    )
    const e = ExecutionTacheSchema.parse(r.json())
    expect(e.statut).toBe('ECHEC')
    expect(JSON.stringify(e.resultat)).toContain(mauvaise.code)
    expect(
      (await db.instruction.findUniqueOrThrow({ where: { code: mauvaise.code } })).statut,
    ).toBe('EN_COURS')
    expect(await db.statutHistorique.count({ where: { entiteId: mauvaise.code } })).toBe(0)
    expect((await db.instruction.findUniqueOrThrow({ where: { code: bonne.code } })).statut).toBe(
      'INSTRUCTION_OK',
    )
    await executer(users.admin, 'INSTRUCTION_OK_AUTO')
    expect(
      (await db.instruction.findUniqueOrThrow({ where: { code: mauvaise.code } })).statut,
    ).toBe('INSTRUCTION_OK')
  })
})

describe('D-20 EX-TRA-030 envoi des mails en file (tâche) : jamais de mail réel', () => {
  it('EX-TRA-030 la tâche dépose les mails en attente dans la boîte d’envoi simulée (canal SIMULE) ; relance sans nouvel envoi', async () => {
    const { colis } = await colisAExpedier('envoi@exemple.test')
    const boite = new MailBoiteEnvoi()
    const { users } = await utilisateurs()
    await executer(users.admin, 'FIN_JOURNEE_COLIS')
    const e = await executerTache({ db, mail: boite }, 'ENVOI_MAILS', {
      declencheur: 'COMMANDE',
      identity: null,
    })
    expect(e).toMatchObject({ statut: 'SUCCES', declencheur: 'COMMANDE' })
    expect(e.message).toContain('aucun mail réel')
    expect(boite.messages.some((m) => m.destinataires.includes('envoi@exemple.test'))).toBe(true)
    expect(
      await db.mailFile.findUniqueOrThrow({ where: { cle: `COLIS:${String(colis.id)}` } }),
    ).toMatchObject({ statut: 'ENVOYE', canal: 'SIMULE' })
    const n = boite.messages.length
    await executerTache({ db, mail: boite }, 'ENVOI_MAILS', {
      declencheur: 'COMMANDE',
      identity: null,
    })
    expect(boite.messages).toHaveLength(n)
  })

  it('EX-TRA-030 une panne du port n’annule pas la tâche : la ligne reste en attente, l’exécution est tracée (résultat : échecs)', async () => {
    await colisAExpedier('panne@exemple.test')
    const { users } = await utilisateurs()
    await executer(users.admin, 'FIN_JOURNEE_COLIS')
    const boite = new MailBoiteEnvoi()
    boite.refuser = () => 'panne SMTP'
    const e = await executerTache({ db, mail: boite }, 'ENVOI_MAILS', {
      declencheur: 'COMMANDE',
      identity: null,
    })
    expect(e.statut).toBe('SUCCES')
    expect((e.resultat as { echecs: number }).echecs).toBeGreaterThanOrEqual(1)
  })
})

describe('D-20 ordonnanceur : les horaires D-06 déclenchent les tâches, vides = désactivé', () => {
  const t = (h: number, m: number, s = 0) => new Date(2026, 0, 5, h, m, s)

  it('Q-410 horaireEchu : un horaire échu dans ]depuis, jusqu’à] ; heure locale ; passage de minuit', () => {
    expect(horaireEchu(['10:00'], t(9, 59, 40), t(10, 0, 10))).toBe(true)
    expect(horaireEchu(['10:00'], t(10, 0, 0), t(10, 0, 30))).toBe(false)
    expect(horaireEchu(['10:00'], t(10, 0, 30), t(10, 1, 0))).toBe(false)
    expect(horaireEchu([], t(9, 0), t(11, 0))).toBe(false)
    expect(horaireEchu(['pas une heure', '25:00'], t(0, 0), t(23, 59))).toBe(false)
    expect(horaireEchu(['00:00'], t(23, 59, 40), new Date(2026, 0, 6, 0, 0, 10))).toBe(true)
  })

  it('Q-410 sans horaire (défaut) aucune tâche ne se lance ; avec un horaire échu seule la tâche concernée s’exécute, une fois par échéance', async () => {
    const mail = new MailBoiteEnvoi()
    const avant = await db.tacheExecution.count()
    expect(await executerEcheances({ db, mail }, t(9, 0), t(11, 0))).toEqual([])
    expect(await db.tacheExecution.count()).toBe(avant)
    await parametre(ctx, 'taches.purgeAttendues', '10:00')
    expect(await executerEcheances({ db, mail }, t(9, 59, 40), t(10, 0, 10))).toEqual([
      'PURGE_ATTENDUES',
    ])
    expect(await derniere('PURGE_ATTENDUES')).toMatchObject({
      declencheur: 'PLANIFIE',
      statut: 'SUCCES',
    })
    // Pulsation suivante : fenêtre contiguë, pas de seconde exécution.
    expect(await executerEcheances({ db, mail }, t(10, 0, 10), t(10, 0, 40))).toEqual([])
    await restaurerParametres()
  })

  it('Q-410 un verrou actif n’empêche pas l’ordonnanceur de continuer : la tâche verrouillée est ignorée (tracée), pas de double exécution', async () => {
    const mail = new MailBoiteEnvoi()
    await parametre(ctx, 'taches.envoiMails', '10:00')
    const verrou = await db.tacheExecution.create({
      data: {
        tache: 'ENVOI_MAILS',
        declencheur: 'MANUEL',
        statut: 'EN_COURS',
        verrou: 'ENVOI_MAILS',
      },
    })
    const messages: string[] = []
    expect(
      await executerEcheances({ db, mail }, t(9, 59, 40), t(10, 0, 10), (m) => messages.push(m)),
    ).toEqual([])
    expect(messages[0]).toContain('ENVOI_MAILS')
    await db.tacheExecution.update({
      where: { id: verrou.id },
      data: { verrou: null, statut: 'SUCCES', fin: new Date() },
    })
    await restaurerParametres()
  })
})

describe('D-20 commande taches:executer', () => {
  const racine = resolve(import.meta.dirname, '../../../..')
  const lancer = (...args: string[]) =>
    spawnSync('pnpm', ['--filter', '@circe/api', 'exec', 'tsx', 'scripts/taches.ts', ...args], {
      cwd: racine,
      env: process.env,
      encoding: 'utf8',
    })

  it.skipIf(!existsSync(resolve(racine, '.env')))(
    'Q-410 la commande exécute une tâche sur la base de test (déclencheur COMMANDE) ; un nom inconnu est refusé (code 1)',
    async () => {
      const avant = await db.tacheExecution.count({
        where: { tache: 'PURGE_ATTENDUES', declencheur: 'COMMANDE' },
      })
      const ok = lancer('PURGE_ATTENDUES')
      expect(ok.status, ok.stderr).toBe(0)
      expect(JSON.parse(ok.stdout)).toMatchObject({ tache: 'PURGE_ATTENDUES', statut: 'SUCCES' })
      expect(
        await db.tacheExecution.count({
          where: { tache: 'PURGE_ATTENDUES', declencheur: 'COMMANDE' },
        }),
      ).toBe(avant + 1)
      const ko = lancer('N_IMPORTE_QUOI')
      expect(ko.status).toBe(1)
    },
    60_000,
  )
})
