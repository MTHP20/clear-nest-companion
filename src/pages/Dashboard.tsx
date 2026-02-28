import { useMemo, useState } from 'react';
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

  const handleDownload = () => {
    const capturedLines = capturedItems.map((i) => {
      const note = userNotes[i.id];
      const verification = i.verificationStatus ?? 'unverified';
      const verifiedBy = i.verifiedByRole ? `${i.verifiedByRole} @ ${i.verifiedAt?.toLocaleString('en-GB')}` : 'not yet';
      return [
        `- [${i.category}] ${i.content}`,
        `  Confidence: ${i.confidence}`,
        `  Verification: ${verification} (${verifiedBy})`,
        `  Captured: ${i.timestamp.toLocaleString('en-GB')}`,
        note ? `  ${childName}'s note: ${note}` : undefined,
      ]
        .filter(Boolean)
        .join('\n');
    });

    const actionLines = actionItems.map((a) =>
      [
        `- [${a.severity.toUpperCase()}] ${a.title}`,
        `  Status: ${a.status}`,
        `  Assignee: ${a.assigneeRole === 'dad' ? `${childName} (Dad)` : 'Unassigned'}`,
        `  Due: ${a.dueDate ?? 'TBD'}`,
        `  Detail: ${a.description}`,
        a.learnMoreUrl ? `  Link: ${a.learnMoreUrl}` : undefined,
      ]
        .filter(Boolean)
        .join('\n')
    );

    const lines = [
      `ClearNest Family Report — ${parentName}`,
      `Roles: ${parentName} (Grandad), ${childName} (Dad)`,
      `Generated: ${new Date().toLocaleString('en-GB')}`,
      `Sessions: ${sessionList.length}`,
      ``,
      `=== CAPTURED INFORMATION (${capturedItems.length} items) ===`,
      ...capturedLines,
      ``,
      `=== TASKS (${actionItems.filter((a) => a.status !== 'done').length} active) ===`,
      ...actionLines,
      ``,
      `---`,
      `This report was downloaded to your device only.`,
      `Nothing has been sent to ClearNest servers.`,
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clearnest-family-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-3 font-body text-[16px] text-left transition-all ${
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
            <button
              onClick={handleDownload}
              className="flex items-center gap-3 font-body text-[16px] text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors mb-2"
            >
              <Download className="w-5 h-5" />
              Download Family Report
            </button>
            <p className="font-body text-xs text-sidebar-foreground/40 leading-snug">
              Downloads to your device only. Nothing is sent to ClearNest servers.
            </p>
          </div>
        </nav>

        <div className="p-5 border-t border-sidebar-border text-sm text-sidebar-foreground/60">
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
              <p className="font-body text-sm text-muted-foreground">
                {childName} (Dad) reviewing {parentName} (Grandad)
              </p>
            </div>
          </div>

          <div className="hidden sm:flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 border border-border font-body text-sm font-medium py-2 px-3 rounded-lg hover:bg-muted transition-colors text-foreground"
              >
                <Download className="w-4 h-4" />
                Download Family Report
              </button>
              <button
                onClick={() => navigate('/conversation')}
                className="bg-accent text-accent-foreground font-body font-medium py-2.5 px-5 rounded-lg hover:bg-primary transition-colors"
              >
                {primarySessionLabel}
              </button>
            </div>
            <p className="font-body text-xs text-muted-foreground">
              Downloads to your device only. Nothing is sent to ClearNest servers.
            </p>
          </div>
        </header>

        <div className="border-b border-border px-6 py-3 bg-card/70">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchHint}
                className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm font-body text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground"
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
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm font-body text-foreground"
              >
                <option value="all">All confidence</option>
                <option value="needs-follow-up">Needs follow-up</option>
                <option value="clear">Clear</option>
              </select>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-sidebar text-sidebar-foreground p-4 cn-slide-in">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 font-body text-left rounded-lg mb-1 ${
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
        )}

        <main className="p-6">{renderPage()}</main>
      </div>
    </div>
  );
};

export default Dashboard;
