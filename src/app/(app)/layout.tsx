// src/app/(app)/layout.tsx
import { MenuInferior } from '@/components/shared/MenuInferior'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50" style={{ height: '100dvh' }}>
      {/* Conteúdo com scroll */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Menu fixo na parte inferior */}
      <MenuInferior />
    </div>
  )
}