import { createFileRoute } from '@tanstack/react-router'
import { AdminDeclarants } from '../../components/nonconformite/ecrans.tsx'
import { requirePermission } from '../../lib/session.ts'
export const Route = createFileRoute('/admin/declarants')({
  beforeLoad: requirePermission('referentiel.gerer'),
  component: AdminDeclarants,
})
