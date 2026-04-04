import { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { useSession } from '@/contexts/SessionContext';
import {
  LayoutDashboard,
  AlertTriangle,
  Landmark,
  FileText,
  Home,
  Heart,
  Users,
  Clock,
  Download,
  Menu,
  Search,
  Palette,
  X,
} from 'lucide-react';
import { generateFamilyReportPDF } from '@/utils/generateReport';
import DashboardOverview from '@/components/dashboard/DashboardOverview';
import DashboardActions from '@/components/dashboard/DashboardActions';
import DashboardFinancial from '@/components/dashboard/DashboardFinancial';
import DashboardDocuments from '@/components/dashboard/DashboardDocuments';
import DashboardProperty from '@/components/dashboard/DashboardProperty';
import DashboardCareWishes from '@/components/dashboard/DashboardCareWishes';
import DashboardContacts from '@/components/dashboard/DashboardContacts';
import DashboardSessions from '@/components/dashboard/DashboardSessions';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const THEME_COLORS = {
  default: {
    bgOuter:      '#e1f1fd',
    bgMain:       '#e1f1fd',
    bgCard:       '#ffffff',
    sidebarBg:    'rgba(70,99,172,0.97)',
    headerBg:     'rgba(200,217,237,0.90)',
    headerText:   '#1e2d4f',
    headerMuted:  'rgba(30,45,79,0.52)',
    glassBorder:  'rgba(70,99,172,0.16)',
    glassActive:  'rgba(255,255,255,0.22)',
    glassHover:   'rgba(255,255,255,0.13)',
    sidebarText:  '#ffffff',
    sidebarMuted: 'rgba(255,255,255,0.65)',
    primary:      '#4663ac',
    muted:        'rgba(46,62,107,0.55)',
    border:       '#c8d9ed',
    orange:       '#E07B5A',
    teal:         '#5ECFCF',
    gold:         '#F0C050',
    red:          '#FF5F52',
    green:        '#5CB85C',
  },
  dark: {
    bgOuter:      '#0d0f1a',
    bgMain:       '#0d0f1a',
    bgCard:       '#1a1c2e',
    sidebarBg:    'rgba(13,15,26,0.88)',
    headerBg:     'rgba(13,15,26,0.88)',
    headerText:   '#ffffff',
    headerMuted:  'rgba(255,255,255,0.46)',
    glassBorder:  'rgba(255,255,255,0.13)',
    glassActive:  'rgba(255,255,255,0.16)',
    glassHover:   'rgba(255,255,255,0.09)',
    sidebarText:  '#ffffff',
    sidebarMuted: 'rgba(255,255,255,0.46)',
    primary:      '#a78bfa',
    muted:        'rgba(255,255,255,0.46)',
    border:       'rgba(255,255,255,0.13)',
    orange:       '#E07B5A',
    teal:         '#5ECFCF',
    gold:         '#F0C050',
    red:          '#FF5F52',
    green:        '#5CB85C',
  },
  orange: {
    bgOuter:      '#fdf0e8',
    bgMain:       '#fdf0e8',
    bgCard:       '#ffffff',
    sidebarBg:    'rgba(156,55,66,0.97)',
    headerBg:     'rgba(242,159,121,0.22)',
    headerText:   '#5c2229',
    headerMuted:  'rgba(92,34,41,0.52)',
    glassBorder:  'rgba(199,98,91,0.20)',
    glassActive:  'rgba(255,255,255,0.22)',
    glassHover:   'rgba(255,255,255,0.14)',
    sidebarText:  '#ffffff',
    sidebarMuted: 'rgba(255,255,255,0.62)',
    primary:      '#d87458',
    muted:        'rgba(92,34,41,0.52)',
    border:       '#f29f79',
    orange:       '#f08b5c',
    teal:         '#5ECFCF',
    gold:         '#F0C050',
    red:          '#c7625b',
    green:        '#5CB85C',
  },
} as const;

type ThemeColors = (typeof THEME_COLORS)[keyof typeof THEME_COLORS];

const FRAUNCES = 'Figtree, system-ui, sans-serif';

// ─── Nav definition ────────────────────────────────────────────────────────────
type NavId =
  | 'overview' | 'actions' | 'financial' | 'documents'
  | 'property' | 'care' | 'contacts' | 'sessions' | 'report';

const NAV_ITEMS: Array<{
  id: NavId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
  action?: boolean;
}> = [
  { id: 'overview',  label: 'Overview',           icon: LayoutDashboard },
  { id: 'actions',   label: 'Tasks',               icon: AlertTriangle, badge: true },
  { id: 'financial', label: 'Financial & Pension', icon: Landmark },
  { id: 'documents', label: 'Documents & Will',    icon: FileText },
  { id: 'property',  label: 'Property',            icon: Home },
  { id: 'care',      label: 'Care Wishes',         icon: Heart },
  { id: 'contacts',  label: 'Key Contacts',        icon: Users },
  { id: 'sessions',  label: 'Conversations',       icon: Clock },
  { id: 'report',    label: 'Family Report',       icon: Download, action: true },
];

// ─── Sidebar ───────────────────────────────────────────────────────────────────
interface SidebarInnerProps {
  parentName: string;
  activePage: NavId;
  activeActions: number;
  lastSession: Date | undefined;
  onNavClick: (id: NavId) => void;
  colors: ThemeColors;
}

function SidebarInner({ parentName, activePage, activeActions, lastSession, onNavClick, colors: C }: SidebarInnerProps) {
  return (
    <>
      {/* Logo */}
      <div style={{ padding: '24px 22px 28px' }}>
        <ClearNestLogo variant="white" href="/" />
      </div>

      {/* Profile */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '0 22px', marginBottom: 30,
      }}>
        {/* Avatar — gradient ring + user icon */}
        <div style={{
          width: 70, height: 70, borderRadius: '50%',
          background: 'linear-gradient(135deg, #F0C050, #FF8A60)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12, flexShrink: 0,
          boxShadow: '0 0 0 2px rgba(255,255,255,0.15), 0 0 0 5px rgba(255,255,255,0.05), 0 8px 24px rgba(255,138,96,0.45)',
        }}>
          <svg viewBox="0 0 24 24" width="36" height="36" fill="white" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" />
          </svg>
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: C.sidebarText, textAlign: 'center' }}>
          {parentName}
        </div>
        <div style={{ fontSize: 11, color: C.sidebarMuted, marginTop: 3 }}>
          Your family member
        </div>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, padding: '0 12px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.id && !item.action;
          return (
            <button
              key={item.id}
              onClick={() => onNavClick(item.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 13px', borderRadius: 13,
                fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                color: isActive ? C.sidebarText : C.sidebarMuted,
                background: isActive ? C.glassActive : 'transparent',
                border: `1px solid ${isActive ? C.glassBorder : 'transparent'}`,
                boxShadow: isActive
                  ? '0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.12)'
                  : 'none',
                cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.18s, color 0.18s, border-color 0.18s',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = C.glassHover;
                  (e.currentTarget as HTMLButtonElement).style.color = C.sidebarText;
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                  (e.currentTarget as HTMLButtonElement).style.color = C.sidebarMuted;
                }
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && activeActions > 0 && (
                <span style={{
                  background: C.red, color: 'white',
                  fontSize: 10, fontWeight: 700,
                  minWidth: 18, height: 18, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px', marginLeft: 'auto', flexShrink: 0,
                  boxShadow: '0 0 8px rgba(255,95,82,0.65)',
                }}>
                  {activeActions}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: 1, background: C.glassBorder, margin: '12px 20px' }} />

      {/* Admin / footer */}
      <button
        onClick={() => window.location.href = '/admin'}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 26px 4px',
          fontSize: 13, color: C.sidebarMuted, fontWeight: 500,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'Figtree, system-ui, sans-serif',
          transition: 'color 0.18s',
        }}
        onMouseEnter={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color = C.red;
          const circle = b.querySelector('.logout-circle') as HTMLElement | null;
          if (circle) { circle.style.background = C.red; circle.style.boxShadow = '0 0 10px rgba(255,95,82,0.5)'; }
        }}
        onMouseLeave={e => {
          const b = e.currentTarget as HTMLButtonElement;
          b.style.color = C.sidebarMuted;
          const circle = b.querySelector('.logout-circle') as HTMLElement | null;
          if (circle) { circle.style.background = 'rgba(255,255,255,0.12)'; circle.style.boxShadow = 'none'; }
        }}
      >
        <span
          className="logout-circle"
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.15)',
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: 'white',
            transition: 'background 0.18s, box-shadow 0.18s',
          }}
        >
          ↩
        </span>
        Admin
      </button>

      <div style={{ padding: '8px 26px 0', fontSize: 10, color: C.sidebarMuted }}>
        {lastSession
          ? `Last session: ${new Date(lastSession).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
          : 'No sessions yet'}
      </div>
    </>
  );
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [theme, setTheme] = useState<'default' | 'dark' | 'orange'>('default');
  const C = THEME_COLORS[theme];
  const [activePage, setActivePage] = useState<NavId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');
  const [activeModal, setActiveModal] = useState<'actions' | 'documents' | null>(null);
  const [docChecked, setDocChecked] = useState<Set<string>>(() => {
    try { const r = localStorage.getItem('cn-doc-checklist'); return r ? new Set(JSON.parse(r) as string[]) : new Set(); }
    catch { return new Set(); }
  });

  const DOC_ITEMS = [
    { id: 'will',           label: 'Will — location confirmed' },
    { id: 'lpa',            label: 'Lasting Power of Attorney — in place' },
    { id: 'life-insurance', label: 'Life Insurance — provider known' },
    { id: 'pension',        label: 'Pension details — confirmed' },
    { id: 'property-deeds', label: 'Property deeds — location known' },
    { id: 'nhs',            label: 'NHS number — recorded' },
  ];

  const toggleDoc = (id: string) => {
    setDocChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem('cn-doc-checklist', JSON.stringify([...next]));
      return next;
    });
  };

  const {
    actionItems, capturedItems, sessions: sessionList,
    parentName, childName, userNotes, updateActionStatus,
  } = useSession();

  const navigate = useNavigate();

  const activeActions = actionItems.filter(a => a.status !== 'done').length;
  const needsFollowUpCount = capturedItems.filter(i => i.confidence === 'needs-follow-up').length;
  const hasFollowUps = needsFollowUpCount > 0 || activeActions > 0;
  const primarySessionLabel = hasFollowUps ? `Continue with ${parentName}` : 'Start New Session';

  // Readiness score (7 areas)
  const readinessScore = useMemo(() => {
    const areas = [
      capturedItems.some(i => i.category === 'bank_accounts' || i.category === 'financial_accounts'),
      capturedItems.some(i => i.category === 'property'),
      capturedItems.some(i => i.category === 'documents'),
      capturedItems.some(i => i.category === 'care_wishes'),
      capturedItems.some(i => i.category === 'key_contacts'),
      sessionList.length > 0,
      actionItems.length > 0,
    ];
    return Math.round((areas.filter(Boolean).length / areas.length) * 100);
  }, [capturedItems, sessionList, actionItems]);

  const renderPage = () => {
    switch (activePage) {
      case 'overview':  return <DashboardOverview query={query} categoryFilter={categoryFilter} confidenceFilter={confidenceFilter} onQueryChange={setQuery} onCategoryChange={setCategoryFilter} onConfidenceChange={setConfidenceFilter} onDownload={handleDownload} />;
      case 'actions':   return <DashboardActions query={query} />;
      case 'financial': return <DashboardFinancial query={query} confidenceFilter={confidenceFilter} />;
      case 'documents': return <DashboardDocuments query={query} confidenceFilter={confidenceFilter} />;
      case 'property':  return <DashboardProperty query={query} confidenceFilter={confidenceFilter} />;
      case 'care':      return <DashboardCareWishes query={query} />;
      case 'contacts':  return <DashboardContacts query={query} confidenceFilter={confidenceFilter} />;
      case 'sessions':  return <DashboardSessions query={query} />;
      default:          return <DashboardOverview query={query} categoryFilter={categoryFilter} confidenceFilter={confidenceFilter} onQueryChange={setQuery} onCategoryChange={setCategoryFilter} onConfidenceChange={setConfidenceFilter} onDownload={handleDownload} />;
    }
  };

  const handleDownload = useCallback(() => {
    generateFamilyReportPDF(capturedItems, actionItems, userNotes, parentName, childName, sessionList.length);
  }, [capturedItems, actionItems, userNotes, parentName, childName, sessionList.length]);

  const handleNavClick = (id: NavId) => {
    if (id === 'report') { handleDownload(); return; }
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  const searchHint = useMemo(() => {
    if (activePage === 'actions') return 'Search tasks, providers, LPA, pension...';
    if (activePage === 'sessions') return 'Search by date, duration, captured count...';
    return 'Search pension, will, solicitor, provider...';
  }, [activePage]);

  // ── 4 stat pills ──────────────────────────────────────────────────────────────
  const statPills = [
    { label: 'Items Captured',      value: capturedItems.length,   dot: C.teal },
    { label: 'Tasks Open',          value: activeActions,           dot: C.red  },
    { label: 'Needs Follow Up',     value: needsFollowUpCount,      dot: C.gold },
  ];

  const sidebarProps: SidebarInnerProps = {
    parentName,
    activePage,
    activeActions,
    lastSession: sessionList[0]?.date,
    onNavClick: handleNavClick,
    colors: C,
  };

  return (
    <div data-theme={theme} style={{ minHeight: '100vh', display: 'flex', background: C.bgOuter }}>

      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside
        className="hidden lg:flex flex-col"
        style={{
          width: 224,
          background: C.sidebarBg,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          position: 'fixed', height: '100%', zIndex: 30,
          borderRight: `1px solid ${C.glassBorder}`,
          boxShadow: '4px 0 40px rgba(0,0,0,0.35), inset 1px 0 0 rgba(255,255,255,0.06)',
        }}
      >
        <SidebarInner {...sidebarProps} />
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div
        className="flex-1 lg:ml-[224px]"
        style={{ display: 'flex', flexDirection: 'column', background: C.bgMain, minHeight: '100vh' }}
      >

        {/* Top header — light glass panel */}
        <header style={{
          padding: '18px 48px',
          background: C.headerBg,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderBottom: `1px solid rgba(70,99,172,0.15)`,
          boxShadow: '0 2px 16px rgba(70,99,172,0.10), inset 0 -1px 0 rgba(255,255,255,0.5)',
        }}>

          {/* Desktop + mobile: three-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'center' }}>

            {/* Left: title + 4 stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Page title row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                fontFamily: FRAUNCES, fontSize: 42, fontWeight: 900,
                color: C.headerText, lineHeight: 1,
              }}>
                {parentName}'s Dashboard
                <span
                  onClick={() => setSettingsOpen(v => !v)}
                  style={{
                    fontSize: 18, color: settingsOpen ? C.primary : C.headerMuted,
                    cursor: 'pointer', marginTop: 6,
                    transition: 'transform 0.4s, color 0.2s',
                    display: 'inline-block',
                    transform: settingsOpen ? 'rotate(60deg)' : 'rotate(0deg)',
                  }}
                  title="Settings"
                >⚙</span>
              </div>

              {/* 4 stat pills */}
              <div style={{ display: 'flex', gap: 36, flexWrap: 'wrap' }}>
                {statPills.map(s => (
                  <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 12, color: C.headerMuted, fontWeight: 500,
                    }}>
                      <span style={{
                        width: 15, height: 15, borderRadius: '50%', background: s.dot,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: 'white', fontWeight: 700, flexShrink: 0,
                        boxShadow: `0 0 7px ${s.dot}99`,
                      }}>i</span>
                      {s.label}
                    </div>
                    <div style={{
                      fontFamily: FRAUNCES, fontSize: 28, fontWeight: 700,
                      color: C.headerText, lineHeight: 1,
                    }}>
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle: quick-access icon buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              {/* Urgent Actions button */}
              <button
                onClick={() => setActiveModal('actions')}
                title="Urgent Actions"
                style={{
                  width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: activeActions > 0 ? 'rgba(255,95,82,0.12)' : 'rgba(255,255,255,0.55)',
                  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                  boxShadow: activeActions > 0
                    ? '0 0 0 1px rgba(255,95,82,0.35), 0 0 16px rgba(255,95,82,0.2)'
                    : '0 0 0 1px rgba(70,99,172,0.18), 0 4px 12px rgba(70,99,172,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                <AlertTriangle style={{ width: 22, height: 22, color: activeActions > 0 ? C.red : 'rgba(46,62,107,0.5)' }} />
                {activeActions > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 2,
                    background: C.red, color: 'white', fontSize: 9, fontWeight: 700,
                    minWidth: 16, height: 16, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                    boxShadow: '0 0 8px rgba(255,95,82,0.8)',
                  }}>{activeActions}</span>
                )}
              </button>
              {/* Critical Documents button */}
              <button
                onClick={() => setActiveModal('documents')}
                title="Critical Documents"
                style={{
                  width: 54, height: 54, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: 'rgba(70,99,172,0.10)',
                  backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
                  boxShadow: '0 0 0 1px rgba(70,99,172,0.22), 0 4px 12px rgba(70,99,172,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
              >
                <FileText style={{ width: 22, height: 22, color: C.teal }} />
              </button>
            </div>

            {/* Right: Chat to Clara card */}
            <div
              onClick={() => navigate('/conversation')}
              style={{
                width: 230, flexShrink: 0, cursor: 'pointer',
                background: 'rgba(155,123,200,0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(155,123,200,0.35)',
                borderRadius: 18, padding: '18px 20px 20px',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                const d = e.currentTarget as HTMLDivElement;
                d.style.transform = 'scale(1.03)';
                d.style.boxShadow = '0 12px 40px rgba(61,31,138,0.5), inset 0 1px 0 rgba(255,255,255,0.12)';
              }}
              onMouseLeave={e => {
                const d = e.currentTarget as HTMLDivElement;
                d.style.transform = 'scale(1)';
                d.style.boxShadow = '0 8px 30px rgba(61,31,138,0.35), inset 0 1px 0 rgba(255,255,255,0.12)';
              }}
            >
              {/* Decorative arcs */}
              <div style={{ position: 'absolute', top: -12, right: -12, width: 95, height: 95, zIndex: 0 }}>
                {[
                  { size: 84, color: 'rgba(94,207,207,0.45)', rot: -20 },
                  { size: 60, color: 'rgba(255,255,255,0.18)', rot: -8 },
                  { size: 38, color: 'rgba(155,123,200,0.6)',  rot:  6 },
                ].map((arc, i) => (
                  <div key={i} style={{
                    position: 'absolute',
                    width: arc.size, height: arc.size,
                    borderRadius: '50%',
                    border: '5px solid transparent',
                    borderTopColor: arc.color,
                    borderRightColor: arc.color,
                    top: (84 - arc.size) / 2,
                    right: (84 - arc.size) / 2,
                    transform: `rotate(${arc.rot}deg)`,
                  }} />
                ))}
              </div>

              {/* Purple sphere (from landing) */}
              <div style={{
                position: 'relative', width: 52, height: 52,
                marginBottom: 10, zIndex: 1,
              }}>
                {/* rotating conic layers */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'conic-gradient(from 0deg,rgba(155,123,200,0) 0%,rgba(155,123,200,0.6) 25%,rgba(200,170,255,0.4) 50%,rgba(100,60,180,0.5) 75%,rgba(155,123,200,0) 100%)',
                  animation: 'cnSphereRot 12s linear infinite',
                  filter: 'blur(3px)',
                }} />
                <div style={{
                  position: 'absolute', inset: 4, borderRadius: '50%',
                  background: 'conic-gradient(from 120deg,rgba(180,150,230,0) 0%,rgba(220,200,255,0.5) 30%,rgba(80,40,160,0.4) 60%,rgba(180,150,230,0) 100%)',
                  animation: 'cnSphereRot2 8s linear infinite',
                  filter: 'blur(4px)',
                }} />
                {/* smoke */}
                <div style={{
                  position: 'absolute', width: 34, height: 22, borderRadius: '50%',
                  background: 'radial-gradient(ellipse,rgba(196,168,232,0.8) 0%,rgba(155,123,200,0.4) 50%,transparent 70%)',
                  top: 6, left: 5,
                  animation: 'cnSphereSmoke1 6.5s ease-in-out infinite',
                  filter: 'blur(5px)',
                }} />
                {/* highlight */}
                <div style={{
                  position: 'absolute', top: 8, left: 10,
                  width: '36%', height: '26%', borderRadius: '50%',
                  background: 'radial-gradient(ellipse,rgba(255,255,255,0.55) 0%,transparent 70%)',
                  zIndex: 9,
                }} />
              </div>

              <div style={{
                fontFamily: FRAUNCES, fontSize: 19, fontWeight: 900, lineHeight: 1.2,
                color: 'white', marginBottom: 5, position: 'relative', zIndex: 1,
              }}>
                <span style={{ color: C.teal }}>Chat</span> to<br />Clara
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', position: 'relative', zIndex: 1 }}>
                {primarySessionLabel}
              </div>

              {/* "GO" circle button */}
              <div style={{
                position: 'absolute', bottom: 16, right: 16,
                width: 38, height: 38,
                background: 'linear-gradient(135deg,#9B7BC8,#3D1F8A)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontSize: 12, fontWeight: 700, zIndex: 2,
                boxShadow: '0 0 16px rgba(155,123,200,0.7)',
              }}>
                GO
              </div>
            </div>
          </div>

        </header>


        {/* Mobile menu overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-10 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.38)' }}
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              className="lg:hidden relative z-20 flex flex-col"
              style={{
                background: C.sidebarBg,
                backdropFilter: 'blur(22px)',
                WebkitBackdropFilter: 'blur(22px)',
                maxHeight: '68vh', overflowY: 'auto',
                borderBottom: `1px solid ${C.glassBorder}`,
              }}
            >
              <SidebarInner {...sidebarProps} />
            </div>
          </>
        )}

        {/* Page content */}
        <main style={{ padding: '20px 48px 80px', flex: 1 }}>
          {renderPage()}
        </main>
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {activeModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setActiveModal(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          {/* Modal panel */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 51, width: '90%', maxWidth: 520, maxHeight: '80vh',
            background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(70,99,172,0.18)', borderRadius: 22,
            boxShadow: '0 20px 60px rgba(70,99,172,0.20), inset 0 1px 0 rgba(255,255,255,0.9)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid rgba(70,99,172,0.10)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {activeModal === 'actions' ? (
                  <AlertTriangle style={{ width: 20, height: 20, color: C.red }} />
                ) : (
                  <FileText style={{ width: 20, height: 20, color: C.teal }} />
                )}
                <span style={{ fontFamily: FRAUNCES, fontSize: 20, fontWeight: 700, color: '#1e2d4f' }}>
                  {activeModal === 'actions' ? 'Urgent Actions' : 'Critical Documents'}
                </span>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'rgba(70,99,172,0.08)', border: '1px solid rgba(70,99,172,0.18)',
                  borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', color: 'rgba(30,45,79,0.6)',
                  fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'system-ui',
                }}
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ overflowY: 'auto', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>

              {activeModal === 'actions' && (
                actionItems.filter(a => a.status !== 'done').length === 0 ? (
                  <p style={{ fontSize: 14, color: 'rgba(30,45,79,0.5)', textAlign: 'center', padding: '24px 0' }}>
                    No urgent actions right now.
                  </p>
                ) : (
                  actionItems.filter(a => a.status !== 'done').map(action => (
                    <div key={action.id} style={{
                      background: 'rgba(255,95,82,0.08)', border: '1px solid rgba(255,95,82,0.2)',
                      borderRadius: 14, padding: '14px 16px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                          background: action.severity === 'red' ? C.red : C.gold,
                          boxShadow: `0 0 6px ${action.severity === 'red' ? C.red : C.gold}99`,
                        }} />
                        <span style={{ fontFamily: FRAUNCES, fontSize: 15, fontWeight: 600, color: '#1e2d4f', flex: 1 }}>
                          {action.title}
                        </span>
                      </div>
                      <p style={{ fontSize: 13, color: 'rgba(30,45,79,0.58)', marginBottom: 12, paddingLeft: 16 }}>
                        {action.description}
                      </p>
                      <div style={{ display: 'flex', gap: 8, paddingLeft: 16, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => updateActionStatus(action.id, 'in-progress')}
                          style={{
                            background: 'rgba(70,99,172,0.08)', border: '1px solid rgba(70,99,172,0.20)',
                            borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#4663ac', cursor: 'pointer',
                            fontFamily: 'Figtree, system-ui, sans-serif',
                          }}
                        >Start task</button>
                        {action.learnMoreUrl && (
                          <a href={action.learnMoreUrl} target="_blank" rel="noopener noreferrer" style={{
                            background: 'rgba(94,207,207,0.12)', border: '1px solid rgba(94,207,207,0.25)',
                            borderRadius: 8, padding: '5px 12px', fontSize: 12, color: C.teal,
                            textDecoration: 'none', fontFamily: 'Figtree, system-ui, sans-serif',
                          }}>Open guidance</a>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {activeModal === 'documents' && (
                <>
                  {DOC_ITEMS.map(doc => {
                    const isChecked = docChecked.has(doc.id);
                    return (
                      <button
                        key={doc.id}
                        onClick={() => toggleDoc(doc.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          background: isChecked ? 'rgba(70,99,172,0.08)' : 'rgba(70,99,172,0.04)',
                          border: `1px solid ${isChecked ? 'rgba(70,99,172,0.25)' : 'rgba(70,99,172,0.12)'}`,
                          borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                          textAlign: 'left', transition: 'background 0.15s, border-color 0.15s',
                        }}
                      >
                        <span style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          border: isChecked ? 'none' : '2px solid rgba(70,99,172,0.4)',
                          background: isChecked ? C.primary : 'rgba(70,99,172,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: isChecked ? `0 0 8px ${C.teal}88` : 'none',
                        }}>
                          {isChecked && <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#0d0f1a" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5"/></svg>}
                        </span>
                        <span style={{
                          fontSize: 14, color: isChecked ? 'rgba(30,45,79,0.4)' : '#1e2d4f',
                          textDecoration: isChecked ? 'line-through' : 'none',
                          fontFamily: 'Figtree, system-ui, sans-serif',
                          transition: 'color 0.15s',
                        }}>{doc.label}</span>
                      </button>
                    );
                  })}
                  <p style={{ fontSize: 11, color: 'rgba(30,45,79,0.4)', textAlign: 'center', paddingTop: 4 }}>
                    {docChecked.size} of {DOC_ITEMS.length} confirmed
                  </p>
                </>
              )}

            </div>
          </div>
        </>
      )}

      {/* ── Settings modal ───────────────────────────────────────────────────── */}
      {settingsOpen && (
        <>
          <div
            onClick={() => setSettingsOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
            }}
          />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            zIndex: 51, width: 360,
            background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(70,99,172,0.18)', borderRadius: 22,
            boxShadow: '0 20px 60px rgba(70,99,172,0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 22px 18px',
              borderBottom: '1px solid rgba(70,99,172,0.10)',
            }}>
              <span style={{ fontFamily: FRAUNCES, fontSize: 18, fontWeight: 700, color: '#1e2d4f' }}>Settings</span>
              <button
                onClick={() => setSettingsOpen(false)}
                style={{
                  background: 'rgba(70,99,172,0.07)', border: '1px solid rgba(70,99,172,0.18)',
                  borderRadius: '50%', width: 30, height: 30, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(70,99,172,0.14)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(70,99,172,0.07)'; }}
              >
                <X style={{ width: 14, height: 14, color: 'rgba(30,45,79,0.55)' }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px 24px' }}>
              {/* Theme row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                {/* Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Palette style={{ width: 18, height: 18, color: 'rgba(30,45,79,0.55)' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e2d4f', fontFamily: FRAUNCES }}>Theme</span>
                </div>

                {/* Joined tab group */}
                <div style={{
                  display: 'flex',
                  border: '1px solid rgba(255,255,255,0.13)',
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  {([
                    { label: 'Default', key: 'default' as const, disabled: false },
                    { label: 'Orange',  key: 'orange'  as const, disabled: false },
                    { label: 'Dark',    key: 'dark'    as const, disabled: false },
                  ] as const).map((tab, i, arr) => {
                    const isActive = theme === tab.key;
                    return (
                      <button
                        key={tab.label}
                        disabled={tab.disabled}
                        onClick={tab.disabled ? undefined : () => setTheme(tab.key)}
                        style={{
                          padding: '7px 14px',
                          fontSize: 12, fontWeight: 600,
                          fontFamily: FRAUNCES,
                          cursor: tab.disabled ? 'not-allowed' : 'pointer',
                          background: isActive ? 'rgba(70,99,172,0.14)' : 'rgba(70,99,172,0.03)',
                          color: tab.disabled ? 'rgba(30,45,79,0.30)' : isActive ? '#4663ac' : 'rgba(30,45,79,0.55)',
                          border: 'none',
                          borderRight: i < arr.length - 1 ? '1px solid rgba(70,99,172,0.12)' : 'none',
                          boxShadow: isActive ? 'inset 0 1px 0 rgba(255,255,255,0.6)' : 'none',
                          transition: 'background 0.15s, color 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Mobile bottom tab bar ─────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 lg:hidden flex items-stretch"
        style={{
          height: 60,
          background: C.sidebarBg,
          backdropFilter: 'blur(22px)',
          WebkitBackdropFilter: 'blur(22px)',
          borderTop: `1px solid ${C.glassBorder}`,
        }}
        aria-label="Mobile navigation"
      >
        {([
          { id: 'overview' as NavId, label: 'Overview', icon: LayoutDashboard },
          { id: 'actions'  as NavId, label: 'Tasks',    icon: AlertTriangle,  badge: true },
          { id: 'sessions' as NavId, label: 'Chats',    icon: Clock },
        ] as const).map(item => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
            style={{
              fontSize: 11, color: activePage === item.id ? C.gold : C.sidebarMuted,
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Figtree, system-ui, sans-serif',
            }}
            aria-current={activePage === item.id ? 'page' : undefined}
          >
            <div style={{ position: 'relative' }}>
              <item.icon className="w-5 h-5" />
              {'badge' in item && item.badge && activeActions > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -6,
                  background: C.red, color: 'white',
                  fontSize: 10, fontWeight: 700,
                  minWidth: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                }}>
                  {activeActions}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        ))}

        <button
          onClick={() => setMobileMenuOpen(v => !v)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2"
          style={{
            fontSize: 11, color: C.sidebarMuted,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'Figtree, system-ui, sans-serif',
          }}
          aria-expanded={mobileMenuOpen}
          aria-label="More navigation options"
        >
          <Menu className="w-5 h-5" />
          <span>More</span>
        </button>
      </nav>
    </div>
  );
};

export default Dashboard;
