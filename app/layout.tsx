import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { AuthProvider } from '@/contexts/AuthContext';

export const metadata: Metadata = {
  title: 'PSX Shariah Portfolio Tracker',
  description: 'Track your KMI-30 Shariah-compliant portfolio on Pakistan Stock Exchange',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#1a1a2e] text-white">
        <AuthProvider>
          <div className="min-h-screen flex">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <main className="flex-1 px-4 sm:px-6 py-6 overflow-y-auto">
                {children}
              </main>
              <footer className="bg-[#16213e] border-t border-gray-700">
                <div className="px-4 sm:px-6 py-4">
                  <p className="text-center text-sm text-gray-400">
                    PSX Shariah Portfolio Tracker - Data refreshes every 15 seconds
                  </p>
                </div>
              </footer>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
