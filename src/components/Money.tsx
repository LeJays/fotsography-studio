import React from 'react'
import { formatAmount } from '../../shared/money'
import { useAuth } from '../context/AuthContext'
import { cn } from './ui'

/**
 * Montant monétaire : n'affiche la valeur qu'aux utilisateurs autorisés (admin).
 * Les autres voient un tiret discret — cf. règle « assistant = pilotage sans données financières ».
 */
export const Money: React.FC<{ value: number | null | undefined; className?: string }> = ({
  value,
  className,
}) => {
  const { isAdmin } = useAuth()

  if (!isAdmin) {
    return (
      <span className={cn('text-studio-dark/35', className)} title="Montant réservé à l’administrateur">
        —
      </span>
    )
  }

  return <span className={className}>{formatAmount(value ?? 0)}</span>
}
