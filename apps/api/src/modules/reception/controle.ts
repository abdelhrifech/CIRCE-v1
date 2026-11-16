// REC-P05 — Sas (palettes à contrôler) et contrôle de la palette (ECR-REC-02, ECR-REC-06).
import { bumpVersion, updateWithVersion } from '../../core/versioning.ts'
import type { Controle, Sas, ValiderControle } from '@circe/shared'
import type { Db } from '../../core/db.ts'
import { BusinessError, ConflictError, NotFoundError, ValidationError } from '../../core/errors.ts'
import type { Identity } from '../../core/identity.ts'
import { ecrireJournal } from '../../core/tracabilite.ts'
import type { Tx } from '../../core/transaction.ts'
import { ecrireAfficheVersionnee } from './affiche.ts'
import { plateformesVisibles } from './attendues.ts'
import { lireParametreNombre, lireParametreTexte } from './parametres.ts'
import { assertDroitReception, assertPerimetreReception, REC } from './permissions.ts'
import { agentsDeReception } from './referentiels.ts'
import { attenduDe, recalculerLigne } from './lignes.ts'
import { changerStatutReception } from './service.ts'
import { enregistrerMouvement, stockAffiche } from './stock.ts'

type Client = Db | Tx

/** Affiches d'une réception : créées par elle, ou complétées par elle (RG-REC-040). */
export async function affichesDeReception(client: Client, receptionId: number) {
  const reception = await client.reception.findUniqueOrThrow({ where: { id: receptionId } })
  const ids = new Set<number>()
  for (const a of await client.affiche.findMany({ where: { receptionId }, select: { id: true } }))
    ids.add(a.id)
  if (reception.livraisonId !== null) {
    for (const la of await client.livraisonAffiche.findMany({
      where: { livraisonId: reception.livraisonId },
      select: { afficheId: true },
    })) {
      ids.add(la.afficheId)
    }
  }
  return [...ids].sort((a, b) => a - b)
}

/** Quantité du BL d'une affiche pour une réception = Σ mouvements Réception / Complément de cette réception. */
async function quantiteBl(client: Client, receptionId: number, afficheId: number): Promise<number> {
  const r = await client.mouvement.aggregate({
    where: { receptionId, afficheId, type: { in: ['RECEPTION', 'COMPLEMENT'] } },
    _sum: { quantite: true },
  })
  return r._sum.quantite ?? 0
}

/** Σ des écarts de contrôle d'une affiche pour une réception (RG-REC-059). */
async function ecartsControle(
  client: Client,
  receptionId: number,
  afficheId: number,
): Promise<number> {
  const r = await client.mouvement.aggregate({
    where: { receptionId, afficheId, type: 'ECART_CONTROLE' },
    _sum: { quantite: true },
  })
  return r._sum.quantite ?? 0
}

// RG-REC-055 (HYPOTHÈSE Q-157 : heures calendaires) : retard au-delà du délai, « double » au-delà de 2 ×.
export function retardDe(minutes: number, delaiHeures: number): 'NON' | 'RETARD' | 'DOUBLE' {
  if (minutes > 2 * delaiHeures * 60) return 'DOUBLE'
  if (minutes > delaiHeures * 60) return 'RETARD'
  return 'NON'
}

