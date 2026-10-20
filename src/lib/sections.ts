import type { LucideIcon } from 'lucide-react'
import { ClipboardList, Settings } from 'lucide-react'

export interface AppSection {
  path: string
  label: string
  icon: LucideIcon
  description: string
  ready: boolean
}

export const ORDERS_PATH = '/orders'
export const MANAGEMENT_PATH = '/management'

export const APP_SECTIONS: AppSection[] = [
  {
    path: ORDERS_PATH,
    label: 'Pedidos',
    icon: ClipboardList,
    description: 'Contagem, digitação e comparativo dos pedidos de abastecimento.',
    ready: true,
  },
  {
    path: MANAGEMENT_PATH,
    label: 'Gestão',
    icon: Settings,
    description: 'Indicadores de vendas e metas, além de cadastros e relatórios gerenciais.',
    ready: true,
  },
]

export const DEFAULT_SECTION_PATH = APP_SECTIONS[0].path

export function findSection(path: string): AppSection | undefined {
  return APP_SECTIONS.find((section) => section.path === path)
}
