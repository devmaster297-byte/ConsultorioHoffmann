// src/components/shared/StatusBadge.tsx
'use client'

import { StatusFinanceiro } from '@/lib/hooks/usePacienteStatus'

interface Props {
  status: StatusFinanceiro
}

const CONFIG: Record<StatusFinanceiro, { label: string; bg: string; color: string; dot: string }> = {
  em_dia:   { label: 'Em dia',   bg: 'var(--hf-success-bg)', color: 'var(--hf-success)', dot: '#4A7C59' },
  pendente: { label: 'Pendente', bg: 'var(--hf-warning-bg)', color: 'var(--hf-warning)', dot: '#C9A96E' },
  vencido:  { label: 'Vencido',  bg: 'var(--hf-danger-bg)',  color: 'var(--hf-danger)',  dot: '#C05050' },
}

export function StatusBadge({ status }: Props) {
  const cfg = CONFIG[status] ?? CONFIG.em_dia
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full flex-shrink-0"
        style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}