'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Users,
  Building2,
  Star,
  BarChart3,
  TrendingUp,
  Briefcase,
  FileText,
  Search,
  Trophy,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  UserCircle,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Avatar } from '@/components/common/Avatar';

const baseNavItems = [
  { href: '/dashboard',       label: 'Dashboard',        icon: LayoutDashboard, roles: ['user', 'company', 'admin'] },
  { href: '/search',          label: 'Buscar',            icon: Search,          roles: ['user', 'company', 'admin'] },
  { href: '/professionals',   label: 'Profesionales',     icon: Users,           roles: ['user', 'company', 'admin'] },
  { href: '/companies',       label: 'Empresas',          icon: Building2,       roles: ['user', 'company', 'admin'] },

  // Solo profesionales: buscar y aplicar a empleos
  { href: '/jobs',            label: 'Empleos',           icon: Briefcase,       roles: ['user', 'admin'] },
  { href: '/applications',    label: 'Mis Solicitudes',   icon: FileText,        roles: ['user', 'admin'] },

  // Solo empresas: publicar búsquedas y ver candidatos
  { href: '/job-posts',       label: 'Mis Publicaciones', icon: Briefcase,       roles: ['company', 'admin'] },
  { href: '/candidates',      label: 'Candidatos',        icon: Users,           roles: ['company', 'admin'] },

  { href: '/ratings',         label: 'Evaluaciones',      icon: Star,            roles: ['user', 'company', 'admin'] },
  { href: '/my-evaluations',  label: 'Mis Evaluaciones',  icon: ClipboardList,   roles: ['user', 'company', 'admin'] },
  { href: '/analytics',       label: 'Analytics',         icon: BarChart3,       roles: ['user', 'company', 'admin'] },
  { href: '/insights',        label: 'Insights',          icon: TrendingUp,      roles: ['user', 'company', 'admin'] },
  { href: '/rankings',        label: 'Rankings',          icon: Trophy,          roles: ['user', 'company', 'admin'] },
  { href: '/profile',         label: 'Mi Perfil',         icon: UserCircle,      roles: ['user', 'company', 'admin'] },
  { href: '/settings',        label: 'Configuración',     icon: Settings,        roles: ['user', 'company', 'admin'] },
];

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role ?? 'user';
  const navItems = baseNavItems.filter((item) => item.roles.includes(role));

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={clsx(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors group',
          active
            ? 'bg-blue-50 text-blue-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        )}
      >
        <Icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600')} />
        {item.label}
        {active && <ChevronRight className="w-3 h-3 ml-auto text-blue-400" />}
      </Link>
    );
  };

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-gray-200 w-64">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 py-5 border-b border-gray-100">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-white" />
        </div>
        <span className="text-lg font-bold text-gray-900">Borasi</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {navItems.map((item) => <NavLink key={item.href} item={item} />)}
      </nav>

      {/* User footer */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
          <Avatar initials={user?.name?.slice(0, 2) ?? 'U'} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name ?? 'Usuario'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen((open) => !open)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
              <Trophy className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-gray-900">Borasi</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}