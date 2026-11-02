import React from 'react';

interface WavingMobileLogoProps {
  size?: number; // size in pixels, default 115
  className?: string;
}

export const WavingMobileLogo: React.FC<WavingMobileLogoProps> = ({ size = 115, className = '' }) => {
  return (
    <div
      className={`relative select-none flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <style>{`
        /* Smooth, natural multi-phase hand waving animation */
        @keyframes fluidHandWave {
          0% {
            transform: rotate(0deg);
          }
          14% {
            transform: rotate(28deg);
          }
          28% {
            transform: rotate(-10deg);
          }
          42% {
            transform: rotate(26deg);
          }
          56% {
            transform: rotate(-6deg);
          }
          70% {
            transform: rotate(20deg);
          }
          84% {
            transform: rotate(-2deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }

        /* Joyful subtle floating bounce */
        @keyframes mascotJoyBounce {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          30% {
            transform: translateY(-4px) rotate(1.2deg);
          }
          70% {
            transform: translateY(-2px) rotate(-1.2deg);
          }
        }

        /* Lightbulb radiant energy pulse */
        @keyframes lightbulbPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.88;
          }
          50% {
            transform: scale(1.18);
            opacity: 1;
          }
        }

        /* Lightbulb spark rays spinning & breathing */
        @keyframes raysShine {
          0%, 100% {
            opacity: 0.65;
            transform: scale(0.95);
          }
          50% {
            opacity: 1;
            transform: scale(1.15);
          }
        }

        /* Natural blink cycle */
        @keyframes eyeBlink {
          0%, 88%, 94%, 100% {
            transform: scaleY(1);
          }
          91% {
            transform: scaleY(0.08);
          }
        }

        /* Little wind / waving trail breeze */
        @keyframes waveTrail {
          0%, 100% {
            opacity: 0.3;
            transform: translateX(0) scale(0.9);
          }
          50% {
            opacity: 0.95;
            transform: translateX(3px) scale(1.1);
          }
        }

        .anim-hand-wave {
          transform-origin: 82px 76px;
          animation: fluidHandWave 2.4s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite;
        }

        .anim-mascot-joy {
          animation: mascotJoyBounce 3.2s ease-in-out infinite;
        }

        .anim-bulb-core {
          transform-origin: 94px 34px;
          animation: lightbulbPulse 2.2s ease-in-out infinite;
        }

        .anim-bulb-rays {
          transform-origin: 94px 34px;
          animation: raysShine 2s ease-in-out infinite;
        }

        .anim-eye-blink {
          transform-origin: 64px 67px;
          animation: eyeBlink 3.8s ease-in-out infinite;
        }

        .anim-wave-trail {
          animation: waveTrail 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* High-Fidelity SVG Mascot */}
      <svg
        viewBox="0 0 140 140"
        width="100%"
        height="100%"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible drop-shadow-[0_16px_32px_rgba(82,45,96,0.35)]"
      >
        <defs>
          {/* Card Outer Deep Royal Gradient */}
          <linearGradient id="cardBg" x1="10" y1="10" x2="130" y2="130" gradientUnits="userSpaceOnUse">
            <stop stopColor="#5E316E" />
            <stop offset="0.5" stopColor="#522D60" />
            <stop offset="1" stopColor="#3B1C47" />
          </linearGradient>

          {/* Card Border Glow */}
          <linearGradient id="cardBorder" x1="0" y1="0" x2="140" y2="140" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C084FC" stopOpacity="0.8" />
            <stop offset="0.5" stopColor="#A855F7" stopOpacity="0.3" />
            <stop offset="1" stopColor="#F472B6" stopOpacity="0.5" />
          </linearGradient>

          {/* Lightbulb Sunburst Gradient */}
          <radialGradient id="bulbGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#FACC15" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#EAB308" stopOpacity="0" />
          </radialGradient>

          {/* Smartphone Screen Glass */}
          <linearGradient id="screenGlass" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#F0F8FF" />
            <stop offset="0.6" stopColor="#E2F1FE" />
            <stop offset="1" stopColor="#CCE6FD" />
          </linearGradient>

          {/* Smartphone Metallic Edge */}
          <linearGradient id="phoneMetal" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.5" stopColor="#E2E8F0" />
            <stop offset="1" stopColor="#94A3B8" />
          </linearGradient>

          {/* Cheeks soft blush */}
          <radialGradient id="blushGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FB7185" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. App Rounded Card Container (#522D60) */}
        <rect
          x="6"
          y="6"
          width="128"
          height="128"
          rx="32"
          fill="url(#cardBg)"
          stroke="url(#cardBorder)"
          strokeWidth="2.5"
        />

        {/* Diagonal Gloss Sheen across card */}
        <path
          d="M 6 42 C 6 22 22 6 42 6 L 102 6 C 58 22 22 62 6 106 Z"
          fill="white"
          fillOpacity="0.08"
        />

        {/* 2. Character Body with Joyful Floating Animation */}
        <g className="anim-mascot-joy">
          {/* Mascot Shoes */}
          <ellipse cx="53" cy="114" rx="5" ry="3.2" fill="#18111D" />
          <ellipse cx="73" cy="114" rx="5" ry="3.2" fill="#18111D" />

          {/* Mascot Legs */}
          <line x1="53" y1="104" x2="53" y2="113" stroke="#18111D" strokeWidth="3.2" strokeLinecap="round" />
          <line x1="73" y1="104" x2="73" y2="113" stroke="#18111D" strokeWidth="3.2" strokeLinecap="round" />

          {/* Left Arm (Resting warmly on hip) */}
          <path
            d="M 45 74 Q 35 81 40 91"
            stroke="#18111D"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="40.5" cy="91.5" r="2.8" fill="#18111D" />

          {/* 3. Smartphone Body */}
          {/* Soft chassis drop shadow */}
          <rect
            x="46"
            y="42"
            width="36"
            height="63"
            rx="8.5"
            fill="#CBD5E1"
            opacity="0.8"
          />

          {/* Smartphone White Metallic Chassis */}
          <rect
            x="45"
            y="41"
            width="36"
            height="63"
            rx="8.5"
            fill="url(#phoneMetal)"
            stroke="#64748B"
            strokeWidth="1.2"
          />

          {/* Screen Glass */}
          <rect
            x="48"
            y="46"
            width="30"
            height="51"
            rx="5.5"
            fill="url(#screenGlass)"
          />

          {/* Screen diagonal light reflection */}
          <path
            d="M 48 58 L 68 46 L 74 46 L 48 64 Z"
            fill="white"
            fillOpacity="0.35"
          />

          {/* Speaker ear slit */}
          <rect
            x="59"
            y="43.5"
            width="8"
            height="1.8"
            rx="0.9"
            fill="#475569"
          />

          {/* 4. Cute Face on Screen with Natural Blinking */}
          <g className="anim-eye-blink">
            {/* Left Eye */}
            <circle cx="56.5" cy="67" r="2.4" fill="#0F172A" />
            <circle cx="55.8" cy="66.2" r="0.9" fill="#FFFFFF" />
            <circle cx="57.4" cy="67.8" r="0.4" fill="#FFFFFF" />

            {/* Right Eye */}
            <circle cx="69.5" cy="67" r="2.4" fill="#0F172A" />
            <circle cx="68.8" cy="66.2" r="0.9" fill="#FFFFFF" />
            <circle cx="70.4" cy="67.8" r="0.4" fill="#FFFFFF" />

            {/* Rosy Cheeks */}
            <ellipse cx="53.5" cy="72" rx="3.2" ry="1.6" fill="url(#blushGlow)" />
            <ellipse cx="72.5" cy="72" rx="3.2" ry="1.6" fill="url(#blushGlow)" />

            {/* Sweet Smile Mouth with Tongue */}
            <path
              d="M 60 72.8 Q 63 77.2 66 72.8"
              stroke="#0F172A"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            {/* Tiny tongue highlight */}
            <path
              d="M 61.8 74.2 Q 63 76.2 64.2 74.2"
              stroke="#FB7185"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
            />
          </g>

          {/* Home indicator bar at bottom */}
          <rect
            x="58"
            y="93"
            width="10"
            height="1.5"
            rx="0.75"
            fill="#94A3B8"
          />

          {/* 5. Glowing Idea Lightbulb (Top-Right) */}
          <g>
            {/* Ambient Sunburst Aura */}
            <circle cx="94" cy="33" r="18" fill="url(#bulbGlow)" className="anim-bulb-core" />

            {/* Radiating Light Rays */}
            <g className="anim-bulb-rays">
              <line x1="94" y1="16" x2="94" y2="21" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="107" y1="23" x2="103" y2="27" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="110" y1="34" x2="105" y2="34" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="105" y1="45" x2="101" y2="42" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
              <line x1="81" y1="23" x2="85" y2="27" stroke="#FDE047" strokeWidth="2.4" strokeLinecap="round" />
            </g>

            {/* Lightbulb Glass */}
            <path
              d="M 94 23 C 89.5 23 86.5 26.5 86.5 30.5 C 86.5 33.2 88 35.3 89.5 37 L 89.5 39.5 C 89.5 40.5 90.5 41.2 91.5 41.2 L 96.5 41.2 C 97.5 41.2 98.5 40.5 98.5 39.5 L 98.5 37 C 100 35.3 101.5 33.2 101.5 30.5 C 101.5 26.5 98.5 23 94 23 Z"
              fill="#FBBF24"
              stroke="#D97706"
              strokeWidth="1.2"
            />

            {/* Glowing Bulb Core */}
            <circle cx="94" cy="30" r="3.5" fill="#FEF08A" />

            {/* Filament curve */}
            <path
              d="M 92 30 Q 94 27 96 30"
              stroke="#FFFFFF"
              strokeWidth="1.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Metal socket */}
            <rect x="91" y="41.2" width="6" height="2.5" rx="1" fill="#64748B" />
          </g>

          {/* 6. Animated Waving Arm & Hand (Saying Hello to the User) */}
          <g className="anim-hand-wave">
            {/* Curving arm swinging up */}
            <path
              d="M 81 74 Q 93 68 96 55"
              stroke="#18111D"
              strokeWidth="3.6"
              strokeLinecap="round"
              fill="none"
            />

            {/* Open Palm */}
            <circle cx="96.5" cy="53.5" r="3.6" fill="#18111D" />

            {/* Cute Fingers Spreading & Waving */}
            <circle cx="93.8" cy="48.5" r="1.6" fill="#18111D" />
            <circle cx="97.8" cy="49" r="1.6" fill="#18111D" />
            <circle cx="101" cy="51.5" r="1.6" fill="#18111D" />
            <circle cx="102" cy="55.5" r="1.4" fill="#18111D" />

            {/* Waving sparkle breeze trails */}
            <g className="anim-wave-trail">
              <path
                d="M 104 44 Q 108 48 106 53"
                stroke="#FACC15"
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 108 47 Q 111 51 109 55"
                stroke="#E879F9"
                strokeWidth="1.4"
                strokeLinecap="round"
                fill="none"
              />
              {/* Little sparkle star */}
              <circle cx="110" cy="43" r="1.2" fill="#FDE047" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
};
