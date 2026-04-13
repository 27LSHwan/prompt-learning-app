import React, { useEffect, useState } from 'react';
import { Character, Emotion } from './Character';

interface CharacterMessageProps {
  emotion: Emotion;
  message: string;
  characterSize?: number;
  position?: 'left' | 'right' | 'center';
  onDismiss?: () => void;
  showDismiss?: boolean;
  accentColor?: string;
}

export const CharacterMessage: React.FC<CharacterMessageProps> = ({
  emotion,
  message,
  characterSize = 80,
  position = 'left',
  onDismiss,
  showDismiss = false,
  accentColor,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const bubbleColors: Record<Emotion, string> = {
    happy: '#F0EDFF',
    excited: '#FFF3ED',
    encouraging: '#EDFFF0',
    thinking: '#F5F0FF',
    concerned: '#FFF8ED',
    neutral: '#F5F5FF',
  };

  const borderColors: Record<Emotion, string> = {
    happy: '#C5BEFF',
    excited: '#FFB347',
    encouraging: '#7BDCA0',
    thinking: '#B8AEFF',
    concerned: '#FFD08A',
    neutral: '#C8C0FF',
  };

  const bubbleBg = accentColor ? `${accentColor}15` : bubbleColors[emotion];
  const bubbleBorder = accentColor || borderColors[emotion];

  return (
    <div style={{
      display: 'flex',
      alignItems: position === 'center' ? 'center' : 'flex-end',
      gap: '12px',
      flexDirection: position === 'center' ? 'column' : position === 'right' ? 'row-reverse' : 'row',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(12px)',
      transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      textAlign: position === 'center' ? 'center' : 'left',
    }}>
      <Character emotion={emotion} size={characterSize} animate />
      <div style={{
        position: 'relative',
        background: bubbleBg,
        border: `2px solid ${bubbleBorder}`,
        borderRadius: position === 'left' ? '18px 18px 18px 4px' : '18px 18px 4px 18px',
        padding: '14px 18px',
        maxWidth: '320px',
        boxShadow: `0 4px 16px ${bubbleBorder}40`,
      }}>
        <p style={{
          margin: 0,
          fontSize: '14px',
          lineHeight: '1.6',
          color: 'var(--text)',
          whiteSpace: 'pre-wrap',
        }}>
          {message}
        </p>
        {showDismiss && onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              display: 'block',
              marginTop: '10px',
              padding: '6px 16px',
              background: bubbleBorder,
              color: 'white',
              border: 'none',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              width: '100%',
            }}
          >
            알겠어요! 👍
          </button>
        )}
      </div>
    </div>
  );
};
