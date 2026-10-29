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
      {/* Subtle ambient light glow */}
      <div className="absolute w-80 h-80 rounded-full bg-gradient-to-tr from-[#522D60]/10 via-[#7c3aed]/10 to-transparent blur-3xl pointer-events-none animate-pulse" />

      {/* Lottie-grade Minimalist Next-Level Loader (Zero Text) */}
      <div className="relative flex items-center justify-center">
        {/* Outer orbital halo */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[2.5px] border-[#522D60]/10" />

        {/* Outer counter-rotating dashed precision ring */}
        <div className="absolute w-24 h-24 sm:w-28 sm:h-28 rounded-full border-[2.5px] border-transparent border-t-[#522D60]/40 border-r-[#522D60]/20 animate-[spin_3s_linear_infinite_reverse]" />

        {/* Primary fluid sweep ring with vibrant brand gradient */}
        <svg
          className="absolute w-20 h-20 sm:w-24 sm:h-24 animate-[spin_1.4s_cubic-bezier(0.4,0,0.2,1)_infinite]"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="loader-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#522D60" stopOpacity="1" />
              <stop offset="60%" stopColor="#8A2BE2" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="40"
            stroke="url(#loader-brand-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="180 80"
          />
        </svg>

        {/* Inner fast-orbiting satellite track */}
        <div className="absolute w-14 h-14 sm:w-16 sm:h-16 animate-[spin_1.8s_linear_infinite]">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-[#522D60] to-[#9333EA] shadow-[0_0_10px_rgba(147,51,234,0.6)]" />
        </div>

        {/* Center breathing crystal core with subtle emblem geometry */}
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-[#522D60] to-[#3B1E45] shadow-lg shadow-[#522D60]/25 flex items-center justify-center animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
          <div className="w-3.5 h-3.5 rounded-md border-2 border-white/80 rotate-45 transform transition-transform duration-500" />
        </div>
      </div>
    </div>
  );
}
