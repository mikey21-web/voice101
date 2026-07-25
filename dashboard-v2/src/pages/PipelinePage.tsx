import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "../lib/api";
import { fetchPipelineDeals, createTask, updateTask, fetchLeadTasks } from "../lib/data";
import toast from "react-hot-toast";
import { Plus, CheckCircle2, Circle, Clock, Bot, User, Target, Building2, CalendarDays, ListTodo, X } from "lucide-react";

interface Deal {
  id: string;
  contact: { id: string; name: string; phone: string; email: string };
  assignedAgent: { id: string; name: string } | null;
  status: string;
  segment: string;
  score: number;
  dealValue: number | null;
  interest: string | null;
  budget: string | null;
  unit: { projectName: string; towerName: string } | null;
  taskCount: number;
  pendingTasks: any[];
  updatedAt: string;
}

interface PipelineData {
  stages: Array<{ id: string; name: string; status: string; color: string; order: number; isEnd: boolean; count: number }>;
  deals: Record<string, Deal[]>;
}

const priorityColors: Record<string, string> = {
  urgent: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20",
  high: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20",
  medium: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20",
  low: "text-gray-500 bg-gray-50 dark:text-gray-400 dark:bg-gray-800",
};

const segmentColors: Record<string, string> = {
  HOT: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  WARM: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  COLD: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  UNQUALIFIED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

function DealCard({ deal, onOpen }: { deal: Deal; onOpen: (id: string) => void }) {
  const daysInStage = Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / 86400000);
  const initials = deal.contact?.name?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3.5 shadow-sm cursor-pointer hover:shadow-md hover:border-[var(--primary)]/30 transition-all" onClick={() => onOpen(deal.id)}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-semibold text-[var(--foreground)] leading-tight line-clamp-2 min-w-0">{deal.contact?.name || "Unknown"}</span>
        <span className="shrink-0 text-[10px] text-[var(--muted-foreground)]">{daysInStage}d</span>
      </div>

      {(deal.interest || deal.unit?.projectName) && (
        <div className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] mb-2">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.unit?.projectName || deal.interest}</span>
        </div>
      )}

      {deal.budget && (
        <div className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] mb-2">
          <Target className="h-3 w-3 shrink-0" />
          <span>{deal.budget}</span>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${segmentColors[deal.segment] || segmentColors.UNQUALIFIED}`}>{deal.segment}</span>
        {deal.score > 0 && <span className="text-[10px] font-medium text-[var(--muted-foreground)]">{deal.score}pts</span>}
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-[var(--border)]">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="h-6 w-6 rounded-full bg-[var(--primary-light)] flex items-center justify-center text-[9px] font-bold text-[var(--primary)] shrink-0">{initials}</div>
          {deal.assignedAgent && <span className="text-[10px] text-[var(--muted-foreground)] truncate">{deal.assignedAgent.name}</span>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {deal.taskCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)]">
              <ListTodo className="h-3 w-3" />{deal.taskCount}
            </span>
          )}
          {deal.dealValue != null && deal.dealValue > 0 && (
            <span className="text-xs font-bold text-[var(--foreground)]">₹{(deal.dealValue / 100000).toFixed(1)}L</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DraggableDeal({ deal, onOpen }: { deal: Deal; onOpen: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id, data: { type: "deal", deal } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <div {...attributes} {...listeners}>
        <DealCard deal={deal} onOpen={onOpen} />
      </div>
    </div>
  );
}

function StageColumn({ stage, deals, onOpen }: { stage: any; deals: Deal[]; onOpen: (id: string) => void }) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: stage.id, data: { type: "stage", stage } });
  const totalValue = deals.reduce((sum, d) => sum + (d.dealValue || 0), 0);

  return (
    <div ref={setNodeRef} className="flex-shrink-0 w-72 flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] max-h-full overflow-hidden" style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="h-1 bg-[var(--primary)]" />
      <div className="px-3.5 py-3 border-b border-[var(--border)]" {...attributes} {...listeners}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--foreground)]">{stage.name}</span>
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] bg-[var(--muted)] px-1.5 py-0.5 rounded-full">{deals.length}</span>
        </div>
        {totalValue > 0 && (
          <span className="text-xs font-bold text-[var(--primary)] mt-0.5 block">₹{(totalValue / 100000).toFixed(1)}L</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 min-h-0 bg-[var(--muted)]/20">
        <SortableContext items={deals.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {deals.map(deal => (<DraggableDeal key={deal.id} deal={deal} onOpen={onOpen} />))}
        </SortableContext>
        {deals.length === 0 && <div className="flex items-center justify-center h-20 text-xs text-[var(--muted-foreground)]">No deals</div>}
      </div>
    </div>
  );
}

function TaskItem({ task, onUpdate, agents }: { task: any; onUpdate: (id: string, data: any) => void; agents: any[] }) {
  const isMikey = task.createdBy === 'mikey';
  return (
    <div className={`rounded-lg border p-2.5 ${task.status === 'done' ? 'border-green-200 bg-green-50/30 dark:border-green-800/30 dark:bg-green-900/10' : 'border-[var(--border)] bg-[var(--card)]'}`}>
      <div className="flex items-start gap-2">
        <button onClick={() => onUpdate(task.id, { status: task.status === 'done' ? 'pending' : 'done' })} className="mt-0.5 shrink-0">
          {task.status === 'done' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-[var(--muted-foreground)]" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-medium ${task.status === 'done' ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>
              {task.title}
            </span>
            {isMikey && <span title="Created by Mikey"><Bot className="h-3.5 w-3.5 text-purple-500 shrink-0" /></span>}
          </div>
          {task.description && <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5">{task.description}</p>}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityColors[task.priority] || priorityColors.medium}`}>{task.priority}</span>
            {task.dueAt && (
              <span className="flex items-center gap-0.5 text-[10px] text-[var(--muted-foreground)]">
                <CalendarDays className="h-3 w-3" />
                {new Date(task.dueAt).toLocaleDateString()}
              </span>
            )}
            <select
              className="text-[10px] border border-[var(--border)] rounded bg-transparent text-[var(--muted-foreground)] px-1 py-0.5"
              value={task.assigneeId || ''}
              onChange={e => onUpdate(task.id, { assigneeId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

function DealDetailPanel({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [taskData, agentData] = await Promise.all([
        fetchLeadTasks(leadId),
        api('/users?role=SALES_AGENT'),
      ]);
      setTasks(taskData);
      setAgents(agentData?.data || agentData || []);
    } catch { toast.error('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { load(); }, [load]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const created = await createTask({ title: newTaskTitle, leadId, status: 'pending', priority: 'medium' });
      setTasks(prev => [...prev, created]);
      setNewTaskTitle('');
      toast.success('Task added');
    } catch { toast.error('Failed to create task'); }
  };

  const handleUpdateTask = async (id: string, data: any) => {
    try {
      const updated = await updateTask(id, data);
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t));
    } catch { toast.error('Failed to update task'); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Deal Tasks</h2>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
            placeholder="Add a task..."
            value={newTaskTitle}
            onChange={e => setNewTaskTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTask()}
          />
          <button onClick={handleAddTask} className="rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="text-center text-sm text-[var(--muted-foreground)] py-8">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-sm text-[var(--muted-foreground)] py-8">No tasks yet. Add one above.</div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => (
              <TaskItem key={task.id} task={task} onUpdate={handleUpdateTask} agents={agents} />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [activeDrag, setActiveDrag] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchPipelineDeals();
      setData(result);
      if (result.stages.length > 0 && !selectedStage) setSelectedStage(result.stages[0].status);
    } catch { toast.error("Failed to load pipeline"); }
    finally { setLoading(false); }
  }, [selectedStage]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === "stage") return;
    const dealId = event.active.id as string;
    if (!data) return;
    for (const status in data.deals) {
      const found = data.deals[status].find(d => d.id === dealId);
      if (found) { setActiveDrag(found); break; }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !data) return;
    const overData = over.data.current;
    let targetStatus: string | null = null;
    if (overData?.type === "stage") targetStatus = overData.stage.status;
    else {
      for (const status in data.deals) {
        if (data.deals[status].some(d => d.id === over.id)) { targetStatus = status; break; }
      }
    }
    if (!targetStatus) return;
    const dealId = active.id as string;
    let sourceStatus: string | null = null;
    for (const status in data.deals) {
      if (data.deals[status].some(d => d.id === dealId)) { sourceStatus = status; break; }
    }
    if (!sourceStatus || sourceStatus === targetStatus) return;

    const prev = { ...data };
    const sourceDeals = [...(data.deals[sourceStatus] || [])];
    const idx = sourceDeals.findIndex(d => d.id === dealId);
    if (idx === -1) return;
    const moved = { ...sourceDeals[idx], status: targetStatus };
    sourceDeals.splice(idx, 1);
    const targetDeals = [...(data.deals[targetStatus] || []), moved];
    const newDeals = { ...data.deals, [sourceStatus]: sourceDeals, [targetStatus]: targetDeals };
    const newStages = data.stages.map(s => ({ ...s, count: (newDeals[s.status] || []).length }));
    setData({ ...data, deals: newDeals, stages: newStages });

    try {
      const result = await api(`/leads/${dealId}/move-stage`, { method: "PATCH", body: JSON.stringify({ status: targetStatus }) });
      const updatedStatus = (result as any).status;
      setData(prev2 => {
        if (!prev2) return prev2;
        const sLeads = [...(prev2.deals[sourceStatus!] || [])];
        const idx2 = sLeads.findIndex(d => d.id === dealId);
        const tLeads = [...(prev2.deals[updatedStatus] || [])];
        const existingIdx = tLeads.findIndex(d => d.id === dealId);
        if (idx2 !== -1) {
          sLeads.splice(idx2, 1);
          if (existingIdx === -1) tLeads.push(result);
          else tLeads[existingIdx] = result;
          const updatedDeals = { ...prev2.deals, [sourceStatus!]: sLeads, [updatedStatus]: tLeads };
          const updatedStages = prev2.stages.map(s => ({ ...s, count: (updatedDeals[s.status] || []).length }));
          return { ...prev2, deals: updatedDeals, stages: updatedStages };
        }
        return prev2;
      });
    } catch {
      setData(prev);
      toast.error("Failed to move deal");
    }
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">Loading pipeline...</div>;
  }

  const stageArray = data?.stages || [];

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
        <h1 className="text-xl font-bold text-[var(--foreground)]">Deal Pipeline</h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchData} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Refresh</button>
          <button onClick={() => setManageOpen(!manageOpen)} className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors">Manage Stages</button>
        </div>
      </div>

      {/* Mobile */}
      <div className="flex flex-col flex-1 md:hidden min-h-0">
        <div className="flex gap-2 overflow-x-auto pb-2 shrink-0">
          {stageArray.map(stage => (
            <button key={stage.id} onClick={() => setSelectedStage(stage.status)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${selectedStage === stage.status ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"}`}
            >
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
              {stage.name}
              <span className="text-[11px] opacity-70">({data?.deals[stage.status]?.length || 0})</span>
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 pb-4">
          {(selectedStage && data?.deals[selectedStage] || []).map(deal => (
            <DealCard key={deal.id} deal={deal} onOpen={setSelectedLeadId} />
          ))}
          {selectedStage && (!data?.deals[selectedStage] || data.deals[selectedStage].length === 0) && (
            <div className="flex items-center justify-center h-20 text-xs text-[var(--muted-foreground)]">No deals in this stage</div>
          )}
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden md:flex flex-1 overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full pb-4" style={{ minWidth: stageArray.length * 288 + (stageArray.length - 1) * 16 }}>
            {stageArray.map(stage => (
              <StageColumn key={stage.id} stage={stage} deals={data?.deals[stage.status] || []} onOpen={setSelectedLeadId} />
            ))}
          </div>
          <DragOverlay>
            {activeDrag && <div className="w-72 opacity-85"><DealCard deal={activeDrag} onOpen={() => {}} /></div>}
          </DragOverlay>
        </DndContext>
      </div>

      {manageOpen && <ManageStagesPanel stages={stageArray} onClose={() => { setManageOpen(false); fetchData(); }} />}
      {selectedLeadId && <DealDetailPanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />}
    </div>
  );
}

function ManageStagesPanel({ stages, onClose }: { stages: any[]; onClose: () => void }) {
  const [orderedStages, setOrderedStages] = useState([...stages].sort((a, b) => a.order - b.order));
  const [editing, setEditing] = useState<Record<string, { name: string; color: string }>>({});
  const [saving, setSaving] = useState(false);
  const moveUp = (idx: number) => { if (idx === 0) return; const next = [...orderedStages]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setOrderedStages(next); };
  const moveDown = (idx: number) => { if (idx === orderedStages.length - 1) return; const next = [...orderedStages]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setOrderedStages(next); };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api("/pipeline-stages/reorder", { method: "PATCH", body: JSON.stringify({ stageIds: orderedStages.map(s => s.id) }) });
      for (const [id, vals] of Object.entries(editing)) await api(`/pipeline-stages/${id}`, { method: "PATCH", body: JSON.stringify(vals) });
      toast.success("Stages updated");
      onClose();
    } catch { toast.error("Failed to update stages"); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[var(--foreground)]">Manage Stages</h2>
          <button onClick={onClose} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-lg leading-none">&times;</button>
        </div>
        <div className="space-y-2 mb-4">
          {orderedStages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center gap-2 rounded-lg border border-[var(--border)] p-2.5">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveUp(idx)} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] leading-none">&uarr;</button>
                <button onClick={() => moveDown(idx)} className="text-[10px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] leading-none">&darr;</button>
              </div>
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: editing[stage.id]?.color || stage.color }} />
              <div className="flex-1 min-w-0">
                <input className="w-full text-sm font-medium bg-transparent border-b border-transparent hover:border-[var(--border)] focus:border-[var(--primary)] outline-none text-[var(--foreground)]"
                  defaultValue={stage.name}
                  onChange={e => setEditing(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], name: e.target.value } }))}
                />
                <span className="text-[10px] text-[var(--muted-foreground)]">{stage.status}</span>
              </div>
              <input type="color" className="h-6 w-8 rounded cursor-pointer border-0 p-0" defaultValue={stage.color} onChange={e => setEditing(prev => ({ ...prev, [stage.id]: { ...prev[stage.id], color: e.target.value } }))} />
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--accent)]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-medium text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
