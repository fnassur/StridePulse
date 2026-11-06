import React, { useState, useRef, useEffect } from 'react';
import { Activity, Flame, Plus, Moon, Sun, Watch, Trophy, User, LogOut, Cloud, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface NavbarProps {
  currentTab: 'dashboard' | 'workouts' | 'planner' | 'compare' | 'goals';
  setCurrentTab: (tab: 'dashboard' | 'workouts' | 'planner' | 'compare' | 'goals') => void;
  onOpenSyncModal: () => void;
  onOpenGoalsModal: () => void;
  onOpenAuthModal: () => void;
  distanceUnit: 'km' | 'mi';
  onToggleUnit: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  weeklyProgressPercent: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  onOpenSyncModal,
  onOpenGoalsModal,
  onOpenAuthModal,
  distanceUnit,
  onToggleUnit,
  isDark,
  onToggleTheme,
  weeklyProgressPercent,
}) => {
  const { user, signOutUser } = useAuth();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded-lg"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-sm shadow-orange-500/20">
              <Flame className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                StridePulse
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-wider text-orange-600 dark:text-orange-400">
                Keep Stridin
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentTab === 'dashboard'
                ? 'text-orange-600 dark:text-orange-400 font-semibold border-b-2 border-orange-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setCurrentTab('workouts')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentTab === 'workouts'
                ? 'text-orange-600 dark:text-orange-400 font-semibold border-b-2 border-orange-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Activity Log
          </button>
          <button
            onClick={() => setCurrentTab('planner')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentTab === 'planner'
                ? 'text-orange-600 dark:text-orange-400 font-semibold border-b-2 border-orange-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Training Calendar &amp; Workouts
          </button>
          <button
            onClick={() => setCurrentTab('compare')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentTab === 'compare'
                ? 'text-orange-600 dark:text-orange-400 font-semibold border-b-2 border-orange-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Progress Comparison
          </button>
          <button
            onClick={() => setCurrentTab('goals')}
            className={`whitespace-nowrap transition-colors py-1 ${
              currentTab === 'goals'
                ? 'text-orange-600 dark:text-orange-400 font-semibold border-b-2 border-orange-500'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Weekly Goals
          </button>
        </nav>

        {/* Zone 3: Primary Action & Tools */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Unit Toggle */}
          <button
            onClick={onToggleUnit}
            title={`Switch to ${distanceUnit === 'km' ? 'Miles' : 'Kilometers'}`}
            className="flex h-9 items-center justify-center rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900 transition-colors"
          >
            <span className={distanceUnit === 'km' ? 'text-orange-600 dark:text-orange-400' : ''}>KM</span>
            <span className="mx-1 text-slate-300 dark:text-slate-600">/</span>
            <span className={distanceUnit === 'mi' ? 'text-orange-600 dark:text-orange-400' : ''}>MI</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle theme"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Garmin Sync / Add Run Button */}
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-orange-600 dark:hover:bg-orange-500 transition-colors"
          >
            <Watch className="h-4 w-4" />
            <span className="hidden sm:inline">Sync Garmin</span>
            <span className="sm:hidden">Sync</span>
          </button>

          {/* User Account / Auth Status */}
          {user ? (
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen(!isAccountMenuOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 p-1 pr-2.5 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-850 transition-colors"
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white uppercase">
                    {(user.displayName || user.email || 'U')[0]}
                  </div>
                )}
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-mono">
                    <Cloud className="h-2.5 w-2.5" />
                    <span>Synced</span>
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {/* Account Dropdown */}
              {isAccountMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-fadeIn">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {user.displayName || 'StridePulse Runner'}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                      <Cloud className="h-3 w-3" />
                      <span>Cloud Sync Active</span>
                    </span>
                  </div>

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={async () => {
                        setIsAccountMenuOpen(false);
                        await signOutUser();
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Sign In</span>
              <span className="sm:hidden">Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
