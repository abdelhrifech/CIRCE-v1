import { z } from 'zod'
import { SemaineIsoSchema } from './reception/attendues.ts'
import { TrainsQuerySchema, TrainVersionSchema } from './coordination-trains.ts'

// COO-P10 — Export des trains du jeudi (RG-COO-210 à 214), export préparation et « Au roulage » (RG-COO-215 à
// 217), suivi par thème (RG-COO-230 à 233), préparation et rouleur (RG-COO-235, 236), choix des trains du
// générateur de fichiers (ECR-GEN-01). Les fichiers de production réels (format Vendôme .ini, D-15) ne sont pas
// générés : l'export est SIMULÉ (HYPOTHÈSE Q-193), le fichier CSV reprend les colonnes du legacy disponibles.

const n = z.number().int()
const s = z.string().nullable()

// ── Export des trains (ECR-COO-05b) ──

/** RG-COO-211 : aperçu de la modale « Exporter les trains · départ Sxx ». */
export const ExportApercuQuerySchema = z.object({ depart: SemaineIsoSchema })
export const ExportApercuSchema = z.object({
  depart: z.string(),
  /** Dossiers en Instruction OK (AUTO / MANUEL), non annulés, préparation reçue. */
  dossiersExportables: n,
  /** Dossiers dont l'instruction a déjà été exportée (« n déjà exporté(s) »). */
  dejaExportes: n,
  /** Dossiers « En cours » : ils ne partent pas (encadré d'avertissement). */
  dossiersEnCours: z.array(z.object({ dossier: n, annonceur: s })),
  /** Faces « Instruction ok » qui partiraient, et trains correspondants. */
  faces: n,
  trains: n,
})
export type ExportApercu = z.infer<typeof ExportApercuSchema>

/** RG-COO-210 / 213 : export réel ou simulation (aucun statut modifié). */
export const ExporterTrainsSchema = z.object({
  depart: SemaineIsoSchema,
  simulation: z.boolean().default(false),
})
export type ExporterTrains = z.infer<typeof ExporterTrainsSchema>

export const ExportResultatSchema = z.object({
  lot: n,
  simulation: z.boolean(),
  nomFichier: z.string(),
  contenu: z.string(),
  dossiers: n,
  trains: n,
  faces: n,
  /**
   * Audit COO-P10 B1 (Q-193 (1), D-15) : le fichier est SIMULÉ, jamais déposé ni transmis à Surf. À ne pas confondre
   * avec `simulation` (« Simulation export » fonctionnelle : aucun statut modifié).
   */
  fichierSimule: z.boolean(),
  message: z.string(),
})
export type ExportResultat = z.infer<typeof ExportResultatSchema>

/** RG-COO-213 : historique des exports (ExporterTrains). */
export const HistoriqueExportsSchema = z.object({
  exports: z.array(
    z.object({
      id: n,
      nature: z.string(),
      /** « Simulation export » fonctionnelle (aucun statut modifié). */
      simulation: z.boolean(),
      /** Fichier simulé, non déposé (D-15) : distinct de `simulation`. */
      fichierSimule: z.boolean(),
      depart: z.string(),
      nomFichier: z.string(),
      dossiers: n,
      trains: n,
      faces: n,
      par: s,
      le: z.string(),
    }),
  ),
})

/** Contenu d'un fichier déjà généré (téléchargement). */
export const ExportFichierSchema = z.object({ nomFichier: z.string(), contenu: z.string() })

// ── Export préparation, Au roulage, suppression d'un thème de l'export (ECR-COO-07) ──

/** RG-COO-215 / 216 : export préparation (faces 5 ou 9 → 9) des trains choisis. */
export const ExportPreparationSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
})
export type ExportPreparation = z.infer<typeof ExportPreparationSchema>

/** RG-COO-217 : « Au roulage » (faces 9 → 10), rouleur obligatoire. */
export const AuRoulageSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
  rouleurId: n.positive(),
})
export type AuRoulage = z.infer<typeof AuRoulageSchema>

/** RG-COO-217 : suppression d'un thème de l'export préparation (faces 9 → 5). */
export const SupprimerThemeExportSchema = z.object({
  atelierId: n.positive(),
  depart: SemaineIsoSchema,
  contNum: n.positive(),
  theme: z.string().min(1).max(100),
})
export type SupprimerThemeExport = z.infer<typeof SupprimerThemeExportSchema>

// ── Rouleur (RG-COO-236) ──

export const RouleursQuerySchema = z.object({ atelier: z.coerce.number().int().positive() })
export const RouleursSchema = z.object({
  rouleurs: z.array(z.object({ id: n, nom: z.string(), poste: s })),
})
export const AffecterRouleurSchema = z.object({
  trains: z.array(TrainVersionSchema).min(1).max(500),
  rouleurId: n.positive(),
})
export type AffecterRouleur = z.infer<typeof AffecterRouleurSchema>

// ── Suivi par thème (ECR-COO-06) ──

/** RG-COO-230 : mêmes filtres que la liste, sauf Statut (les indicateurs et le besoin l'ignorent). */
export const BesoinThemeQuerySchema = TrainsQuerySchema.omit({ statut: true })
export type BesoinThemeQuery = z.infer<typeof BesoinThemeQuerySchema>

