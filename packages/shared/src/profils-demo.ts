// Comptes fictifs de développement uniquement ; aucun nouveau rôle métier.
export const CENTRES_DEMO = [
  { code: 'wissous', nom: 'Wissous' },
  { code: 'nimes', nom: 'Nîmes' },
  { code: 'nanterre', nom: 'Nanterre' },
] as const

export const ROLES_DEMO = [
  { code: 'coord', libelle: 'Coordination' },
  { code: 'cheq', libelle: 'Chef d’équipe' },
  { code: 'recep', libelle: 'Agent de réception' },
  { code: 'expe', libelle: 'Agent d’expédition' },
  { code: 'admin', libelle: 'Administrateur — tous les centres' },
  { code: 'com', libelle: 'Commerce (lecture)' },
] as const

export const PROFILS_DEMO = [
  ...ROLES_DEMO.map((role) => ({
    identifiant: `dev.${role.code}`,
    libelle: role.libelle,
  })),
  ...CENTRES_DEMO.flatMap((centre) =>
    ROLES_DEMO.map((role) => ({
      identifiant: `dev.${role.code}.${centre.code}`,
      libelle: `${role.libelle} · ${centre.nom}`,
    })),
  ),
]
