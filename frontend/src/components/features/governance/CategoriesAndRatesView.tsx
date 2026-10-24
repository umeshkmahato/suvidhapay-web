import React, { useState } from 'react';
import { EntityCategory, RateMaster } from '../../../types/suvidha';
import { formatInr } from '../../../data/mockSuvidhaData';

type NewRate = Pick<RateMaster, 'categoryId' | 'feeType' | 'vehicleType' | 'frequency' | 'amountInr' | 'effectiveFrom' | 'effectiveTo' | 'wardScope'>;
interface Props {
  categories: EntityCategory[];
  rates: RateMaster[];
  onPublishRate: (rate: NewRate) => Promise<void>;
}

export function CategoriesAndRatesView({ categories, rates, onPublishRate }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!window.confirm('Publish this rate? Existing assessed dues must remain unchanged.')) return;
    setBusy(true);
    setError('');
    try {
      await onPublishRate({ categoryId: String(data.get('categoryId')), feeType: String(data.get('feeType')),
        frequency: data.get('frequency') as RateMaster['frequency'], amountInr: Number(data.get('amount')),
        effectiveFrom: String(data.get('from')), effectiveTo: String(data.get('to')) || null, wardScope: String(data.get('ward')) });
    } catch { setError('Rate publication failed. Check the server response and retry.'); }
    finally { setBusy(false); }
  };
  return <section className="space-y-5"><h2 className="text-xl font-semibold">Categories and rate history</h2>
    <ul>{categories.map((c) => <li key={c.id}>{c.name} — {c.entityType}</li>)}</ul>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Category</th><th>Fee</th><th>Amount</th><th>Frequency</th><th>Effective</th><th>Status</th></tr></thead><tbody>
      {rates.map((r) => <tr key={r.id}><td className="p-3">{r.categoryName}</td><td>{r.feeType}</td><td>{formatInr(r.amountInr)}</td><td>{r.frequency}</td><td>{r.effectiveFrom} – {r.effectiveTo || 'Open-ended'}</td><td>{r.status}</td></tr>)}
    </tbody></table>{rates.length === 0 && <p>No rate history available.</p>}</div>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 border rounded p-4">
      <h3 className="sm:col-span-2 font-semibold">Publish rate</h3>
      <label>Category<select name="categoryId" required className="block border rounded p-3">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Fee type<input name="feeType" required className="block border rounded p-3" /></label>
      <label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required className="block border rounded p-3" /></label>
      <label>Frequency<select name="frequency" className="block border rounded p-3">{['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'].map((f) => <option key={f}>{f}</option>)}</select></label>
      <label>Effective from<input name="from" type="date" required className="block border rounded p-3" /></label>
      <label>Effective to<input name="to" type="date" className="block border rounded p-3" /></label>
      <label>Ward code or ALL<input name="ward" defaultValue="ALL" required className="block border rounded p-3" /></label>
      {error && <p role="alert">{error}</p>}<button disabled={busy || !categories.length} className="border rounded p-3 disabled:opacity-50">{busy ? 'Publishing…' : 'Publish rate'}</button>
    </form>
  </section>;
}
