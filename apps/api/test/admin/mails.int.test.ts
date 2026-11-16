// Étape 8, lot 4 (D-19) — tests d'INTÉGRATION de la file d'envoi des mails (EX-TRA-030, RG-ADM-043 à 045 provisoires,
// RG-COO-271 « colis expédié », RG-COO-147 « déblocage », RG-COO-057 « correction Broadcast », Q-375, Q-285, Q-219,
// Q-409) : mise en file dans la transaction du fait, envoi hors transaction par un port, tentatives, échec, relance,
// concurrence, atomicité, idempotence, droits, 401. AUCUN mail réel : adaptateurs en mémoire ; le client SMTP n'est
// exercé que contre un serveur factice sur la boucle locale (127.0.0.1, port éphémère). API réelle, base de test.
import { createServer, type Server } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  ErrorResponseSchema,
  ListeMailsSchema,
  MailFileSchema,
  ResultatFinDeJourneeSchema,
  ResultatTraitementMailsSchema,
  type Role,
} from '@circe/shared'
import {
  creerMailPort,
  MailBoiteEnvoi,
  MailNonConfigure,
  MailSmtp,
  type MailPort,
  type MessageMail,
} from '../../src/core/ports/mail.ts'
import {
  MAIL_TENTATIVES_MAX,
  mettreEnFileMail,
  traiterFileMails,
} from '../../src/modules/mails/file.ts'
import * as f from '../factories/index.ts'
import { next } from '../factories/sequence.ts'
import { devHeaders } from '../support/identite.ts'
import { avecEchec, ROLES } from '../support/export-trains.ts'
import { contexteReception, get, idem, post } from '../support/reception.ts'

const ctx = contexteReception()
const { db } = ctx
type H = Record<string, string>

/** Adaptateur « SMTP » EN MÉMOIRE (canal SMTP, aucune connexion) : prouve le marquage `mailEnvoye` à l'envoi réel. */
class FauxSmtp implements MailPort {
  readonly nom = 'faux-smtp'
  readonly canal = 'SMTP'
  readonly messages: MessageMail[] = []
  envoyer(m: MessageMail) {
    this.messages.push(m)
    return Promise.resolve()
  }
}

const sites: number[] = []
beforeAll(async () => {
  await ctx.demarrer()
  // La base de test est partagée : les mails laissés en attente par les autres fichiers sont soldés (file de 100 lignes).
  await db.mailFile.updateMany({
    where: { statut: { in: ['EN_ATTENTE', 'EN_COURS'] } },
    data: { statut: 'ENVOYE', canal: 'SIMULE' },
  })
})
afterAll(async () => {
  // File purgée (ses lignes de test) ; le reste est recréé à chaque exécution de la base de test.
  await db.mailFile.deleteMany({ where: { cle: { startsWith: 'T-' } } })
  await ctx.arreter()
})

async function utilisateurs() {
  const plateforme = await f.createPlateforme(db)
  sites.push(plateforme.id)
  const users = {} as Record<Role, H>
  for (const r of ROLES) {
    const u = await f.createUtilisateurAvecRoles(db, [r], [{ plateformeId: plateforme.id }])
    users[r] = devHeaders(u.identifiantExterne)
  }
  return { plateforme, users }
}

/** Colis « A expédier » (UM « A expédier » liée) du destinataire donné : prêt pour la fin de journée. */
async function colisAExpedier(mail: string | null) {
  const plateforme = await f.createPlateforme(db)
  const atelier = await f.createAtelier(db, { plateformeId: plateforme.id, type: 'SCROLL' })
  const support = await f.createSupport(db, { poids: 2 })
  const dest = await f.createDestinataire(db, { nom: `Dest mail ${String(next())}`, mail })
  const coord = await f.createUtilisateurAvecRoles(db, ['expe'], [{ plateformeId: plateforme.id }])
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
      codeColis: `C-${String(900_000_000 + next()).padStart(18, '0')}`,
    },
  })
  await db.uniteColis.create({ data: { uniteId: u.id, colisId: colis.id, quantite: 4 } })
  return { colis, headers: devHeaders(coord.identifiantExterne) }
}
const finDeJournee = (headers: H) =>
  post(ctx, '/api/coordination/colis/fin-de-journee', headers, {})

