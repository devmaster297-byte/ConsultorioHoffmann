// src/components/shared/MenuInferior.tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, ClipboardList, ScanLine, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

const itens = [
  { href: '/pacientes', icon: Users, label: 'Pacientes' },
  { href: '/historico', icon: ClipboardList, label: 'Histórico' },
  { href: '/radiografias', icon: ScanLine, label: 'Raio-X' },
  { href: '/financeiro', icon: DollarSign, label: 'Financeiro' },
]

export function MenuInferior() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-gray-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {itens.map(({ href, icon: Icon, label }) => {
        // Ativo se pathname começa com href, exceto /financeiro que não ativa em /financeiro/lancamento
        const ativo =
          href === '/pacientes'
            ? pathname.startsWith('/pacientes')
            : href === '/historico'
            ? pathname.startsWith('/historico')
            : href === '/radiografias'
            ? pathname.startsWith('/radiografias')
            : pathname.startsWith('/financeiro')

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors',
              ativo ? 'text-blue-600' : 'text-gray-400 active:text-gray-600'
            )}
          >
            <Icon className={cn('h-6 w-6', ativo && 'stroke-[2.5]')} />
            <span className={cn('text-[10px] font-medium tracking-tight')}>
              {label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
