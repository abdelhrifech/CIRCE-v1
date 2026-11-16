// COO-P11 — Suivi 8 m² (demies) : saisie en ligne et reste à faire (RG-COO-237, ECR-COO-08). Les thèmes 8 m² sont ceux
// des ateliers du paramètre `suivi8m2.ateliers` (RG-COO-237 : ateliers 7 et 8 du legacy ; identifiants non repris,
// Q-319). Besoin et reçu viennent du suivi par thème (RG-COO-230). Saisie libre ≥ 0 avec historique (Q-264 sans
// réponse : HYPOTHÈSE Q-195). Remplace un Excel hors Circé (PROC-06).
import {
  LIBELLE_CHAMP_8M2,
  lireSemaineIso,
  semaineIsoDe,
  type LigneSuivi8m2,
  type Saisie8m2,
  type Suivi8m2,
  type Suivi8m2Query,
} from '@circe/shared'
import { parPaquets } from '../../core/paquets.ts'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import { lireParametreTexte } from '../reception/parametres.ts'
import { assertDroitCoordination, assertPerimetreAtelier, COO } from './permissions.ts'
import { besoinParTheme } from './suivi-theme.ts'
import { ateliersDuPerimetre, cleTheme } from './trains.ts'

const R = 'RG-COO-237'

/** Identifiants d'atelier 8 m² (paramètre) : liste séparée par « ; ». */
async function ateliersParametres(db: Db | Tx): Promise<Set<number>> {
  return new Set(
    (await lireParametreTexte(db, 'suivi8m2.ateliers'))
      .split(';')
      .map((x) => Number(x.trim()))
      .filter((x) => Number.isInteger(x) && x > 0),
  )
}

// RG-COO-237 : une ligne par thème 8 m² (Site, Annonceur · thème, Besoin, Reçu, Demies haut / bas, 8 m² finales,
// Reste à faire = besoin − finales). Les filtres Statut, Destinataire, Afficheur, « Trains de » sont sans objet ici.
export async function suivi8m2(
  db: Db | Tx,
  identity: Identity,
  q: Suivi8m2Query,
  maintenant = new Date(),
): Promise<Suivi8m2> {
  assertDroitCoordination(identity, 'train.consulter', R)
  const semaine = q.depart
    ? lireSemaineIso(q.depart)
    : semaineIsoDe(new Date(maintenant.getTime() + 7 * 86_400_000))
  const ids = await ateliersParametres(db)
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter((a) => ids.has(a.id))
  const besoin = await besoinParTheme(
    db,
    identity,
    {
      depart: `${String(semaine.annee)}-W${String(semaine.semaine).padStart(2, '0')}`,
      ...(q.atelier ? { atelier: q.atelier } : {}),
      ...(q.dossier ? { dossier: q.dossier } : {}),
      ...(q.annonceur ? { annonceur: q.annonceur } : {}),
    },
    maintenant,
  )
  const parAtelier = new Map(ateliers.map((a) => [a.id, a]))
  const lignes8 = besoin.lignes.filter((l) => parAtelier.has(l.atelierId))
  const plateformes8 = [...new Set(ateliers.map((a) => a.plateformeId))]
  const saisies = await parPaquets([...new Set(lignes8.map((l) => l.contNum ?? 0))], (paquet) =>
    db.suivi8m2.findMany({
      where: { plateformeId: { in: plateformes8 }, contNum: { in: paquet } },
    }),
  )
  const parCle = new Map(
    saisies.map((x) => [`${String(x.plateformeId)}|${String(x.contNum)}|${x.themeCle}`, x]),
  )
  const lignes: LigneSuivi8m2[] = lignes8.map((l) => {
    const at = parAtelier.get(l.atelierId)
    const saisie = parCle.get(
      `${String(at?.plateformeId ?? 0)}|${String(l.contNum ?? 0)}|${cleTheme(l.theme)}`,
    )
    return {
      cle: l.cle,
      atelierId: l.atelierId,
      site: at?.plateforme ?? '—',
      contNum: l.contNum,
      annonceur: l.annonceur,
      theme: l.theme,
      besoin: l.besoin,
      recu: l.recu,
      demiesHaut: saisie?.demiesHaut ?? 0,
      demiesBas: saisie?.demiesBas ?? 0,
      finales: saisie?.finales ?? 0,
      resteAFaire: l.besoin - (saisie?.finales ?? 0),
      version: saisie?.version ?? 0,
    }
  })
  return {
    semaine,
    lignes,
    ateliers: ateliers.map((a) => ({ id: a.id, libelle: a.libelle, plateforme: a.plateforme })),
  }
}

