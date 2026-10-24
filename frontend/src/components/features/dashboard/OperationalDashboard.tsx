import React, { useMemo } from 'react';
import { AdminDashboardView } from './AdminDashboardView';
import { MetricCardGrid } from './MetricCardGrid';
import { formatInr, Money } from '../../../data/mockSuvidhaData';

export const OperationalDashboard = React.memo(function OperationalDashboard(props: React.ComponentProps<typeof AdminDashboardView>) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const verified = props.payments.filter((p) => p.settlementStatus === 'SETTLED' && new Date(p.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === today);
  const sum = (payments: typeof props.payments) => formatInr(Money.paiseToInr(payments.reduce((total, p) => total + Money.inrToPaise(p.amountInr), 0)));
  const cards = useMemo(
    () =>
      [
        {
          label: "Today's Total Collection",
          value: sum(verified),
          sub: 'Cash + Verified Digital',
          toneClass: 'text-slate-900',
          onClick: () => props.onNavigateModule('payments_recon'),
        },
        {
          label: "Today's Cash Collection",
          value: sum(verified.filter((p) => p.method === 'CASH')),
          sub: 'Field collection receipts',
          toneClass: 'text-slate-900',
          onClick: () => props.onNavigateModule('cash_closing'),
        },
        {
          label: "Today's Verified Digital",
          value: sum(verified.filter((p) => p.method !== 'CASH')),
          sub: 'Gateway & bank verified',
          toneClass: 'text-emerald-700',
          onClick: () => props.onNavigateModule('payments_recon'),
        },
        {
          label: 'Total Outstanding Dues',
          value: formatInr(Money.paiseToInr(props.entities.reduce((total, e) => total + Money.inrToPaise(e.outstandingAmount), 0))),
          sub: 'Current period assessment',
          toneClass: 'text-slate-900',
          onClick: () => props.onNavigateModule('dues'),
        },
      ],
    [props.entities, props.payments, props.onNavigateModule, today]
  );

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-600">Summary of loaded authorized records only; collection day uses Asia/Kolkata. Use server reports for complete ledger totals.</p>
      <MetricCardGrid cards={cards} />
      <AdminDashboardView {...props} />
    </div>
  );
});

export { AdminDashboardView as DefaultDashboardView } from './AdminDashboardView';
export { UnifiedEntitiesView as EntityDirectoryView } from '../entities/EntityDirectoryView';
