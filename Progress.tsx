import React from 'react';

export const PROGRESS_SUMMARY = {
  title: 'SuvidhaPay — Municipal Collection Management System',
  status: 'COMPLETE',
  frontend:
    'Interactive prototype across all 21 blueprint sections (Admin, Officer, Field Agent, Citizen shells).',
  backend:
    'Complete Node.js + Express + TypeScript REST API (/api/v1) across Modules A–Q with scrypt auth, JWT rotation, RBAC, integer paise math, atomic due allocation, server receipts, and JSON persistence.',
  commands: {
    dev: 'npm run dev',
    seed: 'npm run seed',
    reset: 'npm run reset',
    test: 'npm test',
    lint: 'npm run lint',
    build: 'npm run build',
  },
};

export default function Progress() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4 text-sm text-slate-800">
      <h1 className="text-xl font-bold text-slate-900">
        {PROGRESS_SUMMARY.title} — Implementation Progress
      </h1>
      <p>{PROGRESS_SUMMARY.frontend}</p>
      <p>{PROGRESS_SUMMARY.backend}</p>
    </div>
  );
}