export const LigneBesoinSchema = z.object({
  /** Clé de ligne : atelier|dossier|thème normalisé (sélection, pré-assemblage). */
  cle: z.string(),
  atelierId: n,
  contNum: z.number().int().nullable(),
  annonceur: s,
  theme: s,
  repiquage: s,
  /** Besoin (trains) = somme des « Nb trains » des trains qui portent le thème. */
  besoin: n,
  /** Entretien = quantité des faces d'entretien du thème. */
  entretien: n,
  recu: n,
  attendu: n,
  /** Couvert = reçu ≥ attendu. */
  couvert: z.boolean(),
  emplacement: s,
  preAssemble: z.boolean(),
  /** Empreinte des faces du thème (verrou de version du pré-assemblage, RG-COO-308). */
  version: z.string(),
  /** RG-COO-231 : thème exclu (« ne pas afficher » / « reste en place ») : listé en annotation, hors besoin. */
  exclu: z.boolean(),
})
export type LigneBesoin = z.infer<typeof LigneBesoinSchema>

export const BesoinThemeSchema = z.object({
  semaine: z.object({ annee: n, semaine: n }),
  lignes: z.array(LigneBesoinSchema),
  /** RG-COO-231 : libellés des thèmes exclus (annotation). */
  exclus: z.array(z.string()),
})
export type BesoinTheme = z.infer<typeof BesoinThemeSchema>

/** RG-COO-233 : marquer / désassembler le pré-assemblage des thèmes sélectionnés. */
export const PreAssemblageSchema = z.object({
  themes: z
    .array(
      z.object({
        atelierId: n.positive(),
        depart: SemaineIsoSchema,
        contNum: n.positive(),
        theme: z.string().min(1).max(100),
        version: z.string().min(1).max(60),
      }),
    )
    .min(1)
    .max(500),
  valeur: z.boolean(),
})
export type PreAssemblage = z.infer<typeof PreAssemblageSchema>

// ── Générateur de fichiers (ECR-GEN-01, GEN-03) ──

export const TrainsGenerationQuerySchema = z.object({
  depart: SemaineIsoSchema.optional(),
  atelier: z.coerce.number().int().positive().optional(),
  /** Recherche (ECR-GEN-01) : train, destinataire, afficheur, annonceur ou thème, sans casse ni accents. */
  recherche: z.string().trim().min(1).max(100).optional(),
})
export const TrainGenerationSchema = z.object({
  trainId: z.string(),
  version: z.string(),
  destinataire: s,
  positions: z.array(
    z.object({ lettre: z.string(), etat: z.enum(['OK', 'MANQUANT', 'FRACTIONNE']) }),
  ),
  nb: n,
  /** Tiroirs = visuels distincts du train, positions fractionnées exclues. */
  tiroirs: n,
  /** Clés des visuels (dossier|thème|repiquage) : l'écran en fait l'union pour le compteur « n / 20 tiroirs ». */
  visuels: z.array(z.string()),
  depart: z.string(),
  statut: z.enum(['PRET', 'EN_ATTENTE', 'DEJA_ENVOYE']),
})
export const TrainsGenerationSchema = z.object({
  semaine: z.object({ annee: n, semaine: n }),
  tiroirsMax: n,
  trains: z.array(TrainGenerationSchema),
  indicateurs: z.object({ prets: n, enAttente: n, dejaEnvoyes: n }),
  historique: z.array(
    z.object({
      id: n,
      lot: z.string(),
      depart: z.string(),
      nomFichier: z.string(),
      trains: n,
      tiroirs: n,
      statut: z.string(),
      version: n,
      /** Adaptateur machine de l'envoi (« simulee » en développement), null tant que le lot n'est pas envoyé. */
      machine: s,
      par: s,
      le: z.string(),
      /** ECR-GEN-03 « Fichiers » : nombre de fichiers du lot (un seul fichier Vendôme par lot). */
      fichiers: n,
      /** ECR-GEN-03 « Modifiées depuis » : trains du lot dont la composition a changé depuis la préparation (RG-COO-074). */
      modifiees: n,
      /** Lot d'origine quand ce lot est un complément (« Générer un complément »). */
      complementDe: s,
    }),
  ),
})
export type TrainsGeneration = z.infer<typeof TrainsGenerationSchema>

export const PreparerGenerationSchema = z.object({
  depart: SemaineIsoSchema,
  trains: z.array(TrainVersionSchema).min(1).max(500),
})
export type PreparerGeneration = z.infer<typeof PreparerGenerationSchema>

export const GenerationSchema = z.object({
  id: n,
  lot: z.string(),
  nomFichier: z.string(),
  contenu: z.string(),
  trains: n,
  tiroirs: n,
  statut: z.string(),
  version: n,
  /** Adaptateur machine de l'envoi (« simulee » en développement) ; null tant que le lot n'est pas envoyé. */
  machine: s,
  message: z.string(),
})
export type Generation = z.infer<typeof GenerationSchema>

export const EnvoyerGenerationSchema = z.object({ id: n.positive(), version: n.positive() })
export type EnvoyerGeneration = z.infer<typeof EnvoyerGenerationSchema>

/** « Générer un complément » (ECR-GEN-03, D-15) : `version` = version du lot d'origine (verrou, RG-COO-308). */
export const ComplementGenerationSchema = z.object({ id: n.positive(), version: n.positive() })
export type ComplementGeneration = z.infer<typeof ComplementGenerationSchema>

/** ECR-GEN-03 « Liste de picking » d'un lot : Tiroir, Annonceur, Thème, Quantité, Emplacement. */
export const PickingGenerationSchema = z.object({
  lot: z.string(),
  lignes: z.array(
    z.object({
      tiroir: n,
      annonceur: s,
      theme: s,
      /** Quantité d'affiches rattachée au visuel (HYPOTHÈSE Q-195) ; null si aucune affiche n'est rattachée. */
      quantite: n.nullable(),
      emplacement: s,
    }),
  ),
})
export type PickingGeneration = z.infer<typeof PickingGenerationSchema>
