import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { RefreshCw, ExternalLink, CheckCircle, XCircle, Link, Unlink, BarChart3, Users, DollarSign } from "lucide-react";
import toast from "react-hot-toast";

type Connection = { platform: string; connected: boolean; status: string; name: string; lastSynced: string | null };
type Campaign = { id: string; platform: string; name: string; status: string; spend: number; impressions: number; clicks: number; leads: number };

export default function AdIntegrationsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [connRes, campRes] = await Promise.all([
        api("/ad-integrations/connections"),
        api("/ad-integrations/campaigns"),
      ]);
      setConnections(connRes || []);
      setCampaigns(campRes || []);
    } catch {}
  };

  useEffect(() => { refresh(); }, []);

  const connectMeta = async () => {
    const res = await api("/ad-integrations/meta/oauth-url");
    if (res.error) return toast.error(res.error);
    // Open popup for OAuth
    const w = window.open(res.url, "meta-oauth", "width=600,height=700");
    const poll = setInterval(async () => {
      try {
        if (w?.closed) {
          clearInterval(poll);
          refresh();
        }
      } catch { clearInterval(poll); }
    }, 1000);
  };

  const connectGoogle = async () => {
    const res = await api("/ad-integrations/google/oauth-url");
    if (res.error) return toast.error(res.error);
    const w = window.open(res.url, "google-oauth", "width=600,height=700");
    const poll = setInterval(async () => {
      try {
        if (w?.closed) {
          clearInterval(poll);
          refresh();
        }
      } catch { clearInterval(poll); }
    }, 1000);
  };

  const disconnect = async (platform: string) => {
    await api(`/ad-integrations/${platform}/disconnect`, { method: "POST" });
    toast.success(`${platform} disconnected`);
    refresh();
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await api("/ad-integrations/campaigns/sync", { method: "POST" });
      toast.success("Campaign data synced");
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setSyncing(false);
  };

  const connection = (platform: string) => connections.find((c) => c.platform === platform);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Ad Integrations</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">Connect Meta Ads and Google Ads to import leads and track campaign performance</p>
        </div>
        {campaigns.length > 0 && (
          <button onClick={sync} disabled={syncing}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-[var(--border)] text-sm text-[var(--foreground)] hover:bg-[var(--accent)] disabled:opacity-50">
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync
          </button>
        )}
      </div>

      {/* Platform Connections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Meta Ads */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center text-lg">f</div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Meta Ads</h3>
                <p className="text-xs text-[var(--muted-foreground)]">Facebook & Instagram lead forms</p>
              </div>
            </div>
            {connection('meta')?.connected
              ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Connected</span>
              : <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"><XCircle size={12} /> Not connected</span>
            }
          </div>
          {connection('meta')?.connected ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--foreground)]">{connection('meta')?.name}</p>
              <button onClick={() => disconnect('meta')}
                className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600">
                <Unlink size={14} /> Disconnect
              </button>
            </div>
          ) : (
            <button onClick={connectMeta}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1877F2] text-white text-sm font-medium hover:opacity-90">
              <Link size={14} /> Connect Meta Ads
            </button>
          )}
        </div>

        {/* Google Ads */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center text-lg">G</div>
              <div>
                <h3 className="font-semibold text-[var(--foreground)]">Google Ads</h3>
                <p className="text-xs text-[var(--muted-foreground)]">Search & display campaigns</p>
              </div>
            </div>
            {connection('google')?.connected
              ? <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle size={12} /> Connected</span>
              : <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]"><XCircle size={12} /> Not connected</span>
            }
          </div>
          {connection('google')?.connected ? (
            <div className="space-y-2">
              <p className="text-sm text-[var(--foreground)]">{connection('google')?.name}</p>
              <button onClick={() => disconnect('google')}
                className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600">
                <Unlink size={14} /> Disconnect
              </button>
            </div>
          ) : (
            <button onClick={connectGoogle}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-[#4285F4] text-white text-sm font-medium hover:opacity-90">
              <Link size={14} /> Connect Google Ads
            </button>
          )}
        </div>
      </div>

      {/* Campaign Performance */}
      {campaigns.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-4">Campaign Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Platform</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Campaign</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Status</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Spend</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Impressions</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-[var(--muted-foreground)] uppercase">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50">
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${c.platform === 'meta' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                        {c.platform === 'meta' ? 'Meta' : 'Google'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[var(--foreground)] font-medium">{c.name}</td>
                    <td className="px-3 py-2.5">
                      <span className={`text-xs ${c.status === 'ACTIVE' ? 'text-green-600' : 'text-[var(--muted-foreground)]'}`}>{c.status}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--foreground)]">${(c.spend || 0).toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--foreground)]">{(c.impressions || 0).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-right text-[var(--foreground)]">{(c.clicks || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      {!connection('meta')?.connected && !connection('google')?.connected && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">How it works</h2>
          <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
            <p>1. Click <strong>Connect</strong> on the platform you want to integrate</p>
            <p>2. Authorize with your ad account (Meta Business or Google Ads)</p>
            <p>3. We automatically import leads from your ad forms and sync campaign performance</p>
            <p>4. Leads appear in your dashboard tagged with the source campaign</p>
          </div>
        </div>
      )}
    </div>
  );
}
