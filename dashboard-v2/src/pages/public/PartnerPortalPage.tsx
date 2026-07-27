import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TOKEN_KEY = "partner_portal_token";

function getPartnerToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function partnerApi(path: string, options: RequestInit = {}) {
  const token = getPartnerToken();
  const res = await fetch(`${API_URL}/partner-portal${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return res.json();
}

/**
 * Standalone partner-facing portal — deliberately not part of the main
 * dashboard SPA's auth/session (spec 48.12): its own token, its own API
 * calls, and it only ever hits /partner-portal/* endpoints which are gated
 * by PartnerAuthGuard on the backend, never the internal RolesGuard.
 */
export default function PartnerPortalPage() {
  const [loggedIn, setLoggedIn] = useState(!!getPartnerToken());

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Toaster position="top-right" />
      {loggedIn ? <PartnerDashboard onLogout={() => setLoggedIn(false)} /> : <PartnerLoginForm onLoggedIn={() => setLoggedIn(true)} />}
    </div>
  );
}

function PartnerLoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await partnerApi("/login", { method: "POST", body: JSON.stringify({ email, password }) });
      localStorage.setItem(TOKEN_KEY, res.accessToken);
      onLoggedIn();
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-1">Partner Portal</h1>
        <p className="text-sm text-gray-500 mb-4">Sign in to register leads and track commissions.</p>
        <div className="space-y-3">
          <input type="email" required placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 text-sm" />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 text-sm" />
        </div>
        <button type="submit" disabled={loading} className="w-full h-10 mt-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

function PartnerDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<"leads" | "units" | "projects" | "commissions">("leads");
  const [me, setMe] = useState<any>(null);
  const [units, setUnits] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectUnits, setProjectUnits] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, unitsRes, leadsRes, commRes, projRes] = await Promise.all([
        partnerApi("/me"),
        partnerApi("/units"),
        partnerApi("/leads"),
        partnerApi("/commissions"),
        partnerApi("/projects"),
      ]);
      setMe(meRes);
      setUnits(unitsRes);
      setLeads(leadsRes.data || leadsRes);
      setCommissions(commRes.data || commRes);
      setProjects(projRes);
    } catch (e: any) {
      if (e.message?.includes("401") || /unauthoriz/i.test(e.message || "")) {
        localStorage.removeItem(TOKEN_KEY);
        onLogout();
      } else {
        toast.error(e.message || "Failed to load portal data");
      }
    }
    setLoading(false);
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  const toggleProject = async (projectId: string) => {
    if (expandedProjectId === projectId) { setExpandedProjectId(null); return; }
    if (!projectUnits[projectId]) {
      try {
        const units = await partnerApi(`/units?projectId=${projectId}`);
        setProjectUnits(pu => ({ ...pu, [projectId]: units }));
      } catch { toast.error("Failed to load project units"); return; }
    }
    setExpandedProjectId(projectId);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    onLogout();
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-50">Partner Portal</h1>
          <p className="text-sm text-gray-500">{me?.email}</p>
        </div>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Sign out</button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-4 overflow-x-auto">
        {(["leads", "units", "projects", "commissions"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"}`}
          >
            {t === "leads" ? "My Leads" : t === "units" ? "Available Units" : t === "projects" ? "Projects" : "Commissions"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Loading...</div>
      ) : tab === "leads" ? (
        <LeadsTab leads={leads} onRegistered={load} />
      ) : tab === "units" ? (
        <UnitsTab units={units} />
      ) : tab === "projects" ? (
        <ProjectsTab projects={projects} expandedProjectId={expandedProjectId} projectUnits={projectUnits} onToggle={toggleProject} />
      ) : (
        <CommissionsTab commissions={commissions} />
      )}
    </div>
  );
}

function LeadsTab({ leads, onRegistered }: { leads: any[]; onRegistered: () => void }) {
  const [phone, setPhone] = useState("");
  const [registering, setRegistering] = useState(false);
  const [detailLead, setDetailLead] = useState<any | null>(null);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegistering(true);
    try {
      const result = await partnerApi("/leads", { method: "POST", body: JSON.stringify({ phone }) });
      if (result.status === "NEEDS_REVIEW") {
        toast("This number needs review by the builder's team before it's confirmed.");
      } else if (result.status === "ALREADY_REGISTERED") {
        toast("You've already registered this number.");
      } else {
        toast.success("Lead registered!");
      }
      setPhone("");
      onRegistered();
    } catch (e: any) {
      toast.error(e.message || "Failed to register lead");
    }
    setRegistering(false);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={register} className="flex gap-2">
        <input required placeholder="Buyer phone number" value={phone} onChange={e => setPhone(e.target.value)} className="flex-1 h-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-3 text-sm" />
        <button type="submit" disabled={registering} className="h-10 px-4 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
          Register lead
        </button>
      </form>
      <div className="space-y-2">
        {leads.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No leads registered yet.</p>
        ) : leads.map(l => (
          <button key={l.id} onClick={() => setDetailLead(detailLead?.id === l.id ? null : l)} className="w-full text-left flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
            <span className="text-sm text-gray-900 dark:text-gray-50">{l.phone}</span>
            <span className="text-xs text-gray-500">{l.status.replace(/_/g, " ")}</span>
          </button>
        ))}
      </div>
      {detailLead && <LeadDetailPanel lead={detailLead} onClose={() => setDetailLead(null)} />}
    </div>
  );
}

