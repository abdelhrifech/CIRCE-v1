import { imprimerNc } from '../nonconformite/service.ts'
// REC-P06 — Feuille de stock (= étiquette rack), impressions et rangement (ECR-REC-09, ECR-REC-10).
// Q-002 (HYPOTHÈSE) : le PDF est rendu par le navigateur ; l'API fournit les données et enregistre
// l'impression (type de feuille posé, tag levé, journal). Aucun envoi à l'agent local d'impression.
import { formatSemaineIso, type Feuille } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { ecrireAfficheVersionnee } from './affiche.ts'
import { attenduDe } from './lignes.ts'
import { lireParametreNombre } from './parametres.ts'
import { assertDroitReception, assertPerimetreReception } from './permissions.ts'
import { stockAffiche } from './stock.ts'

// RG-REC-079 : code-barres « A- » + n° d'affiche sur 13 chiffres.
export function codeBarres(afficheId: number): string {
  return `A-${String(afficheId).padStart(13, '0')}`
}

// RG-REC-076 / RG-REC-077 / RG-REC-078 : feuille de stock = étiquette rack, mention DÉFINITIVE / TEMPORAIRE.
async function feuille(client: Db | Tx, identity: Identity, afficheId: number): Promise<Feuille> {
  const a = await client.affiche.findUnique({
    where: { id: afficheId },
    include: {
      support: { select: { nom: true } },
      reception: { select: { commentaire: true } },
      // RG-REC-078 : ordre des associations (Ref DA = première association).
      rattachements: {
        where: { actif: true },
        include: { ligneAttendue: true },
        orderBy: { id: 'asc' },
      },
    },
  })
  if (!a) throw new NotFoundError(`Affiche ${String(afficheId)} introuvable`)
  assertPerimetreReception(identity, a.plateformeId)
  const semaines = [
    ...new Set(
      a.rattachements.map((r) =>
        formatSemaineIso({ annee: r.ligneAttendue.semAnnee, semaine: r.ligneAttendue.semNum }),
      ),
    ),
  ].sort()
  // RG-REC-084 : définitive dès qu'il y a un dossier ; sinon temporaire (RG-REC-083).
  const type = a.rattachements.length > 0 ? 'DEFINITIVE' : 'TEMPORAIRE'
  return {
    afficheId: a.id,
    photoId: a.photoId,
    codeBarres: codeBarres(a.id),
    type,
    // RG-REC-082 / Q-127 : fond jaune pour une feuille DÉFINITIVE d'un dossier multi-semaines (≥ 2 semaines).
    fondJaune: type === 'DEFINITIVE' && semaines.length >= 2,
    format: a.support.nom,
    dateReception: a.dateEntree.toISOString(),
    adressage: `${a.allee ?? '—'} - ${a.rayon ?? '—'}`,
    // RG-REC-080 : quantité = somme des mouvements (pas affiche.quantite).
    quantite: await stockAffiche(client, a.id),
    dossiers: [
      ...new Set(
        a.rattachements.map((r) => r.ligneAttendue.contNum).filter((x): x is number => x !== null),
      ),
    ],
    semaines,
    // RG-REC-081 : 1er départ = semaine de départ minimale des lignes rattachées.
    premierDepart: semaines[0] ?? null,
    annonceur: a.contAnnonc,
    theme: a.theme,
    repiquage: a.repiquage,
    // RG-REC-078 : commentaire de l'affiche + deux espaces + commentaire de la réception.
    commentaire: [a.commentaire, a.reception?.commentaire].filter(Boolean).join('  ') || null,
    aConserver: a.aConserver,
    lignes: a.rattachements.map((r) => ({
      dossier: r.ligneAttendue.contNum,
      theme: r.ligneAttendue.theme,
      annonceur: r.ligneAttendue.annonceur,
      format: r.ligneAttendue.format,
      depart: `S${String(r.ligneAttendue.semNum).padStart(2, '0')} /${String(r.ligneAttendue.semAnnee)}`,
      qtePrepa: attenduDe(r.ligneAttendue),
      da: r.ligneAttendue.idDaChapeau,
    })),
  }
}

