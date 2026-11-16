import { z } from 'zod'

// Étape 8, lot 4 — D-19 file d'envoi des mails (EX-TRA-030, RG-ADM-043 à 045 provisoires, Q-375) et D-20 traitements
// planifiés (EX-REC-512, RG-COO-269, RG-COO-042, Q-005, Q-006). Hypothèses : Q-409, Q-410.

const n = z.number().int()

// ───────────────────────────── D-19 : file d'envoi des mails ─────────────────────────────

export const TYPES_MAIL = [
  'COLIS_EXPEDIE',
  'DEBLOCAGE',
  'CORRECTION_BROADCAST',
  'CORRECTION_INTITULE',
] as const
export const TypeMailSchema = z.enum(TYPES_MAIL)
export type TypeMail = z.infer<typeof TypeMailSchema>

export const STATUTS_MAIL = ['EN_ATTENTE', 'EN_COURS', 'ENVOYE', 'ECHEC'] as const
export const StatutMailSchema = z.enum(STATUTS_MAIL)
export type StatutMail = z.infer<typeof StatutMailSchema>

export const MailFileSchema = z.object({
  id: n,
  type: TypeMailSchema,
  statut: StatutMailSchema,
  destinataires: z.array(z.string()),
  sujet: z.string(),
  corps: z.string(),
  tentatives: n,
  derniereErreur: z.string().nullable(),
  /** SIMULE : boîte d'envoi de développement, aucun mail réel. */
  canal: z.enum(['SIMULE', 'SMTP']).nullable(),
  sourceType: z.string().nullable(),
  sourceId: n.nullable(),
  creeLe: z.string(),
  envoyeLe: z.string().nullable(),
  version: n,
})
export type MailFile = z.infer<typeof MailFileSchema>

export const MailsQuerySchema = z.object({
  statut: StatutMailSchema.optional(),
  type: TypeMailSchema.optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
})
export const ListeMailsSchema = z.object({
  mails: z.array(MailFileSchema),
  total: n,
  /** Canal de l'adaptateur actif : SIMULE tant que le SMTP n'est pas configuré. */
  canalActif: z.enum(['SIMULE', 'SMTP']),
  parStatut: z.record(z.string(), n),
})
export type ListeMails = z.infer<typeof ListeMailsSchema>

export const ResultatTraitementMailsSchema = z.object({
  envoyes: n,
  echecs: n,
  restants: n,
  canal: z.enum(['SIMULE', 'SMTP']),
  message: z.string(),
})
export type ResultatTraitementMails = z.infer<typeof ResultatTraitementMailsSchema>

export const RelancerMailSchema = z.object({ version: n.positive() })

// ───────────────────────────── D-20 : traitements planifiés ─────────────────────────────

export const NOMS_TACHES = [
  'FIN_JOURNEE_COLIS',
  'PURGE_ATTENDUES',
  'INSTRUCTION_OK_AUTO',
  'ENVOI_MAILS',
] as const
export const NomTacheSchema = z.enum(NOMS_TACHES)
export type NomTache = z.infer<typeof NomTacheSchema>

export const ExecutionTacheSchema = z.object({
  id: n,
  tache: NomTacheSchema,
  declencheur: z.enum(['PLANIFIE', 'MANUEL', 'COMMANDE']),
  par: z.string().nullable(),
  statut: z.enum(['EN_COURS', 'SUCCES', 'ECHEC']),
  debut: z.string(),
  fin: z.string().nullable(),
  message: z.string().nullable(),
  resultat: z.unknown().nullable(),
})
export type ExecutionTache = z.infer<typeof ExecutionTacheSchema>

export const TacheSchema = z.object({
  nom: NomTacheSchema,
  libelle: z.string(),
  regle: z.string(),
  /** Clé du paramètre (D-06) qui porte les horaires ; vide = tâche désactivée. */
  parametre: z.string(),
  horaires: z.array(z.string()),
  active: z.boolean(),
  derniere: ExecutionTacheSchema.nullable(),
})
export const ListeTachesSchema = z.object({
  taches: z.array(TacheSchema),
  /** Ordonnanceur interne démarré (variable ORDONNANCEUR_ACTIF) ; sans effet tant que les horaires sont vides. */
  ordonnanceurActif: z.boolean(),
})
export type ListeTaches = z.infer<typeof ListeTachesSchema>

export const TacheParamSchema = z.object({ tache: NomTacheSchema })
export const ExecutionsQuerySchema = z.object({
  tache: NomTacheSchema.optional(),
  limite: z.coerce.number().int().min(1).max(200).default(50),
})
export const ListeExecutionsSchema = z.object({ executions: z.array(ExecutionTacheSchema) })