function LeadDetailPanel({ lead, onClose }: { lead: any; onClose: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Lead detail</h3>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">Close</button>
      </div>
      <div className="text-xs space-y-1 text-gray-700 dark:text-gray-300">
        <p><span className="font-medium">Phone:</span> {lead.phone}</p>
        <p><span className="font-medium">Status:</span> {lead.status?.replace(/_/g, " ")}</p>
        <p><span className="font-medium">Created:</span> {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</p>
        {lead.leadId && <p><span className="font-medium">Lead ID:</span> {lead.leadId}</p>}
        {lead.lockUntil && <p><span className="font-medium">Locked until:</span> {new Date(lead.lockUntil).toLocaleDateString("en-IN")}</p>}
        {lead.decisionReason && <p><span className="font-medium">Decision reason:</span> {lead.decisionReason}</p>}
      </div>
    </div>
  );
}

function UnitsTab({ units }: { units: any[] }) {
  if (units.length === 0) return <p className="text-sm text-gray-500 text-center py-6">No available units right now.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {units.map(u => (
        <div key={u.id} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-50">Unit {u.unitNumber}</div>
          <div className="text-xs text-gray-500">{u.unitType} · {u.areaSqft ? `${u.areaSqft} sqft` : ""} · {u.facing || ""}</div>
          {u.price != null && (
            <div className="text-sm mt-1 text-gray-900 dark:text-gray-50">
              {new Intl.NumberFormat("en-IN", { style: "currency", currency: u.currency || "INR", maximumFractionDigits: 0 }).format(u.price)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProjectsTab({ projects, expandedProjectId, projectUnits, onToggle }: { projects: any[]; expandedProjectId: string | null; projectUnits: Record<string, any[]>; onToggle: (id: string) => void }) {
  if (projects.length === 0) return <p className="text-sm text-gray-500 text-center py-6">No projects available.</p>;
  return (
    <div className="space-y-3">
      {projects.map(p => (
        <div key={p.id} className="rounded-lg border border-gray-200 dark:border-gray-800">
          <button onClick={() => onToggle(p.id)} className="w-full text-left flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
            <div>
              <div className="text-sm font-medium text-gray-900 dark:text-gray-50">{p.name}</div>
              <div className="text-xs text-gray-500">{p.location || p.address || ""}{p.status ? ` · ${p.status.replace(/_/g, " ")}` : ""}</div>
            </div>
            <span className="text-xs text-gray-400">{expandedProjectId === p.id ? "−" : "+"}</span>
          </button>
          {expandedProjectId === p.id && (
            <div className="border-t border-gray-200 dark:border-gray-800 p-4">
              {(projectUnits[p.id] || []).length === 0 ? (
                <p className="text-xs text-gray-500">No available units in this project.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(projectUnits[p.id] || []).map(u => (
                    <div key={u.id} className="rounded border border-gray-200 dark:border-gray-800 p-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-50">Unit {u.unitNumber}</div>
                      <div className="text-xs text-gray-500">{u.unitType} · {u.areaSqft ? `${u.areaSqft} sqft` : ""}{u.facing ? ` · ${u.facing}` : ""}</div>
                      {u.price != null && (
                        <div className="text-sm mt-1 text-gray-900 dark:text-gray-50">
                          {new Intl.NumberFormat("en-IN", { style: "currency", currency: u.currency || "INR", maximumFractionDigits: 0 }).format(u.price)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CommissionsTab({ commissions }: { commissions: any[] }) {
  if (commissions.length === 0) return <p className="text-sm text-gray-500 text-center py-6">No commission accruals yet.</p>;
  return (
    <div className="space-y-2">
      {commissions.map(c => (
        <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-800 px-4 py-2">
          <span className="text-sm text-gray-900 dark:text-gray-50">
            {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(c.amountPaise) / 100)}
          </span>
          <span className="text-xs text-gray-500">{c.status}</span>
        </div>
      ))}
    </div>
  );
}