// RG-REC-076 à 082 : données des feuilles de stock à rendre en PDF côté navigateur.
export async function lireFeuilles(db: Db, identity: Identity, ids: number[]) {
  assertDroitReception(identity, 'reception.imprimer')
  if (ids.length === 0 || ids.length > 500)
    throw new ValidationError('Entre 1 et 500 affiches par impression.')
  const feuilles = []
  for (const id of ids) feuilles.push(await feuille(db, identity, id))
  return {
    feuilles,
    exemplairesParDefaut: await lireParametreNombre(db, 'reception.exemplairesFeuille'),
  }
}

// RG-REC-085 / RG-REC-086 / RG-REC-087 / RG-REC-090 : impression en lot (feuilles et / ou étiquettes rack).
export async function enregistrerImpression(
  tx: Tx,
  identity: Identity,
  input: {
    afficheIds: number[]
    contenu: 'FEUILLE' | 'ETIQUETTE_RACK' | 'FEUILLE_ET_ETIQUETTE'
    exemplaires: number
    nonConformites?: { id: number; version: number }[]
  },
) {
  assertDroitReception(identity, 'reception.imprimer')
  // EX-NEW16-REC-001 : stock et feuille NC journalisés dans la même transaction.
  if (input.nonConformites?.length) await imprimerNc(tx, identity, input.nonConformites)
  // RG-REC-086 : 1 à 5 exemplaires.
  if (input.exemplaires < 1 || input.exemplaires > 5) {
    throw new ValidationError('Entre 1 et 5 exemplaires.', {
      code: 'REC_EXEMPLAIRES',
      regle: 'RG-REC-086',
    })
  }
  const feuilles = input.contenu !== 'ETIQUETTE_RACK'
  const etiquettes = input.contenu !== 'FEUILLE'
  for (const id of input.afficheIds) {
    const a = await tx.affiche.findUnique({
      where: { id },
      include: { rattachements: { where: { actif: true }, select: { id: true } } },
    })
    if (!a) throw new NotFoundError(`Affiche ${String(id)} introuvable`)
    assertPerimetreReception(identity, a.plateformeId)
    const type = a.rattachements.length > 0 ? 'DEFINITIVE' : 'TEMPORAIRE'
    if (feuilles) {
      // RG-REC-085 : type de feuille noté, tag « Feuille à refaire » levé, historique.
      await ecrireAfficheVersionnee(tx, identity, a, undefined, {
        typeFeuille: type,
        feuilleARefaire: false,
      })
      await ecrireJournal(tx, {
        typeEntite: 'AFFICHE',
        entiteId: id,
        action: 'IMPRESSION_FEUILLE',
        parId: identity.userId,
        nouvelleValeur: `feuille ${type === 'DEFINITIVE' ? 'définitive' : 'temporaire'} × ${String(input.exemplaires)}`,
      })
    }
    if (etiquettes) {
      // RG-REC-084 : une étiquette rack suppose un dossier (feuille définitive).
      if (type !== 'DEFINITIVE') {
        throw new ConflictError(
          `L’affiche ${String(id)} n’a pas de dossier : pas d’étiquette rack.`,
          {
            code: 'REC_FEUILLE_DEFINITIVE_IMPOSSIBLE',
            regle: 'RG-REC-084',
          },
        )
      }
      // RG-COO-023 : l'étiquette rack demandée par la validation admin est imprimée → levée.
      const courante = await tx.affiche.findUniqueOrThrow({ where: { id } })
      if (courante.etiquetteRackAImprimer) {
        await ecrireAfficheVersionnee(tx, identity, courante, undefined, {
          etiquetteRackAImprimer: false,
        })
      }
      await ecrireJournal(tx, {
        typeEntite: 'AFFICHE',
        entiteId: id,
        action: 'IMPRESSION_ETIQUETTE_RACK',
        parId: identity.userId,
      })
    }
  }
  const n = input.afficheIds.length
  const parts = [
    feuilles ? `${String(n)} feuille(s)` : null,
    etiquettes ? `${String(n)} étiquette(s) rack` : null,
  ].filter(Boolean)
  return {
    afficheIds: input.afficheIds,
    message: `${parts.join(' et ')} prête(s) à imprimer (${String(input.exemplaires)} exemplaire(s)).`,
  }
}