// RG-REC-053 : sas = réceptions À contrôler du site, la plus ancienne en tête ; recherche par BL ou imprimeur.
// RG-REC-071 : une réception À identifier n'y figure pas.
export async function listerSas(
  db: Db,
  identity: Identity,
  q?: string,
  maintenant = new Date(),
): Promise<Sas> {
  assertDroitReception(identity, 'reception.sas.consulter')
  const plateformes = plateformesVisibles(identity)
  const delai = await lireParametreNombre(db, 'reception.delaiControle')
  const receptions = await db.reception.findMany({
    where: {
      statut: 'A_CONTROLER',
      ...(plateformes === 'toutes' ? {} : { plateformeId: { in: plateformes } }),
    },
    include: {
      plateforme: { select: { id: true, nom: true } },
      livraison: { include: { imprimeur: { select: { libelle: true } } } },
    },
  })
  const terme = q?.trim().toLowerCase()
  const palettes = []
  for (const r of receptions) {
    const bl = r.livraison?.reference ?? null
    const imprimeur = r.livraison?.imprimeur?.libelle ?? null
    if (
      terme &&
      !(bl ?? '').toLowerCase().includes(terme) &&
      !(imprimeur ?? '').toLowerCase().includes(terme)
    )
      continue
    const depuis = r.aControlerDepuis ?? r.dateArrivee
    const minutes = Math.max(0, Math.floor((maintenant.getTime() - depuis.getTime()) / 60_000))
    const affiches = await affichesDeReception(db, r.id)
    let qte = 0
    for (const a of affiches) qte += await quantiteBl(db, r.id, a)
    palettes.push({
      receptionId: r.id,
      version: r.version,
      estInconnue: r.estInconnue,
      arrivee: r.dateArrivee.toISOString(),
      aControlerDepuis: depuis.toISOString(),
      attenteMinutes: minutes,
      retard: retardDe(minutes, delai),
      site: r.plateforme,
      bl,
      imprimeur,
      nombreAffiches: affiches.length,
      quantiteBl: qte,
      dechargePar: r.livraison?.dechargePar ?? null,
    })
  }
  palettes.sort((a, b) => a.aControlerDepuis.localeCompare(b.aControlerDepuis))
  return {
    palettes,
    delaiControleHeures: delai,
    nombreEnRetard: palettes.filter((p) => p.retard !== 'NON').length,
  }
}

// RG-REC-056 : le contrôle montre toute la palette, une ligne par affiche ; lecture seule si contrôlée (RG-REC-070).
export async function lireControle(
  db: Db,
  identity: Identity,
  receptionId: number,
): Promise<Controle> {
  assertDroitReception(identity, 'reception.sas.consulter')
  const r = await db.reception.findUnique({
    where: { id: receptionId },
    include: {
      plateforme: { select: { id: true, nom: true } },
      livraison: { include: { imprimeur: true, livreur: true } },
    },
  })
  if (!r) throw new NotFoundError('Réception introuvable')
  assertPerimetreReception(identity, r.plateformeId)
  const controleur = r.controleurId
    ? await db.utilisateur.findUnique({
        where: { id: r.controleurId },
        select: { nom: true, identifiantExterne: true },
      })
    : null
  const lignes = []
  for (const id of await affichesDeReception(db, r.id)) {
    const a = await db.affiche.findUniqueOrThrow({
      where: { id },
      include: {
        support: { select: { nom: true } },
        imprimeur: true,
        rattachements: { where: { actif: true }, include: { ligneAttendue: true } },
        livraisons: { select: { numeroLivraison: true, livraisonId: true } },
      },
    })
    const bl = await quantiteBl(db, r.id, a.id)
    lignes.push({
      afficheId: a.id,
      version: a.version,
      complement: a.receptionId !== r.id,
      orpheline: a.statut === 'ORPHELINE',
      annonceur: a.contAnnonc,
      theme: a.theme,
      dossiers: [
        ...new Set(
          a.rattachements
            .map((x) => x.ligneAttendue.contNum)
            .filter((x): x is number => x !== null),
        ),
      ],
      format: a.support.nom,
      quantiteBl: bl,
      attendu: a.rattachements.reduce((s, x) => s + attenduDe(x.ligneAttendue), 0),
      qteComptee: r.statut === 'CONTROLEE' ? bl + (await ecartsControle(db, r.id, a.id)) : null,
      recu: a.rattachements.reduce((s, x) => s + x.quantite, 0),
      statutAffiche: a.statut,
      feuille: a.typeFeuille,
      allee: a.allee,
      rayon: a.rayon,
      surplusEntretien: a.surplusEntretien,
    })
  }
  const imprimeur = r.livraison?.imprimeur ?? null
  return {
    receptionId: r.id,
    version: r.version,
    statut: r.statut,
    estInconnue: r.estInconnue,
    lectureSeule: r.statut !== 'A_CONTROLER',
    arrivee: r.dateArrivee.toISOString(),
    site: r.plateforme,
    bl: r.livraison?.reference ?? null,
    photoBlId: r.photoBlId,
    imprimeur: imprimeur ? { id: imprimeur.id, libelle: imprimeur.libelle } : null,
    transporteur: r.livraison?.livreur?.libelle ?? null,
    nbColis: r.livraison?.nbreColis ?? null,
    dechargePar: r.livraison?.dechargePar ?? null,
    controleur: controleur
      ? (controleur.nom ?? controleur.identifiantExterne)
      : (r.controleurNom ?? null),
    controleLe: r.controleLe ? r.controleLe.toISOString() : null,
    ecartReceptionPourcent: await lireParametreNombre(db, 'reception.ecartReception'),
    comptageMorceauSeuil: await lireParametreNombre(db, 'reception.comptageMorceau'),
    lignes,
  }
}

