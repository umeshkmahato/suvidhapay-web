import React from 'react';
import { MetricCard } from '../../shared/MetricCard';

export interface DashboardMetricCard {
  label: string;
  value: string;
  sub: string;
  toneClass?: string;
  onClick?: () => void;
}

export interface MetricCardGridProps {
  readonly cards: DashboardMetricCard[];
  readonly className?: string;
}

export function MetricCardGrid({ cards, className = '' }: MetricCardGridProps) {
  return (
    <div className={['grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5', className].join(' ')}>
      {cards.map((card) => (
        <MetricCard
          key={card.label}
          label={card.label}
          value={card.value}
          sub={card.sub}
          toneClass={card.toneClass}
          onClick={card.onClick}
        />
      ))}
    </div>
  );
}