describe('D-19 RG-COO-271 le mail « colis expédié » est mis en file dans la transaction de la fin de journée', () => {
  it('RG-COO-271 nominal : une ligne « En attente » (destinataire, sujet, corps), journal, aucun envoi à ce stade', async () => {
    const { colis, headers } = await colisAExpedier('client@exemple.test')
    const boite = new MailBoiteEnvoi()
    const r = await finDeJournee(headers)
    expect(r.statusCode, r.body).toBe(200)
    expect(ResultatFinDeJourneeSchema.parse(r.json()).colis).toContain(colis.id)
    const m = await db.mailFile.findUniqueOrThrow({ where: { cle: `COLIS:${String(colis.id)}` } })
    expect(m).toMatchObject({
      type: 'COLIS_EXPEDIE',
      statut: 'EN_ATTENTE',
      destinataires: 'client@exemple.test',
      tentatives: 0,
      sourceType: 'COLIS',
      sourceId: colis.id,
    })
    expect(m.sujet).toContain(colis.codeColis ?? '')
    expect(m.corps).toContain('Unités de manutention : 1')
    expect(boite.messages).toHaveLength(0)
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'MAIL', entiteId: String(m.id), action: 'CREATION_MAIL' },
      }),
    ).toBe(1)
  })

  it('RG-COO-271 rejet : destinataire sans adresse valide → rien en file, journal explicite, la fin de journée aboutit quand même', async () => {
    for (const adresse of [null, 'pas une adresse']) {
      const { colis, headers } = await colisAExpedier(adresse)
      expect((await finDeJournee(headers)).statusCode).toBe(200)
      expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(0)
      const j = await db.journalAudit.findFirstOrThrow({
        where: { entiteId: String(colis.id), action: 'MAIL_COLIS' },
      })
      expect(j.complement).toContain('non mis en file')
      expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).statut).toBe('TERMINE')
    }
  })

  it('RG-COO-271 atomicité : un échec de l’écriture de la file annule toute la fin de journée (colis, UM, historique), puis le passage suivant aboutit', async () => {
    const { colis, headers } = await colisAExpedier('atomique@exemple.test')
    const r = await avecEchec(
      ctx,
      `BEFORE INSERT ON mail_file WHEN NEW.cle = 'COLIS:${String(colis.id)}'`,
      () => finDeJournee(headers),
    )
    expect(r.statusCode).toBeGreaterThanOrEqual(500)
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).statut).toBe(
      'A_EXPEDIER',
    )
    expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(0)
    expect(
      await db.statutHistorique.count({
        where: { typeEntite: 'COLIS', entiteId: String(colis.id), nouveau: 'TERMINE' },
      }),
    ).toBe(0)
    expect((await finDeJournee(headers)).statusCode).toBe(200)
    expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(1)
  })

  it('RG-COO-271 idempotence : une seconde fin de journée ne remet rien en file ; la même clé de fait ne crée qu’une ligne', async () => {
    const { colis, headers } = await colisAExpedier('idem@exemple.test')
    await finDeJournee(headers)
    await finDeJournee(headers)
    expect(await db.mailFile.count({ where: { cle: `COLIS:${String(colis.id)}` } })).toBe(1)
    const deux = await db.$transaction(async (tx) => {
      const a = await mettreEnFileMail(tx, {
        type: 'COLIS_EXPEDIE',
        cle: 'T-idem',
        destinataires: ['a@exemple.test', 'A@exemple.test; b@exemple.test'],
        sujet: 's',
        corps: 'c',
        parId: null,
      })
      const b = await mettreEnFileMail(tx, {
        type: 'COLIS_EXPEDIE',
        cle: 'T-idem',
        destinataires: ['autre@exemple.test'],
        sujet: 's2',
        corps: 'c2',
        parId: null,
      })
      return [a, b]
    })
    expect(deux[0]?.dejaEnFile).toBe(false)
    expect(deux[1]).toMatchObject({ id: deux[0]?.id, dejaEnFile: true })
    const l = await db.mailFile.findUniqueOrThrow({ where: { cle: 'T-idem' } })
    expect(l.destinataires).toBe('a@exemple.test;b@exemple.test')
  })
})

