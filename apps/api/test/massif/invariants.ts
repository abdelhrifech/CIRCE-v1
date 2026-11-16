// Invariants des JDD massifs (étape 9). Chaque invariant est une requête SQL de VIOLATIONS : zéro ligne attendue.
// Seules les lignes créées depuis le repère (donc par le JDD) sont examinées. Les lectures sont agrégées en SQL
// (aucun paramètre lié : pas de limite de ~1000 paramètres) et les exemples sont limités à 10 lignes.
import type { Db } from '../../src/core/db.ts'
import type { Repere } from '../jdd/purge.ts'
import { TRANSITIONS_AFFICHE, TRANSITIONS_RECEPTION } from '../../src/modules/reception/statuts.ts'
import { TRANSITIONS_DOSSIER } from '../../src/modules/coordination/statuts.ts'
import { statutLigneDe } from '../../src/modules/reception/lignes.ts'

export interface Violation {
  id: string
  regle: string
  description: string
  total: number
  exemples: unknown[]
}

export interface Invariant {
  id: string
  regle: string
  description: string
  /** Retourne les lignes en violation (le contrôleur en garde 10). */
  lire(db: Db, apres: (table: string, alias: string) => string): Promise<unknown[]>
}

const q = <T = Record<string, unknown>>(db: Db, sql: string) => db.$queryRawUnsafe<T[]>(sql)

/** Reçu d'une ligne (Σ liens actifs) et statut attendu (RG-REC-018) : calcul en TS sur des agrégats SQL. */
async function lignesIncoherentes(db: Db, apres: (t: string, a: string) => string) {
  const rows = await q<{
    id: number
    statut: string
    source: string
    qte_bc: number | null
    qte_prepa: number | null
    etat: string
    recu: number | bigint | null
    plt: number
  }>(
    db,
    `SELECT l.id, l.statut, l.source, l.qte_bc, l.qte_prepa, l.etat_ligne AS etat, l.plt_id AS plt,
            (SELECT SUM(a.quantite) FROM asso_affiche_visuel a WHERE a.ligne_attendue_id = l.id AND a.actif = 1) AS recu
     FROM tf_prepa_affiche l WHERE ${apres('tf_prepa_affiche', 'l')}`,
  )
  const parametres = await q<{ plateforme_id: number | null; valeur: string }>(
    db,
    "SELECT plateforme_id, valeur FROM parametre WHERE cle = 'reception.ecartReception'",
  )
  const global = Number(parametres.find((p) => p.plateforme_id === null)?.valeur ?? 10)
  const ecartDe = (plt: number) =>
    Number(parametres.find((p) => p.plateforme_id === plt)?.valeur ?? global)
  const mauvais: unknown[] = []
  for (const l of rows) {
    const attendu =
      (l.source === 'PREPA' ? (l.qte_prepa ?? l.qte_bc) : (l.qte_bc ?? l.qte_prepa)) ?? 0
    const attenduStatut = statutLigneDe(attendu, Number(l.recu ?? 0), ecartDe(l.plt))
    if (attenduStatut !== l.statut)
      mauvais.push({
        ligne: l.id,
        statut: l.statut,
        attendu: attenduStatut,
        recu: Number(l.recu ?? 0),
        qte: attendu,
      })
  }
  return mauvais
}

