import React, { useState, useEffect, useCallback } from 'react';
import { fetchTasks, createTask, updateTask, deleteTask, fetchLeads, fetchUsers } from '../lib/data';
import { Plus, CheckCircle, Circle, Trash2, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import { Dialog } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';

export default function TasksPage() {
  const [data, setData] = useState<any>({ data: [], meta: {} });
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'medium', leadId: '', assigneeId: '' });
  const [leads, setLeads] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(() => fetchTasks().then((r: any) => setData(r.data ? r : { data: r, meta: {} })).catch(() => {}), []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { fetchLeads().then((r: any) => setLeads(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { fetchUsers().then((r: any) => setUsers(Array.isArray(r) ? r : r.data || [])).catch(() => {}); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTask(form);
      setShowCreate(false);
      setForm({ title: '', priority: 'medium', leadId: '', assigneeId: '' });
      refresh();
      toast.success('Task created');
    } catch (e: any) { toast.error(e.message); }
  };

  const toggle = async (id: string, current: string) => {
    try {
      await updateTask(id, { status: current === 'done' ? 'pending' : 'done' });
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (deleting === id) return;
    setDeleting(id);
    try {
      await deleteTask(id);
      refresh();
      toast.success('Task deleted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
    }
  };

  const confirmDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this task?')) {
      handleDelete(id);
    }
  };

  const items = Array.isArray(data.data) ? data.data : data;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Tasks</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">{Array.isArray(items) ? items.length : 0} tasks</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} /> New Task
        </Button>
      </div>

      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create task"
        description="Add a to-do or reminder for your team."
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" form="create-task-form">Create task</Button>
          </>
        }
      >
        <form id="create-task-form" onSubmit={create} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Confirm catering count"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            required
          />
          <Select
            label="Priority"
            value={form.priority}
            onChange={e => setForm({ ...form, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
          <Select
            label="Lead"
            value={form.leadId}
            onChange={e => setForm({ ...form, leadId: e.target.value })}
          >
            <option value="">No lead</option>
            {leads.map((l: any) => (
              <option key={l.id} value={l.id}>{l.contact?.name || l.id}</option>
            ))}
          </Select>
          <Select
            label="Assignee"
            value={form.assigneeId}
            onChange={e => setForm({ ...form, assigneeId: e.target.value })}
          >
            <option value="">Unassigned</option>
            {users.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name || u.email || u.id}</option>
            ))}
          </Select>
        </form>
      </Dialog>

      <div className="space-y-2">
        {(!Array.isArray(items) || items.length === 0) ? (
          <div className="text-center py-12 text-[var(--muted-foreground)]">No tasks yet</div>
        ) : (
          Array.isArray(items) && items.map((t: any) => {
            const isDone = t.status === 'done' || t.status === 'completed';
            return (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 hover:shadow-sm transition-shadow">
                <button
                  onClick={() => toggle(t.id, t.status)}
                  className="shrink-0 p-1 rounded-md hover:bg-[var(--accent)] transition-colors"
                >
                  {isDone
                    ? <CheckCircle size={20} className="text-emerald-500" />
                    : <Circle size={20} className="text-[var(--muted-foreground)]" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm ${isDone ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)] font-medium'}`}>
                    {t.title}
                  </div>
                  {t.lead?.contact?.name && (
                    <div className="text-xs text-[var(--muted-foreground)] mt-0.5">{t.lead.contact.name}</div>
                  )}
                  {t.dueAt && (
                    <div className="flex items-center gap-1 text-xs text-[var(--muted-foreground)] mt-0.5">
                      <Calendar size={11} />
                      {new Date(t.dueAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                    t.priority === 'high'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : t.priority === 'medium'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {t.priority}
                  </span>
                  <button
                    onClick={(e) => confirmDelete(e, t.id)}
                    disabled={deleting === t.id}
                    className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--muted-foreground)] hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
