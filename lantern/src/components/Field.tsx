import type { ReactNode } from 'react'

export function Field({
  label,
  htmlFor,
  hint,
  uncertain = false,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  uncertain?: boolean
  children: ReactNode
}) {
  return (
    <div className={`field${uncertain ? ' field-uncertain' : ''}`}>
      <label htmlFor={htmlFor}>
        {label}
        {uncertain && <span className="field-tag">please check</span>}
      </label>
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}
