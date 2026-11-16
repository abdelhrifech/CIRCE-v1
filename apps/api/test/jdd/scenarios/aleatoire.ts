// Famille « aleatoire » (en plus des douze de la skill) : marche aléatoire déterministe par seed. `volume` × 2 actions
// tirées au hasard (réception partielle / complète / sur-livrée, complément, contrôle avec écart et rebut, validation
// et annulation, changement de thème, retrait de lien, rattachement, inconnue, signalement, rebut, annulation de dossier,
// transitions d'instruction (valides ou non), export, Colisage, colis, fin de journée) sur un pool d'entités du site.
// Les refus métier (4xx) sont normaux ; AUCUNE réponse ne doit être une erreur serveur (5xx) ni sortir du format
// d'erreur { code, message }. Les invariants (`massif/`) sont contrôlés ensuite sur l'état atteint. RG : toutes celles
// des actions ; CLAUDE.md §6 (erreurs). Volume : ~2 × volume actions.
import type { Scenario } from './index.ts'
import { poster, type Reponse } from '../api.ts'
import { creerSite } from '../contexte.ts'
import {
  appelUnitaire,
  chaineFixe,
  departTexte,
  creerInconnue,
  dossierAvecLignes,
  exporterTrains,
  lireLesListes,
  finDeJournee,
  ligneRepartition,
  rattacherInconnue,
  trainsDuDossier,
  typePreparation,
} from '../monde.ts'
import { corpsBl } from '../api.ts'
import { withTransaction } from '../../../src/core/transaction.ts'
import { annulerDossier } from '../../../src/modules/coordination/integration.ts'

const ACTIONS = [
  'recevoir',
  'recevoir',
  'recevoir',
  'complement',
  'controler',
  'controler',
  'valider',
  'valider',
  'annuler-validation',
  'theme',
  'retrait',
  'inconnue',
  'rattacher-inconnue',
  'signaler',
  'rebut',
  'annuler-dossier',
  'instruction',
  'instruction',
  'export',
  'colisage',
  'unitaire',
  'unitaire',
  'unitaire',
  'unitaire',
  'unitaire',
  'colis',
  'fin-de-journee',
  'nouveau-dossier',
  'nouveau-dossier',
] as const

