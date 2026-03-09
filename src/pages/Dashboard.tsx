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
  X,
  Search,
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

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'actions', label: 'Tasks', icon: AlertTriangle, badge: true },
  { id: 'financial', label: 'Financial Accounts', icon: Landmark },
  { id: 'documents', label: 'Documents & Will', icon: FileText },
  { id: 'property', label: 'Property', icon: Home },
  { id: 'care', label: 'Care Wishes', icon: Heart },
  { id: 'contacts', label: 'Key Contacts', icon: Users },
  { id: 'sessions', label: 'Conversations', icon: Clock },
];

const Dashboard = () => {
  const [activePage, setActivePage] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [confidenceFilter, setConfidenceFilter] = useState('all');

  const { actionItems, capturedItems, sessions: sessionList, parentName, childName, userNotes } = useSession();
  const navigate = useNavigate();

  const activeActions = actionItems.filter((a) => a.status !== 'done').length;
  const hasFollowUps = capturedItems.some((i) => i.confidence === 'needs-follow-up') || activeActions > 0;
  const primarySessionLabel = hasFollowUps ? `Continue with ${parentName}` : 'Start New Session';

  const lastSessionDate = sessionList[0]?.date;

  const renderPage = () => {
    switch (activePage) {
      case 'overview':
        return <DashboardOverview query={query} categoryFilter={categoryFilter} confidenceFilter={confidenceFilter} />;
      case 'actions':
        return <DashboardActions query={query} />;
      case 'financial':
        return <DashboardFinancial query={query} confidenceFilter={confidenceFilter} />;
      case 'documents':
        return <DashboardDocuments query={query} confidenceFilter={confidenceFilter} />;
      case 'property':
        return <DashboardProperty query={query} confidenceFilter={confidenceFilter} />;
      case 'care':
        return <DashboardCareWishes query={query} />;
      case 'contacts':
        return <DashboardContacts query={query} confidenceFilter={confidenceFilter} />;
      case 'sessions':
        return <DashboardSessions query={query} />;
      default:
        return <DashboardOverview query={query} categoryFilter={categoryFilter} confidenceFilter={confidenceFilter} />;
    }
  };

  const handleNavClick = (id: string) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  const handleDownload = useCallback(() => {
    generateFamilyReportPDF(
      capturedItems,
      actionItems,
      userNotes,
      parentName,
      childName,
      sessionList.length,
    );
  }, [capturedItems, actionItems, userNotes, parentName, childName, sessionList.length]);

  const searchHint = useMemo(() => {
    if (activePage === 'actions') return 'Search tasks, providers, LPA, pension...';
    if (activePage === 'sessions') return 'Search by date, duration, captured count...';
    return 'Search pension, will, solicitor, provider...';
  }, [activePage]);

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar text-sidebar-foreground fixed h-full z-30">
        <div className="p-5 border-b border-sidebar-border">
          <ClearNestLogo variant="white" href="/" />
        </div>

        <div className="sidebar-person">
          <div className="sidebar-person-photo-placeholder">👴</div>
          <div className="sidebar-person-info">
            <div className="sidebar-person-name">{parentName}</div>
            <div className="sidebar-person-role">Your family member</div>
            <div className="sidebar-person-badge">Active profile</div>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 font-body text-[18px] text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                activePage === item.id ? 'cn-nav-active' : 'hover:bg-sidebar-accent'
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.badge && activeActions > 0 && (
                <span className="bg-amber-500 text-white text-xs font-bold min-w-[22px] h-[22px] flex items-center justify-center rounded-full px-1.5 shadow-sm">
                  {activeActions}
                </span>
              )}
            </button>
          ))}

          <div className="border-t border-sidebar-border mt-4 pt-4 px-5">
            {/* UI-6 — sidebar version is text-link only; header has the primary button */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-3 font-body text-[18px] text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors mb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
            >
              <Download className="w-5 h-5" />
              Download Family Report
            </button>
            {/* UI-5 — privacy text bumped from text-xs to text-sm, opacity raised */}
            <p className="font-body text-sm text-sidebar-foreground/70 leading-snug">
              Downloads to your device only. Nothing is sent to ClearNest servers.
            </p>
          </div>
        </nav>

        {/* UI-7 — text-base (18px) minimum, was text-sm */}
        <div className="p-5 border-t border-sidebar-border text-base text-sidebar-foreground/70">
          <p>
            Last session:{' '}
            {lastSessionDate
              ? lastSessionDate.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              : 'No sessions yet'}
          </p>
          <p className="mt-1">Data stored on your device only</p>
        </div>
      </aside>

      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-20 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="lg:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div>
              <h1 className="font-display text-2xl lg:text-[28px] font-semibold text-foreground">{parentName}'s Summary</h1>
              {/* UI-9 — removed hardcoded role labels "(Dad)" / "(Grandad)" */}
              <p className="font-body text-sm text-muted-foreground">
                Reviewing {parentName}'s family information
              </p>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {/* UI-6 — header download is the primary styled button, sidebar is text-only */}
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 border border-border font-body text-sm font-semibold py-2.5 px-4 rounded-lg hover:bg-muted transition-colors text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Download className="w-4 h-4" />
                Download Family Report
              </button>
              {/* UI-4 — font-semibold + py-3 to match its importance as the primary CTA */}
              <button
                onClick={() => navigate('/conversation')}
                className="bg-accent text-accent-foreground font-body font-semibold py-3 px-5 rounded-lg hover:bg-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {primarySessionLabel}
              </button>
            </div>
            <p className="font-body text-xs text-muted-foreground">
              Downloads to your device only. Nothing is sent to ClearNest servers.
            </p>
          </div>
        </header>

        {/* UI-3 — solid bg-background (was bg-card/70 semi-transparent) */}
        <div className="border-b border-border px-6 py-3 bg-background">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* UI-2 — py-3 for 44px+ tap target (was py-2) */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchHint}
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-3 text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {/* UI-2 + UI-8 — py-3 for tap height + focus rings on selects */}
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-3 text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All categories</option>
                <option value="bank_accounts">Bank accounts</option>
                <option value="financial_accounts">Financial accounts</option>
                <option value="documents">Documents</option>
                <option value="property">Property</option>
                <option value="care_wishes">Care wishes</option>
                <option value="key_contacts">Key contacts</option>
              </select>
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-3 text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All confidence</option>
                <option value="needs-follow-up">Needs follow-up</option>
                <option value="clear">Clear</option>
              </select>
            </div>
          </div>
        </div>

        {/* UI-10 — backdrop dims content behind mobile nav; click it to dismiss */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/40 z-10 lg:hidden"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="lg:hidden bg-sidebar text-sidebar-foreground p-4 cn-slide-in relative z-20">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 font-body text-[18px] text-left rounded-lg mb-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                    activePage === item.id ? 'bg-sidebar-accent' : ''
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                  {item.badge && activeActions > 0 && (
                    <span className="bg-amber-500 text-white text-xs font-bold min-w-[22px] h-[22px] flex items-center justify-center rounded-full px-1.5 ml-auto shadow-sm">
                      {activeActions}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </>
        )}

        <main className="p-6">{renderPage()}</main>
      </div>
    </div>
  );
};

export default Dashboard;