/** Historique de statut : chaîne continue, dernier « nouveau » = statut courant, transitions de la table quand elle existe. */
async function historiqueIncoherent(
  db: Db,
  apres: (t: string, a: string) => string,
  type: string,
  table: string,
  cle: string,
  statutCol: string,
  transitions?: Record<string, readonly string[]>,
) {
  const hist = await q<{ entite_id: string; ancien: string | null; nouveau: string }>(
    db,
    `SELECT h.entite_id, h.ancien, h.nouveau FROM statut_historique h WHERE h.type_entite = '${type}' AND ${apres('statut_historique', 'h')} ORDER BY h.id`,
  )
  const parEntite = new Map<string, { ancien: string | null; nouveau: string }[]>()
  for (const h of hist) parEntite.set(h.entite_id, [...(parEntite.get(h.entite_id) ?? []), h])
  const courants = new Map<string, string>(
    (
      await q<{ k: string | number; s: string }>(
        db,
        `SELECT ${cle} AS k, ${statutCol} AS s FROM ${table} WHERE ${apres(table, table)}`,
      )
    ).map((r) => [String(r.k), r.s]),
  )
  const mauvais: unknown[] = []
  for (const [id, suite] of parEntite) {
    const courant = courants.get(id)
    if (courant === undefined) continue // entité antérieure au repère ou d'un autre type de clé
    const dernier = suite[suite.length - 1]
    if (dernier && dernier.nouveau !== courant)
      mauvais.push({ entite: id, type, courant, dernierHistorique: dernier.nouveau })
    for (let i = 1; i < suite.length; i++) {
      const prec = suite[i - 1]
      const cur = suite[i]
      if (prec && cur && cur.ancien !== null && cur.ancien !== prec.nouveau)
        mauvais.push({
          entite: id,
          type,
          rupture: `${prec.nouveau} puis ancien=${cur.ancien}`,
        })
    }
    if (transitions)
      for (const h of suite)
        if (
          h.ancien !== null &&
          h.ancien !== h.nouveau &&
          !(transitions[h.ancien] ?? []).includes(h.nouveau)
        )
          mauvais.push({ entite: id, type, transitionInterdite: `${h.ancien} -> ${h.nouveau}` })
  }
  return mauvais
}

