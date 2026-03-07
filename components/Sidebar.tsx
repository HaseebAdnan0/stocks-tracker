'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', path: '/', icon: '📊' },
  { name: 'My Portfolio', path: '/portfolio', icon: '💼' },
  { name: 'Settings', path: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActivePath = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex md:flex-col md:w-52 bg-[#16213e] border-r border-gray-700">
        <div className="flex items-center h-16 px-6 border-b border-gray-700">
          <h1 className="text-lg font-bold text-green-400">PSX Tracker</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navigation.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`flex items-center px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
                isActivePath(item.path)
                  ? 'bg-green-500/20 text-green-400 font-semibold'
                  : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <span className="mr-3 text-xl">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="px-4 py-3 border-t border-gray-700">
            <div className="flex items-center mb-2">
              <span className="mr-2 text-lg">👤</span>
              <span className="text-sm text-gray-300 font-medium truncate">{user.username}</span>
            </div>
            <button
              onClick={logout}
              className="w-full px-3 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
        <div className="px-4 py-4 border-t border-gray-700">
          <p className="text-xs text-gray-500 text-center">KMI-30 Shariah Compliant</p>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          ></div>
          <aside className="fixed inset-y-0 left-0 w-52 bg-[#16213e] border-r border-gray-700">
            <div className="flex items-center justify-between h-16 px-6 border-b border-gray-700">
              <h1 className="text-lg font-bold text-green-400">PSX Tracker</h1>
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <nav className="px-4 py-6 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors whitespace-nowrap ${
                    isActivePath(item.path)
                      ? 'bg-green-500/20 text-green-400 font-semibold'
                      : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  <span className="mr-3 text-xl">{item.icon}</span>
                  {item.name}
                </Link>
              ))}
            </nav>
            {user && (
              <div className="px-4 py-3 border-t border-gray-700 absolute bottom-16 left-0 right-0">
                <div className="flex items-center mb-2">
                  <span className="mr-2 text-lg">👤</span>
                  <span className="text-sm text-gray-300 font-medium truncate">{user.username}</span>
                </div>
                <button
                  onClick={logout}
                  className="w-full px-3 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}
            <div className="px-4 py-4 border-t border-gray-700 absolute bottom-0 left-0 right-0">
              <p className="text-xs text-gray-500 text-center">KMI-30 Shariah Compliant</p>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile Header */}
      <header className="bg-[#16213e] border-b border-gray-700 h-16 md:hidden fixed top-0 left-0 right-0 z-40">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(true)}
              className="mr-4 text-gray-400 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-green-400">PSX Tracker</h1>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300 hidden sm:inline">{user.username}</span>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Mobile spacer */}
      <div className="h-16 md:hidden"></div>
    </>
  );
}
