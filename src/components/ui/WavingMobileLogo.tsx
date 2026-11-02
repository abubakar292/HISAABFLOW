import React from 'react';

interface WavingMobileLogoProps {
  size?: number; // size in pixels, default 110
  className?: string;
}

export const WavingMobileLogo: React.FC<WavingMobileLogoProps> = ({ size = 110, className = '' }) => {
  return (
    <div
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <style>{`
        @keyframes mobileHandWave {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(26deg); }
          30% { transform: rotate(-8deg); }
          45% { transform: rotate(24deg); }
          60% { transform: rotate(-4deg); }
          75% { transform: rotate(18deg); }
          100% { transform: rotate(0deg); }
        }

        @keyframes mascotBreathing {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }

        @keyframes lightbulbGlow {
          0%, 100% { opacity: 0.85; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.12); }
        }

        @keyframes mascotBlink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }

        .animate-hand-wave {
          transform-origin: 82px 76px;
          animation: mobileHandWave 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .animate-mascot-idle {
          animation: mascotBreathing 3s ease-in-out infinite;
        }

        .animate-lightbulb {
          transform-origin: 94px 34px;
          animation: lightbulbGlow 2.4s ease-in-out infinite;
        }

        .animate-blink {
          transform-origin: 64px 74px;
          animation: mascotBlink 4s infinite;
        }
      `}</style>

      {/* SVG Mascot Character matching the official HisaabFlow brand icon */}
      <svg
        viewBox="0 0 140 140"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible drop-shadow-[0_12px_24px_rgba(82,45,96,0.28)]"
      >
        <defs>
          {/* Card subtle gradient */}
          <linearGradient id="cardGrad" x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5D336E" />
            <stop offset="1" stopColor="#452352" />
          </linearGradient>

          {/* Lightbulb glow gradient */}
          <radialGradient id="bulbGlowGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FDE047" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#EAB308" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
          </radialGradient>

          {/* Phone body sheen */}
          <linearGradient id="phoneScreenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#F0F7FF" />
            <stop offset="1" stopColor="#D9ECFD" />
          </linearGradient>

          {/* Card Border glow */}
          <linearGradient id="borderGrad" x1="0" y1="0" x2="140" y2="140">
            <stop stopColor="#A855F7" stopOpacity="0.6" />
            <stop offset="1" stopColor="#E9D5FF" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* 1. App Icon Rounded Card Container (#522D60) */}
        <rect
          x="6"
          y="6"
          width="128"
          height="128"
          rx="32"
          fill="url(#cardGrad)"
          stroke="url(#borderGrad)"
          strokeWidth="2.5"
        />

        {/* Subtle interior sheen */}
        <path
          d="M 6 38 C 6 20 20 6 38 6 L 102 6 C 60 20 20 60 6 102 Z"
          fill="white"
          fillOpacity="0.06"
        />

        {/* 2. Character Body Group with gentle breathing motion */}
        <g className="animate-mascot-idle">
          {/* Mascot Feet */}
          <ellipse cx="54" cy="113" rx="4.5" ry="3" fill="#1E1424" />
          <ellipse cx="74" cy="113" rx="4.5" ry="3" fill="#1E1424" />

          {/* Legs */}
          <line x1="54" y1="104" x2="54" y2="112" stroke="#1E1424" strokeWidth="3" strokeLinecap="round" />
          <line x1="74" y1="104" x2="74" y2="112" stroke="#1E1424" strokeWidth="3" strokeLinecap="round" />

          {/* Left Arm (Relaxed at side) */}
          <path
            d="M 45 74 Q 37 81 41 91"
            stroke="#1E1424"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left Hand */}
          <circle cx="41.5" cy="91.5" r="2.6" fill="#1E1424" />

          {/* 3. Smartphone Body */}
          {/* Phone Outer Chassis Shadow */}
          <rect
            x="46"
            y="42"
            width="36"
            height="62"
            rx="8"
            fill="#CBD5E1"
          />

          {/* Phone Outer Chassis (Clean White/Silver) */}
          <rect
            x="45"
            y="41"
            width="36"
            height="62"
            rx="8"
            fill="#FFFFFF"
            stroke="#94A3B8"
            strokeWidth="1.2"
          />

          {/* Phone Screen Glass */}
          <rect
            x="48"
            y="46"
            width="30"
            height="50"
            rx="5"
            fill="url(#phoneScreenGrad)"
          />

          {/* Phone Top Ear-Speaker pill */}
          <rect
            x="59"
            y="43.5"
            width="8"
            height="1.8"
            rx="0.9"
            fill="#64748B"
          />

          {/* Cute Face on the Screen */}
          <g className="animate-blink">
            {/* Left Eye */}
            <circle cx="57" cy="67" r="2.2" fill="#1E293B" />
            <circle cx="56.3" cy="66.3" r="0.8" fill="#FFFFFF" />

            {/* Right Eye */}
            <circle cx="69" cy="67" r="2.2" fill="#1E293B" />
            <circle cx="68.3" cy="66.3" r="0.8" fill="#FFFFFF" />

            {/* Blushing Cheeks */}
            <ellipse cx="54" cy="72" rx="2.5" ry="1.2" fill="#F43F5E" fillOpacity="0.45" />
            <ellipse cx="72" cy="72" rx="2.5" ry="1.2" fill="#F43F5E" fillOpacity="0.45" />

            {/* Happy Smile Mouth */}
            <path
              d="M 60.5 73.5 Q 63 77.5 65.5 73.5"
              stroke="#1E293B"
              strokeWidth="1.8"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* Home indicator bar at bottom of screen */}
          <rect
            x="58"
            y="92"
            width="10"
            height="1.5"
            rx="0.75"
            fill="#94A3B8"
          />

          {/* 4. Glowing Lightbulb above top-right corner (Idea/Smart Symbol) */}
          <g className="animate-lightbulb">
            {/* Ambient Radial Aura */}
            <circle cx="94" cy="34" r="16" fill="url(#bulbGlowGrad)" />

            {/* Spark Rays */}
            <line x1="94" y1="18" x2="94" y2="22" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="106" y1="24" x2="103" y2="27" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="109" y1="34" x2="105" y2="34" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="82" y1="24" x2="85" y2="27" stroke="#FDE047" strokeWidth="2.2" strokeLinecap="round" />

            {/* Lightbulb Glass */}
            <path
              d="M 94 24 C 90 24 87 27 87 31 C 87 33.5 88.5 35.5 90 37 L 90 39.5 C 90 40.5 91 41 92 41 L 96 41 C 97 41 98 40.5 98 39.5 L 98 37 C 99.5 35.5 101 33.5 101 31 C 101 27 98 24 94 24 Z"
              fill="#FACC15"
              stroke="#CA8A04"
              strokeWidth="1"
            />
            {/* Filament highlight */}
            <path
              d="M 92 30 Q 94 27 96 30"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Bulb Base */}
            <rect x="91" y="41" width="6" height="2.5" rx="1" fill="#71717A" />
          </g>

          {/* 5. Right Arm & Waving Hand (Saying "Hello!") */}
          <g className="animate-hand-wave">
            {/* Arm swinging up to wave */}
            <path
              d="M 81 74 Q 92 68 95 56"
              stroke="#1E1424"
              strokeWidth="3.4"
              strokeLinecap="round"
              fill="none"
            />
            {/* Open Palm Waving */}
            <circle cx="95.5" cy="54.5" r="3.2" fill="#1E1424" />
            {/* Cute Fingers Spread */}
            <circle cx="94" cy="50" r="1.5" fill="#1E1424" />
            <circle cx="98" cy="51" r="1.5" fill="#1E1424" />
            <circle cx="100.5" cy="54.5" r="1.5" fill="#1E1424" />
            {/* Little wave wind accents */}
            <path
              d="M 104 46 Q 107 50 105 55"
              stroke="#FDE047"
              strokeWidth="1.4"
              strokeLinecap="round"
              fill="none"
              opacity="0.85"
            />
          </g>
        </g>
      </svg>
    </div>
  );
};