describe('D-19 envoi : port hors transaction, tentatives, marquage du fait', () => {
  it('RG-COO-271 boîte d’envoi de développement : la ligne passe « Envoyé » (canal SIMULE), le message est déposé, `mailEnvoye` reste faux (rien n’est parti)', async () => {
    const { colis, headers } = await colisAExpedier('simule@exemple.test')
    await finDeJournee(headers)
    const boite = new MailBoiteEnvoi()
    const r = await traiterFileMails({ db, mail: boite })
    expect(r.canal).toBe('SIMULE')
    expect(r.envoyes).toBeGreaterThanOrEqual(1)
    const m = await db.mailFile.findUniqueOrThrow({ where: { cle: `COLIS:${String(colis.id)}` } })
    expect(m).toMatchObject({ statut: 'ENVOYE', canal: 'SIMULE', tentatives: 1 })
    expect(m.envoyeLe).not.toBeNull()
    expect(boite.messages.find((x) => x.sujet === m.sujet)?.destinataires).toEqual([
      'simule@exemple.test',
    ])
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).mailEnvoye).toBe(false)
  })

  it('RG-COO-271 canal SMTP : `mailEnvoye` passe à vrai seulement quand l’envoi réussit ; une seconde passe n’envoie rien de plus', async () => {
    const { colis, headers } = await colisAExpedier('smtp@exemple.test')
    await finDeJournee(headers)
    const smtp = new FauxSmtp()
    await traiterFileMails({ db, mail: smtp })
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).mailEnvoye).toBe(true)
    const avant = smtp.messages.length
    await traiterFileMails({ db, mail: smtp })
    expect(smtp.messages).toHaveLength(avant)
    expect(
      (await db.mailFile.findUniqueOrThrow({ where: { cle: `COLIS:${String(colis.id)}` } }))
        .tentatives,
    ).toBe(1)
  })

  it('RG-ADM-045 échec : la ligne reste « En attente » avec l’erreur, l’action métier est intacte (Q-219) ; après 10 tentatives : « Échec » et fait marqué', async () => {
    const { colis, headers } = await colisAExpedier('echec@exemple.test')
    await finDeJournee(headers)
    const cle = `COLIS:${String(colis.id)}`
    const boite = new MailBoiteEnvoi()
    boite.refuser = (m) => (m.destinataires.includes('echec@exemple.test') ? 'SMTP refusé' : null)
    await traiterFileMails({ db, mail: boite })
    let m = await db.mailFile.findUniqueOrThrow({ where: { cle } })
    expect(m).toMatchObject({ statut: 'EN_ATTENTE', tentatives: 1, derniereErreur: 'SMTP refusé' })
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).statut).toBe('TERMINE')
    for (let k = 1; k < MAIL_TENTATIVES_MAX; k++) await traiterFileMails({ db, mail: boite })
    m = await db.mailFile.findUniqueOrThrow({ where: { cle } })
    expect(m).toMatchObject({ statut: 'ECHEC', tentatives: MAIL_TENTATIVES_MAX })
    expect(boite.messages.some((x) => x.destinataires.includes('echec@exemple.test'))).toBe(false)
    // Une ligne en échec définitif n'est plus reprise automatiquement.
    await traiterFileMails({ db, mail: boite })
    expect((await db.mailFile.findUniqueOrThrow({ where: { cle } })).tentatives).toBe(
      MAIL_TENTATIVES_MAX,
    )
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'MAIL', entiteId: String(m.id), action: 'ECHEC_MAIL' },
      }),
    ).toBe(MAIL_TENTATIVES_MAX)
  })

  it('RG-ADM-045 concurrence : deux traitements simultanés n’envoient jamais deux fois la même ligne', async () => {
    const { headers } = await colisAExpedier('course@exemple.test')
    await finDeJournee(headers)
    let appels = 0
    const compteur: MailPort = {
      nom: 'compteur',
      canal: 'SIMULE',
      envoyer: async (m) => {
        if (m.destinataires.includes('course@exemple.test')) appels += 1
        await new Promise((r) => setTimeout(r, 30))
      },
    }
    const [a, b] = await Promise.all([
      traiterFileMails({ db, mail: compteur }),
      traiterFileMails({ db, mail: compteur }),
    ])
    expect(appels).toBe(1)
    expect(a.envoyes + b.envoyes).toBeGreaterThanOrEqual(1)
  })

  it('RG-ADM-045 atomicité : un échec d’écriture du résultat n’enregistre ni « Envoyé » ni le marquage du fait ; une réservation périmée est reprise', async () => {
    const { colis, headers } = await colisAExpedier('resultat@exemple.test')
    await finDeJournee(headers)
    const cle = `COLIS:${String(colis.id)}`
    const smtp = new FauxSmtp()
    const id = (await db.mailFile.findUniqueOrThrow({ where: { cle } })).id
    await avecEchec(
      ctx,
      `BEFORE INSERT ON journal_audit WHEN NEW.action = 'ENVOI_MAIL' AND NEW.entite_id = '${String(id)}'`,
      () => traiterFileMails({ db, mail: smtp }).catch(() => undefined),
    )
    const m = await db.mailFile.findUniqueOrThrow({ where: { cle } })
    expect(m.statut).toBe('EN_COURS')
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).mailEnvoye).toBe(false)
    // Réservation restée au-delà de 15 minutes (arrêt du serveur) : remise en attente puis envoyée.
    await db.mailFile.update({
      where: { id },
      data: { tentativeLe: new Date(Date.now() - 3_600_000) },
    })
    await traiterFileMails({ db, mail: smtp })
    expect((await db.mailFile.findUniqueOrThrow({ where: { cle } })).statut).toBe('ENVOYE')
    expect((await db.colis.findUniqueOrThrow({ where: { id: colis.id } })).mailEnvoye).toBe(true)
  })
})

