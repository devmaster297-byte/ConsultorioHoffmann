// src/components/pacientes/PacienteCard.tsx
'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Phone } from 'lucide-react'
import { Paciente } from '@/lib/supabase/types'
import { StatusFinanceiro } from '@/lib/hooks/usePacienteStatus'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { iniciais, formatarTelefone } from '@/lib/utils'

interface Props {
  paciente: Paciente
  status: StatusFinanceiro
}

export function PacienteCard({ paciente, status }: Props) {
  return (
    <Link
      href={`/pacientes/${paciente.id}`}
      className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm active:scale-[0.98] transition-transform"
    >
      {/* Avatar */}
      <div className="relative h-12 w-12 flex-shrink-0">
        {paciente.foto_url ? (
          <Image
            src={paciente.foto_url}
            alt={paciente.nome}
            fill
            className="rounded-full object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
            {iniciais(paciente.nome)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-gray-900">{paciente.nome}</p>
        {paciente.telefone && (
          <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
            <Phone className="h-3 w-3" />
            {formatarTelefone(paciente.telefone)}
          </p>
        )}
      </div>

      {/* Status */}
      <StatusBadge status={status} />
    </Link>
  )
}
