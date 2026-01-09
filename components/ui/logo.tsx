"use client";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", showText = true, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  const textSizes = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Logo Icon - Banana emoji 🍌 lying down with water waves */}
      <div className={`${sizeClasses[size]} relative transition-all duration-300 hover:scale-110`}>
        {/* Banana emoji 🍌 - rotated to lie down */}
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: 'rotate(-25deg)' }}
        >
          <span className="text-2xl">🍌</span>
        </div>
        
        {/* Realistic flowing water - clear and natural */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Clear water gradient - light and transparent */}
            <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#87CEEB" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#4FC3F7" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#29B6F6" stopOpacity="0.8" />
            </linearGradient>
            {/* Water shine/highlight */}
            <linearGradient id="waterShine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
              <stop offset="30%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </linearGradient>
            {/* Deeper water */}
            <linearGradient id="deepWater" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4FC3F7" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0288D1" stopOpacity="0.7" />
            </linearGradient>
          </defs>
          
          {/* Water body - bottom section */}
          <rect
            x="0"
            y="26"
            width="40"
            height="14"
            fill="url(#waterGradient)"
          />
          
          {/* First wave - flowing water surface */}
          <path
            d="M0 28 Q8 26, 16 28 T32 28 T40 28 L40 40 L0 40 Z"
            fill="url(#waterGradient)"
            opacity="0.9"
          />
          
          {/* Second wave - deeper layer */}
          <path
            d="M0 30 Q10 28, 20 30 T40 30 L40 40 L0 40 Z"
            fill="url(#deepWater)"
            opacity="0.8"
          />
          
          {/* Water surface shine/highlight */}
          <path
            d="M0 28 Q8 26, 16 28 T32 28 T40 28"
            stroke="url(#waterShine)"
            strokeWidth="2"
            fill="none"
            opacity="0.6"
          />
          
          {/* Subtle water ripples */}
          <circle
            cx="20"
            cy="30"
            r="6"
            fill="none"
            stroke="#87CEEB"
            strokeWidth="1"
            opacity="0.3"
          />
          <circle
            cx="20"
            cy="30"
            r="4"
            fill="none"
            stroke="#4FC3F7"
            strokeWidth="1"
            opacity="0.4"
          />
        </svg>
      </div>
      
      {showText && (
        <span className={`font-bold text-gray-900 ${textSizes[size]}`}>
          Flownana
        </span>
      )}
    </div>
  );
}
