import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  type Node, type Edge, type Connection, MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Trash2, Save, MessageSquare, HelpCircle, Flag, Play, Pause, ArrowLeft, Bot, Workflow } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchFlows, createFlow, updateFlow, deleteFlow, fetchBusinessSettings, updateBusinessSettings } from '../lib/data';
import { fetchWorkflowById } from '../lib/data';

let idCounter = 1;
const nextId = () => `n${Date.now()}_${idCounter++}`;

const NODE_DEFAULTS: Record<string, { label: string; icon: any; color: string }> = {
  start: { label: 'Start', icon: Play, color: 'var(--primary)' },
  message: { label: 'Send Message', icon: MessageSquare, color: '#0ea5e9' },
  question: { label: 'Ask (Buttons)', icon: HelpCircle, color: '#f59e0b' },
  end: { label: 'End Flow', icon: Flag, color: '#ef4444' },
};

function FlowNode({ data, type }: { data: any; type: string }) {
  const meta = NODE_DEFAULTS[type] || NODE_DEFAULTS.message;
  const Icon = meta.icon;
  return (
    <div className="rounded-xl border-2 bg-[var(--card)] shadow-md min-w-[200px]" style={{ borderColor: meta.color }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]" style={{ color: meta.color }}>
        <Icon size={14} />
        <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
      </div>
      <div className="px-3 py-2 text-sm text-[var(--foreground)] whitespace-pre-line break-words">
        {data.text || <span className="text-[var(--muted-foreground)] italic">Click to edit…</span>}
      </div>
    </div>
  );
}

const nodeTypes = { start: FlowNode, message: FlowNode, question: FlowNode, end: FlowNode };

