import type { z } from 'zod'
import {
  BUS_FORMATS,
  BusReferencesSchema,
  BusReferencesVersionSchema,
  BusLigneBroadcastSchema,
  lireSemaineIso,
  lundiSemaineIso,
  type BusLigne,
  type BusLigneBroadcast,
  type BusReception,
  type BusResultat,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Tx } from '../../core/transaction.ts'
import { identiteDuSite, type Identity } from '../../core/identity.ts'
import { assertPermission, assertPlateforme } from '../../core/permissions/permissions.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { ecrireHistoriqueStatut, ecrireJournal } from '../../core/tracabilite.ts'
import { attenduDe, recalculerLigne, statutLigneDe } from '../reception/lignes.ts'
import { enregistrerMouvement } from '../reception/stock.ts'
import { enregistrerPhoto } from '../reception/photos.ts'
import { rattacher } from '../reception/rattachement.ts'
import { dossiersEnProduction } from '../coordination/production.ts'
import { lireParametreNombre } from '../reception/parametres.ts'

type Client = Db | Tx
const refVide = { dsps: [], centres: [], formats: [], parcs: [] }
// BUS-02/03/21 : modèle explicite, sans reconnaître les formats dans des libellés concaténés.
export async function referencesBus(db: Client) {
  const row = await db.busReferentiel.findUnique({ where: { id: 1 } })
  return BusReferencesVersionSchema.parse({
    version: row?.version ?? 0,
    ...(row ? BusReferencesSchema.parse(JSON.parse(row.donnees)) : refVide),
  })
}
export async function lireReferencesBus(db: Client, identity: Identity) {
  assertPermission(identity, 'referentiel.gerer')
  return referencesBus(db)
}
export async function sauverReferencesBus(
  tx: Tx,
  identity: Identity,
  input: z.infer<typeof BusReferencesVersionSchema>,
) {
  assertPermission(identity, 'referentiel.gerer')
  const ref = BusReferencesSchema.parse(input)
  const unique = (xs: string[]) => new Set(xs).size === xs.length
  if (
    !unique(ref.dsps.map((d) => d.code)) ||
    !unique(ref.centres.map((c) => c.code)) ||
    !unique(ref.formats.map((f) => f.code)) ||
    !unique(ref.parcs.map((p) => `${p.centreCode}|${p.parc}|${p.formatCode}`))
  )
    throw new BusinessError('Un code de référentiel ne peut figurer deux fois.')
  if (ref.formats.length !== 5)
    throw new BusinessError('Les cinq formats Bus doivent être identifiés.')
  for (const d of ref.dsps)
    if (
      d.plateformeId !== null &&
      !(await tx.plateforme.findUnique({ where: { id: d.plateformeId } }))
    )
      throw new BusinessError(`Plateforme inconnue pour ${d.code}.`)
  if (ref.centres.some((c) => !ref.dsps.some((d) => d.code === c.dspCode)))
    throw new BusinessError('Chaque centre bus doit appartenir à une DSP connue.')
  for (const f of ref.formats)
    if (!(await tx.categorieSupport.findUnique({ where: { id: f.supportId } })))
      throw new BusinessError(`Support inconnu pour ${f.code}.`)
  if (
    ref.parcs.some(
      (p) =>
        !ref.centres.some((c) => c.code === p.centreCode) ||
        !ref.formats.some((f) => f.code === p.formatCode),
    )
  )
    throw new BusinessError('Parc rattaché à un centre ou format inconnu.')
  const anciennes = await referencesBus(tx)
  for (const l of await tx.busLigne.findMany()) {
    const c = ref.centres.find((c) => c.code === l.centreCode),
      d = ref.dsps.find((d) => d.code === c?.dspCode)
    if (
      !c ||
      !d ||
      d.plateformeId !== l.plateformeId ||
      !ref.formats.some((f) => f.code === l.formatCode)
    )
      throw new ConflictError(
        'Un centre, sa plateforme ou un format déjà utilisé ne peut être supprimé ou déplacé.',
      )
    const ancienFormat = anciennes.formats.find((f) => f.code === l.formatCode)
    if (ancienFormat?.supportId !== ref.formats.find((f) => f.code === l.formatCode)?.supportId)
      throw new ConflictError(
        'La correspondance support d’un format utilisé doit être migrée explicitement.',
      )
  }
  const row = await tx.busReferentiel.findUnique({ where: { id: 1 } })
  const donnees = JSON.stringify(ref)
  if (!row) {
    if (input.version !== 0) throw new ConflictError('Rechargez le référentiel Bus.')
    await tx.busReferentiel.create({ data: { id: 1, donnees, updatedById: identity.userId } })
  } else
    await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.busReferentiel.updateMany({
          where: { id: 1, ...where },
          data: { donnees, updatedById: identity.userId, ...bumpVersion },
        }),
    })
  await ecrireJournal(tx, {
    typeEntite: 'REFERENTIEL',
    entiteId: 'bus',
    action: 'MODIFICATION_REFERENTIEL',
    parId: identity.userId,
    ancienneValeur: row?.donnees,
    nouvelleValeur: donnees,
  })
  return referencesBus(tx)
}
// BUS-01/02/03/19/20 : entrée Broadcast idempotente ; vendu et quantités reçus sans correction automatique.
// Un lot partiel ne supprime aucune ligne absente. Les références inconnues font échouer le dossier entier.
export async function integrerLignesBus(tx: Tx, entrees: BusLigneBroadcast[], le: Date) {
  if (new Set(entrees.map((l) => l.idExterne)).size !== entrees.length)
    throw new BusinessError('Un identifiant de ligne Bus apparaît plusieurs fois dans le lot.')
  const ref = await referencesBus(tx)
  const groupe = new Map<string, { id: number; attendu: number }>()
  let creees = 0,
    misesAJour = 0,
    ignorees = 0
  for (const brut of entrees) {
    const l = BusLigneBroadcastSchema.parse(brut)
    if (l.finPose < l.semaine) throw new BusinessError('La fin de pose précède le début de pose.')
    const centre = ref.centres.find((c) => c.code === l.centreCode),
      dsp = ref.dsps.find((d) => d.code === centre?.dspCode),
      format = ref.formats.find((f) => f.code === l.formatCode)
    if (!centre || !dsp || !format)
      throw new BusinessError(`Référentiel Bus incomplet : ${l.centreCode}, ${l.formatCode}.`)
    if (dsp.plateformeId === null) {
      ignorees++
      continue
    }
    if (
      !ref.parcs.some(
        (p) => p.centreCode === l.centreCode && p.parc === l.parc && p.formatCode === l.formatCode,
      )
    )
      throw new BusinessError(`Parc Bus inconnu : ${l.centreCode}, ${l.parc}, ${l.formatCode}.`)
    const dossier = await tx.dossier.upsert({
      where: { contNum: l.contNum },
      create: { contNum: l.contNum, annonceur: l.annonceur },
      update: { annonceur: l.annonceur },
    })
    const existante = await tx.busLigne.findUnique({ where: { idExterne: l.idExterne } })
    if (
      existante &&
      (existante.dossierId !== dossier.id ||
        existante.plateformeId !== dsp.plateformeId ||
        existante.centreCode !== l.centreCode ||
        existante.parc !== l.parc ||
        existante.formatCode !== l.formatCode)
    )
      throw new ConflictError(
        'Une clé de ligne Broadcast ne peut désigner une autre vente ou une autre destination.',
      )
    const sem = lireSemaineIso(l.semaine)
    const cleTheme = `BUS:${l.themeCode}`
    const cle = `${dsp.plateformeId}|${dossier.id}|${format.supportId}|${cleTheme}|${l.semaine}`
    let attendue = await tx.receptionAttendue.findFirst({
      where: {
        plateformeId: dsp.plateformeId,
        contNum: l.contNum,
        supportId: format.supportId,
        themeCle: cleTheme,
        semAnnee: sem.annee,
        semNum: sem.semaine,
        etatLigne: 'ACTIVE',
      },
    })
    if (!attendue)
      attendue = await tx.receptionAttendue.create({
        data: {
          plateformeId: dsp.plateformeId,
          supportId: format.supportId,
          contNum: l.contNum,
          annonceur: l.annonceur,
          theme: l.theme,
          themeCle: cleTheme,
          format: BUS_FORMATS.find((f) => f.code === l.formatCode)?.nom,
          semAnnee: sem.annee,
          semNum: sem.semaine,
          source: 'BC',
          qteBc: 0,
          dateVueBc: le,
        },
      })
    else if (attendue.theme !== l.theme) {
      // BUS-18 : l'intitulé amont suit les documents ; les feuilles existantes sont à refaire.
      await tx.receptionAttendue.update({
        where: { id: attendue.id },
        data: { theme: l.theme, annonceur: l.annonceur, dateVueBc: le, ...bumpVersion },
      })
      const liens = await tx.afficheAttendue.findMany({
        where: { ligneAttendueId: attendue.id, actif: true },
        select: { afficheId: true },
      })
      await tx.affiche.updateMany({
        where: { id: { in: liens.map((x) => x.afficheId) } },
        data: { feuilleARefaire: true, themeModifie: true, ...bumpVersion },
      })
    }
    const data = {
      plateformeId: dsp.plateformeId,
      dossierId: dossier.id,
      ligneAttendueId: attendue.id,
      centreCode: l.centreCode,
      parc: l.parc,
      formatCode: l.formatCode,
      semaine: l.semaine,
      finPose: l.finPose,
      vendu: l.vendu,
      quantiteBroadcast: l.quantiteBroadcast,
      attendu: l.attendu,
      entretienPourcent: l.entretienPourcent,
      resteEnPlace: l.resteEnPlace,
    }
    if (existante) {
      await tx.busLigne.update({ where: { id: existante.id }, data: { ...data, ...bumpVersion } })
      misesAJour++
    } else {
      await tx.busLigne.create({ data: { idExterne: l.idExterne, ...data } })
      creees++
    }
    if (existante && existante.ligneAttendueId !== attendue.id)
      groupe.set(`ancienne:${existante.ligneAttendueId}`, {
        id: existante.ligneAttendueId,
        attendu: 0,
      })
    groupe.set(cle, { id: attendue.id, attendu: 0 })
  }
  for (const { id } of groupe.values()) {
    const total = await tx.busLigne.aggregate({
      where: { ligneAttendueId: id },
      _sum: { attendu: true },
    })
    await tx.receptionAttendue.update({
      where: { id },
      data: { qteBc: total._sum.attendu ?? 0, dateVueBc: le, ...bumpVersion },
    })
    await recalculerLigne(tx, null, id)
  }
  return { creees, misesAJour, ignorees }
}
// BUS-10 : vendredi S-2, 16 h 30 (maquette), semaines ISO avec changement d'année.
export function echeanceBus(semaine: string) {
  return new Date(lundiSemaineIso(lireSemaineIso(semaine)).getTime() - 10 * 864e5 + 16.5 * 36e5)
}
const scope = (i: Identity) => {
  const s = identiteDuSite(i)
  return s.perimetre.toutesPlateformes ? {} : { plateformeId: { in: s.perimetre.plateformeIds } }
}
// BUS-04/07/15/25 : reçus depuis les rattachements communs, jamais un compteur Bus parallèle.
export async function lireBus(db: Client, identity: Identity): Promise<BusResultat> {
  assertPermission(identity, 'bus.consulter')
  const ref = await referencesBus(db)
  const rows = await db.busLigne.findMany({
    where: scope(identity),
    orderBy: [{ semaine: 'asc' }, { centreCode: 'asc' }, { id: 'asc' }],
  })
  const attendues = await db.receptionAttendue.findMany({
    where: { id: { in: [...new Set(rows.map((l) => l.ligneAttendueId))] } },
    include: { rattachements: { where: { actif: true }, include: { affiche: true } } },
  })
  const dossiers = await db.dossier.findMany({
    where: { id: { in: [...new Set(rows.map((l) => l.dossierId))] } },
  })
  const enProd = await dossiersEnProduction(
    db,
    dossiers.map((d) => d.contNum),
  )
  const utilisateurs = await db.utilisateur.findMany({
    select: { id: true, nom: true, identifiantExterne: true },
  })
  const nomUser = (id: number | null) => {
    const u = utilisateurs.find((u) => u.id === id)
    return u ? (u.nom ?? u.identifiantExterne) : 'Circé automatique'
  }
  const lignes: BusLigne[] = rows.map((l) => {
    const centre = ref.centres.find((c) => c.code === l.centreCode),
      dsp = ref.dsps.find((d) => d.code === centre?.dspCode),
      format = BUS_FORMATS.find((f) => f.code === l.formatCode),
      parc = ref.parcs.find(
        (p) => p.centreCode === l.centreCode && p.parc === l.parc && p.formatCode === l.formatCode,
      ),
      d = dossiers.find((d) => d.id === l.dossierId),
      a = attendues.find((a) => a.id === l.ligneAttendueId)
    if (!centre || !dsp || !format || !d || !a)
      throw new BusinessError('Une référence Bus utilisée est introuvable.')
    return {
      ...l,
      formatCode: format.code,
      dossier: d.contNum,
      annonceur: d.annonceur ?? a.annonceur ?? '',
      theme: a.theme ?? '',
      themeCode: a.themeCle ?? '',
      centre: centre.nom,
      dspCode: dsp.code,
      dsp: dsp.nom,
      format: format.nom,
      verni: format.verni,
      aEncoller: l.quantiteAjustee ?? l.quantiteBroadcast,
      cadastre: parc?.cadastre ?? null,
      terrain: parc?.terrain ?? null,
      ajustePar: l.ajusteParId === null ? null : nomUser(l.ajusteParId),
      ajusteLe: l.ajusteLe?.toISOString() ?? null,
      verrouillee: enProd.has(d.contNum),
    }
  })
  const controles = await db.busControleReception.findMany({
    where: { ligneAttendueId: { in: attendues.map((a) => a.id) } },
    orderBy: { createdAt: 'desc' },
  })
  const receptionsBase = await db.reception.findMany({
    where: { id: { in: controles.map((c) => c.receptionId) } },
    include: { livraison: true, mouvements: true },
  })
  const receptions: BusResultat['receptions'] = controles.map((c) => {
    const r = receptionsBase.find((r) => r.id === c.receptionId)
    return {
      ...c,
      date: r?.dateArrivee.toISOString() ?? c.createdAt.toISOString(),
      bl: r?.livraison?.reference ?? '',
      quantite:
        r?.mouvements
          .filter((m) => m.type === 'RECEPTION' || m.type === 'COMPLEMENT')
          .reduce((s, m) => s + m.quantite, 0) ?? 0,
      auteur: nomUser(c.createdById),
    }
  })
  const visuels: BusResultat['visuels'] = []
  for (const a of attendues) {
    const ls = lignes.filter((l) => l.ligneAttendueId === a.id),
      premier = ls[0]
    if (!premier) continue
    const recu = a.rattachements.reduce((s, r) => s + r.quantite, 0),
      attendu = attenduDe(a),
      rs = receptions.filter((r) => r.ligneAttendueId === a.id),
      echeance = echeanceBus(premier.semaine),
      besoin = ls.reduce((s, l) => s + l.aEncoller, 0)
    const anomalies = [
      recu === 0 && new Date() > echeance ? 'Affiches manquantes' : null,
      recu > 0 && recu < attendu ? 'Quantité inférieure à l’attendu' : null,
      rs.some((r) => new Date(r.date) > echeance) ? 'Retard de réception' : null,
      rs.some((r) => !r.themeConforme) ? 'Thème non conforme' : null,
    ].filter((v): v is string => v !== null)
    visuels.push({
      ligneAttendueId: a.id,
      dossier: premier.dossier,
      dossierId: premier.dossierId,
      annonceur: premier.annonceur,
      theme: a.theme ?? '',
      semaine: premier.semaine,
      finPose: premier.finPose,
      plateformeId: a.plateformeId,
      attendu,
      recu,
      reste: Math.max(0, attendu - recu),
      aEncoller: besoin,
      statut: statutLigneDe(
        attendu,
        recu,
        await lireParametreNombre(db, 'reception.ecartReception', a.plateformeId),
      ),
      echeance: echeance.toISOString(),
      anomalies,
      pret: recu >= besoin,
      formats: [...new Set(ls.map((l) => l.format))],
      centres: [...new Set(ls.map((l) => l.centre))],
      dsps: [...new Set(ls.map((l) => l.dsp))],
      affiches: [...new Set(a.rattachements.map((l) => l.afficheId))],
    })
  }
  const inconnues = await db.affiche.findMany({
    where: {
      ...scope(identity),
      statut: 'ORPHELINE',
      supportId: { in: ref.formats.map((f) => f.supportId) },
    },
    include: { reception: { include: { livraison: true } } },
    orderBy: { dateEntree: 'desc' },
  })
  return {
    lignes,
    visuels,
    receptions,
    sansDossier: inconnues.map((a) => ({
      afficheId: a.id,
      version: a.version,
      receptionId: a.receptionId ?? 0,
      annonceur: a.contAnnonc,
      theme: a.theme,
      quantite: a.quantite,
      bl: a.reception?.livraison?.reference ?? null,
      date: a.dateEntree.toISOString(),
      plateformeId: a.plateformeId,
    })),
  }
}
// BUS-19/20, décision utilisateur 12/11 : manuel, valeur originale conservée et garde de production conservée.
export async function ajusterBus(
  tx: Tx,
  identity: Identity,
  id: number,
  input: { version: number; quantite: number | null; motif: string },
) {
  assertPermission(identity, 'bus.ajuster')
  const ligne = await tx.busLigne.findUnique({ where: { id } })
  if (!ligne) throw new NotFoundError('Ligne Bus introuvable.')
  assertPlateforme(identiteDuSite(identity), ligne.plateformeId)
  const d = await tx.dossier.findUniqueOrThrow({ where: { id: ligne.dossierId } })
  if ((await dossiersEnProduction(tx, [d.contNum])).has(d.contNum))
    throw new ConflictError(
      'Production déjà lancée : les quantités à encoller ne peuvent plus être ajustées.',
    )
  const avant = ligne.quantiteAjustee ?? ligne.quantiteBroadcast,
    apres = input.quantite ?? ligne.quantiteBroadcast
  await updateWithVersion({
    expectedVersion: input.version,
    update: (where) =>
      tx.busLigne.updateMany({
        where: { id, ...where },
        data: {
          quantiteAjustee: input.quantite,
          ajusteParId: input.quantite === null ? null : identity.userId,
          ajusteLe: input.quantite === null ? null : new Date(),
          ...bumpVersion,
        },
      }),
  })
  await ecrireJournal(tx, {
    typeEntite: 'LIGNE_BUS',
    entiteId: id,
    action: 'QUANTITES_ENCOLLER',
    parId: identity.userId,
    ancienneValeur: String(avant),
    nouvelleValeur: String(apres),
    complement: input.quantite === null ? 'Retour à la quantité Broadcast' : input.motif,
  })
  return { message: 'Quantité enregistrée. Les documents utilisent cette nouvelle valeur.' }
}
// BUS-09/12/13 : réception avec photo avant collage, contrôle entretien/thème, sans alerte Bus dédiée.
export async function receptionnerBus(tx: Tx, identity: Identity, input: BusReception) {
  assertPermission(identity, 'bus.recevoir')
  const bus = await tx.busLigne.findFirst({ where: { ligneAttendueId: input.ligneAttendueId } })
  if (!bus) throw new NotFoundError('Visuel Bus introuvable.')
  assertPlateforme(identiteDuSite(identity), bus.plateformeId)
  // BUS-12 : sous 50 exemplaires la NC de conditionnement est non bloquante.
  // Aucune règle de refus de réception au-delà de ce seuil n’est spécifiée.
  const a = await tx.receptionAttendue.findUniqueOrThrow({ where: { id: input.ligneAttendueId } })
  if (a.etatLigne !== 'ACTIVE' || a.themeExclu)
    throw new ConflictError('Ce visuel n’est plus attendu.')
  const photo = await enregistrerPhoto(tx, identity, input.photo)
  const livraison = await tx.livraison.create({
    data: {
      reference: input.bl || 'Sans BL',
      dateLivraison: input.date,
      nbreColis: 1,
      createdById: identity.userId,
    },
  })
  const reception = await tx.reception.create({
    data: {
      plateformeId: bus.plateformeId,
      livraisonId: livraison.id,
      statut: 'A_CONTROLER',
      dateArrivee: input.date,
      aControlerDepuis: input.date,
      createdById: identity.userId,
    },
  })
  let affiche =
    a.statut === 'PARTIELLE'
      ? (
          await tx.afficheAttendue.findFirst({
            where: { ligneAttendueId: a.id, actif: true },
            include: { affiche: true },
            orderBy: { id: 'desc' },
          })
        )?.affiche
      : undefined
  const complement = affiche !== undefined
  if (!affiche)
    affiche = await tx.affiche.create({
      data: {
        plateformeId: bus.plateformeId,
        supportId: a.supportId,
        receptionId: reception.id,
        photoId: photo.id,
        statut: 'IDENTIFIEE',
        dateEntree: input.date,
        contNum: a.contNum,
        contAnnonc: a.annonceur,
        theme: a.theme,
        conservation: 20,
        quantite: 0,
        createdById: identity.userId,
      },
    })
  await tx.livraisonAffiche.create({
    data: {
      afficheId: affiche.id,
      livraisonId: livraison.id,
      numeroLivraison: (await tx.livraisonAffiche.count({ where: { afficheId: affiche.id } })) + 1,
    },
  })
  await enregistrerMouvement(tx, identity, {
    permission: 'bus.recevoir',
    date: input.date,
    livraisonId: livraison.id,
    afficheId: affiche.id,
    type: complement ? 'COMPLEMENT' : 'RECEPTION',
    quantite: input.quantite,
    receptionId: reception.id,
  })
  if (complement) {
    const lien = await tx.afficheAttendue.findFirstOrThrow({
      where: { afficheId: affiche.id, ligneAttendueId: a.id, actif: true },
    })
    await updateWithVersion({
      expectedVersion: lien.version,
      update: (where) =>
        tx.afficheAttendue.updateMany({
          where: { id: lien.id, ...where },
          data: { quantite: { increment: input.quantite }, ...bumpVersion },
        }),
    })
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: affiche.id,
      action: 'RATTACHEMENT_AFFICHE',
      parId: identity.userId,
      ancienneValeur: String(lien.quantite),
      nouvelleValeur: String(lien.quantite + input.quantite),
      complement: `Complément Bus · ligne ${a.id}`,
    })
    await recalculerLigne(tx, identity, a.id)
  } else
    await rattacher(tx, identity, {
      permission: 'bus.recevoir',
      afficheId: affiche.id,
      ligneAttendueId: a.id,
      quantite: input.quantite,
      mode: input.bl ? 'BL' : 'MAIN',
    })
  await tx.busControleReception.create({
    data: {
      receptionId: reception.id,
      ligneAttendueId: a.id,
      entretien: input.entretien,
      themeConforme: input.themeConforme,
      photoId: photo.id,
      tenue: input.tenue,
      allongement: input.allongement,
      massicotage: input.massicotage,
      nc: input.nc,
      commentaire: input.commentaire,
      createdById: identity.userId,
    },
  })
  await ecrireHistoriqueStatut(tx, {
    typeEntite: 'RECEPTION',
    entiteId: reception.id,
    ancien: null,
    nouveau: 'A_CONTROLER',
    parId: identity.userId,
    regle: 'BUS-09',
  })
  await ecrireJournal(tx, {
    typeEntite: 'RECEPTION',
    entiteId: reception.id,
    action: 'CREATION_RECEPTION',
    parId: identity.userId,
    nouvelleValeur: String(input.quantite),
    complement: `Bus · ${input.nc || 'sans NC'} · thème ${input.themeConforme ? 'conforme' : 'non conforme'}`,
  })
  return {
    receptionId: reception.id,
    afficheId: affiche.id,
    message: 'Réception Bus enregistrée et visible dans le module Réception.',
  }
}
export async function historiqueBus(db: Client, identity: Identity) {
  assertPermission(identity, 'bus.consulter')
  const ids = (await db.busLigne.findMany({ where: scope(identity), select: { id: true } })).map(
    (l) => String(l.id),
  )
  const rows = await db.journalAudit.findMany({
    where: { typeEntite: 'LIGNE_BUS', entiteId: { in: ids } },
    include: { par: true },
    orderBy: { le: 'desc' },
  })
  return {
    items: rows.map((r) => ({
      id: r.id,
      ligneId: Number(r.entiteId),
      date: r.le.toISOString(),
      auteur: r.par?.nom ?? r.par?.identifiantExterne ?? 'Circé automatique',
      avant: r.ancienneValeur,
      apres: r.nouvelleValeur,
      motif: r.complement,
    })),
  }
}
