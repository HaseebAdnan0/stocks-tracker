'use client';

import { useState } from 'react';

interface StaleDataWarningProps {
  isStale: boolean;
  lastUpdated: Date | null;
  className?: string;
}

function formatRelativeTime(lastUpdated: Date | null): string {
  if (!lastUpdated) return 'unknown';

  const now = new Date();
  const diffMs = now.getTime() - lastUpdated.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes === 1) return '1 minute ago';
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

export default function StaleDataWarning({
  isStale,
  lastUpdated,
  className = '',
}: StaleDataWarningProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isStale) {
    return null;
  }

  const relativeTime = formatRelativeTime(lastUpdated);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <svg
          className="w-5 h-5 text-yellow-500 cursor-help"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>

        {showTooltip && (
          <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded shadow-lg whitespace-nowrap border border-gray-700">
            <div className="font-medium">Data may be stale</div>
            <div className="text-gray-400 text-xs mt-1">Last updated: {relativeTime}</div>
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
              <div className="border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