// RG-COO-237 : saisie en ligne d'une cellule éditable (entier ≥ 0, validé par le schéma : 400 sinon). Verrou de
// version de la saisie (0 = première saisie du thème) ; historique « 8 m² : <champ> = <valeur> » (qui, quand).
export async function saisir8m2(
  tx: Tx,
  identity: Identity,
  input: Saisie8m2,
  maintenant = new Date(),
): Promise<{ message: string; ligne: LigneSuivi8m2 }> {
  assertDroitCoordination(identity, 'suivi_8m2.saisir', R)
  const atelier = await tx.atelier.findUnique({ where: { id: input.atelierId } })
  if (!atelier) throw new NotFoundError('Atelier introuvable')
  assertPerimetreAtelier(identity, atelier)
  if (!(await ateliersParametres(tx)).has(atelier.id))
    throw new BusinessError("Cet atelier n'est pas un atelier 8 m².", {
      code: 'COO_ATELIER_NON_8M2',
      regle: R,
    })
  const s = lireSemaineIso(input.depart)
  const faces = (
    await tx.faceTrain.findMany({
      where: {
        atelierId: atelier.id,
        depAnbas: s.annee,
        depSembas: s.semaine,
        contNum: input.contNum,
        trainId: { not: null },
        NOT: { statut: 'ANNULE' },
      },
      select: { theme: true },
    })
  ).filter((f) => cleTheme(f.theme) === cleTheme(input.theme))
  if (faces.length === 0)
    throw new NotFoundError(`Thème « ${input.theme} » introuvable pour cette semaine`)
  const cle = cleTheme(input.theme)
  const existante = await tx.suivi8m2.findUnique({
    where: {
      plateformeId_contNum_themeCle: {
        plateformeId: atelier.plateformeId,
        contNum: input.contNum,
        themeCle: cle,
      },
    },
  })
  const libelle = LIBELLE_CHAMP_8M2[input.champ]
  if (!existante) {
    // Première saisie : la version attendue est 0 (sinon la ligne affichée est périmée).
    if (input.version !== 0)
      throw new ConflictError(
        'Cette saisie a été modifiée par un autre utilisateur : rechargez la page.',
        { ...COO.version, regle: 'RG-COO-308' },
      )
    await tx.suivi8m2.create({
      data: {
        plateformeId: atelier.plateformeId,
        contNum: input.contNum,
        themeCle: cle,
        theme: input.theme,
        [input.champ]: input.valeur,
        createdById: identity.userId,
        updatedById: identity.userId,
      },
    })
  } else {
    await updateWithVersion({
      expectedVersion: input.version,
      update: (where) =>
        tx.suivi8m2.updateMany({
          where: { id: existante.id, ...where },
          data: { [input.champ]: input.valeur, updatedById: identity.userId, ...bumpVersion },
        }),
      ...COO.version,
      regle: 'RG-COO-308',
    })
  }
  await ecrireJournal(tx, {
    typeEntite: 'SUIVI_8M2',
    entiteId: `${String(atelier.plateformeId)}|${String(input.contNum)}|${cle}`,
    action: 'SUIVI_8M2',
    parId: identity.userId,
    ancienneValeur: String(existante?.[input.champ] ?? 0),
    nouvelleValeur: `8 m² : ${libelle.toLowerCase()} = ${String(input.valeur)}`,
    complement: R,
    donnees: JSON.stringify({ atelierId: atelier.id, le: maintenant.toISOString() }),
  })
  const apres = (
    await suivi8m2(
      tx,
      identity,
      { depart: input.depart, atelier: atelier.id, dossier: input.contNum },
      maintenant,
    )
  ).lignes.find((l) => cleTheme(l.theme) === cle)
  if (!apres) throw new NotFoundError(`Thème « ${input.theme} » introuvable`)
  return { message: `8 m² : ${libelle.toLowerCase()} = ${String(input.valeur)}`, ligne: apres }
}
