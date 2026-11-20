import { parPaquets } from '../../core/paquets.ts'
import { lireConfigurationFinCampagne } from './configuration.ts'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import {
  DECISIONS_FIN_CAMPAGNE,
  FinCampagneSchema,
  formatSemaineIso,
  lireSemaineIso,
  lundiSemaineIso,
  semaineIsoDe,
  type FinCampagneLigne,
  type FinCampagneQuerySchema,
  type DeciderFinCampagneSchema,
  type ExecuterFinCampagneSchema,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import type { Identity } from '../../core/identity.ts'
import { assertPermission, hasPermission } from '../../core/permissions/permissions.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import { ecrireJournal, ecrireHistoriqueStatut } from '../../core/tracabilite.ts'
import { enregistrerMouvement } from '../reception/stock.ts'
import { lireStock, scopeStock, idsDossiers } from './lecture.ts'
type Client = Db | Tx
const D = 'stock.fin_campagne.agir'
const normaliser = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
const cle = (site: number, dossier: number) => `${site}-${dossier}`
// RG-STK-NEW-002 — maquette data.js:1269–1301, calcul réel sans modifier Réception/Coordination.
export async function calculerFinsCampagne(
  db: Client,
  i: Identity,
  maintenant = new Date(),
  dossiers?: number[],
): Promise<FinCampagneLigne[]> {
  assertPermission(i, 'stock.fin_campagne.consulter')
  const { affiches, items } = await lireStock(db, i, dossiers)
  const contNums = [
    ...new Set(
      affiches.flatMap((a) =>
        a.rattachements.flatMap((r) =>
          r.ligneAttendue.contNum === null ? [] : [r.ligneAttendue.contNum],
        ),
      ),
    ),
  ]
  const [decisions, configuration, reparts, attendues, faces, dossiersAnnules, instructions] =
    await Promise.all([
      parPaquets(contNums, (p) =>
        db.finCampagne.findMany({ where: { ...scopeStock(i), dossier: { in: p } } }),
      ),
      lireConfigurationFinCampagne(db),
      parPaquets(contNums, (paquet) =>
        db.repartition.findMany({
          where: {
            contNum: { in: paquet },
            retire: false,
            atelier: { ...scopeStock(i) },
          },
          include: { destinataire: true, atelier: true },
        }),
      ),
      parPaquets(contNums, (paquet) =>
        db.receptionAttendue.findMany({
          where: { ...scopeStock(i), contNum: { in: paquet } },
          include: { atelier: true },
          orderBy: { id: 'asc' },
        }),
      ),
      parPaquets(contNums, (paquet) =>
        db.faceTrain.findMany({
          where: {
            contNum: { in: paquet },
            statut: { not: 'ANNULE' },
            atelier: { ...scopeStock(i) },
          },
          include: { destinataire: true, atelier: true },
        }),
      ),
      parPaquets(contNums, (paquet) =>
        db.dossier.findMany({
          where: { contNum: { in: paquet }, statut: 'ANNULE' },
          select: { contNum: true },
        }),
      ),
      parPaquets(contNums, (paquet) =>
        db.instruction.findMany({
          where: {
            contNum: { in: paquet },
            statut: { not: 'ANNULE' },
            atelier: { ...scopeStock(i) },
          },
          include: { atelier: true },
        }),
      ),
    ])
  const users = await db.utilisateur.findMany({
    where: { id: { in: [...new Set(decisions.map((d) => d.parId))] } },
    select: { id: true, nom: true, identifiantExterne: true },
  })
  const noms = new Map(users.map((u) => [u.id, u.nom ?? u.identifiantExterne])),
    decDe = new Map(decisions.map((d) => [cle(d.plateformeId, d.dossier), d])),
    stockDe = new Map(items.map((a) => [a.id, a]))
  const annules = new Set(dossiersAnnules.map((d) => d.contNum))
  const courant = formatSemaineIso(semaineIsoDe(maintenant))
  const programmes = new Map<string, Set<string>>()
  const noter = (site: number | undefined, dossier: number | null, semaine: string) => {
    if (site === undefined || dossier === null || annules.has(dossier)) return
    const k = cle(site, dossier),
      v = programmes.get(k) ?? new Set<string>()
    v.add(semaine)
    programmes.set(k, v)
  }
  for (const l of attendues)
    if (l.etatLigne === 'ACTIVE')
      noter(l.plateformeId, l.contNum, formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum }))
  for (const f of faces)
    noter(
      f.atelier?.plateformeId,
      f.contNum,
      f.depAnbas !== null && f.depSembas !== null
        ? formatSemaineIso({ annee: f.depAnbas, semaine: f.depSembas })
        : formatSemaineIso(semaineIsoDe(f.dateDepart)),
    )
  for (const r of reparts)
    if (r.statut !== 'ANNULE' && r.semAnnee !== null && r.semNum !== null)
      noter(
        r.atelier?.plateformeId,
        r.contNum,
        formatSemaineIso({ annee: r.semAnnee, semaine: r.semNum }),
      )
  for (const ins of instructions)
    if (ins.contAnbas !== null && ins.contSembas !== null)
      noter(
        ins.atelier?.plateformeId,
        ins.contNum,
        formatSemaineIso({ annee: ins.contAnbas, semaine: ins.contSembas }),
      )

  const groupes = new Map<string, { site: number; dossier: number; ids: Set<number> }>()
  for (const a of affiches) {
    if (a.statut === 'ORPHELINE' || a.estFusionne) continue
    // La maquette attribue l’affiche à son premier rattachement actif : un stock physique, un seul propriétaire.
    const l = a.rattachements.find((r) => r.ligneAttendue.contNum !== null)?.ligneAttendue
    if (!l || l.contNum === null) continue
    const k = cle(a.plateformeId, l.contNum),
      g = groupes.get(k) ?? { site: a.plateformeId, dossier: l.contNum, ids: new Set<number>() }
    g.ids.add(a.id)
    groupes.set(k, g)
  }

  const rows: FinCampagneLigne[] = []
  for (const [key, g] of groupes) {
    const afs = affiches.filter((a) => g.ids.has(a.id)),
      ls = attendues.filter((l) => l.plateformeId === g.site && l.contNum === g.dossier)
    const dernier = [
      ...ls.map((l) => formatSemaineIso({ annee: l.semAnnee, semaine: l.semNum })),
      ...(programmes.get(key) ?? []),
    ]
      .sort()
      .at(-1)
    if (!dernier || dernier >= courant) continue
    const stocks = afs.flatMap((a) => {
        const s = stockDe.get(a.id)
        return s ? [s] : []
      }),
      stock = stocks.reduce((s, a) => s + Math.max(0, a.disponible), 0),
      x = decDe.get(key)
    if (!stock && !x) continue
    const formats = [...new Set(stocks.map((a) => a.format))],
      format = formats.some((f) => /^8\s*m[²2]/i.test(f))
        ? '8m2'
        : formats.some((f) => /^2\s*m[²2]|MUI/i.test(f))
          ? '2m2'
          : 'autres'
    const delai = configuration.delais[format]
    const echeance = formatSemaineIso(
      semaineIsoDe(
        new Date(lundiSemaineIso(lireSemaineIso(dernier)).getTime() + delai * 7 * 86400000),
      ),
    )
    const attention: string[] = []
    const destinations = [
      ...reparts
        .filter((r) => r.contNum === g.dossier && r.atelier?.plateformeId === g.site)
        .map((r) => ({
          nom: `${r.destinataire?.nom ?? ''} ${r.destinataire?.nomOrigine ?? ''}`,
          quantite: r.qte ?? 0,
        })),
      ...faces
        .filter((f) => f.contNum === g.dossier && f.atelier?.plateformeId === g.site)
        .map((f) => ({
          nom: `${f.destinataire?.nom ?? ''} ${f.destinataire?.nomOrigine ?? ''}`,
          quantite: 1,
        })),
    ]
    const versBordeaux = destinations.filter((r) => normaliser(r.nom).includes('BORDEAUX'))
    const total = destinations.reduce((s, r) => s + r.quantite, 0),
      bdx = destinations
        .filter((r) => normaliser(r.nom).includes('BORDEAUX'))
        .reduce((s, r) => s + r.quantite, 0)
    if (configuration.attention.includes('BDX') && versBordeaux.length > 0)
      attention.push(`BDX ${total ? Math.round((100 * bdx) / total) : 0} %`)
    if (configuration.attention.includes('MUI') && formats.some((f) => /MUI/i.test(f)))
      attention.push('MUI')
    const gardes = [
      ...new Set(
        afs
          .filter((a) => (stockDe.get(a.id)?.disponible ?? 0) > 0)
          .flatMap((a) =>
            a.rattachements.flatMap((r) => {
              const l = r.ligneAttendue
              if (l.contNum === g.dossier || (l.contNum !== null && annules.has(l.contNum)))
                return []
              const prochaines =
                l.contNum === null
                  ? []
                  : [...(programmes.get(cle(a.plateformeId, l.contNum)) ?? [])]
                      .filter((s) => s >= courant)
                      .sort()
              return prochaines[0]
                ? [
                    `Affiche ${a.id} : campagne prévue ${prochaines[0]} (dossier ${l.contNum ?? 'à identifier'})`,
                  ]
                : []
            }),
          ),
      ),
    ]
    // Empreinte couvre aussi les liens et les gardes, pas seulement la décision enregistrée.
    const empreinte = createHash('sha256')
      .update(
        JSON.stringify({
          afs: afs.map((a) => [
            a.id,
            a.version,
            stockDe.get(a.id)?.disponible,
            a.rattachements.map((r) => [
              r.id,
              r.quantite,
              r.ligneAttendue.id,
              r.ligneAttendue.version,
              r.ligneAttendue.etatLigne,
            ]),
          ]),
          lignes: ls.map((l) => [l.id, l.version, l.semAnnee, l.semNum, l.etatLigne]),
          gardes,
          attention,
          echeance,
        }),
      )
      .digest('hex')
    rows.push({
      cle: key,
      plateformeId: g.site,
      site: stocks[0]?.site ?? '',
      dossier: g.dossier,
      annonceur: ls.find((l) => l.annonceur)?.annonceur ?? stocks[0]?.annonceur ?? '',
      atelier: [...new Set(ls.flatMap((l) => (l.atelier ? [l.atelier.libelle] : [])))].join(', '),
      formats,
      dernierDepart: dernier,
      echeance,
      delai,
      stock,
      attention,
      gardes,
      affiches: stocks,
      decision: z.enum(DECISIONS_FIN_CAMPAGNE).parse(x?.decision ?? 'A_DECIDER'),
      version: x?.version ?? 0,
      empreinte,
      jusqua: x?.jusqua ?? null,
      motif: x?.motif ?? null,
      destinataire: x?.destinataire ?? null,
      quantiteRetour: x?.quantiteRetour ?? null,
      quantiteEnvoyee: x?.quantiteEnvoyee ?? 0,
      quantiteDetruite: x?.quantiteDetruite ?? 0,
      modifieLe: x?.updatedAt.toISOString() ?? null,
      par: x ? (noms.get(x.parId) ?? null) : null,
    })
  }
  return rows.sort(
    (a, b) => a.dernierDepart.localeCompare(b.dernierDepart) || a.dossier - b.dossier,
  )
}
export async function listerFinsCampagne(
  db: Client,
  i: Identity,
  q: z.infer<typeof FinCampagneQuerySchema>,
) {
  const ids = idsDossiers(q.dossier),
    all = await calculerFinsCampagne(db, i, new Date(), q.dossier ? ids : undefined)
  const compatibles = all.filter(
    (r) =>
      (!q.dossier || ids.includes(r.dossier)) &&
      (!q.q ||
        `${r.dossier} ${r.annonceur} ${r.site}`
          .toLocaleLowerCase('fr')
          .includes(q.q.toLocaleLowerCase('fr'))) &&
      (!q.attention ||
        (q.attention === 'garde'
          ? r.gardes.length > 0
          : q.attention === 'aucun'
            ? !r.gardes.length && !r.attention.length
            : r.attention.some((a) => a.startsWith(q.attention ?? '')))),
  )
  const indicateurs = FinCampagneSchema.shape.indicateurs.parse(
    Object.fromEntries(
      DECISIONS_FIN_CAMPAGNE.map((d) => [d, compatibles.filter((r) => r.decision === d).length]),
    ),
  )
  return {
    items: compatibles.filter(
      (r) =>
        !q.decision ||
        (q.decision === 'FAIT'
          ? ['ENVOYE', 'DETRUIT'].includes(r.decision)
          : r.decision === q.decision),
    ),
    indicateurs,
    peutAgir: hasPermission(i, D),
  }
}
function verifierCible(
  rows: FinCampagneLigne[],
  c: { plateformeId: number; dossier: number; version: number; empreinte: string },
) {
  const r = rows.find((r) => r.plateformeId === c.plateformeId && r.dossier === c.dossier)
  if (!r) throw new NotFoundError('Fin de campagne introuvable dans ce périmètre.')
  if (r.version !== c.version || r.empreinte !== c.empreinte)
    throw new ConflictError(
      'Le dossier, ses affiches ou sa décision ont changé : rechargez la liste.',
      { regle: 'RG-STK-NEW-002' },
    )
  return r
}
async function enregistrerDecision(
  tx: Tx,
  i: Identity,
  r: FinCampagneLigne,
  data: {
    decision: string
    jusqua?: string | null
    motif?: string | null
    destinataire?: string | null
    quantiteRetour?: number | null
    quantiteEnvoyee?: number
    quantiteDetruite?: number
  },
) {
  if (r.version === 0) {
    await tx.finCampagne.create({
      data: { plateformeId: r.plateformeId, dossier: r.dossier, ...data, parId: i.userId },
    })
  } else {
    const e = await tx.finCampagne.updateMany({
      where: { plateformeId: r.plateformeId, dossier: r.dossier, version: r.version },
      data: { ...data, parId: i.userId, version: { increment: 1 } },
    })
    if (!e.count) throw new ConflictError('Décision modifiée entre-temps : rechargez.')
  }
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'FIN_CAMPAGNE',
    entiteId: r.cle,
    ancien: r.decision,
    nouveau: data.decision,
    parId: i.userId,
    regle: 'RG-STK-NEW-002',
  })
}
// RG-STK-NEW-002 — décision par dossier, sans sortie tant que l’action physique n’est pas confirmée.
export async function deciderFinCampagne(
  tx: Tx,
  i: Identity,
  input: z.infer<typeof DeciderFinCampagneSchema>,
) {
  assertPermission(i, D)
  const r = verifierCible(await calculerFinsCampagne(tx, i, new Date(), [input.dossier]), input)
  if (['ENVOYE', 'DETRUIT'].includes(r.decision))
    throw new ConflictError('Une sortie réalisée ne peut pas être annulée.')
  if (input.decision !== 'CONSERVER' && input.decision !== 'A_DECIDER' && r.gardes.length)
    throw new BusinessError(
      'Le visuel a encore une campagne prévue : seule la conservation est possible.',
      { regle: 'RG-STK-NEW-002' },
    )
  if (
    input.decision === 'CONSERVER' &&
    (!input.jusqua ||
      input.jusqua <= formatSemaineIso(semaineIsoDe(new Date())) ||
      !input.motif?.trim())
  )
    throw new BusinessError('Choisissez une semaine future et un motif de conservation.')
  if (
    input.decision === 'ENVOYER' &&
    (!input.destinataire?.trim() || !input.quantiteRetour || input.quantiteRetour > r.stock)
  )
    throw new BusinessError('Destinataire et quantité de renvoi entre 1 et le stock requis.')
  await enregistrerDecision(tx, i, r, {
    decision: input.decision,
    jusqua: input.decision === 'CONSERVER' ? input.jusqua : null,
    motif: input.decision === 'CONSERVER' ? input.motif : null,
    destinataire: input.decision === 'ENVOYER' ? input.destinataire : null,
    quantiteRetour: input.decision === 'ENVOYER' ? input.quantiteRetour : null,
  })
  await ecrireJournal(tx, {
    typeEntite: 'FIN_CAMPAGNE',
    entiteId: r.cle,
    action: 'DECISION_FIN_CAMPAGNE',
    parId: i.userId,
    ancienneValeur: r.decision,
    nouvelleValeur: input.decision,
    complement: `Décision ${input.decision}${input.decision === 'CONSERVER' ? ` jusqu’à ${input.jusqua ?? ''} — ${input.motif ?? ''}` : ''}${input.decision === 'ENVOYER' ? ` — ${input.quantiteRetour ?? 0} à renvoyer à ${input.destinataire ?? ''}` : ''}`,
    donnees: {
      ...ciblePourAudit(input),
      decision: input.decision,
      ...(input.decision === 'CONSERVER'
        ? { jusqua: input.jusqua, motif: input.motif }
        : input.decision === 'ENVOYER'
          ? { destinataire: input.destinataire, quantiteRetour: input.quantiteRetour }
          : {}),
    },
  })
  return { message: `Dossier ${r.dossier} : décision enregistrée.`, quantite: 0 }
}
export async function executerFinCampagne(
  tx: Tx,
  i: Identity,
  input: z.infer<typeof ExecuterFinCampagneSchema>,
) {
  assertPermission(i, D)
  const rows = await calculerFinsCampagne(
      tx,
      i,
      new Date(),
      input.cibles.map((c) => c.dossier),
    ),
    cibles = [
      ...new Map(input.cibles.map((c) => [cle(c.plateformeId, c.dossier), c])).values(),
    ].map((c) => verifierCible(rows, c))
  if (input.action === 'RENVOI' && cibles.length !== 1)
    throw new BusinessError('Le renvoi se traite dossier par dossier.')
  if (input.action === 'DESTRUCTION' && !input.confirmation)
    throw new BusinessError('Cochez la confirmation de destruction.')
  const ids = new Set<number>()
  for (const r of cibles) {
    if (r.gardes.length)
      throw new BusinessError('Campagne prévue sur une affiche : sortie interdite.', {
        regle: 'RG-STK-NEW-002',
      })
    if ((cibles.length > 1 || input.action === 'PROPOSER_DESTRUCTION') && r.attention.length)
      throw new BusinessError('Bordeaux et MUI : décision un par un, jamais en lot.')
    const attendu =
      input.action === 'PROPOSER_DESTRUCTION'
        ? 'A_DECIDER'
        : input.action === 'DESTRUCTION'
          ? 'DETRUIRE'
          : 'ENVOYER'
    if (r.decision !== attendu)
      throw new ConflictError(`Cette action exige la décision « ${attendu} ».`)
    if (input.action === 'DESTRUCTION' && r.echeance > formatSemaineIso(semaineIsoDe(new Date())))
      throw new BusinessError(`Sortie autorisée à partir de ${r.echeance}.`)
    if (input.action !== 'PROPOSER_DESTRUCTION')
      for (const a of r.affiches.filter((a) => a.disponible > 0)) {
        if (ids.has(a.id))
          throw new BusinessError(
            'Une affiche est partagée entre les dossiers sélectionnés : traitez-les individuellement.',
          )
        ids.add(a.id)
      }
  }
  let quantite = 0
  for (const r of cibles) {
    let quantiteDossier = 0
    if (input.action === 'PROPOSER_DESTRUCTION') {
      await enregistrerDecision(tx, i, r, { decision: 'DETRUIRE' })
    } else {
      let reste = input.action === 'RENVOI' ? (r.quantiteRetour ?? 0) : r.stock,
        total = 0
      if (reste < 1 || reste > r.stock)
        throw new BusinessError('La quantité à sortir dépasse le stock disponible.')
      for (const a of r.affiches) {
        const n = Math.min(Math.max(0, a.disponible), reste)
        if (!n) continue
        await enregistrerMouvement(tx, i, {
          permission: D,
          afficheId: a.id,
          type: input.action === 'RENVOI' ? 'RENVOI' : 'DESTRUCTION',
          quantite: -n,
          expectedAfficheVersion: a.version,
          motif: `Fin de campagne dossier ${r.dossier}${input.action === 'RENVOI' ? ` — ${r.destinataire ?? ''}` : ''}`,
        })
        total += n
        reste -= n
      }
      quantite += total
      quantiteDossier = total
      await enregistrerDecision(
        tx,
        i,
        r,
        input.action === 'RENVOI'
          ? {
              decision: r.stock > total ? 'DETRUIRE' : 'ENVOYE',
              quantiteEnvoyee: r.quantiteEnvoyee + total,
            }
          : { decision: 'DETRUIT', quantiteDetruite: r.quantiteDetruite + total },
      )
    }
    await ecrireJournal(tx, {
      typeEntite: 'FIN_CAMPAGNE',
      entiteId: r.cle,
      action: 'EXECUTION_FIN_CAMPAGNE',
      parId: i.userId,
      ancienneValeur: r.decision,
      nouvelleValeur: input.action,
      complement: `${input.action} : ${quantiteDossier} affiche(s), dossier ${r.dossier}`,
      donnees: { quantite: quantiteDossier, affiches: r.affiches.map((a) => a.id) },
    })
  }
  return {
    message:
      input.action === 'PROPOSER_DESTRUCTION'
        ? `${cibles.length} dossier(s) à détruire.`
        : `${quantite} affiche(s) ${input.action === 'RENVOI' ? 'renvoyée(s)' : 'détruite(s)'}.`,
    quantite,
  }
}

function ciblePourAudit(c: {
  plateformeId: number
  dossier: number
  version: number
  empreinte: string
}) {
  return {
    plateformeId: c.plateformeId,
    dossier: c.dossier,
    version: c.version,
    empreinte: c.empreinte,
  }
}
