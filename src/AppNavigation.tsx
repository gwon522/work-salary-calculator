import { useEffect, useRef, useState } from 'react'
import {
  Calculator,
  CalendarDays,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  LogOut,
  Menu,
  Settings,
  Users,
  UserRound,
  Workflow,
  Wallet,
  X,
} from 'lucide-react'
import './AppNavigation.css'

export type NavigationPage =
  | 'work'
  | 'history'
  | 'calendar'
  | 'users'
  | 'organization'
  | 'system'
  | 'profile'
  | 'retirement'

type Props = {
  page: NavigationPage
  isAdmin: boolean
  userName: string
  onNavigate: (page: NavigationPage) => void
  onLogout: () => void
}

const workItems = [
  { page: 'work', label: '근무입력', icon: Clock },
  { page: 'history', label: '월별 근무기록', icon: FileText },
  { page: 'calendar', label: '워킹캘린더', icon: CalendarDays },
  { page: 'retirement', label: '퇴직금 정산', icon: Wallet },
] as const

const adminItems = [
  { page: 'users', label: '사용자관리', icon: Users },
  { page: 'organization', label: '조직관리', icon: Workflow },
  { page: 'system', label: '시스템관리', icon: Settings },
] as const

const navigationTitles: Record<NavigationPage, string> = {
  work: '근무 입력',
  history: '월별 근무기록',
  calendar: '워킹캘린더',
  users: '사용자관리',
  organization: '조직관리',
  system: '시스템관리',
  profile: '마이페이지',
  retirement: '퇴직금 정산',
}

export function PageHeading({ page }: { page: NavigationPage }) {
  return (
    <h1 className="desktop-page-title">{navigationTitles[page]}</h1>
  )
}

export function AppNavigation({
  page,
  isAdmin,
  userName,
  onNavigate,
  onLogout,
}: Props) {
  const drawer = useRef<HTMLDialogElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1101px)')
    const closeOnDesktop = () => {
      if (desktop.matches) drawer.current?.close()
    }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])
  const navigate = (next: NavigationPage) => {
    onNavigate(next)
    drawer.current?.close()
  }
  const navigationContent = (mobile = false) => (
    <>
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon">
          <Calculator size={23} aria-hidden="true" />
        </span>
        <div>
          <strong>
            WSC<span>.</span>
          </strong>
          <small>Work Salary Calculator</small>
        </div>
        {mobile && (
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label="메뉴 닫기"
            onClick={() => drawer.current?.close()}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav className="sidebar-navigation" aria-label="주 메뉴">
        <p className="sidebar-group-label">내 근무</p>
        {workItems.map(({ page: next, label, icon: Icon }) => (
          <button
            key={next}
            type="button"
            className="sidebar-link"
            aria-current={page === next ? 'page' : undefined}
            onClick={() => navigate(next)}
          >
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            {page === next && (
              <ChevronRight
                size={15}
                className="sidebar-active-arrow"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
        {isAdmin && (
          <div className="sidebar-admin-group">
            <p className="sidebar-group-label">관리자</p>
            {adminItems.map(({ page: next, label, icon: Icon }) => (
              <button
                key={next}
                type="button"
                className="sidebar-link"
                aria-current={page === next ? 'page' : undefined}
                onClick={() => navigate(next)}
              >
                <Icon size={19} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
            <a
              className="sidebar-link"
              href="https://stlo.stload.com/#/login"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="STLO 바로가기 (새 탭)"
              onClick={() => drawer.current?.close()}
            >
              <ExternalLink size={19} aria-hidden="true" />
              <span>STLO 바로가기</span>
            </a>
          </div>
        )}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          className="sidebar-profile"
          aria-current={page === 'profile' ? 'page' : undefined}
          onClick={() => navigate('profile')}
        >
          <span className="sidebar-avatar">
            <UserRound size={19} aria-hidden="true" />
          </span>
          <span className="sidebar-profile-text">
            <strong>{userName}님</strong>
            <small>마이페이지</small>
          </span>
          <Settings size={17} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="sidebar-link sidebar-logout"
          onClick={() => {
            drawer.current?.close()
            onLogout()
          }}
        >
          <LogOut size={17} aria-hidden="true" />
          <span>로그아웃</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      <aside className="app-sidebar" aria-label="사이드바">
        {navigationContent()}
      </aside>
      <header className="mobile-app-header">
        <button
          type="button"
          className="sidebar-icon-button"
          aria-label="메뉴 열기"
          aria-expanded={isOpen}
          aria-controls="navigation-drawer"
          onClick={() => {
            drawer.current?.showModal()
            setIsOpen(true)
          }}
        >
          <Menu size={22} />
        </button>
        <h1>{navigationTitles[page]}</h1>
        <span className="mobile-brand">WSC.</span>
      </header>
      <dialog
        id="navigation-drawer"
        ref={drawer}
        className="navigation-drawer"
        aria-label="내비게이션 메뉴"
        onClose={() => setIsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect()
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              drawer.current?.close()
          }
        }}
      >
        {navigationContent(true)}
      </dialog>
    </>
  )
}
