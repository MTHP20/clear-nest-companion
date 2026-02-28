import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClearNestLogo } from '@/components/ClearNestLogo';
import { useSession } from '@/contexts/SessionContext';
import {
  LayoutDashboard, AlertTriangle, Landmark, FileText,
  Home, Heart, Users, Clock, Download, Menu, X
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
  { id: 'actions', label: 'Action Required', icon: AlertTriangle, badge: true },
  { id: 'financial', label: 'Financial Accounts', icon: Landmark },
  { id: 'documents', label: 'Documents & Will', icon: FileText },
  { id: 'property', label: 'Property', icon: Home },
  { id: 'care', label: 'Care Wishes', icon: Heart },
  { id: 'contacts', label: 'Key Contacts', icon: Users },
  { id: 'sessions', label: 'Session History', icon: Clock },
];

const Dashboard = () => {
  const [activePage, setActivePage] = useState('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { actionItems, parentName } = useSession();
  const navigate = useNavigate();

  const activeActions = actionItems.filter(a => a.status !== 'done').length;

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <DashboardOverview />;
      case 'actions': return <DashboardActions />;
      case 'financial': return <DashboardFinancial />;
      case 'documents': return <DashboardDocuments />;
      case 'property': return <DashboardProperty />;
      case 'care': return <DashboardCareWishes />;
      case 'contacts': return <DashboardContacts />;
      case 'sessions': return <DashboardSessions />;
      default: return <DashboardOverview />;
    }
  };

  const handleNavClick = (id: string) => {
    setActivePage(id);
    setMobileMenuOpen(false);
  };

  const handleDownload = () => {
    const data = { exportedAt: new Date().toISOString(), parentName, message: "Full summary export placeholder" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clearnest-full-summary.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-sidebar text-sidebar-foreground fixed h-full z-30">
        <div className="p-5 border-b border-sidebar-border">
          <ClearNestLogo variant="white" />
        </div>

        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(item => (
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
                <span className="bg-alert text-alert-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  {activeActions}
                </span>
              )}
            </button>
          ))}

          <div className="border-t border-sidebar-border mt-4 pt-4 px-5">
            <button onClick={handleDownload} className="flex items-center gap-3 font-body text-[16px] text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors">
              <Download className="w-5 h-5" />
              Download Summary
            </button>
          </div>
        </nav>

        <div className="p-5 border-t border-sidebar-border text-sm text-sidebar-foreground/60">
          <p>Last session: Today, 10:34am</p>
          <p className="mt-1">Data stored on your device only</p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <h1 className="font-display text-2xl lg:text-[28px] font-semibold text-foreground">
              {parentName}'s Summary
            </h1>
          </div>
          <button
            onClick={() => navigate('/conversation')}
            className="bg-accent text-accent-foreground font-body font-medium py-2.5 px-5 rounded-lg hover:bg-primary transition-colors hidden sm:block"
          >
            Start New Session
          </button>
        </header>

        {/* Mobile Nav Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-sidebar text-sidebar-foreground p-4 cn-slide-in">
            {NAV_ITEMS.map(item => (
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
                  <span className="bg-alert text-alert-foreground text-xs font-bold px-2 py-0.5 rounded-full ml-auto">
                    {activeActions}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Page Content */}
        <main className="p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
