import React from 'react';

export type Emotion = 'happy' | 'encouraging' | 'thinking' | 'concerned' | 'excited' | 'neutral';

interface CharacterProps {
  emotion: Emotion;
  size?: number;
  animate?: boolean;
}

const EMOTIONS = {
  happy: {
    eyeLeft: 'M 28 36 Q 33 30 38 36',
    eyeRight: 'M 52 36 Q 57 30 62 36',
    mouth: 'M 35 52 Q 45 60 55 52',
    eyeColor: '#5B4CFF',
    blush: true,
  },
  excited: {
    eyeLeft: 'M 28 32 L 38 38 L 28 44',
    eyeRight: 'M 52 32 L 62 38 L 52 44',
    mouth: 'M 32 52 Q 45 63 58 52',
    eyeColor: '#FF6B35',
    blush: true,
  },
  encouraging: {
    eyeLeft: 'M 30 38 Q 33 34 38 38',
    eyeRight: 'M 52 38 Q 57 34 62 38',
    mouth: 'M 36 52 Q 45 58 54 52',
    eyeColor: '#5B4CFF',
    blush: false,
  },
  thinking: {
    eyeLeft: 'M 30 38 Q 33 35 37 38',
    eyeRight: 'M 52 35 Q 57 32 62 35',
    mouth: 'M 38 53 Q 45 50 52 53',
    eyeColor: '#8B7FFF',
    blush: false,
  },
  concerned: {
    eyeLeft: 'M 28 40 Q 33 36 38 40',
    eyeRight: 'M 52 40 Q 57 36 62 40',
    mouth: 'M 35 56 Q 45 50 55 56',
    eyeColor: '#9B8FCC',
    blush: false,
  },
  neutral: {
    eyeLeft: 'M 30 38 Q 33 36 38 38',
    eyeRight: 'M 52 38 Q 57 36 62 38',
    mouth: 'M 37 53 L 53 53',
    eyeColor: '#7B6FDD',
    blush: false,
  },
};

export const Character: React.FC<CharacterProps> = ({ emotion, size = 100, animate = true }) => {
  const e = EMOTIONS[emotion];

  return (
    <div style={{
      display: 'inline-block',
      animation: animate ? (emotion === 'excited' ? 'bounce 0.5s ease infinite alternate' : 'float 3s ease-in-out infinite') : 'none',
    }}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
        @keyframes bounce {
          0% { transform: translateY(0px) scale(1); }
          100% { transform: translateY(-8px) scale(1.05); }
        }
        @keyframes blink {
          0%, 90%, 100% { transform: scaleY(1); }
          95% { transform: scaleY(0.1); }
        }
        .char-eyes { animation: blink 4s ease-in-out infinite; transform-origin: center; }
      `}</style>
      <svg
        width={size}
        height={size}
        viewBox="0 0 90 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Graduation cap */}
        <rect x="25" y="8" width="40" height="5" rx="2" fill="#3D2EAB" />
        <polygon points="45,2 65,10 45,14 25,10" fill="#5B4CFF" />
        <line x1="65" y1="10" x2="65" y2="20" stroke="#3D2EAB" strokeWidth="1.5" />
        <circle cx="65" cy="21" r="3" fill="#FFD700" />

        {/* Body (round) */}
        <ellipse cx="45" cy="58" rx="28" ry="26" fill="#EDE9FF" stroke="#C5BEFF" strokeWidth="1.5" />

        {/* Head */}
        <circle cx="45" cy="38" r="26" fill="#F0EDFF" stroke="#C5BEFF" strokeWidth="1.5" />

        {/* Ear tufts (owl-like) */}
        <ellipse cx="22" cy="16" rx="5" ry="8" fill="#C5BEFF" transform="rotate(-20 22 16)" />
        <ellipse cx="68" cy="16" rx="5" ry="8" fill="#C5BEFF" transform="rotate(20 68 16)" />

        {/* Eye whites */}
        <circle cx="33" cy="38" r="10" fill="white" stroke="#C5BEFF" strokeWidth="1" />
        <circle cx="57" cy="38" r="10" fill="white" stroke="#C5BEFF" strokeWidth="1" />

        {/* Eye pupils */}
        <circle cx="34" cy="38" r="6" fill={e.eyeColor} />
        <circle cx="58" cy="38" r="6" fill={e.eyeColor} />
        <circle cx="36" cy="36" r="2" fill="white" opacity="0.8" />
        <circle cx="60" cy="36" r="2" fill="white" opacity="0.8" />

        {/* Eye expression overlay */}
        <g className="char-eyes">
          <path d={e.eyeLeft} stroke={e.eyeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d={e.eyeRight} stroke={e.eyeColor} strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </g>

        {/* Beak/Nose */}
        <polygon points="45,44 42,50 48,50" fill="#FFB347" />

        {/* Mouth */}
        <path d={e.mouth} stroke="#A094DD" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Blush cheeks */}
        {e.blush && (
          <>
            <ellipse cx="20" cy="45" rx="6" ry="4" fill="#FFB5C8" opacity="0.5" />
            <ellipse cx="70" cy="45" rx="6" ry="4" fill="#FFB5C8" opacity="0.5" />
          </>
        )}

        {/* Wing arms */}
        <ellipse cx="19" cy="58" rx="8" ry="14" fill="#DDD8FF" stroke="#C5BEFF" strokeWidth="1" transform="rotate(-15 19 58)" />
        <ellipse cx="71" cy="58" rx="8" ry="14" fill="#DDD8FF" stroke="#C5BEFF" strokeWidth="1" transform="rotate(15 71 58)" />

        {/* Belly pattern */}
        <ellipse cx="45" cy="60" rx="16" ry="14" fill="#F8F6FF" stroke="#E0D8FF" strokeWidth="1" />
        <text x="45" y="65" textAnchor="middle" fontSize="10" fill="#8B7FFF">✦</text>

        {/* Feet */}
        <ellipse cx="35" cy="83" rx="8" ry="4" fill="#FFB347" />
        <ellipse cx="55" cy="83" rx="8" ry="4" fill="#FFB347" />
      </svg>
    </div>
  );
};
