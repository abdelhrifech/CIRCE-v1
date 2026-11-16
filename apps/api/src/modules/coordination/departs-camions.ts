// D-14 — ECR-EXP-03 « Départs camions » (lecture seule, EX-EXP-501 à 506 de la maquette) : avancement du colisage par
// départ. Le jour et l'heure de départ, la boucle et le canal ne sont pas modélisés (Q-403) : un départ est une
// semaine ISO et une ligne = départ × destinataire (HYPOTHÈSES Q-411). Les unités sont les trains (statut calculé,
// Q-250) et les UM des ateliers fixes (hors types « Bus », maquette : « exclut le site Nanterre (Bus) »).
import {
  comparerSemaines,
  formatSemaineIso,
  lireSemaineIso,
  semaineIsoDe,
  type DepartCamionLigne,
  type DepartsCamions,
  type DepartsCamionsQuery,
  type GraviteDepart,
} from '@circe/shared'
import type { Db } from '../../core/db.ts'
import type { Identity } from '../../core/identity.ts'
import { parPaquets } from '../../core/paquets.ts'
import { assertDroitCoordination } from './permissions.ts'
import { construireTrains, ateliersDuPerimetre, facesDesTrains } from './trains.ts'
import { lireTypes } from './unitaire.ts'

const DROIT = 'colis.gerer'
/** Maquette ECR-EXP-03 : liseré critique si des unités attendent et que le départ est dans moins de 36 h. */
const SEUIL_CRITIQUE_MS = 36 * 3600 * 1000
/** HYPOTHÈSE Q-411 : sans filtre de départ, on liste les départs des 14 derniers jours et à venir. */
const FENETRE_JOURS = 14
const JOUR_MS = 24 * 3600 * 1000

type Statut = 'attente' | 'cours' | 'colisee'

