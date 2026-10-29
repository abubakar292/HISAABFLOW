import React from 'react';

interface AppLoaderProps {
  isLoading?: boolean;
  shopName?: string;
  subTitle?: string;
}

export default function AppLoader({ isLoading = true }: AppLoaderProps) {
  if (!isLoading) return null;

  return (
    <div
      aria-label="Loading"
      role="status"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 backdrop-blur-md select-none transition-all duration-300"
    >
      {/* Soft ambient brand glow */}
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#522D60]/10 via-purple-500/10 to-transparent blur-3xl pointer-events-none" />

      {/* Perfectly Centered Geometric Spinner Container */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
        {/* Full-size SVG with identical coordinates for both track and rotating arc */}
        <svg
          className="absolute inset-0 w-full h-full animate-[spin_1.1s_linear_infinite]"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="loader-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#522D60" />
              <stop offset="60%" stopColor="#8A2BE2" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>
          </defs>

          {/* Minimalist static background track (concentric circle cx=50, cy=50) */}
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="#F3EAF6"
            strokeWidth="3"
            fill="none"
          />

          {/* Smooth dynamic rotating arc with rounded ends */}
          <circle
            cx="50"
            cy="50"
            r="44"
            stroke="url(#loader-brand-grad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray="90 190"
            fill="none"
          />
        </svg>

        {/* Logo at exact mathematical center (using absolute inset-0 m-auto) */}
        <div className="absolute inset-0 m-auto w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-[0_4px_18px_rgba(82,45,96,0.18)] border border-purple-100/80 bg-white flex items-center justify-center pointer-events-none">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
