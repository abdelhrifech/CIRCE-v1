// ECR-NAV-01 : sélecteur de profil de DEV (Q-001 non tranchée). Le choix est un cookie lu par le relais web
// (routes/api/$.ts), qui ne l'honore que hors production et pour un identifiant du catalogue de démo.
// Aucune authentification réelle : jamais en production.
export const COOKIE_PROFIL_DEV = 'circe_dev_user'
export { PROFILS_DEMO as PROFILS_DEV } from '@circe/shared'
import { PROFILS_DEMO as PROFILS_DEV } from '@circe/shared'

/** Les menus de profil ne sont proposés que hors build de production. */
export const PROFIL_DEV_DISPONIBLE = !import.meta.env.PROD

export function profilDevChoisi(): string | null {
  const prise = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_PROFIL_DEV}=`))
    ?.slice(COOKIE_PROFIL_DEV.length + 1)
  return PROFILS_DEV.some((p) => p.identifiant === prise) ? (prise ?? null) : null
}

export function choisirProfilDev(identifiant: string | null): void {
  document.cookie =
    identifiant === null
      ? `${COOKIE_PROFIL_DEV}=; path=/; max-age=0; SameSite=Lax`
      : `${COOKIE_PROFIL_DEV}=${identifiant}; path=/; SameSite=Lax`
}
