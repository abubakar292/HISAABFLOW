import React from 'react';

interface AppLoaderProps {
  isLoading: boolean;
  shopName?: string;
  subTitle?: string;
}

export default function AppLoader({ isLoading }: AppLoaderProps) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white select-none transition-opacity duration-300">
      <div className="flex flex-col items-center max-w-xs text-center px-4">
        {/* Clean Logo Presentation */}
        <div className="w-16 h-16 sm:w-20 sm:h-20 mb-3 flex items-center justify-center">
          <img
            src="/logo.png"
            alt="HISAABFLOW"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Brand Name */}
        <h2 className="text-lg sm:text-xl font-black tracking-wide text-[#522D60] uppercase">
          HISAABFLOW
        </h2>
        
        {/* Subtle Minimalist Indicator */}
        <div className="mt-4 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#522D60] animate-pulse" />
          <span className="w-2 h-2 rounded-full bg-[#522D60]/60 animate-pulse [animation-delay:200ms]" />
          <span className="w-2 h-2 rounded-full bg-[#522D60]/30 animate-pulse [animation-delay:400ms]" />
        </div>
      </div>
    </div>
  );
}