describe('D-19 RG-COO-057 demande de correction Broadcast : mail « Pré-Prod » en file', () => {
  async function dossierAvecLigne(mail: string | null) {
    const plateforme = await f.createPlateforme(db, { mail })
    const dossier = await f.createDossier(db, { statut: 'PREPARATION_RECUE' })
    await f.createReceptionAttendue(db, { plateformeId: plateforme.id, contNum: dossier.contNum })
    const u = await f.createUtilisateurAvecRoles(db, ['coord'], [{ plateformeId: plateforme.id }])
    return { dossier, headers: devHeaders(u.identifiantExterne) }
  }
  const demander = (headers: H, dossierId: number) =>
    post(ctx, `/api/coordination/dossiers/${String(dossierId)}/corrections`, headers, {
      note: 'Quantité à revoir',
    })

  it('RG-COO-057 nominal : adresses de la plateforme du dossier (repli Q-219), mail en file ; `mailEnvoye` vrai seulement à l’envoi réel', async () => {
    const { dossier, headers } = await dossierAvecLigne('preprod@exemple.test, chef@exemple.test')
    const r = await demander(headers, dossier.id)
    expect(r.statusCode, r.body).toBe(200)
    expect(r.json<{ message: string; mailEnvoye: boolean }>()).toMatchObject({ mailEnvoye: false })
    expect(r.json<{ message: string }>().message).toContain('mis en file')
    const demande = await db.demandeCorrection.findFirstOrThrow({
      where: { dossierId: dossier.id },
    })
    const m = await db.mailFile.findUniqueOrThrow({
      where: { cle: `CORRECTION_BROADCAST:${String(demande.id)}` },
    })
    expect(m).toMatchObject({
      statut: 'EN_ATTENTE',
      destinataires: 'preprod@exemple.test;chef@exemple.test',
    })
    expect(m.corps).toContain('Quantité à revoir')
    await traiterFileMails({ db, mail: new MailBoiteEnvoi() })
    expect(
      (await db.demandeCorrection.findUniqueOrThrow({ where: { id: demande.id } })).mailEnvoye,
    ).toBe(false)
    await db.mailFile.update({ where: { id: m.id }, data: { statut: 'EN_ATTENTE' } })
    await traiterFileMails({ db, mail: new FauxSmtp() })
    expect(
      (await db.demandeCorrection.findUniqueOrThrow({ where: { id: demande.id } })).mailEnvoye,
    ).toBe(true)
  })

  it('RG-COO-057 rejet : plateforme sans adresse → demande enregistrée, rien en file ; profil sans droit : 403 sans écriture', async () => {
    const { dossier, headers } = await dossierAvecLigne(null)
    expect((await demander(headers, dossier.id)).statusCode).toBe(200)
    const demande = await db.demandeCorrection.findFirstOrThrow({
      where: { dossierId: dossier.id },
    })
    expect(
      await db.mailFile.count({ where: { cle: `CORRECTION_BROADCAST:${String(demande.id)}` } }),
    ).toBe(0)
    const { users } = await utilisateurs()
    const avant = await db.mailFile.count()
    expect((await demander(users.recep, dossier.id)).statusCode).toBe(403)
    expect(await db.mailFile.count()).toBe(avant)
  })
})

