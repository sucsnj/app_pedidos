import type { FlashState } from '../types/app'

export function FlashToast({ flash }: { flash: FlashState | null }) {
  if (!flash) return null
  return (
    <div
      role="status"
      className={`fixed inset-x-0 bottom-4 z-40 mx-auto flex w-[calc(100%-2rem)] max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
        flash.kind === 'error'
          ? 'bg-red-600'
          : flash.kind === 'success'
            ? 'bg-green-600'
            : 'bg-wine-600'
      }`}
    >
      {flash.message}
    </div>
  )
}