// RG-REC-072 : une réception inconnue rattachée se contrôle comme les autres (imprimeur corrigeable).
// RG-REC-069 : « Valider le contrôle » — tout dans UNE transaction (mouvements, contrôleur, statut, emplacements).
export async function validerControle(
  tx: Tx,
  identity: Identity,
  receptionId: number,
  input: ValiderControle,
) {
  // RG-REC-002 : le contrôle est fait par un agent de réception.
  assertDroitReception(identity, 'reception.controler')
  const r = await tx.reception.findUnique({
    where: { id: receptionId },
    include: { livraison: true },
  })
  if (!r) throw new NotFoundError('Réception introuvable')
  assertPerimetreReception(identity, r.plateformeId)
  // RG-REC-071 : une réception À identifier n'est pas contrôlable (rattacher d'abord).
  if (r.statut === 'A_IDENTIFIER') {
    throw new ConflictError(
      'Cette réception est à identifier : rattachez-la avant de la contrôler.',
      {
        code: 'REC_CONTROLE_INTERDIT_A_IDENTIFIER',
        regle: 'RG-REC-071',
      },
    )
  }
  // RG-REC-070 : contrôle terminé = lecture seule.
  if (r.statut === 'CONTROLEE') {
    throw new ConflictError('Le contrôle de cette palette est déjà validé.', {
      code: 'REC_CONTROLE_DEJA_FAIT',
      regle: 'RG-REC-070',
    })
  }
  const affiches = await affichesDeReception(tx, r.id)
  const saisies = new Map(input.lignes.map((l) => [l.afficheId, l]))
  if (
    saisies.size !== input.lignes.length ||
    affiches.some((id) => !saisies.has(id)) ||
    input.lignes.some((l) => !affiches.includes(l.afficheId))
  ) {
    throw new ValidationError(
      'Le contrôle porte sur toutes les affiches de la palette, une fois chacune.',
      {
        code: 'REC_CONTROLE_LIGNES',
        regle: 'RG-REC-056',
        details: { attendues: affiches },
      },
    )
  }
  // RG-REC-057 : quantité comptée ≥ 0 ; RG-REC-064 : rebut ≥ 0.
  if (input.lignes.some((l) => l.qteComptee < 0 || l.rebut < 0 || (l.surplusEntretien ?? 0) < 0)) {
    throw new ValidationError('La quantité doit être supérieure ou égale à 0.', {
      code: 'REC_QTE_NEGATIVE',
      regle: 'RG-REC-057',
    })
  }
  // RG-REC-067 : contrôleur obligatoire ; RG-REC-063 : agent de réception du site.
  if (input.controleurId === null) {
    throw new BusinessError('Le nom du contrôleur est obligatoire (REC-12).', {
      code: 'REC_CONTROLEUR_OBLIGATOIRE',
      regle: 'RG-REC-067',
    })
  }
  const agents = await agentsDeReception(tx, [r.plateformeId])
  const controleur = agents.find((a) => a.id === input.controleurId)
  if (!controleur) {
    throw new BusinessError('Le contrôleur doit être un agent de réception du site.', {
      code: 'REC_REFERENTIEL_INCONNU',
      regle: 'RG-REC-063',
    })
  }
  // RG-REC-066 : « +N en entretien » seulement si le comptage dépasse l'attendu des lignes rattachées ;
  // N ≤ comptée − attendu (HYPOTHÈSE Q-178 (19) : attendu sans entretien, non connu côté Réception).
  for (const l of input.lignes) {
    if (l.surplusEntretien === null || l.surplusEntretien === 0) continue
    const liens = await tx.afficheAttendue.findMany({
      where: { afficheId: l.afficheId, actif: true },
      include: { ligneAttendue: true },
    })
    const attendu = liens.reduce((somme, x) => somme + attenduDe(x.ligneAttendue), 0)
    if (l.surplusEntretien > l.qteComptee - attendu) {
      throw new BusinessError(
        `Pas de surplus en entretien : le comptage (${String(l.qteComptee)}) ne dépasse pas l’attendu (${String(attendu)}) d’au moins ${String(l.surplusEntretien)}.`,
        {
          code: 'REC_SURPLUS_ENTRETIEN_INVALIDE',
          regle: 'RG-REC-066',
          details: { afficheId: l.afficheId },
        },
      )
    }
  }
  // RG-REC-061 : allée et rayon obligatoires pour chaque affiche (sortie de la zone tampon).
  if (input.lignes.some((l) => !l.allee || !l.rayon)) {
    throw new BusinessError('Allée et rayon sont obligatoires pour chaque affiche.', {
      code: 'REC_ALLEE_RAYON_OBLIGATOIRES',
      regle: 'RG-REC-061',
    })
  }
  // RG-REC-068 : imprimeur corrigé seulement pour une réception inconnue, et dans le référentiel.
  if (input.imprimeurId !== null) {
    if (!r.estInconnue) {
      throw new BusinessError(
        "L'imprimeur ne se corrige au contrôle que pour une réception inconnue.",
        {
          code: 'REC_IMPRIMEUR_NON_MODIFIABLE',
          regle: 'RG-REC-068',
        },
      )
    }
    if (!(await tx.imprimeur.findFirst({ where: { id: input.imprimeurId, actif: true } }))) {
      throw new BusinessError(
        "Valeur absente du référentiel : l'administrateur l'ajoute dans Administration.",
        {
          code: 'REC_REFERENTIEL_INCONNU',
          regle: 'RG-REC-035',
        },
      )
    }
  }

  const alleeTampon = (
    await lireParametreTexte(tx, 'reception.alleeInconnues', r.plateformeId)
  ).toUpperCase()
  const lignesTouchees = new Set<number>()
  for (const saisie of input.lignes) {
    const affiche = await tx.affiche.findUniqueOrThrow({ where: { id: saisie.afficheId } })
    const bl = await quantiteBl(tx, r.id, affiche.id)
    const ecart = saisie.qteComptee - bl
    // RG-REC-059 : écart au BL → mouvement « Contrôle (écart au BL) » signé ; il compte dans le reçu.
    if (ecart !== 0) {
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.controler',
        afficheId: affiche.id,
        type: 'ECART_CONTROLE',
        quantite: ecart,
        receptionId: r.id,
        comptee: true,
        motif: `Compté ${String(saisie.qteComptee)} pour ${String(bl)} au BL`,
      })
      // Le reçu (Σ liens) suit le comptage quand l'affiche n'a qu'un lien actif (HYPOTHÈSE Q-178).
      const liens = await tx.afficheAttendue.findMany({
        where: { afficheId: affiche.id, actif: true },
      })
      const [seul] = liens
      if (liens.length === 1 && seul) {
        await updateWithVersion({
          expectedVersion: seul.version,
          update: (where) =>
            tx.afficheAttendue.updateMany({
              where: { id: seul.id, ...where },
              data: { quantite: Math.max(1, seul.quantite + ecart), ...bumpVersion },
            }),
          ...REC.version,
        })
        lignesTouchees.add(seul.ligneAttendueId)
      }
    }
    // RG-REC-064 : rebut = mouvement « Mise au rebut » négatif, plafonné au disponible ; ne réduit pas le reçu.
    if (saisie.rebut > 0) {
      const disponible = await stockAffiche(tx, affiche.id)
      if (saisie.rebut > disponible) {
        throw new BusinessError(
          `Le rebut (${String(saisie.rebut)}) dépasse le stock disponible (${String(disponible)}).`,
          {
            code: 'REC_REBUT_SUPERIEUR_STOCK',
            regle: 'RG-REC-064',
            details: { afficheId: affiche.id, disponible },
          },
        )
      }
      await enregistrerMouvement(tx, identity, {
        permission: 'reception.controler',
        afficheId: affiche.id,
        type: 'MISE_AU_REBUT',
        quantite: -saisie.rebut,
        receptionId: r.id,
        motif: saisie.nonConformite,
      })
    }
    // RG-REC-062 / RG-REC-006 : emplacement définitif + historique « Rangée : X-3 → B-7 ».
    const allee = saisie.allee.toUpperCase()
    const avant = await tx.affiche.findUniqueOrThrow({ where: { id: affiche.id } })
    await ecrireAfficheVersionnee(tx, identity, avant, undefined, {
      allee,
      rayon: saisie.rayon,
      ...(saisie.surplusEntretien !== null ? { surplusEntretien: saisie.surplusEntretien } : {}),
      ...(input.imprimeurId !== null ? { imprimeurId: input.imprimeurId } : {}),
    })
    if (avant.allee !== allee || avant.rayon !== saisie.rayon) {
      await ecrireJournal(tx, {
        typeEntite: 'AFFICHE',
        entiteId: affiche.id,
        action: 'MODIFICATION_EMPLACEMENT',
        parId: identity.userId,
        ancienneValeur: `${avant.allee ?? '—'}-${avant.rayon ?? '—'}`,
        nouvelleValeur: `${allee}-${saisie.rayon}`,
        // RG-REC-062 : allée vide ou allée tampon des réceptions inconnues du site (Q-105).
        complement:
          !avant.allee || avant.allee === alleeTampon ? 'sortie de la zone tampon' : undefined,
      })
    }
    // RG-REC-065 : non-conformité historisée (pas de mouvement).
    if (saisie.nonConformite !== 'CONFORME') {
      await ecrireJournal(tx, {
        typeEntite: 'AFFICHE',
        entiteId: affiche.id,
        action: 'NON_CONFORMITE',
        parId: identity.userId,
        nouvelleValeur: saisie.nonConformite,
      })
    }
    // RG-REC-066 : surplus noté en entretien.
    if (saisie.surplusEntretien !== null && saisie.surplusEntretien > 0) {
      await ecrireJournal(tx, {
        typeEntite: 'AFFICHE',
        entiteId: affiche.id,
        action: 'SURPLUS_ENTRETIEN',
        parId: identity.userId,
        nouvelleValeur: String(saisie.surplusEntretien),
      })
    }
  }
  // RG-X-017 / RG-REC-018 : recalcul des lignes dont le reçu a changé.
  for (const id of lignesTouchees) await recalculerLigne(tx, identity, id)

  // RG-REC-069 : contrôleur et date ; réception → CONTROLEE (machine d'états + version + historique).
  const version = await changerStatutReception(tx, identity, {
    id: r.id,
    vers: 'CONTROLEE',
    expectedVersion: input.version,
    regle: 'RG-REC-069',
    permission: 'reception.controler',
    data: { controleLe: new Date(), controleurId: controleur.id, controleurNom: controleur.nom },
  })
  await ecrireJournal(tx, {
    typeEntite: 'RECEPTION',
    entiteId: r.id,
    action: 'CONTROLE_RECEPTION',
    parId: identity.userId,
    nouvelleValeur: `contrôlée par ${controleur.nom}`,
  })
  return {
    receptionId: r.id,
    version,
    affiches,
    message: `Contrôle de la réception ${String(r.id)} validé : ${String(affiches.length)} affiche(s) rangée(s).`,
  }
}
