import React from 'react';

export interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 16, className = '' }: SpinnerProps) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}

