import { Construction } from 'lucide-react'
import type { AppSection } from '../lib/sections'
import { contentClass } from './ui'

interface SectionPlaceholderProps {
  section: AppSection
}

export function SectionPlaceholder({ section }: SectionPlaceholderProps) {
  return (
    <main className={contentClass}>
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center gap-3 py-6 text-center sm:py-10">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-wine-100">
            <Construction className="h-7 w-7 text-wine-700" />
          </span>
          <h2 className="text-lg font-extrabold text-gray-800">Em construção</h2>
          <p className="max-w-md text-sm text-gray-500">{section.description}</p>
          <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-wine-800">
            {section.label} · em breve
          </span>
        </div>
      </section>
    </main>
  )
}