// RG-REC-088 / RG-REC-062 : « Ranger avant d'imprimer » — emplacement mis à jour et historisé.
// Allée / rayon vides = reste en zone tampon.
export async function ranger(
  tx: Tx,
  identity: Identity,
  affiches: { id: number; version: number; allee: string; rayon: string }[],
) {
  assertDroitReception(identity, 'affiche.modifier')
  for (const s of affiches) {
    const a = await tx.affiche.findUnique({ where: { id: s.id } })
    if (!a) throw new NotFoundError(`Affiche ${String(s.id)} introuvable`)
    assertPerimetreReception(identity, a.plateformeId)
    if (!s.allee && !s.rayon) continue
    if (!s.allee || !s.rayon) {
      throw new BusinessError(
        'Allée et rayon vont ensemble (vides : l’affiche reste en zone tampon).',
        {
          code: 'REC_ALLEE_RAYON_OBLIGATOIRES',
          regle: 'RG-REC-088',
        },
      )
    }
    const allee = s.allee.toUpperCase()
    await ecrireAfficheVersionnee(tx, identity, a, s.version, { allee, rayon: s.rayon })
    await ecrireJournal(tx, {
      typeEntite: 'AFFICHE',
      entiteId: s.id,
      action: 'MODIFICATION_EMPLACEMENT',
      parId: identity.userId,
      ancienneValeur: `${a.allee ?? '—'}-${a.rayon ?? '—'}`,
      nouvelleValeur: `${allee}-${s.rayon}`,
    })
  }
  return { afficheIds: affiches.map((a) => a.id), message: 'Emplacements enregistrés.' }
}

// RG-X-053 / RG-COO-022 : seules les affiches validées produisent l'effet « picking » (une affiche à confirmer en
// est exclue ; l'annulation de la validation la retire de l'édition suivante, Q-202).
// RG-REC-093 (HYPOTHÈSE Q-101 : édition conservée) : affiches validées admin, hors zone picking, par
// plateforme et période d'entrée ; quantité = Σ mouvements ; groupées par format, triées par annonceur.
export async function editionPicking(
  db: Db,
  identity: Identity,
  plateformeId: number,
  du: Date,
  au: Date,
) {
  assertDroitReception(identity, 'reception.imprimer')
  assertPerimetreReception(identity, plateformeId)
  const affiches = await db.affiche.findMany({
    where: {
      plateformeId,
      validationAdmin: true,
      zonePicking: false,
      dateEntree: { gte: du, lte: au },
    },
    include: { support: { select: { nom: true } } },
  })
  const lignes = []
  for (const a of affiches) {
    lignes.push({
      afficheId: a.id,
      codeBarres: codeBarres(a.id),
      format: a.support.nom,
      annonceur: a.contAnnonc ?? '',
      theme: a.theme,
      quantite: await stockAffiche(db, a.id),
    })
  }
  const lettre = (s: string) => (/^[a-z]/i.test(s) ? 0 : 1)
  lignes.sort(
    (x, y) =>
      x.format.localeCompare(y.format) ||
      lettre(x.annonceur) - lettre(y.annonceur) ||
      x.annonceur.localeCompare(y.annonceur, 'fr', { sensitivity: 'base' }),
  )
  return { lignes }
}
