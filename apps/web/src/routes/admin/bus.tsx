import { createFileRoute } from '@tanstack/react-router'
import { AdminBus } from '../../components/bus/admin.tsx'
import { requirePermission } from '../../lib/session.ts'
export const Route = createFileRoute('/admin/bus')({
  beforeLoad: requirePermission('referentiel.gerer'),
  component: AdminBus,
})