describe('D-19 adaptateur : jamais de mail réel par défaut', () => {
  const base = { NODE_ENV: 'test', MAIL_MODE: 'dev', SMTP_PORT: 25, SMTP_SECURE: 'false' } as const

  it('Q-409 par défaut (développement et test) : boîte d’envoi simulée, jamais SMTP', () => {
    expect(creerMailPort(base)).toBeInstanceOf(MailBoiteEnvoi)
    expect(creerMailPort({ ...base, NODE_ENV: 'development' })).toBeInstanceOf(MailBoiteEnvoi)
  })

  it('Q-409 SMTP demandé mais non configuré (hôte ou expéditeur absent) : pas de SMTP ; en production : refus explicite', async () => {
    const incomplet = { ...base, MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemple.test' } as const
    expect(creerMailPort(incomplet)).toBeInstanceOf(MailBoiteEnvoi)
    const prod = creerMailPort({ ...incomplet, NODE_ENV: 'production' })
    expect(prod).toBeInstanceOf(MailNonConfigure)
    await expect(prod.envoyer({ destinataires: [], sujet: '', corps: '' })).rejects.toThrow(
      /non configuré/,
    )
    expect(creerMailPort({ ...base, NODE_ENV: 'production' })).toBeInstanceOf(MailNonConfigure)
  })

  it('Q-409 SMTP complet : l’adaptateur SMTP n’est créé que si MAIL_MODE=smtp, hôte et expéditeur sont renseignés (aucune connexion à la création)', () => {
    const p = creerMailPort({
      ...base,
      MAIL_MODE: 'smtp',
      SMTP_HOST: '127.0.0.1',
      MAIL_EXPEDITEUR: 'circe@exemple.test',
    })
    expect(p).toBeInstanceOf(MailSmtp)
    expect(p.canal).toBe('SMTP')
  })

  it('Q-409 en production sans SMTP, la file n’envoie rien : la ligne reste « En attente » avec l’erreur (jamais de succès simulé)', async () => {
    await db.mailFile.deleteMany({ where: { cle: 'T-prod' } })
    await db.$transaction((tx) =>
      mettreEnFileMail(tx, {
        type: 'DEBLOCAGE',
        cle: 'T-prod',
        destinataires: ['prod@exemple.test'],
        sujet: 's',
        corps: 'c',
        parId: null,
      }),
    )
    // Les autres lignes en attente sont ignorées : on ne regarde que celle-ci.
    await traiterFileMails({ db, mail: new MailNonConfigure() })
    expect(await db.mailFile.findUniqueOrThrow({ where: { cle: 'T-prod' } })).toMatchObject({
      statut: 'EN_ATTENTE',
      tentatives: 1,
    })
    await db.mailFile.update({
      where: { cle: 'T-prod' },
      data: { statut: 'ENVOYE', canal: 'SIMULE' },
    })
  })

  it('Q-409 client SMTP : dialogue EHLO / AUTH / MAIL / RCPT / DATA contre un serveur FACTICE sur la boucle locale (aucun envoi réel)', async () => {
    const recu: string[] = []
    let donnees = false
    const serveur: Server = createServer((socket) => {
      socket.write('220 factice ESMTP\r\n')
      let tampon = ''
      socket.on('data', (d: Buffer) => {
        tampon += d.toString('utf8')
        for (;;) {
          if (donnees) {
            const fin = tampon.indexOf('\r\n.\r\n')
            if (fin < 0) return
            recu.push(`DATA:${tampon.slice(0, fin)}`)
            tampon = tampon.slice(fin + 5)
            donnees = false
            socket.write('250 ok\r\n')
            continue
          }
          const i = tampon.indexOf('\r\n')
          if (i < 0) return
          const ligne = tampon.slice(0, i)
          tampon = tampon.slice(i + 2)
          recu.push(ligne)
          if (ligne.startsWith('EHLO')) socket.write('250 factice\r\n')
          else if (ligne === 'AUTH LOGIN') socket.write('334 VXNlcm5hbWU6\r\n')
          else if (ligne === 'DATA') {
            donnees = true
            socket.write('354 go\r\n')
          } else if (ligne !== 'QUIT' && /^[A-Za-z0-9+/=]+$/.test(ligne))
            socket.write(
              recu.filter((x) => /^[A-Za-z0-9+/=]+$/.test(x)).length === 1
                ? '334 UGFzc3dvcmQ6\r\n'
                : '235 ok\r\n',
            )
          else if (ligne === 'QUIT') {
            socket.write('221 bye\r\n')
            socket.end()
          } else socket.write('250 ok\r\n')
        }
      })
    })
    await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r))
    const adresse = serveur.address()
    const port = typeof adresse === 'object' && adresse ? adresse.port : 0
    try {
      const smtp = new MailSmtp({
        hote: '127.0.0.1',
        port,
        secure: false,
        expediteur: 'circe@exemple.test',
        prefixeSujet: '[test] ',
        delaiMs: 3000,
      })
      await smtp.envoyer({
        destinataires: ['a@exemple.test', 'b@exemple.test'],
        sujet: 'Sujet é',
        corps: 'Corps é',
      })
    } finally {
      await new Promise((r) => serveur.close(r))
    }
    expect(recu.some((x) => x.startsWith('AUTH'))).toBe(false)
    expect(recu).toContain('MAIL FROM:<circe@exemple.test>')
    expect(recu).toContain('RCPT TO:<a@exemple.test>')
    expect(recu).toContain('RCPT TO:<b@exemple.test>')
    const data = recu.find((x) => x.startsWith('DATA:')) ?? ''
    expect(data).toContain('Subject: =?UTF-8?B?')
    expect(Buffer.from(data.split('\r\n\r\n')[1] ?? '', 'base64').toString('utf8')).toBe('Corps é')
  })

  it('Q-413 client SMTP : identifiants configurés sur une connexion non chiffrée ⇒ refus explicite, aucune connexion ouverte', async () => {
    let connexions = 0
    const serveur: Server = createServer((socket) => {
      connexions++
      socket.end()
    })
    await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r))
    const adresse = serveur.address()
    const port = typeof adresse === 'object' && adresse ? adresse.port : 0
    try {
      const smtp = new MailSmtp({
        hote: '127.0.0.1',
        port,
        secure: false,
        utilisateur: 'u',
        motDePasse: 'p',
        expediteur: 'c@exemple.test',
        delaiMs: 3000,
      })
      await expect(
        smtp.envoyer({ destinataires: ['x@exemple.test'], sujet: 's', corps: 'c' }),
      ).rejects.toThrow(/non chiffrée/)
    } finally {
      await new Promise((r) => serveur.close(r))
    }
    expect(connexions).toBe(0)
  })

  it('Q-409 client SMTP : une réponse d’erreur du serveur (RCPT refusé) fait échouer l’envoi', async () => {
    const serveur: Server = createServer((socket) => {
      socket.write('220 factice\r\n')
      socket.on('data', (d: Buffer) => {
        const t = d.toString('utf8')
        if (t.startsWith('EHLO')) socket.write('250 ok\r\n')
        else if (t.startsWith('MAIL')) socket.write('250 ok\r\n')
        else socket.write('550 refusé\r\n')
      })
    })
    await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r))
    const adresse = serveur.address()
    const port = typeof adresse === 'object' && adresse ? adresse.port : 0
    try {
      const smtp = new MailSmtp({
        hote: '127.0.0.1',
        port,
        secure: false,
        expediteur: 'c@exemple.test',
        delaiMs: 3000,
      })
      await expect(
        smtp.envoyer({ destinataires: ['x@exemple.test'], sujet: 's', corps: 'c' }),
      ).rejects.toThrow(/550/)
    } finally {
      await new Promise((r) => serveur.close(r))
    }
  })
})

