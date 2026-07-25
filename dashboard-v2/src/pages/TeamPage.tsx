import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { UserPlus, Trash2, Shield, IdCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchPermissionPresets, fetchUserPermissions, setUserPermission, applyPermissionPreset, createTeamInvite } from '../lib/data';
import { Drawer } from '../components/ui/drawer';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import CustomFieldsSection from '../components/CustomFieldsSection';
import { getTeamConfig, getPermissionModuleLabel } from '../lib/niche-config';
import { PERMISSION_MODULES, PERMISSION_LEVELS } from '../lib/permission-modules';

function PermissionsPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [presets, setPresets] = useState<any[]>([]);
  const [perms, setPerms] = useState<Record<string, string>>({});

  const refresh = () => fetchUserPermissions(userId).then((rows: any[]) => {
    const map: Record<string, string> = {};
    rows.forEach(r => { map[r.module] = r.level; });
    setPerms(map);
  }).catch(() => {});

  useEffect(() => { fetchPermissionPresets().then(setPresets).catch(() => {}); refresh(); }, [userId]);

  const setLevel = async (module: string, level: string) => {
    try { await setUserPermission(userId, module, level); setPerms({ ...perms, [module]: level }); } catch (e: any) { toast.error(e.message); }
  };

  const apply = async (preset: string) => {
    try { await applyPermissionPreset(userId, preset); refresh(); toast.success(`Applied "${preset}"`); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Workspace access</h4>
        <div className="flex items-center gap-2">
          <select onChange={e => e.target.value && apply(e.target.value)} defaultValue=""
            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]">
            <option value="" disabled>Apply preset</option>
            {presets.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
          <button onClick={onClose} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Close</button>
        </div>
      </div>
      <div className="space-y-2">
        {PERMISSION_MODULES.map(m => (
          <div key={m} className="flex items-center justify-between">
            <span className="text-sm text-[var(--foreground)]">{getPermissionModuleLabel(m)}</span>
            <select value={perms[m] || 'NO_ACCESS'} onChange={e => setLevel(m, e.target.value)}
              className="h-8 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)]">
              {PERMISSION_LEVELS.map(l => <option key={l} value={l}>{l.replace('_', ' ')}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamDetailsPanel({ user, onClose, onSaved }: { user: any; onClose: () => void; onSaved: () => void }) {
  const team = getTeamConfig();
  const [fields, setFields] = useState({
    department: user.department || '',
    salaryType: user.salaryType || 'Monthly',
    monthlySalary: user.monthlySalary ?? '',
    skills: (user.skills || []).join(', '),
    annualLeaveQuota: user.annualLeaveQuota ?? 12,
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          department: fields.department,
          salaryType: fields.salaryType,
          monthlySalary: fields.monthlySalary === '' ? undefined : Number(fields.monthlySalary),
          skills: fields.skills.split(',').map(s => s.trim()).filter(Boolean),
          annualLeaveQuota: fields.annualLeaveQuota === '' ? undefined : Number(fields.annualLeaveQuota),
        }),
      });
      toast.success('Details saved');
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 mt-2 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Team member details</h4>
        <button onClick={onClose} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Close</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Role / Department" placeholder={team.deptPlaceholder} value={fields.department}
          onChange={e => setFields({ ...fields, department: e.target.value })} />
        <Select label="Salary type" value={fields.salaryType} onChange={e => setFields({ ...fields, salaryType: e.target.value })}>
          <option value="Monthly">Monthly</option>
          <option value="Commission">Commission</option>
          <option value="Monthly + Commission">Monthly + Commission</option>
        </Select>
        <Input label="Monthly salary (₹)" type="number" value={fields.monthlySalary}
          onChange={e => setFields({ ...fields, monthlySalary: e.target.value })} />
        <Input label="Annual leave quota (days)" type="number" value={fields.annualLeaveQuota}
          onChange={e => setFields({ ...fields, annualLeaveQuota: e.target.value })} />
        <div className="sm:col-span-2">
          <Input label="Skills (comma-separated)" placeholder={team.skillsPlaceholder} value={fields.skills}
            onChange={e => setFields({ ...fields, skills: e.target.value })} />
        </div>
      </div>
      <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save details'}</Button>

      <div className="border-t border-[var(--border)] pt-4">
        <CustomFieldsSection target="TEAM_MEMBER" targetId={user.id} />
      </div>
    </div>
  );
}

export default function TeamPage() {
  const team = getTeamConfig();
  const [users, setUsers] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', role: 'SALES_AGENT', phone: '', department: '' });
  const [permUserId, setPermUserId] = useState<string | null>(null);
  const [detailsUserId, setDetailsUserId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const refresh = () => api('/users').then((r: any) => setUsers(Array.isArray(r) ? r : r.data || [])).catch(() => {});
  useEffect(() => { refresh(); }, []);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Was calling POST /users directly, which requires a password this
      // form never collected (an admin can't set someone else's password
      // sight-unseen) — every invite here silently 400'd. Now sends a real
      // invite: the teammate gets an email and sets their own password.
      await createTeamInvite({ name: form.name, email: form.email, role: form.role, department: form.department });
      setShowInvite(false);
      setForm({ email: '', name: '', role: 'SALES_AGENT', phone: '', department: '' });
      refresh();
      toast.success(`Invite sent to ${form.email}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Team</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{team.pageSubtitle} · {users.length} members</p>
        </div>
        <Button onClick={() => setShowInvite(true)} className="w-full sm:w-auto">
          <UserPlus size={16} /> Invite Member
        </Button>
      </div>

      <Drawer
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite team member"
        description="Add someone to your workspace and set their role."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button type="submit" form="invite-team-form">Invite</Button>
          </>
        }
      >
        <form id="invite-team-form" onSubmit={invite} className="space-y-4">
          <Input
            label="Name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            required
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={e => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Role / Department"
            placeholder={team.deptPlaceholder}
            value={form.department}
            onChange={e => setForm({ ...form, department: e.target.value })}
          />
          <Select
            label="Access level"
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value })}
          >
            {['SALES_AGENT', 'SUPPORT_AGENT', 'MANAGER', 'ADMIN', 'VIEWER'].map(r => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </Select>
        </form>
      </Drawer>

      <div className="hidden sm:block rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--muted)]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Member</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[var(--muted-foreground)]">No team members</td></tr>
              ) : (
                users.map((u: any) => (
                  <tr key={u.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[var(--primary)] flex items-center justify-center text-xs font-medium text-white shadow-sm">
                          {(u.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[var(--foreground)]">{u.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === 'OWNER'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : u.role === 'ADMIN'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {u.department || u.role?.replace('_', ' ') || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                        (u.teamStatus || 'active') === 'active'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {u.teamStatus || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setDetailsUserId(detailsUserId === u.id ? null : u.id)}
                          className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                          title="Team member details"
                        >
                          <IdCard size={14} />
                        </button>
                        <button
                          onClick={() => setPermUserId(permUserId === u.id ? null : u.id)}
                          className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                          title="Manage permissions"
                        >
                          <Shield size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(u.id)}
                          className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {permUserId && <PermissionsPanel userId={permUserId} onClose={() => setPermUserId(null)} />}
      {detailsUserId && (() => {
        const u = users.find(u => u.id === detailsUserId);
        return u ? (
          <TeamDetailsPanel user={u} onClose={() => setDetailsUserId(null)} onSaved={refresh} />
        ) : null;
      })()}

      <div className="block sm:hidden space-y-3">
        {users.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-12 text-center text-[var(--muted-foreground)]">
            No team members
          </div>
        ) : (
          users.map((u: any) => (
            <div key={u.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-sm font-medium text-white shadow-sm shrink-0">
                    {(u.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-[var(--foreground)]">{u.name}</div>
                    <div className="text-sm text-[var(--muted-foreground)]">{u.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirmId(u.id)}
                  className="p-1.5 rounded-md hover:bg-[var(--accent)] text-red-400 hover:text-red-600 transition-colors shrink-0"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  u.role === 'OWNER'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : u.role === 'ADMIN'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {u.department || u.role?.replace('_', ' ') || 'N/A'}
                </span>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                  (u.teamStatus || 'active') === 'active'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {u.teamStatus || 'active'}
                </span>
                <button
                  onClick={() => setDetailsUserId(detailsUserId === u.id ? null : u.id)}
                  className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                >
                  <IdCard size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Remove team member"
        description="Are you sure you want to remove this team member? This action cannot be undone."
        maxWidth="max-w-sm"
        footer={
          <>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                try {
                  await api(`/users/${deleteConfirmId}`, { method: 'DELETE' });
                  refresh();
                  toast.success('Removed');
                } catch (e: any) {
                  toast.error(e.message || 'Failed to remove');
                }
                setDeleteConfirmId(null);
              }}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          </>
        }
      >
        <></>
      </Dialog>
    </div>
  );
}