export async function lireDepartsCamions(
  db: Db,
  identity: Identity,
  q: DepartsCamionsQuery,
  maintenant = new Date(),
): Promise<DepartsCamions> {
  assertDroitCoordination(identity, DROIT, 'RG-COO-265') // RG-COO-265 : droit « colis.gerer » comme ECR-EXP-01 / 02
  const ateliers = (await ateliersDuPerimetre(db, identity)).filter(
    (a) => q.atelier === undefined || a.id === q.atelier,
  )
  const depuis = q.depart
    ? null
    : formatSemaineIso(semaineIsoDe(new Date(maintenant.getTime() - FENETRE_JOURS * JOUR_MS)))
  const dansLaFenetre = (depart: string) =>
    q.depart
      ? depart === q.depart
      : comparerSemaines(lireSemaineIso(depart), lireSemaineIso(depuis ?? depart)) >= 0
  const filtreDest = q.destinataire?.toLowerCase()

  interface Groupe {
    depart: string
    destinataireId: number
    destinataire: string
    plateforme: string
    departLe: Date | null
    nb: Record<Statut, number>
  }
  const groupes = new Map<string, Groupe>()
  const ajouter = (
    depart: string,
    dest: { id: number; nom: string },
    plateforme: string,
    statut: Statut,
    departLe: Date | null,
  ) => {
    if (!dansLaFenetre(depart)) return
    if (filtreDest && !dest.nom.toLowerCase().includes(filtreDest)) return
    const cle = `${depart}|${String(dest.id)}|${plateforme}`
    const g = groupes.get(cle) ?? {
      depart,
      destinataireId: dest.id,
      destinataire: dest.nom,
      plateforme,
      departLe: null,
      nb: { attente: 0, cours: 0, colisee: 0 },
    }
    g.nb[statut] += 1
    if (departLe && (!g.departLe || departLe < g.departLe)) g.departLe = departLe
    groupes.set(cle, g)
  }

  // Trains : statut d'unité calculé (EN_ATTENTE ; PRET / EN_PROD / PRODUIT ; COLISE / EXPEDIE / LIVRE).
  const filtreSemaine = q.depart ? lireSemaineIso(q.depart) : undefined
  const faces = await facesDesTrains(db, ateliers, {
    ...(filtreSemaine ? { semaine: filtreSemaine } : {}),
    ...(filtreSemaine
      ? {}
      : { departApres: new Date(maintenant.getTime() - FENETRE_JOURS * JOUR_MS) }),
  })
  const trains = await construireTrains(db, faces, ateliers)
  for (const t of trains) {
    const premiere = t.faces[0]
    if (!premiere || premiere.destinataireId === null) continue
    if (q.dossier !== undefined && !t.faces.some((f) => f.contNum === q.dossier)) continue
    const statut: Statut =
      t.statut === 'EN_ATTENTE'
        ? 'attente'
        : t.statut === 'COLISE' || t.statut === 'EXPEDIE' || t.statut === 'LIVRE'
          ? 'colisee'
          : 'cours'
    ajouter(
      formatSemaineIso(t.semaineDepart),
      { id: premiere.destinataireId, nom: t.destinataire ?? '—' },
      t.atelier?.plateforme ?? '',
      statut,
      t.depart,
    )
  }

  // UM des ateliers fixes, hors Bus (remise directe) ; une UM « Annulé » n'est pas une unité à livrer.
  const types = await lireTypes(db)
  const fixes = ateliers.filter((a) => a.type === 'FIXE')
  const ums = await parPaquets(
    fixes.map((a) => a.id),
    (paquet) =>
      db.uniteManutention.findMany({
        where: {
          atelierId: { in: paquet },
          statut: { in: ['EN_COURS', 'PREPARE', 'A_EXPEDIER', 'TERMINE'] },
          destinataireId: { not: null },
          semAnnee: { not: null },
          semNum: { not: null },
          ...(q.dossier !== undefined ? { contNum: q.dossier } : {}),
        },
        include: { destinataire: true },
      }),
  )
  const plateformeDe = new Map(fixes.map((a) => [a.id, a.plateforme]))
  for (const um of ums) {
    if (um.typePreparationId !== null && types.bus.has(um.typePreparationId)) continue
    if (um.destinataireId === null || um.semAnnee === null || um.semNum === null) continue
    ajouter(
      formatSemaineIso({ annee: um.semAnnee, semaine: um.semNum }),
      {
        id: um.destinataireId,
        nom: um.destinataire ? (um.destinataire.nom ?? um.destinataire.nomOrigine) : '—',
      },
      plateformeDe.get(um.atelierId ?? 0) ?? '',
      um.statut === 'A_EXPEDIER' || um.statut === 'TERMINE' ? 'colisee' : 'cours',
      null,
    )
  }

  const departs: DepartCamionLigne[] = [...groupes.values()]
    .map((g) => {
      const unites = g.nb.attente + g.nb.cours + g.nb.colisee
      const proche =
        g.departLe !== null && g.departLe.getTime() - maintenant.getTime() < SEUIL_CRITIQUE_MS
      const gravite: GraviteDepart =
        g.nb.attente > 0
          ? proche
            ? 'CRITIQUE'
            : 'ATTENTION'
          : g.nb.colisee === unites
            ? 'PRET'
            : 'AUCUNE'
      return {
        depart: g.depart,
        departLe: g.departLe?.toISOString() ?? null,
        destinataire: { id: g.destinataireId, nom: g.destinataire },
        plateforme: g.plateforme,
        unites,
        colisees: g.nb.colisee,
        enCours: g.nb.cours,
        enAttente: g.nb.attente,
        avancement: unites === 0 ? 0 : Math.round((100 * g.nb.colisee) / unites),
        gravite,
      }
    })
    .sort(
      (a, b) =>
        a.depart.localeCompare(b.depart) ||
        a.destinataire.nom.localeCompare(b.destinataire.nom) ||
        a.plateforme.localeCompare(b.plateforme),
    )
  const somme = (cle: 'unites' | 'colisees' | 'enCours' | 'enAttente') =>
    departs.reduce((s, d) => s + d[cle], 0)
  return {
    departs,
    indicateurs: {
      unites: somme('unites'),
      colisees: somme('colisees'),
      enCours: somme('enCours'),
      enAttente: somme('enAttente'),
    },
    depuis,
  }
}
