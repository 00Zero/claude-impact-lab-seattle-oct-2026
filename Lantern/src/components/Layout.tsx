import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

function LanternMark() {
  return (
    <svg className="wordmark-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.5c2 2 3.2 4.1 3.2 6.3a3.2 3.2 0 1 1-6.4 0c0-2.2 1.2-4.3 3.2-6.3Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path d="M9 14h6l-1 6.5a2 2 0 0 1-2 1.5 2 2 0 0 1-2-1.5L9 14Z" fill="currentColor" opacity="0.6" />
    </svg>
  )
}

export function Layout({
  children,
  wide = false,
  variant,
}: {
  children: ReactNode
  wide?: boolean
  variant?: 'funeral'
}) {
  return (
    <>
      <header className={`site-header${variant ? ` site-header-${variant}` : ''}`}>
        <Link to="/" className="wordmark">
          <LanternMark />
          AgenticLantern
        </Link>
        <nav>
          <Link to="/hospital/login">Hospital staff</Link>
          <Link to="/funeral-home">Funeral home</Link>
        </nav>
      </header>
      <main className={`page${wide ? ' page-wide' : ''}`}>{children}</main>
      <footer className="site-footer">
        <p>Here to help you take the next step, one at a time.</p>
      </footer>
    </>
  )
}