function FlowEditor({ flow, onBack, onSaved }: { flow: any; onBack: () => void; onSaved: () => void }) {
  const [name, setName] = useState(flow.name);
  const [triggerKeywords, setTriggerKeywords] = useState((flow.triggerKeywords || []).join(', '));
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    flow.nodes?.length ? flow.nodes : [{ id: 'start', type: 'start', position: { x: 250, y: 20 }, data: { text: '' } }]
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flow.edges || []);
  const [selected, setSelected] = useState<Node | null>(null);
  const [saving, setSaving] = useState(false);
  const nextPos = useRef(150);

  const onConnect = useCallback((c: Connection) => {
    const sourceNode = nodes.find(n => n.id === c.source);
    const label = sourceNode?.type === 'question' ? (prompt('Button label for this option (what the lead taps):') || '') : undefined;
    setEdges(eds => addEdge({ ...c, label, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
  }, [nodes, setEdges]);

  const addNode = (type: string) => {
    nextPos.current += 110;
    const id = nextId();
    setNodes(ns => [...ns, { id, type, position: { x: 250, y: nextPos.current }, data: { text: '' } }]);
  };

  const updateSelectedText = (text: string) => {
    if (!selected) return;
    setNodes(ns => ns.map(n => (n.id === selected.id ? { ...n, data: { ...n.data, text } } : n)));
    setSelected(s => (s ? { ...s, data: { ...s.data, text } } : s));
  };

  const removeSelected = () => {
    if (!selected || selected.type === 'start') return;
    setNodes(ns => ns.filter(n => n.id !== selected.id));
    setEdges(es => es.filter(e => e.source !== selected.id && e.target !== selected.id));
    setSelected(null);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
        edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, label: typeof e.label === 'string' ? e.label : undefined })),
        triggerKeywords: triggerKeywords.split(',').map(k => k.trim()).filter(Boolean),
      };
      if (flow.id) await updateFlow(flow.id, payload);
      else await createFlow(payload);
      toast.success('Flow saved');
      onSaved();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save flow');
    }
    setSaving(false);
  };

  return (
    <div className="flex h-full gap-3">
      <div className="w-64 shrink-0 flex flex-col gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
          <ArrowLeft size={14} /> All flows
        </button>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Flow name"
          className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        <div>
          <label className="text-xs font-medium text-[var(--muted-foreground)]">Trigger keywords (comma separated)</label>
          <input value={triggerKeywords} onChange={e => setTriggerKeywords(e.target.value)} placeholder="e.g. buy, rent, property"
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
          <p className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">Add a node</p>
          <div className="grid grid-cols-1 gap-1.5">
            {(['message', 'question', 'end'] as const).map(t => {
              const meta = NODE_DEFAULTS[t];
              const Icon = meta.icon;
              return (
                <button key={t} onClick={() => addNode(t)}
                  className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-2.5 py-2 text-xs font-medium hover:bg-[var(--accent)] transition-colors">
                  <Icon size={13} style={{ color: meta.color }} /> {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 flex-1 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[var(--muted-foreground)]">Editing: {NODE_DEFAULTS[selected.type || 'message'].label}</p>
              {selected.type !== 'start' && (
                <button onClick={removeSelected} className="text-red-500 hover:text-red-600"><Trash2 size={13} /></button>
              )}
            </div>
            <textarea
              value={(selected.data as any)?.text || ''}
              onChange={e => updateSelectedText(e.target.value)}
              placeholder={selected.type === 'question' ? 'The question to ask…' : selected.type === 'start' ? 'Nothing to send — connects straight to the first real node' : 'What Mikey sends…'}
              className="flex-1 min-h-[100px] rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm resize-none"
            />
            {selected.type === 'question' && (
              <p className="text-[11px] text-[var(--muted-foreground)]">Drag a connection out of this node for each button — you'll be asked for that button's label when you connect it.</p>
            )}
          </div>
        )}

        <button onClick={save} disabled={saving}
          className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90 disabled:opacity-50">
          <Save size={15} /> {saving ? 'Saving…' : 'Save Flow'}
        </button>
      </div>

      <div className="flex-1 rounded-xl border border-[var(--border)] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onNodeClick={(_, n) => setSelected(n)}
          onPaneClick={() => setSelected(null)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function FlowBuilderPage() {
  const [flows, setFlows] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [agentMode, setAgentMode] = useState<'AI' | 'FLOW'>('AI');

  const load = async () => {
    setLoading(true);
    try {
      const [f, settings] = await Promise.all([fetchFlows(), fetchBusinessSettings()]);
      setFlows(f || []);
      setAgentMode(settings?.agentMode === 'FLOW' ? 'FLOW' : 'AI');

      const match = window.location.hash.match(/[?&]id=([^&]+)/);
      if (match) {
        const wfId = match[1];
        try {
          const wf = await fetchWorkflowById(wfId);
          const v = wf.versions?.[0];
          if (v) {
            const nodes = (v.steps || []).map((s: any, i: number) => ({
              id: s.stepKey,
              type: s.actionType === 'CONDITION' ? 'question' : 'message',
              position: { x: 250, y: 30 + i * 110 },
              data: { text: s.label || s.actionType },
            }));
            if (!nodes.length) {
              nodes.push({ id: 'start', type: 'start', position: { x: 250, y: 20 }, data: { text: '' } });
            }
            const edges = (v.edges || []).map((e: any) => ({
              id: `${e.sourceKey}->${e.targetKey}`,
              source: e.sourceKey,
              target: e.targetKey,
            }));
            setEditing({ id: wfId, name: wf.name, nodes, edges, triggerKeywords: [] });
          }
        } catch {}
      }
    } catch { /* keep empty state */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleMode = async () => {
    const next = agentMode === 'AI' ? 'FLOW' : 'AI';
    setAgentMode(next);
    try {
      await updateBusinessSettings({ agentMode: next });
      toast.success(next === 'FLOW' ? 'Flow Builder is now driving conversations' : 'Mikey (AI agent) is back in control');
    } catch (e: any) {
      setAgentMode(agentMode);
      toast.error(e.message || 'Failed to switch mode');
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this flow? This cannot be undone.')) return;
    try {
      await deleteFlow(id);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete');
    }
  };

  if (editing) {
    return <FlowEditor flow={editing} onBack={() => { setEditing(null); load(); }} onSaved={() => setEditing(null)} />;
  }

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Flow Builder</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Design a fixed, button-driven script for WhatsApp/Telegram — an alternative to Mikey's free-form AI chat.</p>
        </div>
        <button
          onClick={toggleMode}
          className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            agentMode === 'FLOW' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
          }`}
          title="Switch which one drives live conversations"
        >
          {agentMode === 'FLOW' ? <Workflow size={15} /> : <Bot size={15} />}
          {agentMode === 'FLOW' ? 'Flow Builder is LIVE' : 'Mikey (AI) is LIVE'}
          {agentMode === 'FLOW' ? <Pause size={13} /> : <Play size={13} />}
        </button>
      </div>

      {agentMode === 'AI' && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Flows you build here won't run until you switch the toggle above to "Flow Builder is LIVE." Right now every conversation goes to Mikey's normal AI agent.
        </div>
      )}
      {agentMode === 'FLOW' && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800">
          Live: every inbound WhatsApp/Telegram message is now handled by your flow below (matched by trigger keyword, or the one marked Default). Mikey's AI only steps in if no flow is configured.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => setEditing({ name: 'New Flow', nodes: [], edges: [], triggerKeywords: [] })}
            className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--border)] p-8 text-[var(--muted-foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            <Plus size={24} /> <span className="text-sm font-medium">New Flow</span>
          </button>
          {flows.map(f => (
            <div key={f.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[var(--foreground)]">{f.name}</h3>
                {f.isDefault && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)] font-medium">DEFAULT</span>}
              </div>
              <p className="text-xs text-[var(--muted-foreground)]">{(f.nodes || []).length} nodes · {f.active ? 'Active' : 'Paused'}</p>
              {f.triggerKeywords?.length > 0 && (
                <p className="text-[11px] text-[var(--muted-foreground)] truncate">Triggers: {f.triggerKeywords.join(', ')}</p>
              )}
              <div className="flex gap-2 mt-1">
                <button onClick={() => setEditing(f)} className="flex-1 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--accent)]">Edit</button>
                <button onClick={() => remove(f.id)} className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
