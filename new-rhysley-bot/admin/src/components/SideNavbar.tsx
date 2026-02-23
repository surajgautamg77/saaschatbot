import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, LogOut, HelpCircle } from 'lucide-react';
import { useTourStore } from '../store/useTourStore';

// This maps the route path (e.g., '/bots') to the data-tour ID (e.g., 'nav-bots')
// used in our admin/src/tours/onboarding.ts file.
const getTourAttribute = (path: string) => {
  if (path === '/bots') return 'nav-bots';
  if (path === '/inbox') return 'nav-inbox';
  if (path === '/installation') return 'nav-installation';
  if (path === '/') return 'nav-dashboard';
  return undefined; // specific items don't get a tour tag
};

export interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  requiresRole?: ('OWNER' | 'AGENT' | 'SUPER_ADMIN' | 'MANAGER')[];
  activeWhen?: string[];
  onClick?: (startTour: (tourId: any) => void) => void;
}

interface SideNavbarProps {
  navItems: NavItem[];
  onLogout?: () => void;
  user?: {
    name?: string;
    email?: string;
    role?: string;
    avatar?: string;
  };
  brandName?: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const SideNavbar: React.FC<SideNavbarProps> = ({
  navItems,
  onLogout,
  user,
  brandName = 'RhysleyBot',
  isCollapsed: controlledCollapsed,
  onToggleCollapse
}) => {
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const location = useLocation();
  const { startTour } = useTourStore();

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const handleToggle = onToggleCollapse || (() => setInternalCollapsed(!internalCollapsed));

  const isActive = (path: string, activeWhen?: string[]) => {
    if (path === '#') return false;
    let isActive = location.pathname === path || location.pathname.startsWith(path + '/');
    if (!isActive && activeWhen) {
      for (const p of activeWhen) {
        if (location.pathname.startsWith(p)) {
          isActive = true;
          break;
        }
      }
    }
    return isActive;
  };

  const filteredNavItems = navItems.filter(item => {
    if (item.requiresRole) {
      if (!user?.role || !item.requiresRole.includes(user.role as any)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div
      style={{
        width: isCollapsed ? '80px' : '256px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
      className="ml-4 my-4 rounded-md bg-gradient-to-br from-[#0b1f3a] via-[#0a1930] to-[#020633] shadow-md shadow-gray-900 flex flex-col h-[calc(100vh-2rem)]"
    >
      {/* HEADER SECTION */}
      <div className="p-4 flex items-center justify-between border-b border-gray-800">
        {!isCollapsed && (
          <h1 className="text-xl font-bold text-white">
            <span className="text-blue-400">{brandName.split('Bot')[0]}</span>
            <span className="text-gray-300">Bot</span>
          </h1>
        )}
        <button
          onClick={handleToggle}
          className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors ml-auto"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      {/* NAVIGATION ITEMS */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {filteredNavItems.map((item) => (
            <li key={item.label}>
              {item.onClick ? (
                <button
                  onClick={() => item.onClick!(startTour)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative text-gray-400 hover:bg-blue-600 hover:text-white w-full"
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!isCollapsed && <span className="text-lg">{item.label}</span>}
                </button>
              ) : (
                <NavLink
                  to={item.to}
                  data-tour={getTourAttribute(item.to)}
                  className={({ isActive: navIsActive }) => {
                    const active = navIsActive || isActive(item.to, item.activeWhen);
                    return `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${active
                        ? 'bg-gradient-to-r from-blue-700 to-blue-900 text-white font-medium shadow-lg'
                        : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                      }`;
                  }}
                >
                  {({ isActive: navIsActive }) => {
                    const active = navIsActive || isActive(item.to, item.activeWhen);
                    return (
                      <>
                        <span className={`flex-shrink-0 ${active ? 'bg-white/20 text-white rounded-md p-1' : ''}`}>
                          {item.icon}
                        </span>

                        {!isCollapsed && (
                          <>
                            <span className="flex-1 text-lg">{item.label}</span>
                            {item.badge !== undefined && item.badge > 0 && (
                              <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${active ? 'bg-blue-600 text-white' : 'bg-yellow-400 text-black'}`}>
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                          </>
                        )}

                        {isCollapsed && item.badge !== undefined && item.badge > 0 && (
                          <span
                            className="absolute flex items-center justify-center w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full"
                            style={{ top: '-4px', right: '-4px' }}
                          >
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </>
                    );
                  }}
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </nav>

      {/* USER SECTION */}
      {user && (
        <div className="border-t border-gray-800 p-4">
          {!isCollapsed ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.name?.charAt(0).toUpperCase() || 'U'
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-md font-medium text-white truncate">
                    {user.name || 'User'}
                  </p>
                  <p className="text-sm text-gray-400 truncate">
                    {user.email || user.role}
                  </p>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-black font-bold">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 rounded-lg text-gray-400 hover:bg-red-600 hover:text-white transition-colors"
                  aria-label="Logout"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};