export const aleatoire: Scenario = {
  nom: 'aleatoire',
  regles: [
    'RG-REC-018',
    'RG-REC-059',
    'RG-X-012',
    'RG-X-050',
    'RG-X-058',
    'RG-X-060',
    'RG-X-065',
    'RG-X-087',
    'RG-COO-040',
  ],
  attendu:
    'aucune erreur serveur (5xx), format d’erreur unique, invariants conservés sur l’état final',
  async generer(jdd) {
    const site = await creerSite(jdd, { destinataires: 4 })
    const { db } = jdd.ctx
    const type = await typePreparation(jdd)
    const rec = site.users.recep.headers
    const coord = site.users.coord.headers
    const expe = site.users.expe.headers
    const n = Math.max(20, jdd.volume * 2)
    const dossiers: Awaited<ReturnType<typeof dossierAvecLignes>>[] = []
    const receptions: number[] = []
    const inconnues: number[] = []
    const affiches: number[] = []
    const instructions: string[] = []
    const colisIds: number[] = []
    let enPanne = 0
    const juger = (action: string, r: Reponse) => {
      jdd.compter(`aleatoire.${action}`)
      const formatOk =
        r.status < 400 ||
        (r.code !== null && typeof (r.body as { message?: unknown } | null)?.message === 'string')
      if (r.status >= 500 || !formatOk) {
        enPanne++
        jdd.verifier(
          `aléatoire : « ${action} » sans erreur serveur et au format d’erreur`,
          false,
          '< 500 et { code, message }',
          `${String(r.status)} ${JSON.stringify(r.body).slice(0, 200)}`,
          'CLAUDE.md §6',
        )
      }
      return r
    }
    const pick = <T>(l: T[]): T | undefined => (l.length === 0 ? undefined : jdd.rng.choisir(l))
    for (let i = 0; i < n; i++) {
      const action = jdd.rng.choisir(ACTIONS)
      if (action === 'nouveau-dossier' || dossiers.length < 3) {
        const d = await dossierAvecLignes(jdd, site, {
          statut: jdd.rng.booleen(0.5) ? 'PREPARATION_RECUE' : 'A_TRAITER',
        })
        dossiers.push(d)
        if (jdd.rng.booleen(0.6))
          instructions.push((await trainsDuDossier(jdd, site, d)).instruction.code)
        continue
      }
      switch (action) {
        case 'recevoir': {
          const d = pick(dossiers)
          if (!d) break
          const lignes = jdd.rng.echantillon(d.lignes, jdd.rng.entier(1, d.lignes.length))
          const corps = await corpsBl(
            jdd,
            site,
            lignes.map((l) => ({
              ligneAttendueId: l.id,
              quantite: Math.max(
                0,
                Math.round(
                  (l.qteBc ?? 10) * jdd.rng.choisirPondere([0.3, 0.6, 1, 1, 1.5], [1, 1, 3, 3, 1]),
                ),
              ),
            })),
          )
          const r = juger(
            action,
            await poster(jdd, '/api/receptions', rec, { ...corps, confirmerDoublon: true }),
          )
          if (r.status === 201) {
            const b = r.body as { receptionId: number; affiches: { id: number }[] }
            receptions.push(b.receptionId)
            affiches.push(...b.affiches.map((a) => a.id))
          }
          break
        }
        case 'complement': {
          const l = await db.receptionAttendue.findFirst({
            where: { plateformeId: site.plateforme.id, statut: 'PARTIELLE', etatLigne: 'ACTIVE' },
            skip: jdd.rng.entier(0, 3),
          })
          if (!l) break
          const lien = await db.afficheAttendue.findFirst({
            where: { ligneAttendueId: l.id, actif: true },
          })
          if (!lien) break
          juger(
            action,
            await poster(
              jdd,
              '/api/receptions',
              rec,
              await corpsBl(jdd, site, [
                {
                  ligneAttendueId: l.id,
                  quantite: jdd.rng.entier(1, 10),
                  complementAfficheId: lien.afficheId,
                },
              ]),
            ),
          )
          break
        }
        case 'controler': {
          const id = pick(receptions)
          if (id === undefined) break
          const c = await jdd.ctx.app.inject({
            method: 'GET',
            url: `/api/receptions/${String(id)}/controle`,
            headers: rec,
          })
          if (c.statusCode !== 200) break
          const ctl = c.json<{
            version: number
            lignes: { afficheId: number; quantiteBl: number }[]
          }>()
          juger(
            action,
            await poster(jdd, `/api/receptions/${String(id)}/controle`, rec, {
              version: ctl.version,
              controleurId: site.users.recep.id,
              lignes: ctl.lignes.map((l) => ({
                afficheId: l.afficheId,
                qteComptee: Math.max(
                  0,
                  l.quantiteBl +
                    jdd.rng.entier(-Math.ceil(l.quantiteBl * 0.5), Math.ceil(l.quantiteBl * 0.5)),
                ),
                allee: 'A',
                rayon: '1',
                rebut: jdd.rng.booleen(0.2) ? jdd.rng.entier(1, 5) : 0,
              })),
            }),
          )
          break
        }
        case 'valider':
        case 'annuler-validation': {
          const id = pick(affiches)
          if (id === undefined) break
          const a = await db.affiche.findUnique({ where: { id } })
          if (!a) break
          juger(
            action,
            await poster(jdd, `/api/coordination/affiches/${String(id)}/validation-admin`, coord, {
              version: a.version,
              valider: action === 'valider',
            }),
          )
          break
        }
        case 'theme': {
          const id = pick(affiches)
          if (id === undefined) break
          const lien = await db.afficheAttendue.findFirst({
            where: { afficheId: id, actif: true },
            include: { ligneAttendue: true },
          })
          const d = pick(dossiers)
          const cible = d ? pick(d.lignes) : undefined
          const a = await db.affiche.findUnique({ where: { id } })
          if (!lien || !cible || !a) break
          juger(
            action,
            await poster(
              jdd,
              `/api/affiches/${String(id)}/changer-theme`,
              jdd.rng.booleen() ? coord : rec,
              { version: a.version, lienId: lien.id, nouvelleLigneId: cible.id },
            ),
          )
          break
        }
        case 'retrait': {
          const id = pick(affiches)
          if (id === undefined) break
          const lien = await db.afficheAttendue.findFirst({ where: { afficheId: id, actif: true } })
          if (!lien) break
          juger(
            action,
            await poster(jdd, `/api/rattachements/${String(lien.id)}/retrait`, coord, {
              lienVersion: lien.version,
            }),
          )
          break
        }
        case 'inconnue': {
          const x = await creerInconnue(jdd, site, jdd.rng.entier(1, 50))
          inconnues.push(x.afficheId)
          affiches.push(x.afficheId)
          break
        }
        case 'rattacher-inconnue': {
          const id = pick(inconnues)
          const d = pick(dossiers)
          const l = d ? pick(d.lignes) : undefined
          if (id === undefined || !l) break
          const a = await db.affiche.findUnique({ where: { id } })
          juger(
            action,
            await rattacherInconnue(
              jdd,
              id,
              [
                {
                  ligneAttendueId: l.id,
                  quantite: jdd.rng.entier(1, Math.max(1, a?.quantite ?? 1)),
                },
              ],
              jdd.rng.booleen() ? coord : rec,
            ),
          )
          break
        }
        case 'signaler': {
          const id = pick(inconnues)
          if (id === undefined) break
          const a = await db.affiche.findUnique({ where: { id }, include: { reception: true } })
          if (!a?.reception) break
          juger(
            action,
            await poster(jdd, `/api/affiches/${String(id)}/signaler`, rec, {
              receptionVersion: a.reception.version,
            }),
          )
          break
        }
        case 'rebut': {
          const id = pick(affiches)
          if (id === undefined) break
          juger(
            action,
            await poster(jdd, `/api/affiches/${String(id)}/rebut`, rec, {
              quantite: jdd.rng.entier(1, 30),
              motif: 'AUTRE',
            }),
          )
          break
        }
        case 'annuler-dossier': {
          const d = pick(dossiers)
          if (!d || !jdd.rng.booleen(0.3)) break
          jdd.compter('aleatoire.annuler-dossier')
          try {
            await withTransaction(db, (tx) => annulerDossier(tx, d.dossier.contNum))
          } catch {
            // déjà annulé : 409 attendu du service
          }
          break
        }
        case 'instruction': {
          const code = pick(instructions)
          if (!code) break
          const i = await db.instruction.findUnique({ where: { code } })
          if (!i) break
          juger(
            action,
            await poster(jdd, `/api/coordination/instructions/${code}/statut`, coord, {
              version: i.version,
              vers: jdd.rng.choisir(['A_TRAITER', 'EN_COURS', 'ANNULE'] as const),
            }),
          )
          break
        }
        case 'export':
          if (jdd.rng.booleen(0.4))
            juger(action, await exporterTrains(jdd, site, jdd.rng.booleen(0.3)))
          break
        case 'unitaire': {
          // Libération, retrait, « Préparer », rendre la main, quantité : sur des lignes de répartition du site.
          const reps = await db.repartition.findMany({
            where: { atelierId: site.ateliers.fixe.id },
            orderBy: { id: 'desc' },
            take: 8,
          })
          const choix = jdd.rng.echantillon(reps, jdd.rng.entier(1, 3))
          if (choix.length === 0) break
          const lignes = choix.map((r) => ({ id: r.id, version: r.version }))
          const quoi = jdd.rng.choisir([
            'retirer',
            'preparer',
            'rendre-la-main',
            'quantite',
            'liberer',
          ] as const)
          const corps =
            quoi === 'rendre-la-main'
              ? { lignes, motif: 'JDD' }
              : quoi === 'quantite'
                ? {
                    id: lignes[0]?.id,
                    version: lignes[0]?.version,
                    quantite: jdd.rng.entier(0, 60),
                  }
                : quoi === 'liberer'
                  ? { atelierId: site.ateliers.fixe.id, depart: departTexte(jdd) }
                  : { lignes }
          juger(
            action,
            await appelUnitaire(jdd, site, quoi === 'quantite' ? 'quantite' : quoi, corps),
          )
          break
        }
        case 'colisage': {
          const reps = []
          for (let k = 0; k < jdd.rng.entier(1, 4); k++)
            reps.push(
              await ligneRepartition(jdd, site, type.id, {
                qte: jdd.rng.entier(1, 60),
                ...(dossiers.length > 0 && jdd.rng.booleen(0.6)
                  ? { contNum: pick(dossiers)?.dossier.contNum ?? null }
                  : {}),
              }),
            )
          const ch = await chaineFixe(
            jdd,
            site,
            reps.map((r) => ({ id: r.id, version: r.version })),
            { expedier: jdd.rng.booleen(0.7) },
          ).catch(() => ({ umIds: [], colisIds: [] as number[] }))
          colisIds.push(...ch.colisIds)
          break
        }
        case 'colis': {
          const id = pick(colisIds)
          if (id === undefined) break
          const c = await db.colis.findUnique({ where: { id } })
          if (!c) break
          juger(
            action,
            await poster(
              jdd,
              `/api/coordination/colis/${String(id)}/${jdd.rng.choisir(['expedier', 'ouvrir', 'supprimer'])}`,
              expe,
              { version: c.version },
            ),
          )
          break
        }
        case 'fin-de-journee':
          if (jdd.rng.booleen(0.5)) juger(action, await finDeJournee(jdd, site))
          break
      }
    }
    await lireLesListes(jdd, site)
    jdd.verifier(
      'aléatoire : aucune réponse en erreur serveur ni hors format',
      enPanne === 0,
      '0',
      String(enPanne),
      'CLAUDE.md §6',
    )
  },
}
