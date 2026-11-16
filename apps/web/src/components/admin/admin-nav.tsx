import { Link } from '@tanstack/react-router'

// ECR-ADM-01 / 04 / 05 / 07 + D-01 / 03 / 04 / 08 — navigation de l'administration.
export function AdminNav() {
  const lien = (
    to:
      | '/admin/parametres'
      | '/admin/sites'
      | '/admin/utilisateurs'
      | '/admin/referentiels'
      | '/admin/plateformes'
      | '/admin/alertes',
    libelle: string,
  ) => (
    <Link to={to} className="underline" activeProps={{ className: 'font-semibold underline' }}>
      {libelle}
    </Link>
  )
  return (
    <nav aria-label="Administration" className="mt-2 flex flex-wrap gap-4 text-sm">
      {lien('/admin/parametres', 'Règles métier')}
      {lien('/admin/sites', 'Sites et ateliers')}
      {lien('/admin/utilisateurs', 'Utilisateurs')}
      {lien('/admin/referentiels', 'Référentiels de réception')}
      {lien('/admin/plateformes', 'Plateformes')}
      {lien('/admin/alertes', 'Alertes et mails')}
    </nav>
  )
}
