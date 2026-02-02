'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  X, LogOut, ChevronRight, Loader2,
  // Icons used by registry
  LayoutDashboard, Users, Package, Building2, Truck, Link as LinkIcon,
  Warehouse, HardHat, Calendar, Headphones, Banknote, TrendingUp, Tags,
  MapPin, Brain, Bot, LineChart, Activity, Shield, ShieldAlert,
  AlertTriangle, FileCheck, BookOpen, Award, Server, Bell, Home,
  Settings, Wallet, Sparkles, Lock, Cog
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSession, useLogout } from '@/lib/auth-system/sessionHooks';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getEnginesGrouped,
  ENGINE_GROUP_ORDER,
  ENGINE_GROUP_META,
  type AdminRole,
  type EngineGroup,
  type AdminEngine
} from './ADMIN_ENGINE_REGISTRY';

// Icon mapping from string names to components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, Users, Package, Building2, Truck, Link: LinkIcon,
  Warehouse, HardHat, Calendar, Headphones, Banknote, TrendingUp, Tags,
  MapPin, Brain, Bot, LineChart, Activity, Shield, ShieldAlert,
  AlertTriangle, FileCheck, BookOpen, Award, Server, Bell, Home,
  Settings, Wallet, Sparkles, Lock, Cog,
};

interface AdminSidebarProps {
  className?: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  className,
  isOpen = false,
  onToggle
}) => {
  const { role, loading } = useSession();
  const { logout } = useLogout();
  const pathname = usePathname();
  const [isHovered, setIsHovered] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<EngineGroup>>(
    new Set(['Core', 'Operations']) // Default expanded groups
  );

  // Sidebar expands on hover or when pinned open
  const showExpanded = isOpen || isHovered;

  const handleLogout = async () => {
    await logout();
  };

  const toggleGroup = (group: EngineGroup) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Get engines grouped by role
  const groupedEngines = getEnginesGrouped(role as AdminRole | null);

  // Render loading state
  if (loading) {
    return (
      <aside
        className={cn(
          "fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-50 overflow-y-auto",
          showExpanded ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-20",
          className
        )}
      >
        <div className="p-4 space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <div className="pt-4 border-t">
            <Skeleton className="h-6 w-1/2 mb-2" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </aside>
    );
  }

  // Render empty state if no role (should redirect)
  if (!role) {
    return (
      <aside
        className={cn(
          "fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-50",
          showExpanded ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-20",
          className
        )}
      >
        <div className="p-4 flex flex-col items-center justify-center h-full text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">Loading permissions...</p>
        </div>
      </aside>
    );
  }

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-50 overflow-y-auto custom-scrollbar",
        showExpanded ? "translate-x-0 w-64 shadow-2xl" : "-translate-x-full md:translate-x-0 md:w-20",
        className
      )}
    >
      <div className="h-full py-4 flex flex-col">
        {/* Mobile close button */}
        <div className="px-4 flex justify-between items-center mb-4 md:hidden">
          <div className="text-lg font-semibold">Menu</div>
          <button onClick={onToggle} className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation - Grouped by Engine Groups */}
        <nav className="flex-1 px-2 space-y-4">
          {ENGINE_GROUP_ORDER.map((group) => {
            const engines = groupedEngines[group];
            if (engines.length === 0) return null;

            const isExpanded = expandedGroups.has(group);
            const GroupIcon = ICON_MAP[ENGINE_GROUP_META[group].icon] || Home;

            return (
              <div key={group}>
                {/* Group Header */}
                {showExpanded ? (
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
                  >
                    <span>{ENGINE_GROUP_META[group].label}</span>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <div className="flex justify-center py-2">
                    <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                )}

                {/* Engine Items */}
                {(isExpanded || !showExpanded) && (
                  <div className="mt-1 space-y-1">
                    {engines.map((engine) => {
                      const Icon = ICON_MAP[engine.icon] || Home;
                      const isActive = pathname === engine.href || pathname?.startsWith(`${engine.href}/`);

                      return (
                        <Link
                          key={engine.id}
                          href={engine.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                            isActive
                              ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                              : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800",
                            showExpanded ? "justify-start" : "justify-center"
                          )}
                          title={!showExpanded ? engine.label : undefined}
                        >
                          <Icon className={cn("shrink-0", showExpanded ? "h-5 w-5" : "h-6 w-6")} />
                          {showExpanded && (
                            <span className="truncate flex-1">{engine.label}</span>
                          )}
                          {showExpanded && engine.status === 'stub' && (
                            <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded">
                              Soon
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="mt-auto px-2 pt-4 pb-2 border-t border-gray-200 dark:border-gray-800">
          <Button
            variant="outline"
            className={cn(
              "w-full bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 dark:border-red-800",
              showExpanded ? "justify-start" : "justify-center px-0"
            )}
            onClick={handleLogout}
            title={!showExpanded ? "Logout" : undefined}
          >
            <LogOut className={cn("h-5 w-5", showExpanded ? "mr-3" : "")} />
            {showExpanded && <span>Logout</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
};

export { AdminSidebar };