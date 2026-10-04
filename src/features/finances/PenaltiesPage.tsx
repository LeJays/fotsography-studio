import { PageHeader } from '../../components/ui'
import { PenaltiesPanel } from './PenaltiesPanel'

/**
 * Suivi des pénalités de retard — accessible à l'administrateur et à l'assistant
 * (consultation des soldes et enregistrement des règlements, partiels compris).
 */
export const PenaltiesPage = () => (
  <div className="space-y-6">
    <PageHeader
      title="Pénalités de retard"
      subtitle="Soldes dus par les membres, tâches pénalisées et traçabilité des règlements."
    />
    <PenaltiesPanel />
  </div>
)