export const INVARIANTS: Invariant[] = [
  // ───────── Intégrité ─────────
  {
    id: 'INV-001',
    regle: 'CLAUDE.md §6 (FK)',
    description: 'aucune clé étrangère orpheline',
    lire: (db) => q(db, 'PRAGMA foreign_key_check'),
  },
  {
    id: 'INV-002',
    regle: 'RG-COO-080',
    description: 'une seule ligne attendue ACTIVE par (site, dossier, thème)',
    lire: (db, a) =>
      q(
        db,
        `SELECT l.plt_id, l.cont_num, l.theme_cle, COUNT(*) AS n FROM tf_prepa_affiche l WHERE ${a('tf_prepa_affiche', 'l')} AND l.etat_ligne = 'ACTIVE' AND l.cont_num IS NOT NULL GROUP BY l.plt_id, l.cont_num, l.theme_cle, l.repiquage HAVING COUNT(*) > 1`,
      ),
  },
  {
    id: 'INV-003',
    regle: 'RG-COO-261',
    description: 'code barre d’UM et code de colis uniques ; un seul lien UM × colis',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT "UM_code_barre" AS code, COUNT(*) AS n FROM "tf_UM" u WHERE ${a('tf_UM', 'u')} AND "UM_code_barre" IS NOT NULL GROUP BY "UM_code_barre" HAVING COUNT(*) > 1`,
      )),
      ...(await q(
        db,
        `SELECT colis_code AS code, COUNT(*) AS n FROM tf_colis c WHERE ${a('tf_colis', 'c')} AND colis_code IS NOT NULL GROUP BY colis_code HAVING COUNT(*) > 1`,
      )),
      ...(await q(
        db,
        `SELECT "UM_id", colis_id, COUNT(*) AS n FROM "tf_UM_colis" uc WHERE ${a('tf_UM_colis', 'uc')} GROUP BY "UM_id", colis_id HAVING COUNT(*) > 1`,
      )),
    ],
  },
  {
    id: 'INV-004',
    regle: 'RG-COO-001',
    description: 'un seul dossier par numéro, un seul utilisateur par identifiant',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT cont_num, COUNT(*) AS n FROM dossier d WHERE ${a('dossier', 'd')} GROUP BY cont_num HAVING COUNT(*) > 1`,
      )),
      ...(await q(
        db,
        `SELECT identifiant_externe, COUNT(*) AS n FROM utilisateur u WHERE ${a('utilisateur', 'u')} GROUP BY identifiant_externe HAVING COUNT(*) > 1`,
      )),
    ],
  },
  // ───────── Historique de statut (CLAUDE.md §6) ─────────
  {
    id: 'INV-010',
    regle: 'CLAUDE.md §6',
    description:
      'historique des réceptions : chaîne continue, dernier statut = statut courant, transitions de la table',
    lire: (db, a) =>
      historiqueIncoherent(db, a, 'RECEPTION', 'reception', 'id', 'statut', TRANSITIONS_RECEPTION),
  },
  {
    id: 'INV-011',
    regle: 'CLAUDE.md §6',
    description:
      'historique des affiches : chaîne continue, dernier statut = statut courant, transitions de la table',
    lire: (db, a) =>
      historiqueIncoherent(
        db,
        a,
        'AFFICHE',
        'affiche',
        'affiche_id',
        'statut',
        TRANSITIONS_AFFICHE,
      ),
  },
  {
    id: 'INV-012',
    regle: 'RG-REC-018',
    description:
      'historique des lignes attendues : chaîne continue, dernier statut = statut courant',
    lire: (db, a) =>
      historiqueIncoherent(db, a, 'LIGNE_ATTENDUE', 'tf_prepa_affiche', 'id', 'statut'),
  },
  {
    id: 'INV-013',
    regle: 'RG-COO-061',
    description:
      'historique des dossiers (clé = n° de dossier) et des instructions : dernier statut = statut courant',
    lire: async (db, a) => [
      ...(await historiqueIncoherent(
        db,
        a,
        'DOSSIER',
        'dossier',
        'cont_num',
        'statut',
        TRANSITIONS_DOSSIER,
      )),
      ...(await historiqueIncoherent(
        db,
        a,
        'INSTRUCTION',
        'instruction_train',
        'instr_code',
        'statut',
      )),
    ],
  },
  {
    id: 'INV-014',
    regle: 'RG-COO-266',
    description:
      'historique des UM, colis, répartitions et faces : dernier statut = statut courant',
    lire: async (db, a) => [
      ...(await historiqueIncoherent(db, a, 'UNITE_MANUTENTION', 'tf_UM', '"UM_id"', 'statut')),
      ...(await historiqueIncoherent(db, a, 'COLIS', 'tf_colis', 'colis_id', 'statut')),
      ...(await historiqueIncoherent(db, a, 'REPARTITION', 'tf_repart_calcul', 'rpc_id', 'statut')),
      ...(await historiqueIncoherent(db, a, 'FACE_TRAIN', 'tf_face_train', 'ft_id', 'statut')),
    ],
  },
  {
    id: 'INV-015',
    regle: 'RG-REC-018',
    description:
      'toute ligne attendue qui n’est plus « Attendue » a au moins une entrée d’historique',
    lire: (db, a) =>
      q(
        db,
        `SELECT l.id, l.statut FROM tf_prepa_affiche l WHERE ${a('tf_prepa_affiche', 'l')} AND l.statut <> 'ATTENDUE' AND NOT EXISTS (SELECT 1 FROM statut_historique h WHERE h.type_entite = 'LIGNE_ATTENDUE' AND h.entite_id = CAST(l.id AS TEXT))`,
      ),
  },
  // ───────── Versions ─────────
  {
    id: 'INV-020',
    regle: 'CLAUDE.md §6 (verrou optimiste)',
    description:
      'version ≥ 1 et ≥ 1 + nombre de changements de statut historisés (les versions ne reculent jamais, aucun trou apparent)',
    lire: async (db, a) => {
      const tables: [string, string, string, string][] = [
        ['reception', 'id', 'RECEPTION', 'id'],
        ['affiche', 'affiche_id', 'AFFICHE', 'affiche_id'],
        ['tf_prepa_affiche', 'id', 'LIGNE_ATTENDUE', 'id'],
        ['tf_colis', 'colis_id', 'COLIS', 'colis_id'],
        ['tf_UM', '"UM_id"', 'UNITE_MANUTENTION', '"UM_id"'],
        ['tf_repart_calcul', 'rpc_id', 'REPARTITION', 'rpc_id'],
      ]
      const r: unknown[] = []
      for (const [table, pk, type] of tables) {
        r.push(
          ...(await q(
            db,
            `SELECT '${table}' AS "table", t.${pk} AS id, t.version, (SELECT COUNT(*) FROM statut_historique h WHERE h.type_entite = '${type}' AND h.entite_id = CAST(t.${pk} AS TEXT) AND h.ancien IS NOT NULL) AS transitions
             FROM ${table} t WHERE ${a(table, 't')} AND (t.version < 1 OR t.version < 1 + (SELECT COUNT(*) FROM statut_historique h WHERE h.type_entite = '${type}' AND h.entite_id = CAST(t.${pk} AS TEXT) AND h.ancien IS NOT NULL))`,
          )),
        )
      }
      return r
    },
  },
  // ───────── Quantités de réception ─────────
  {
    id: 'INV-030',
    regle: 'RG-REC-017 / RG-REC-018',
    description: 'ligne attendue : statut = f(attendu, reçu = Σ liens actifs)',
    lire: (db, a) => lignesIncoherentes(db, a),
  },
  {
    id: 'INV-031',
    regle: 'RG-REC-151',
    description: 'stock d’une affiche = Σ de ses mouvements, jamais négatif',
    lire: (db, a) =>
      q(
        db,
        `SELECT m.affiche_id, SUM(m.quantite) AS stock FROM mouvement m WHERE ${a('mouvement', 'm')} GROUP BY m.affiche_id HAVING SUM(m.quantite) < 0`,
      ),
  },
  {
    id: 'INV-032',
    regle: 'RG-REC-153',
    description:
      'sens des mouvements : réception / complément / ajout positifs ; rebut / sortie / expédition / renvoi / destruction négatifs',
    lire: (db, a) =>
      q(
        db,
        `SELECT m.mouvement_id, m.type, m.quantite FROM mouvement m WHERE ${a('mouvement', 'm')} AND ((m.type IN ('RECEPTION','COMPLEMENT','AJOUT_MANUEL') AND m.quantite <= 0) OR (m.type IN ('MISE_AU_REBUT','SORTIE_MANUELLE','EXPEDITION','RENVOI','DESTRUCTION') AND m.quantite >= 0))`,
      ),
  },
  {
    id: 'INV-033',
    regle: 'RG-X-060',
    description:
      'Σ liens actifs d’une affiche ≤ reçu cumulé (Σ réception, complément, écart, ajout, fusion ; un rebut ou une expédition ne réduit pas le reçu, Q-401), avec le minimum d’1 par lien actif (Q-178 / Q-416)',
    lire: (db, a) =>
      q(
        db,
        `SELECT af.affiche_id, (SELECT COALESCE(SUM(m.quantite),0) FROM mouvement m WHERE m.affiche_id = af.affiche_id AND m.type IN ('RECEPTION','COMPLEMENT','ECART_CONTROLE','AJOUT_MANUEL','FUSION')) AS recu_cumule,
                    (SELECT COALESCE(SUM(v.quantite),0) FROM asso_affiche_visuel v WHERE v.affiche_id = af.affiche_id AND v.actif = 1) AS liens
             FROM affiche af WHERE ${a('affiche', 'af')} AND (SELECT COALESCE(SUM(v.quantite),0) FROM asso_affiche_visuel v WHERE v.affiche_id = af.affiche_id AND v.actif = 1)
               > MAX((SELECT COALESCE(SUM(m.quantite),0) FROM mouvement m WHERE m.affiche_id = af.affiche_id AND m.type IN ('RECEPTION','COMPLEMENT','ECART_CONTROLE','AJOUT_MANUEL','FUSION')),
                     (SELECT COUNT(*) FROM asso_affiche_visuel v WHERE v.affiche_id = af.affiche_id AND v.actif = 1))`,
      ),
  },
  {
    id: 'INV-034',
    regle: 'RG-REC-009 / RG-REC-151 / ANO-004',
    description: 'la quantité en cache (affiche.quantite) = stock = Σ de tous les mouvements',
    lire: (db, a) =>
      q(
        db,
        `SELECT af.affiche_id, af.quantite AS cache, (SELECT COALESCE(SUM(m.quantite),0) FROM mouvement m WHERE m.affiche_id = af.affiche_id) AS somme
             FROM affiche af WHERE ${a('affiche', 'af')} AND af.quantite <> (SELECT COALESCE(SUM(m.quantite),0) FROM mouvement m WHERE m.affiche_id = af.affiche_id)`,
      ),
  },
  {
    id: 'INV-035',
    regle: 'RG-REC-037',
    description:
      'toute réception non inconnue a une livraison et au moins une affiche ; chaque affiche liée à une livraison est de sa réception',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT r.id, 'sans livraison' AS pb FROM reception r WHERE ${a('reception', 'r')} AND r.est_inconnue = 0 AND r.livraison_id IS NULL`,
      )),
      ...(await q(
        db,
        `SELECT r.id, 'sans affiche' AS pb FROM reception r WHERE ${a('reception', 'r')} AND NOT EXISTS (SELECT 1 FROM affiche af WHERE af.reception_id = r.id) AND NOT EXISTS (SELECT 1 FROM asso_livraison_affiche la WHERE la."Id_livraison" = r.livraison_id)`,
      )),
    ],
  },
  // ───────── Cohérence Réception ↔ Coordination ─────────
  {
    id: 'INV-040',
    regle: 'RG-X-058 / K-03',
    description:
      'une affiche validée est IDENTIFIEE et a au moins un lien actif ; une affiche ORPHELINE n’a ni lien actif ni validation',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT af.affiche_id, af.statut, 'validée sans lien actif ou orpheline' AS pb FROM affiche af WHERE ${a('affiche', 'af')} AND af.validation_admin = 1 AND (af.statut <> 'IDENTIFIEE' OR NOT EXISTS (SELECT 1 FROM asso_affiche_visuel v WHERE v.affiche_id = af.affiche_id AND v.actif = 1))`,
      )),
      ...(await q(
        db,
        `SELECT af.affiche_id, 'orpheline avec lien actif' AS pb FROM affiche af WHERE ${a('affiche', 'af')} AND af.statut = 'ORPHELINE' AND EXISTS (SELECT 1 FROM asso_affiche_visuel v WHERE v.affiche_id = af.affiche_id AND v.actif = 1)`,
      )),
      ...(await q(
        db,
        `SELECT af.affiche_id, 'identifiée sans lien actif' AS pb FROM affiche af WHERE ${a('affiche', 'af')} AND af.statut = 'IDENTIFIEE' AND NOT EXISTS (SELECT 1 FROM asso_affiche_visuel v WHERE v.affiche_id = af.affiche_id AND v.actif = 1)`,
      )),
    ],
  },
  {
    id: 'INV-041',
    regle: 'RG-REC-071 / RG-REC-114 / Q-108 / Q-180',
    description:
      'réception « À identifier » ⇒ elle porte une affiche ORPHELINE ; une réception dont toutes les affiches sont orphelines est « À identifier » (une palette à plusieurs affiches garde son statut tant qu’une affiche reste rattachée, Q-180) ; « Contrôlée » ⇒ date de contrôle',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT r.id, r.statut, 'A_IDENTIFIER sans affiche orpheline' AS pb FROM reception r WHERE ${a('reception', 'r')} AND r.statut = 'A_IDENTIFIER' AND NOT EXISTS (SELECT 1 FROM affiche af WHERE af.reception_id = r.id AND af.statut = 'ORPHELINE')`,
      )),
      ...(await q(
        db,
        `SELECT r.id, r.statut, 'orpheline sur une réception non « À identifier »' AS pb FROM reception r WHERE ${a('reception', 'r')} AND r.statut <> 'A_IDENTIFIER' AND EXISTS (SELECT 1 FROM affiche af WHERE af.reception_id = r.id AND af.statut = 'ORPHELINE') AND NOT EXISTS (SELECT 1 FROM affiche af WHERE af.reception_id = r.id AND af.statut = 'IDENTIFIEE')`,
      )),
      ...(await q(
        db,
        `SELECT r.id, r.statut, 'contrôlée sans date' AS pb FROM reception r WHERE ${a('reception', 'r')} AND r.statut = 'CONTROLEE' AND r.controle_le IS NULL`,
      )),
    ],
  },
  {
    id: 'INV-042',
    regle: 'RG-X-019 / RG-REC-001',
    description:
      'un lien actif relie une affiche et une ligne du MÊME site ; un lien actif n’a pas de date de retrait, un lien retiré en a une',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT v.id, 'sites différents' AS pb FROM asso_affiche_visuel v JOIN affiche af ON af.affiche_id = v.affiche_id JOIN tf_prepa_affiche l ON l.id = v.ligne_attendue_id WHERE ${a('asso_affiche_visuel', 'v')} AND af.plt_id <> l.plt_id`,
      )),
      ...(await q(
        db,
        `SELECT v.id, 'dates de retrait incohérentes' AS pb FROM asso_affiche_visuel v WHERE ${a('asso_affiche_visuel', 'v')} AND ((v.actif = 1 AND v.retire_le IS NOT NULL) OR (v.actif = 0 AND v.retire_le IS NULL))`,
      )),
    ],
  },
  {
    id: 'INV-043',
    regle: 'RG-X-065 / RG-COO-087',
    description:
      'un dossier ANNULÉ n’a plus aucune ligne attendue ACTIVE ; ses affiches reçues restent en stock',
    lire: (db, a) =>
      q(
        db,
        `SELECT d.cont_num, l.id AS ligne FROM dossier d JOIN tf_prepa_affiche l ON l.cont_num = d.cont_num WHERE ${a('dossier', 'd')} AND d.statut = 'ANNULE' AND l.etat_ligne = 'ACTIVE'`,
      ),
  },
  {
    id: 'INV-044',
    regle: 'RG-COO-210',
    description:
      'une face « A imprimer » / « Préparé » / « A expédier » / « Terminé » / « Export prépa » / « Au roulage » appartient à une instruction « Prêt à produire » exportée',
    lire: (db, a) =>
      q(
        db,
        `SELECT f.ft_id, f.statut AS face, i.statut AS instruction FROM tf_face_train f JOIN instruction_train i ON i.instr_code = f.instr_code
             WHERE ${a('tf_face_train', 'f')} AND f.statut IN ('A_IMPRIMER','PREPARE','A_EXPEDIER','TERMINE','EXPORT_PREPA','AU_ROULAGE') AND (i.statut <> 'PRET_A_PRODUIRE' OR i.exporte_le IS NULL)`,
      ),
  },
  {
    id: 'INV-045',
    regle: 'RG-COO-044 / RG-COO-210',
    description:
      'une instruction « Instruction OK » ou « Prêt à produire » a son mode d’Instruction OK ; « Prêt à produire » a sa date d’export',
    lire: (db, a) =>
      q(
        db,
        `SELECT i.instr_code, i.statut FROM instruction_train i WHERE ${a('instruction_train', 'i')} AND ((i.statut IN ('INSTRUCTION_OK','PRET_A_PRODUIRE') AND i.iok_mode IS NULL) OR (i.statut = 'PRET_A_PRODUIRE' AND i.exporte_le IS NULL))`,
      ),
  },
  {
    id: 'INV-046',
    regle: 'RG-COO-167',
    description:
      'une face est sur le même site que son instruction ; toutes les faces d’un train partagent atelier et départ',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT f.ft_id, 'site de la face ≠ site de l’instruction' AS pb FROM tf_face_train f JOIN instruction_train i ON i.instr_code = f.instr_code JOIN tr_atelier af ON af.id = f.ate_id JOIN tr_atelier ai ON ai.id = i.ate_id WHERE ${a('tf_face_train', 'f')} AND af.plt_id <> ai.plt_id`,
      )),
      ...(await q(
        db,
        `SELECT f.train_id, 'train à plusieurs ateliers ou départs' AS pb FROM tf_face_train f WHERE ${a('tf_face_train', 'f')} AND f.train_id IS NOT NULL GROUP BY f.train_id HAVING COUNT(DISTINCT f.ate_id) > 1 OR COUNT(DISTINCT f.dep_sembas || '-' || f.dep_anbas) > 1`,
      )),
    ],
  },
  // ───────── UM et colis ─────────
  {
    id: 'INV-050',
    regle: 'RG-COO-260 / 261 / 239',
    description:
      'quantité d’une UM = Σ des quantités de ses lignes de répartition actives tant qu’aucune de ses lignes n’a vu sa quantité modifiée après le Colisage (modification autorisée « En cours », Q-418 / ANO-063 ouverte) ; code barre présent',
    lire: (db, a) =>
      q(
        db,
        `SELECT u."UM_id", u."UM_qte" AS qte, (SELECT COALESCE(SUM(r.rpc_qte),0) FROM tf_repart_calcul r WHERE r."UM_id" = u."UM_id" AND r.rpc_retire = 0) AS somme, u."UM_code_barre" AS code
         FROM "tf_UM" u WHERE ${a('tf_UM', 'u')} AND (u."UM_code_barre" IS NULL OR (
           u."UM_qte" <> (SELECT COALESCE(SUM(r.rpc_qte),0) FROM tf_repart_calcul r WHERE r."UM_id" = u."UM_id" AND r.rpc_retire = 0)
           AND NOT EXISTS (SELECT 1 FROM tf_repart_calcul r JOIN journal_audit j ON j.type_entite = 'REPARTITION' AND j.entite_id = CAST(r.rpc_id AS TEXT) AND j.action = 'MODIFICATION_QUANTITE_UNITE' WHERE r."UM_id" = u."UM_id")))`,
      ),
  },
  {
    id: 'INV-051',
    regle: 'RG-COO-264 / 265',
    description:
      'Σ des quantités placées en colis ≤ quantité de l’UM ; le colis et l’UM ont le même destinataire et le même site',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT u."UM_id", u."UM_qte" AS qte, SUM(uc.uc_qte) AS placee FROM "tf_UM" u JOIN "tf_UM_colis" uc ON uc."UM_id" = u."UM_id" WHERE ${a('tf_UM', 'u')} GROUP BY u."UM_id", u."UM_qte" HAVING SUM(uc.uc_qte) > u."UM_qte"`,
      )),
      ...(await q(
        db,
        `SELECT uc.id, 'destinataire ou site différent' AS pb FROM "tf_UM_colis" uc JOIN "tf_UM" u ON u."UM_id" = uc."UM_id" JOIN tf_colis c ON c.colis_id = uc.colis_id JOIN tr_atelier au ON au.id = u.ate_id WHERE ${a('tf_UM_colis', 'uc')} AND (u.dest_id <> c.dest_id OR au.plt_id <> c.plt_id OR u.ate_id <> c.ate_id)`,
      )),
    ],
  },
  {
    id: 'INV-052',
    regle: 'RG-COO-266',
    description:
      'colis « A expédier » / « Terminé » : date de clôture et au moins une UM ou un train ; UM d’un colis clos = « A expédier » (colis clos) ou « Terminé » (colis expédié)',
    lire: async (db, a) => [
      ...(await q(
        db,
        `SELECT c.colis_id, c.statut, 'clos sans date ou vide' AS pb FROM tf_colis c WHERE ${a('tf_colis', 'c')} AND c.statut IN ('A_EXPEDIER','TERMINE') AND (c.colis_dat_expe IS NULL OR (NOT EXISTS (SELECT 1 FROM "tf_UM_colis" uc WHERE uc.colis_id = c.colis_id) AND NOT EXISTS (SELECT 1 FROM tf_face_train f WHERE f.colis_id = c.colis_id)))`,
      )),
      ...(await q(
        db,
        `SELECT c.colis_id, c.statut AS colis, u.statut AS um, 'UM incompatible avec son colis' AS pb FROM tf_colis c JOIN "tf_UM_colis" uc ON uc.colis_id = c.colis_id JOIN "tf_UM" u ON u."UM_id" = uc."UM_id" WHERE ${a('tf_colis', 'c')} AND ((c.statut = 'A_EXPEDIER' AND u.statut NOT IN ('A_EXPEDIER')) OR (c.statut = 'TERMINE' AND u.statut NOT IN ('TERMINE')))`,
      )),
    ],
  },
  {
    id: 'INV-053',
    regle: 'RG-X-087',
    description:
      'les sorties de stock « Expédition » sont automatiques, négatives, et ne dépassent pas ce qui a été reçu',
    lire: (db, a) =>
      q(
        db,
        `SELECT m.affiche_id, SUM(CASE WHEN m.type = 'EXPEDITION' THEN -m.quantite ELSE 0 END) AS sorties, SUM(CASE WHEN m.quantite > 0 THEN m.quantite ELSE 0 END) AS entrees
             FROM mouvement m WHERE ${a('mouvement', 'm')} GROUP BY m.affiche_id HAVING SUM(CASE WHEN m.type = 'EXPEDITION' THEN -m.quantite ELSE 0 END) > SUM(CASE WHEN m.quantite > 0 THEN m.quantite ELSE 0 END)
             UNION ALL SELECT m.affiche_id, 0, 0 FROM mouvement m WHERE ${a('mouvement', 'm')} AND m.type = 'EXPEDITION' AND m.auto = 0`,
      ),
  },
  {
    id: 'INV-054',
    regle: 'RG-X-087',
    description:
      'au total, les sorties de stock « Expédition » ne dépassent pas la quantité des UM « Terminé » (une sortie par unité expédiée, jamais plus)',
    lire: (db, a) =>
      q(
        db,
        `SELECT s.sorties, u.expediees FROM
           (SELECT COALESCE(SUM(-m.quantite), 0) AS sorties FROM mouvement m WHERE ${a('mouvement', 'm')} AND m.type = 'EXPEDITION') s,
           (SELECT COALESCE(SUM(u."UM_qte"), 0) AS expediees FROM "tf_UM" u WHERE ${a('tf_UM', 'u')} AND u.statut = 'TERMINE') u
         WHERE s.sorties > u.expediees`,
      ),
  },
]

export interface ResultatInvariants {
  violations: Violation[]
  verifies: number
}

/** Exécute tous les invariants sur les lignes créées depuis le repère. */
export async function controlerInvariants(db: Db, repere: Repere): Promise<ResultatInvariants> {
  const apres = (table: string, alias: string) => `${alias}.rowid > ${String(repere[table] ?? 0)}`
  const violations: Violation[] = []
  for (const inv of INVARIANTS) {
    const lignes = await inv.lire(db, apres)
    if (lignes.length > 0)
      violations.push({
        id: inv.id,
        regle: inv.regle,
        description: inv.description,
        total: lignes.length,
        exemples: lignes
          .slice(0, 10)
          .map(
            (l) =>
              JSON.parse(
                JSON.stringify(l, (_k, v: unknown) => (typeof v === 'bigint' ? Number(v) : v)),
              ) as unknown,
          ),
      })
  }
  return { violations, verifies: INVARIANTS.length }
}
