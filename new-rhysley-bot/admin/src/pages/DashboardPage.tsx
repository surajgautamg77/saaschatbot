
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { BarChart3, Inbox, Calendar, Bot, Users, Code, UserCog, HelpCircle } from 'lucide-react';
import { apiClient } from '../api/apiClient';

// Import the SideNavbar component
import { SideNavbar, NavItem } from '../components/SideNavbar';

// Import all the page components
import { AnalyticsPage } from './AnalyticsPage';
import { LiveChatPage } from './LiveChatPage';
import { HistoryPage } from './HistoryPage';
import { KnowledgePage } from './KnowledgePage';
import { EmbedPage } from './EmbedPage';
import { BotBuilderPage } from './BotBuilderPage';
import { BotListingPage } from './BotListingPage';
import { BrandingPage } from './BrandingPage';
import { TeamPage } from './TeamPage';
import { BookingsPage } from './BookingsPage';
import { ProfilePage } from './ProfilePage';
import { VisitorsPage } from './VisitorsPage';

// ============================================================================
// PROTECTED ROUTE COMPONENT
// ============================================================================
const ProtectedRoute: React.FC<{ children: JSX.Element; allowedRoles?: ('OWNER' | 'MANAGER' | 'AGENT' | 'SUPER_ADMIN')[] }> = ({
  children,
  allowedRoles
}) => {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && (!user?.role || !allowedRoles.includes(user.role as any))) {
      return <Navigate to="/inbox/live" replace />;
  }
  return children;
};


// ============================================================================
// PAGE WRAPPER COMPONENT
// ============================================================================
const PageWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="p-4 mx-auto w-full">
    {children}
  </div>
);


