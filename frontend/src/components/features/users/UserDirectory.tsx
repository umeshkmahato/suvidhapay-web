import React, { useState } from 'react';
import { SystemUser, Ward, Zone } from '../../../types/suvidha';

export type NewStaffUser = Pick<SystemUser, 'fullName' | 'loginIdentifier' | 'mobile' | 'email' | 'role' | 'assignedWard' | 'assignedZone'> & { password: string };

interface Props {
  users: SystemUser[];
  wards: Ward[];
  zones: Zone[];
  onToggleUserStatus: (id: string) => Promise<void>;
  onCreateUser: (user: NewStaffUser) => Promise<void>;
}

export function UserDirectoryView({ users, wards, zones, onToggleUserStatus, onCreateUser }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await onCreateUser({
        fullName: String(data.get('fullName')), loginIdentifier: String(data.get('loginIdentifier')),
        mobile: String(data.get('mobile')), email: String(data.get('email')),
        role: data.get('role') as SystemUser['role'], assignedWard: String(data.get('ward')),
        assignedZone: String(data.get('zone')), password: String(data.get('password')),
      });
      form.reset();
    } catch {
      setError('User could not be created. Check the server response and retry.');
    } finally { setBusy(false); }
  };
  return <section className="space-y-5">
    <h2 className="text-xl font-semibold">Users and jurisdictions</h2>
    <label className="block">Search users<input className="block border rounded p-3" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Name</th><th>Role</th><th>Ward</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {users.filter((u) => `${u.fullName} ${u.loginIdentifier}`.toLowerCase().includes(query.toLowerCase())).map((user) => <tr key={user.id}>
        <td className="p-3">{user.fullName}</td><td>{user.role}</td><td>{user.assignedWard}</td><td>{user.status}</td>
        <td><button disabled={busy} className="border rounded p-3 disabled:opacity-50" onClick={async () => {
          if (!window.confirm(`Change account status for ${user.fullName}?`)) return;
          setBusy(true);
          try { await onToggleUserStatus(user.id); } catch { setError('Status update failed.'); } finally { setBusy(false); }
        }}>{user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td>
      </tr>)}
    </tbody></table>{users.length === 0 && <p>No users available.</p>}</div>
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 border rounded p-4">
      <h3 className="sm:col-span-2 font-semibold">Create staff account</h3>
      {(['fullName', 'loginIdentifier', 'mobile', 'email', 'password'] as const).map((name) => <label key={name}>{({ fullName: 'Full name', loginIdentifier: 'Login identifier', mobile: 'Mobile', email: 'Email', password: 'Initial password' })[name]}
        <input className="block w-full border rounded p-3" name={name} required type={name === 'password' ? 'password' : name === 'email' ? 'email' : 'text'} minLength={name === 'password' ? 12 : undefined} autoComplete={name === 'password' ? 'new-password' : 'off'} />
      </label>)}
      <label>Role<select name="role" className="block border rounded p-3"><option>AGENT</option><option>OFFICER</option><option>ADMIN</option></select></label>
      <label>Ward<select name="ward" required className="block border rounded p-3">{wards.map((w) => <option key={w.id} value={w.code}>{w.name}</option>)}</select></label>
      <label>Zone<select name="zone" required className="block border rounded p-3">{zones.map((z) => <option key={z.id} value={z.name}>{z.name}</option>)}</select></label>
      {error && <p role="alert">{error}</p>}<button disabled={busy || !wards.length || !zones.length} className="border rounded p-3 disabled:opacity-50">{busy ? 'Saving…' : 'Create user'}</button>
    </form>
  </section>;
}