describe('D-19 API d’administration de la file (droit parametrage.gerer)', () => {
  it('EX-TRA-030 GET /admin/file-envoi : l’administrateur lit la file (canal actif SIMULE), filtres statut et type', async () => {
    const { users } = await utilisateurs()
    await db.$transaction((tx) =>
      mettreEnFileMail(tx, {
        type: 'DEBLOCAGE',
        cle: `T-api-${String(next())}`,
        destinataires: ['api@exemple.test'],
        sujet: 'Sujet API',
        corps: 'Corps',
        parId: null,
      }),
    )
    const r = await get(ctx, '/api/admin/file-envoi?statut=EN_ATTENTE&type=DEBLOCAGE', users.admin)
    expect(r.statusCode, r.body).toBe(200)
    const liste = ListeMailsSchema.parse(r.json())
    expect(liste.canalActif).toBe('SIMULE')
    expect(liste.mails.length).toBeGreaterThan(0)
    expect(liste.mails.every((m) => m.statut === 'EN_ATTENTE' && m.type === 'DEBLOCAGE')).toBe(true)
    expect(liste.parStatut['EN_ATTENTE']).toBeGreaterThan(0)
    expect((await get(ctx, '/api/admin/file-envoi?statut=BIDON', users.admin)).statusCode).toBe(400)
  })

  it.each(ROLES)(
    'RG-REC-002 %s : lecture et traitement de la file réservés à l’administrateur',
    async (role) => {
      const { users } = await utilisateurs()
      const lire = await get(ctx, '/api/admin/file-envoi', users[role])
      const traiter = await post(ctx, '/api/admin/file-envoi/traiter', users[role], {})
      if (role === 'admin') {
        expect(lire.statusCode).toBe(200)
        expect(traiter.statusCode, traiter.body).toBe(200)
        const res = ResultatTraitementMailsSchema.parse(traiter.json())
        expect(res.canal).toBe('SIMULE')
        expect(res.message).toContain('aucun mail réel')
      } else {
        expect(lire.statusCode).toBe(403)
        expect(traiter.statusCode).toBe(403)
        expect(ErrorResponseSchema.parse(traiter.json()).regle).toBe('RG-REC-002')
      }
    },
  )

  it('401 sans identité ; 400 sans Idempotency-Key', async () => {
    const { users } = await utilisateurs()
    expect((await get(ctx, '/api/admin/file-envoi', {})).statusCode).toBe(401)
    expect(
      (await ctx.app.inject({ method: 'POST', url: '/api/admin/file-envoi/traiter', payload: {} }))
        .statusCode,
    ).toBe(401)
    const sansCle = await post(ctx, '/api/admin/file-envoi/traiter', users.admin, {}, false)
    expect(sansCle.statusCode).toBe(400)
    expect(ErrorResponseSchema.parse(sansCle.json()).code).toBe('IDEMPOTENCE_CLE_MANQUANTE')
  })

  it('RG-ADM-045 relancer : un mail en échec repart en attente (tentatives remises à 0) ; refus 409 hors échec, version périmée 409, 404, 403, journal', async () => {
    const { users } = await utilisateurs()
    const cle = `T-relance-${String(next())}`
    await db.$transaction((tx) =>
      mettreEnFileMail(tx, {
        type: 'CORRECTION_BROADCAST',
        cle,
        destinataires: ['relance@exemple.test'],
        sujet: 's',
        corps: 'c',
        parId: null,
      }),
    )
    const m = await db.mailFile.findUniqueOrThrow({ where: { cle } })
    const url = `/api/admin/file-envoi/${String(m.id)}/relancer`
    const horsEchec = await post(ctx, url, users.admin, { version: m.version })
    expect(horsEchec.statusCode).toBe(409)
    expect(ErrorResponseSchema.parse(horsEchec.json())).toMatchObject({
      code: 'TRANSITION_INTERDITE',
      regle: 'RG-ADM-045',
    })
    await db.mailFile.update({
      where: { id: m.id },
      data: { statut: 'ECHEC', tentatives: 10, derniereErreur: 'x' },
    })
    expect((await post(ctx, url, users.coord, { version: m.version })).statusCode).toBe(403)
    const perimee = await post(ctx, url, users.admin, { version: m.version + 5 })
    expect(perimee.statusCode).toBe(409)
    expect(ErrorResponseSchema.parse(perimee.json()).code).toBe('ADM_CONFLIT_VERSION')
    expect(
      (await post(ctx, '/api/admin/file-envoi/999999999/relancer', users.admin, { version: 1 }))
        .statusCode,
    ).toBe(404)
    const ok = await post(ctx, url, users.admin, { version: m.version })
    expect(ok.statusCode, ok.body).toBe(200)
    expect(MailFileSchema.parse(ok.json())).toMatchObject({
      statut: 'EN_ATTENTE',
      tentatives: 0,
      derniereErreur: null,
    })
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'MAIL', entiteId: String(m.id), action: 'RELANCE_MAIL' },
      }),
    ).toBe(1)
    // Concurrence : deux relances de la même version, une seule aboutit.
    await db.mailFile.update({ where: { id: m.id }, data: { statut: 'ECHEC' } })
    const courante = (await db.mailFile.findUniqueOrThrow({ where: { id: m.id } })).version
    const [a, b] = await Promise.all([
      post(ctx, url, users.admin, { version: courante }),
      post(ctx, url, users.admin, { version: courante }),
    ])
    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 409])
  })

  it('RG-ADM-045 idempotence de la requête : même Idempotency-Key = même réponse rejouée, une seule relance', async () => {
    const { users } = await utilisateurs()
    const cle = `T-rejeu-${String(next())}`
    await db.$transaction((tx) =>
      mettreEnFileMail(tx, {
        type: 'DEBLOCAGE',
        cle,
        destinataires: ['rejeu@exemple.test'],
        sujet: 's',
        corps: 'c',
        parId: null,
      }),
    )
    const m = await db.mailFile.update({ where: { cle }, data: { statut: 'ECHEC' } })
    const k = idem()
    const url = `/api/admin/file-envoi/${String(m.id)}/relancer`
    const un = await ctx.app.inject({
      method: 'POST',
      url,
      headers: { ...users.admin, ...k },
      payload: { version: m.version },
    })
    const deux = await ctx.app.inject({
      method: 'POST',
      url,
      headers: { ...users.admin, ...k },
      payload: { version: m.version },
    })
    expect(un.statusCode).toBe(200)
    expect(deux.statusCode).toBe(200)
    expect(deux.json()).toEqual(un.json())
    expect(
      await db.journalAudit.count({
        where: { typeEntite: 'MAIL', entiteId: String(m.id), action: 'RELANCE_MAIL' },
      }),
    ).toBe(1)
  })
})
