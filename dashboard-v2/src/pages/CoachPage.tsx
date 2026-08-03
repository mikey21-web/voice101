import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { Award, TrendingUp, AlertCircle, Lightbulb } from "lucide-react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/table";
import { Badge } from "../components/ui/badge";

const ADMIN_ROLES = ["OWNER", "ADMIN", "MANAGER"];

function scoreTone(score: number | null) {
  if (score == null) return "bg-slate-100 text-slate-600";
  if (score >= 85) return "bg-emerald-100 text-emerald-700";
  if (score >= 60) return "bg-amber-100 text-amber-700";
  return "bg-rose-100 text-rose-700";
}

/**
 * Rail D. A rep sees only their own calls; the side-by-side comparison is on
 * the admin tab and is never shown to reps. The backend enforces this with a
 * 403, so hiding the tab here is convenience, not the security boundary.
 */
export default function CoachPage() {
  const [mine, setMine] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [tab, setTab] = useState<"me" | "team">("me");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const role = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}").role || ""; } catch { return ""; }
  })();
  const isAdmin = ADMIN_ROLES.includes(role);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [own, team] = await Promise.all([
        api("/coach/me"),
        isAdmin ? api("/coach/admin/overview") : Promise.resolve(null),
      ]);
      setMine(own || []);
      setOverview(team);
    } catch (e: any) {
      setError(e.message || "Failed to load coaching");
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6 text-slate-500">Loading coaching…</div>;
  if (error) return <div className="p-6 text-rose-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Award className="w-6 h-6" /> Sales Coach
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Feedback after every call, not just the ones that closed.
        </p>
      </div>

      {isAdmin && (
        <div className="flex gap-2 border-b">
          <button
            className={`px-4 py-2 text-sm ${tab === "me" ? "border-b-2 border-slate-900 font-medium" : "text-slate-500"}`}
            onClick={() => setTab("me")}
          >My calls</button>
          <button
            className={`px-4 py-2 text-sm ${tab === "team" ? "border-b-2 border-slate-900 font-medium" : "text-slate-500"}`}
            onClick={() => setTab("team")}
          >Team</button>
        </div>
      )}

      {tab === "me" && (
        mine.length === 0 ? (
          <div className="text-slate-500">
            No coaching yet. It appears after your next call is transcribed.
          </div>
        ) : (
          <div className="space-y-4">
            {mine.map((c) => (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm text-slate-500">
                      {new Date(c.createdAt).toLocaleString("en-IN")}
                      {c.callLog?.durationSec ? ` · ${Math.round(c.callLog.durationSec / 60)} min` : ""}
                    </div>
                    <div className="mt-1">{c.callLog?.summary || "No summary"}</div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${scoreTone(c.score)}`}>
                    {c.score == null ? "Not scored" : `${c.score}/100`}
                  </span>
                </div>

                {c.analysisStatus === "NO_TRANSCRIPT" && (
                  <div className="text-sm text-slate-500">
                    No recording was available for this call, so it was not scored.
                  </div>
                )}

                {c.recommendedAction && (
                  <div className="flex gap-2 text-sm">
                    <Lightbulb className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>{c.recommendedAction}</span>
                  </div>
                )}
                {c.whatToSend && (
                  <div className="text-sm text-slate-600">Send next: {c.whatToSend}</div>
                )}

                {c.missedQuestions?.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center text-sm">
                    <AlertCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-slate-500 mr-1">Not asked:</span>
                    {c.missedQuestions.map((m: string) => (
                      <Badge key={m} variant="outline">{m}</Badge>
                    ))}
                  </div>
                )}
                {c.objections?.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center text-sm">
                    <span className="text-slate-500 mr-1">Objections:</span>
                    {c.objections.map((o: string) => <Badge key={o} variant="outline">{o}</Badge>)}
                  </div>
                )}
                {c.buyingSignals?.length > 0 && (
                  <div className="flex flex-wrap gap-1 items-center text-sm">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    {c.buyingSignals.map((b: string) => <Badge key={b}>{b}</Badge>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {tab === "team" && isAdmin && overview && (
        <div className="space-y-4">
          <div className="text-sm text-slate-500">
            {overview.totalCalls} call(s) in the last 30 days
            {overview.teamAvgScore != null && ` · team average ${overview.teamAvgScore}/100`}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Salesperson</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Avg score</TableHead>
                <TableHead>Most missed</TableHead>
                <TableHead>Top objection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.reps.map((r: any) => (
                <TableRow key={r.userId}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.calls}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded text-sm ${scoreTone(r.avgScore)}`}>
                      {r.avgScore ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>{r.topGap ?? "—"}</TableCell>
                  <TableCell>{r.topObjection ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