// ============================================================================
// SUB NAVIGATION COMPONENT (for tabs within pages)
// ============================================================================
const SubNav: React.FC<{ links: { to: string; label: string }[] }> = ({ links }) => {
  const getTourAttr = (label: string) => {
    if (label === 'Flow Builder') return 'subnav-flow';
    if (label === 'Knowledge') return 'subnav-knowledge';
    if (label === 'Branding') return 'subnav-branding';
    if (label === 'Installation') return 'subnav-installation';
    return undefined;
  };

  return (
    <div className="mb-6 border-b border-gray-700">
      <nav className="flex space-x-6" style={{ marginBottom: '-1px' }} aria-label="Tabs">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            data-tour={getTourAttr(link.label)}
            end
            className={({ isActive }) => `whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${isActive
              ? 'border-blue-400 text-blue-400'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};


// Import NavLink from react-router-dom for SubNav
import { NavLink } from 'react-router-dom';


// ============================================================================
// INBOX LAYOUT (with sub-navigation)
// ============================================================================
const InboxLayout: React.FC = () => (
  <div className="w-full">
    <PageWrapper>
      <h2 className="text-3xl font-bold text-white mb-6">Inbox</h2>
      <SubNav links={[
        { to: '/inbox/live', label: 'Live Chat' },
        { to: '/inbox/history', label: 'History' }
      ]} />
    </PageWrapper>
    <Routes>
      <Route index element={<Navigate to="live" replace />} />
      <Route path="live" element={<PageWrapper><LiveChatPage /></PageWrapper>} />
      <Route path="history" element={<PageWrapper><HistoryPage /></PageWrapper>} />
    </Routes>
  </div>
);

const ContactsLayout: React.FC = () => (
    <div className="w-full">
      <PageWrapper>
        <h2 className="text-3xl font-bold text-white mb-6">Contacts</h2>
        <SubNav links={[
          { to: '/contacts/bookings', label: 'Bookings' },
          { to: '/contacts/visitors', label: 'Visitors' }
        ]} />
      </PageWrapper>
      <Routes>
        <Route index element={<Navigate to="bookings" replace />} />
        <Route path="bookings" element={<PageWrapper><BookingsPage /></PageWrapper>} />
        <Route path="visitors" element={<PageWrapper><VisitorsPage /></PageWrapper>} />
      </Routes>
    </div>
  );


// ============================================================================
// BOT LAYOUT (with sub-navigation)
// ============================================================================
const BotLayout: React.FC = () => {
  const { botId } = useParams<{ botId: string }>();
  const [botName, setBotName] = useState('Bot Configuration');

  useEffect(() => {
    if (botId) {
      // Use the correct '/details' endpoint to get the bot's name.
      apiClient.get<{ id: string, name: string }>(`/bots/${botId}/details`)
        .then(bot => {
          setBotName(bot.name);
        })
        .catch(err => {
          console.error("Failed to fetch bot name:", err);
          setBotName('Bot Configuration'); // Keep fallback on error
        });
    }
  }, [botId]);

  return (
    <div className="w-full">
      <PageWrapper>
        <h2 className="text-3xl font-bold text-white mb-6 capitalize">{botName}</h2>
        <SubNav links={[
          { to: `builder`, label: 'Flow Builder' },
          { to: `branding`, label: 'Branding' },
          { to: `knowledge`, label: 'Knowledge' },
          { to: `installation`, label: 'Installation' }
        ]} />
      </PageWrapper>
      <Routes>
        <Route path="builder" element={<PageWrapper><BotBuilderPage /></PageWrapper>} />
        <Route path="branding" element={<PageWrapper><BrandingPage /></PageWrapper>} />
        <Route path="knowledge" element={<PageWrapper><KnowledgePage /></PageWrapper>} />
        <Route path="installation" element={<PageWrapper><EmbedPage /></PageWrapper>} />
        <Route index element={<Navigate to="builder" replace />} />
      </Routes>
    </div>
  );

};


// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================
export const DashboardPage: React.FC = () => {
  // State for sidebar collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Get user and logout from store
  const user: any = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  // Define navigation items with icons and badges
  const navItems: NavItem[] = [
    {
      to: '/dashboard',
      label: 'Dashboard',
      icon: <BarChart3 size={20} />,
      requiresRole: ['OWNER', 'MANAGER'],
    },
    {
      to: '/inbox',
      label: 'Chats',
      icon: <Inbox size={20} />,
      // No role requirement, visible to all
    },
    {
        to: '/contacts',
        label: 'Contacts',
        icon: <Calendar size={20} />,
        activeWhen: ['/contacts/'],
      },
    {
      to: '/bots',
      label: 'Bots', // Changed label for clarity
      icon: <Bot size={20} />,
      requiresRole: ['OWNER', 'MANAGER'],
      activeWhen: ['/bot/']
    },
    {
      to: '/profile',
      label: 'Profile',
      icon: <UserCog size={20} />,
      // No role requirement, visible to all
    },
    {
      to: '/team',
      label: 'Team',
      icon: <Users size={20} />,
      requiresRole: ['OWNER', 'MANAGER'],
    },
    {
      to: '/installation',
      label: 'Installation',
      icon: <Code size={20} />,
      requiresRole: ['OWNER', 'MANAGER'],
    },
    {
      to: '#', // Use a dummy path or handle click directly
      label: 'Tutorial',
      icon: <HelpCircle size={20} />,
      onClick: (startTour: (tourId: any) => void) => {
        startTour('onboarding');
        localStorage.removeItem('rhysley_tour_completed');
      },
    },
  ];


  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        backgroundColor: '#0f1419',
        color: '#e4e6eb',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}
    >
      {/* ============================= */}
      {/* SIDE NAVBAR */}
      {/* ============================= */}
      <SideNavbar
        navItems={navItems}
        onLogout={logout}
        user={{
          name: user?.name,
          email: user?.email,
          role: user?.role,
          avatar: user?.avatar
        }}
        brandName="Rhysley"
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* ============================= */}
      {/* MAIN CONTENT AREA */}
      {/* ============================= */}
      <main className="flex-1 overflow-auto">
        <Routes>
          {/* ============================= */}
          {/* Dashboard - Owner only */}
          {/* ============================= */}
          <Route
            path="dashboard"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <PageWrapper>
                  <h2 className="text-3xl font-bold text-white mb-6">Dashboard</h2>
                  <AnalyticsPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Inbox - All users */}
          {/* ============================= */}
          <Route
            path="inbox/*"
            element={
              <ProtectedRoute>
                <InboxLayout />
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Contacts - All users */}
          {/* ============================= */}
          <Route
            path="contacts/*"
            element={
              <ProtectedRoute>
                <ContactsLayout />
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Bots - Owner only */}
          {/* ============================= */}
          <Route
            path="bots"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <BotListingPage />
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Bot Configuration - Owner only */}
          {/* ============================= */}
          <Route
            path="bot/:botId/*"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <BotLayout />
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Profile - All users */}
          {/* ============================= */}
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <PageWrapper>
                  <h2 className="text-3xl font-bold text-white mb-6">Profile</h2>
                  <ProfilePage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Team - Owner only */}
          {/* ============================= */}
          <Route
            path="team"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <PageWrapper>
                  <h2 className="text-3xl font-bold text-white mb-6">Team</h2>
                  <TeamPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Installation - Owner only */}
          {/* ============================= */}
          <Route
            path="installation"
            element={
              <ProtectedRoute allowedRoles={['OWNER', 'MANAGER']}>
                <PageWrapper>
                  <h2 className="text-3xl font-bold text-white mb-6">Installation</h2>
                  <EmbedPage />
                </PageWrapper>
              </ProtectedRoute>
            }
          />

          {/* ============================= */}
          {/* Default redirect */}
          {/* ============================= */}
          <Route path="*" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
};
