import { useEffect, useState } from 'react';
import { api } from './api.js';

const card = 'space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm';
const input = 'rounded border border-gray-300 px-2 py-1';
const btn = 'rounded bg-blue-700 px-3 py-1 text-white hover:bg-blue-800';

export default function App() {
  const [me, setMe] = useState(undefined); // undefined = loading, null = logged out
  useEffect(() => {
    api('/api/me').then(setMe, () => setMe(null));
    const onUnauthorized = () => setMe(null);
    window.addEventListener('unauthorized', onUnauthorized);
    return () => window.removeEventListener('unauthorized', onUnauthorized);
  }, []);

  if (me === undefined) return null;
  if (!me) return <Login onLogin={setMe} />;
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <h1 className="font-semibold">Barangay Management System</h1>
        <div className="flex items-center gap-3 text-sm">
          <span>{me.fullName} · {me.role}</span>
          <button className={btn} onClick={() => api('/api/logout', {}).finally(() => setMe(null))}>Log out</button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <Status />
        {me.modules.includes('admin') && <><Users /><AuditLog /></>}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault();
    try { onLogin(await api('/api/login', Object.fromEntries(new FormData(e.currentTarget)))); }
    catch (err) { setError(err.message); }
  }
  return (
    <form onSubmit={submit} className={`${card} mx-auto mt-24 max-w-sm`}>
      <h1 className="text-lg font-semibold">Barangay Management System</h1>
      <input name="username" placeholder="Username" autoComplete="username" required autoFocus className={`${input} w-full`} />
      <input name="password" type="password" placeholder="Password" autoComplete="current-password" required className={`${input} w-full`} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button className={`${btn} w-full`}>Log in</button>
    </form>
  );
}

function Status() {
  const [health, setHealth] = useState(null);
  useEffect(() => { api('/api/health').then(setHealth, (err) => setHealth({ error: err.message })); }, []);
  return (
    <section className={card}>
      <h2 className="font-semibold">System status</h2>
      {!health ? <p className="text-sm">Checking…</p>
        : health.error ? <p className="text-sm text-red-600">Problem: {health.error}</p>
        : <p className="text-sm">Server ✓ · Database ✓ · Your IP {health.ip} is on the barangay network ✓</p>}
    </section>
  );
}

function Users() {
  const [data, setData] = useState({ users: [], roles: [] });
  const [msg, setMsg] = useState('');
  const load = () => api('/api/users').then(setData);
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await api('/api/users', Object.fromEntries(new FormData(form)));
      form.reset();
      setMsg('User added.');
      load();
    } catch (err) { setMsg(err.message); }
  }

  return (
    <section className={card}>
      <h2 className="font-semibold">Users</h2>
      <table className="w-full text-left text-sm">
        <thead className="text-gray-500"><tr><th>Username</th><th>Full name</th><th>Role</th><th>Active</th></tr></thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.id} className="border-t border-gray-100">
              <td>{u.username}</td><td>{u.fullName}</td><td>{u.role}</td><td>{u.active ? 'yes' : 'no'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-5">
        <input name="username" placeholder="Username" required className={input} />
        <input name="fullName" placeholder="Full name" required className={input} />
        <select name="role" required className={input}>{data.roles.map((r) => <option key={r}>{r}</option>)}</select>
        <input name="password" type="password" placeholder="Password (8+)" minLength={8} required autoComplete="new-password" className={input} />
        <button className={btn}>Add user</button>
      </form>
      {msg && <p className="text-sm">{msg}</p>}
    </section>
  );
}

function AuditLog() {
  const [rows, setRows] = useState([]);
  const load = () => api('/api/audit').then(setRows);
  useEffect(() => { load(); }, []);
  return (
    <section className={card}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Audit log (last 50)</h2>
        <button className={btn} onClick={load}>Refresh</button>
      </div>
      <table className="w-full text-left text-sm">
        <thead className="text-gray-500"><tr><th>When</th><th>User</th><th>Action</th><th>Record</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-gray-100">
              <td>{new Date(r.at).toLocaleString('en-PH')}</td><td>{r.user ?? 'system'}</td>
              <td>{r.action}</td><td>{r.tableName} #{r.rowId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
