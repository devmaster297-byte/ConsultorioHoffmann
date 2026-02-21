// src/components/shared/StatusBadge.tsx
import { cn } from '@/lib/utils'
import { StatusFinanceiro } from '@/lib/hooks/usePacienteStatus'

const config = {
  em_dia: { emoji: '🟢', label: 'Em dia', className: 'text-emerald-700 bg-emerald-50' },
  pendente: { emoji: '🟡', label: 'Pendente', className: 'text-amber-700 bg-amber-50' },
  vencido: { emoji: '🔴', label: 'Vencido', className: 'text-red-700 bg-red-50' },
}

interface Props {
  status: StatusFinanceiro
  variant?: 'badge' | 'dot'
}

export function StatusBadge({ status, variant = 'badge' }: Props) {
  const { emoji, label, className } = config[status]

  if (variant === 'dot') {
    return <span title={label}>{emoji}</span>
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        className
      )}
    >
      {emoji} {label}
    </span>
  )
}
