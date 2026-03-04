interface ShariahBadgeProps {
  indices?: string[];
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export default function ShariahBadge({ indices, size = 'sm' }: ShariahBadgeProps) {
  const isKMI30 = indices?.includes('kmi30') || indices?.includes('KMI-30');
  const isKMIAllShare = indices?.includes('kmi_all_share') || indices?.includes('KMI All Share');

  if (!isKMI30 && !isKMIAllShare) {
    return null;
  }

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-xs',
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-3 py-1.5 text-sm',
  };

  if (isKMI30) {
    return (
      <span
        className={`${sizeClasses[size]} bg-green-500/20 text-green-400 font-semibold rounded-full border border-green-500/50 inline-block whitespace-nowrap`}
        title="Shariah Compliant - KMI-30 Index"
      >
        KMI-30
      </span>
    );
  }

  if (isKMIAllShare) {
    return (
      <span
        className={`${sizeClasses[size]} bg-blue-500/20 text-blue-400 font-semibold rounded-full border border-blue-500/50 inline-block whitespace-nowrap`}
        title="Shariah Compliant - KMI All Share Index"
      >
        KMI All Share
      </span>
    );
  }

  return null;
}
