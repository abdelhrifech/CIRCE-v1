// Données écrites sur l'affiche par une validation ou une annulation (RG-COO-008 / 014 / 015 / 023 / 030).
// Module sans dépendance métier : utilisé par validation-admin.ts, effets-validation.ts et la Réception.
import type { Identity } from '../../core/identity.ts'
import type { Affiche, Prisma } from '../../generated/prisma/client.ts'

// RG-COO-015 : validée / par / le nominatifs (jamais « Circé ») ; RG-COO-023 : l'étiquette rack est à
// imprimer au passage non validée → validée seulement ; RG-COO-006 / 030 : motifs ANNULEE et THEME effacés.
export function donneesValidation(
  identity: Identity,
  a: Pick<Affiche, 'validationAdmin' | 'etiquetteRackAImprimer'>,
  le: Date,
): Prisma.AfficheUpdateManyMutationInput {
  return {
    validationAdmin: true,
    validationAdminParId: identity.userId,
    validationAdminLe: le,
    validationAnnulee: false,
    themeModifie: false,
    etiquetteRackAImprimer: a.validationAdmin ? a.etiquetteRackAImprimer : true,
  }
}

// RG-COO-014 / RG-X-050 : validée / par / le effacés, motif ANNULEE (ou THEME, RG-COO-030). Aucun effet sur
// l'étiquette déjà imprimée ni à imprimer (RG-COO-023 « aucun effet au décochage », Q-202), ni sur le stock.
export function donneesAnnulation(
  motif: 'ANNULEE' | 'THEME',
): Prisma.AfficheUpdateManyMutationInput {
  return {
    validationAdmin: false,
    validationAdminParId: null,
    validationAdminLe: null,
    ...(motif === 'ANNULEE' ? { validationAnnulee: true } : { themeModifie: true }),
  }
}
