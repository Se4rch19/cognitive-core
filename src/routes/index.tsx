import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rafael — Cognitive Dashboard" },
      { name: "description", content: "Local dashboard for the Rafael cognitive system and Belzebuth ingest engine." },
    ],
  }),
  component: Dashboard,
});

const LS_KEY = "rafael.apiBase";

function useApiBase() {
  const [base, setBase] = useState<string>(() => {
    if (typeof window === "undefined") return "http://localhost:8000";
    return localStorage.getItem(LS_KEY) || "http://localhost:8000";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, base);
  }, [base]);
  return [base, setBase] as const;
}

async function api(base: string, path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => "")}`);
  return res.json();
}

function Dashboard() {
  const [base, setBase] = useApiBase();
  const [online, setOnline] = useState<boolean | null>(null);
  const [status, setStatus] = useState<any>(null);

  const refreshStatus = async () => {
    try {
      const s = await api(base, "/status");
      setStatus(s);
      setOnline(true);
    } catch (e: any) {
      setOnline(false);
      setStatus(null);
    }
  };

  useEffect(() => {
    refreshStatus();
    const t = setInterval(refreshStatus, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <header className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Rafael</h1>
            <p className="text-sm text-muted-foreground">Local cognitive dashboard · Belzebuth + Rafael</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={online ? "default" : online === false ? "destructive" : "secondary"}>
              {online === null ? "…" : online ? "online" : "offline"}
            </Badge>
            <Input
              className="w-72"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="http://localhost:8000"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6 space-y-6">
        <StatusCard status={status} onRefresh={refreshStatus} />

        <Tabs defaultValue="cognitive">
          <TabsList>
            <TabsTrigger value="cognitive">Cognitive</TabsTrigger>
            <TabsTrigger value="ask">Ask</TabsTrigger>
            <TabsTrigger value="ingest">Ingest</TabsTrigger>
            <TabsTrigger value="goal">Goal</TabsTrigger>
            <TabsTrigger value="skills">Skills</TabsTrigger>
            <TabsTrigger value="ku">Knowledge</TabsTrigger>
            <TabsTrigger value="learning">Learning</TabsTrigger>
          </TabsList>

          <TabsContent value="cognitive"><CognitivePanel base={base} /></TabsContent>
          <TabsContent value="ask"><AskPanel base={base} /></TabsContent>
          <TabsContent value="ingest"><IngestPanel base={base} onDone={refreshStatus} /></TabsContent>
          <TabsContent value="goal"><GoalPanel base={base} /></TabsContent>
          <TabsContent value="skills"><SkillsPanel base={base} /></TabsContent>
          <TabsContent value="ku"><KuPanel base={base} /></TabsContent>
          <TabsContent value="learning"><LearningPanel base={base} /></TabsContent>
        </Tabs>

      </main>
    </div>
  );
}

function StatusCard({ status, onRefresh }: { status: any; onRefresh: () => void }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>System status</CardTitle>
        <Button variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
      </CardHeader>
      <CardContent>
        {!status ? (
          <p className="text-sm text-muted-foreground">
            No connection. Start the Python API: <code className="font-mono">uvicorn api.server:app --reload</code>
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(status).map(([k, v]) => (
              <div key={k} className="rounded-md border border-border p-3">
                <div className="text-xs uppercase text-muted-foreground">{k}</div>
                <div className="mt-1 font-mono break-words">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AskPanel({ base }: { base: string }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);

  const submit = async () => {
    if (!q.trim()) return;
    setLoading(true); setRes(null);
    try { setRes(await api(base, "/ask", { method: "POST", body: JSON.stringify({ question: q }) })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Ask Rafael</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={3} placeholder="Ask a question over your ingested knowledge…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={submit} disabled={loading}>{loading ? "Thinking…" : "Ask"}</Button>
        {res && (
          <div className="space-y-2 rounded-md border border-border p-4">
            <div className="text-xs uppercase text-muted-foreground">Answer · confidence {Number(res.confidence).toFixed(2)}</div>
            <p className="whitespace-pre-wrap text-sm">{res.answer}</p>
            {res.citations?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-2">
                {res.citations.map((c: string) => <Badge key={c} variant="secondary">{c}</Badge>)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IngestPanel({ base, onDone }: { base: string; onDone: () => void }) {
  const [paths, setPaths] = useState("");
  const [embed, setEmbed] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const list = paths.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    setLoading(true);
    try {
      const r = await api(base, "/ingest", { method: "POST", body: JSON.stringify({ paths: list, embed }) });
      toast.success(`Ingested ${r.ingested} KUs`);
      onDone();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Ingest sources</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Label>Local paths or URLs (one per line)</Label>
        <Textarea rows={5} placeholder="/home/me/notes&#10;https://example.com/article" value={paths} onChange={(e) => setPaths(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch checked={embed} onCheckedChange={setEmbed} id="embed" />
          <Label htmlFor="embed">Compute embeddings</Label>
        </div>
        <Button onClick={submit} disabled={loading}>{loading ? "Ingesting…" : "Ingest"}</Button>
      </CardContent>
    </Card>
  );
}

function GoalPanel({ base }: { base: string }) {
  const [goal, setGoal] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);

  const submit = async () => {
    if (!goal.trim()) return;
    setLoading(true); setRes(null);
    try { setRes(await api(base, "/goal", { method: "POST", body: JSON.stringify({ goal, dry_run: dryRun }) })); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Execute goal</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea rows={3} placeholder="e.g. summarize last week's ingested notes and save to a file" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch checked={dryRun} onCheckedChange={setDryRun} id="dry" />
          <Label htmlFor="dry">Dry run (plan only)</Label>
        </div>
        <Button onClick={submit} disabled={loading}>{loading ? "Planning…" : "Run"}</Button>
        {res && (
          <div className="space-y-3">
            <div className="rounded-md border border-border p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Plan</div>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {res.plan.steps.map((s: any, i: number) => (
                  <li key={i}><span className="font-mono">{s.skill}</span> {s.args ? <span className="text-muted-foreground">({JSON.stringify(s.args)})</span> : null}</li>
                ))}
              </ol>
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Execution · {res.execution.ok ? "ok" : "failed"}</div>
              <pre className="text-xs overflow-auto max-h-64">{JSON.stringify(res.execution.steps, null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SkillsPanel({ base }: { base: string }) {
  const [skills, setSkills] = useState<any[]>([]);
  const [need, setNeed] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [args, setArgs] = useState("{}");
  const [result, setResult] = useState<any>(null);

  const load = async () => {
    try { setSkills(await api(base, "/skills")); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [base]);

  const generate = async () => {
    if (!need.trim()) return;
    try {
      const r = await api(base, "/skills/generate", { method: "POST", body: JSON.stringify({ need }) });
      toast.success(`Generated: ${r.name || "skill"}`);
      setNeed(""); load();
    } catch (e: any) { toast.error(e.message); }
  };

  const run = async () => {
    if (!selected) return;
    let parsed: any = {};
    try { parsed = JSON.parse(args || "{}"); } catch { toast.error("Args must be valid JSON"); return; }
    try {
      const r = await api(base, "/skills/run", { method: "POST", body: JSON.stringify({ name: selected, args: parsed }) });
      setResult(r.result);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Registered skills</CardTitle>
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {skills.length === 0 && <p className="text-sm text-muted-foreground">No skills registered yet.</p>}
          {skills.map((s: any) => (
            <button
              key={s.name}
              onClick={() => setSelected(s.name)}
              className={`w-full text-left rounded-md border p-3 transition-colors ${selected === s.name ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
            >
              <div className="font-mono text-sm">{s.name}</div>
              {s.description && <div className="text-xs text-muted-foreground mt-1">{s.description}</div>}
            </button>
          ))}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Generate skill</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Textarea rows={3} placeholder="Describe the capability you need…" value={need} onChange={(e) => setNeed(e.target.value)} />
            <Button onClick={generate}>Generate</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Run skill</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Label>Selected: <span className="font-mono">{selected || "—"}</span></Label>
            <Label>Args (JSON)</Label>
            <Textarea rows={3} value={args} onChange={(e) => setArgs(e.target.value)} />
            <Button onClick={run} disabled={!selected}>Run</Button>
            {result !== null && (
              <pre className="text-xs rounded-md border border-border p-3 overflow-auto max-h-64">{JSON.stringify(result, null, 2)}</pre>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KuPanel({ base }: { base: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    try { setItems(await api(base, "/ku?limit=50")); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [base]);

  const search = async () => {
    if (!q.trim()) return load();
    try {
      const hits = await api(base, `/ku/search?q=${encodeURIComponent(q)}&top_k=20`);
      setItems(hits.map((h: any) => ({ ...h.ku, _score: h.score })));
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Knowledge units</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <Button variant="outline" onClick={search}>Search</Button>
          <Button variant="ghost" onClick={load}>All</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No KUs.</p>}
        {items.map((k: any) => (
          <div key={k.id} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">{String(k.id).slice(0, 12)}</span>
              {k._score !== undefined && <Badge variant="secondary">score {Number(k._score).toFixed(2)}</Badge>}
            </div>
            <div className="text-sm mt-1 line-clamp-3">{k.content || k.text || JSON.stringify(k).slice(0, 240)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CognitivePanel({ base }: { base: string }) {
  const [text, setText] = useState("");
  const [project, setProject] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [traces, setTraces] = useState<any[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<any>(null);

  const loadTraces = async () => {
    try { setTraces(await api(base, "/cognitive/traces?limit=25")); } catch {}
  };
  useEffect(() => { loadTraces(); /* eslint-disable-next-line */ }, [base]);

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true); setRes(null); setSelectedTrace(null);
    try {
      const r = await api(base, "/cognitive/run", {
        method: "POST",
        body: JSON.stringify({ text, project: project || null, dry_run: dryRun }),
      });
      setRes(r); loadTraces();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const openTrace = async (id: string) => {
    try { setSelectedTrace(await api(base, `/cognitive/traces/${id}`)); }
    catch (e: any) { toast.error(e.message); }
  };

  const trace = selectedTrace || res?.trace;

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div className="md:col-span-2 space-y-4">
        <Card>
          <CardHeader><CardTitle>Cognitive cycle</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea rows={3} placeholder="Talk to Rafael…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex flex-wrap items-center gap-3">
              <Input className="w-48" placeholder="project (optional)" value={project} onChange={(e) => setProject(e.target.value)} />
              <div className="flex items-center gap-2">
                <Switch id="cog-dry" checked={dryRun} onCheckedChange={setDryRun} />
                <Label htmlFor="cog-dry">Dry run</Label>
              </div>
              <Button onClick={submit} disabled={loading}>{loading ? "Thinking…" : "Run cycle"}</Button>
            </div>
            {res && (
              <div className="rounded-md border border-border p-4">
                <div className="text-xs uppercase text-muted-foreground">Response · intent {res.trace.intent} · ok {String(res.ok)}</div>
                <p className="whitespace-pre-wrap text-sm mt-1">{res.response}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {trace && (
          <Card>
            <CardHeader><CardTitle>Trace {trace.id?.slice(0, 8)}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(trace.entries || []).map((e: any, i: number) => (
                <details key={i} className="rounded-md border border-border">
                  <summary className="cursor-pointer px-3 py-2 text-sm flex items-center justify-between">
                    <span className="font-mono">{e.stage}</span>
                    <span className="text-xs text-muted-foreground">{e.duration_ms}ms</span>
                  </summary>
                  <pre className="text-xs px-3 pb-2 overflow-auto max-h-64">{JSON.stringify(e.payload, null, 2)}</pre>
                </details>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent traces</CardTitle>
          <Button size="sm" variant="outline" onClick={loadTraces}>Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {traces.length === 0 && <p className="text-sm text-muted-foreground">No traces yet.</p>}
          {traces.map((t: any) => (
            <button
              key={t.id}
              onClick={() => openTrace(t.id)}
              className="w-full text-left rounded-md border border-border p-2 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs">{t.id.slice(0, 8)}</span>
                <Badge variant={t.ok ? "default" : "destructive"}>{t.intent}</Badge>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.input}</div>
            </button>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function LearningPanel({ base }: { base: string }) {
  const [data, setData] = useState<any>(null);
  const load = async () => {
    try { setData(await api(base, "/learning")); } catch (e: any) { toast.error(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [base]);

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Skill performance</CardTitle>
          <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {(!data || !data.skills?.length) && <p className="text-sm text-muted-foreground">No data yet.</p>}
          {data?.skills?.map((s: any) => (
            <div key={s.skill} className="rounded-md border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-mono">{s.skill}</span>
                <Badge variant={s.failures > 0 ? "destructive" : "default"}>
                  {s.successes}/{s.runs}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                avg {Math.round(s.avg_ms)}ms{s.last_error ? ` · last: ${s.last_error}` : ""}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Intents</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data?.intents?.map((r: any) => (
              <div key={r.intent} className="flex justify-between text-sm">
                <span className="font-mono">{r.intent}</span>
                <span className="text-muted-foreground">{r.successes}/{r.runs}</span>
              </div>
            ))}
            {!data?.intents?.length && <p className="text-sm text-muted-foreground">No data yet.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
          <CardContent>
            {data?.recommendations?.length ? (
              <ul className="list-disc list-inside space-y-1 text-sm">
                {data.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No recommendations yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
