import React from 'react';

export function getInitials(name: string, maxChars = 3): string {
  if (!name || !name.trim()) return 'HF';
  const clean = name.trim().replace(/[^a-zA-Z0-9\s]/g, '');
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'HF';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();
  if (maxChars >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function getBrandGradient(_name?: string): { from: string; to: string; text: string; ring: string } {
  return {
    from: '#522D60',
    to: '#3E2149',
    text: '#FFFFFF',
    ring: 'ring-[#522D60]/30',
  };
}

export function generateMonogramDataUrl(_initials?: string, _size?: number, _nameForColor?: string): string {
  return '/logo.png';
}

/**
 * Universal HISAABFLOW App Branding Updater
 */
export function updateAppBranding(shopName?: string, _unusedShortName?: string): void {
  if (typeof document === 'undefined') return;

  const appTitle = 'HISAABFLOW';

  document.title = shopName && shopName !== 'HISAABFLOW' ? `${shopName} — HISAABFLOW` : 'HISAABFLOW';

  try {
    let appleTitle = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement | null;
    if (appleTitle) appleTitle.content = appTitle;

    let appNameMeta = document.querySelector("meta[name='application-name']") as HTMLMetaElement | null;
    if (appNameMeta) appNameMeta.content = appTitle;

    let ogTitle = document.querySelector("meta[property='og:title']") as HTMLMetaElement | null;
    if (ogTitle) ogTitle.content = appTitle;

    let favLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (favLink) favLink.href = '/logo.png';

    let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
    if (appleLink) appleLink.href = '/logo.png';

    if (shopName) {
      localStorage.setItem('cached_shop_name', shopName);
    }
  } catch (err) {
    console.warn('Branding sync warning:', err);
  }
}

/**
 * Universal Brand Badge - Renders the Official Logo Asset
 */
export function ShopBrandBadge({
  size = 'md',
  className = '',
}: {
  name?: string;
  shortName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const sizeClasses = {
    xs: 'w-6 h-6 rounded-md',
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
    xl: 'w-20 h-20 rounded-2xl shadow-lg',
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center p-1 bg-white border border-gray-100 shadow-xs shrink-0 select-none ${sizeClasses} ${className}`}
      title="HISAABFLOW"
    >
      <img
        src="/logo.png"
        alt="HISAABFLOW"
        className="w-full h-full object-contain"
      />
    </div>
  );
}
