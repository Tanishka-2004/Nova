"use client";

import { useState, useEffect } from "react";
import { Users, AlertCircle, Target, Zap, ShieldCheck, ChevronDown, ChevronUp, Database, BrainCircuit, Activity, Network, BarChart3, ArrowRight, Play, Server, LineChart, Moon, Sun, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentChat } from "@/components/chat/agent-chat";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

// ── Types for API response ──────────────────────────────────────────────────
interface Opportunity {
  id: number;
  title: string;
  type: string;
  color: string;
  audienceSize: number;
  revenue: number;
  avgOrderValue?: number;
  avgCartValue?: number;
  accessoryAOV?: number;
  totalHistoricalSpend?: number;
  totalAtRiskRevenue?: number;
  totalOrders?: number;
  totalRevenue?: number;
  avgDaysInactive?: number;
  dataConfidence: number;
  modelConfidence: number;
  overallConfidence: number;
  formula: string;
  assumptions: string;
  whyExists: string;
  recommendation: string;
  whyNow: string;
  windowOfOpportunity: string;
  waitConsequence: string;
  dataSources: Record<string, string>;
}

interface GlobalStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  tierDistribution: Array<{ tier: string; count: number; percentage: number }>;
}

interface OpportunitiesResponse {
  totalOpportunity: number;
  opportunities: Opportunity[];
  globalStats: GlobalStats;
  metadata: {
    generatedAt: string;
    dataSource: string;
    hardcodedValues: string;
  };
}

// ── Icon mapping by opportunity type ─────────────────────────────────────────
const TYPE_ICONS: Record<string, any> = {
  "Revenue Recovery": Users,
  "Churn Prevention": AlertCircle,
  "Growth Expansion": Target,
};

// ── Format INR currency ─────────────────────────────────────────────────────
function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function CommandCenterPage() {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showHowNovaThinks, setShowHowNovaThinks] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // ── Real data state ─────────────────────────────────────────────────────
  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Fetch real opportunities from database ──────────────────────────────
  useEffect(() => {
    async function fetchOpportunities() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/opportunities");
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const json: OpportunitiesResponse = await res.json();
        setData(json);
      } catch (err: any) {
        console.error("Failed to fetch opportunities:", err);
        setError(err.message || "Failed to load opportunities");
      } finally {
        setLoading(false);
      }
    }
    fetchOpportunities();
  }, []);

  const opportunities = data?.opportunities ?? [];
  const totalOpportunity = data?.totalOpportunity ?? 0;
  const globalStats = data?.globalStats;

  const topOpp = opportunities[0] ?? null;
  const restOpps = opportunities.slice(1);
  const TopIcon = topOpp ? (TYPE_ICONS[topOpp.type] ?? Zap) : Zap;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground selection:bg-primary/30 transition-colors duration-300">
      
      {/* Left Column: Proactive Command Center */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-12 md:px-16 lg:pr-12">
        <div className="max-w-4xl mx-auto space-y-16 pb-24">
          
          {/* Top Action Bar */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-between items-center"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center border border-primary/20">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">Command Center</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowHowNovaThinks(!showHowNovaThinks)}
                className="text-xs font-semibold uppercase tracking-widest text-primary hover:text-foreground flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <Network className="h-3.5 w-3.5" /> How Nova Thinks
              </button>
              
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="h-9 w-9 rounded-full border border-border bg-card flex items-center justify-center hover:bg-muted transition-colors relative"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-foreground" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-foreground" />
                  <span className="sr-only">Toggle theme</span>
                </button>
              )}
            </div>
          </motion.div>

          {/* How Nova Thinks Diagram (Framer Motion) */}
          <AnimatePresence>
            {showHowNovaThinks && (
              <motion.div 
                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                animate={{ opacity: 1, height: "auto", scale: 1 }}
                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="p-8 rounded-2xl bg-card border border-border shadow-lg relative mt-4">
                  <h3 className="text-sm font-bold text-foreground mb-8 tracking-widest uppercase flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> System Architecture
                  </h3>
                  
                  <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                    <Node icon={Database} label="Customer Data" sub="PostgreSQL + Prisma" />
                    <Connection />
                    <Node icon={Zap} label="Opportunity Engine" sub="Real-Time Queries" glow="amber" />
                    <Connection />
                    <Node icon={BrainCircuit} label="AI Strategist" sub="LLM (Copy Only)" glow="purple" />
                    <Connection />
                    <Node icon={Server} label="Channel Service" sub="Async FastAPI" />
                    <Connection />
                    <Node icon={LineChart} label="Analytics" sub="Webhook Ingestion" glow="emerald" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading State */}
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="relative">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <Loader2 className="h-8 w-8 text-primary animate-spin" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Querying Customer Database...</h2>
                <p className="text-sm text-muted-foreground">Running Prisma queries against 500+ customers and orders</p>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {error && !loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="h-20 w-20 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Failed to Load Opportunities</h2>
                <p className="text-sm text-muted-foreground">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-4 px-6 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
                >
                  Retry
                </button>
              </div>
            </motion.div>
          )}

          {/* Real Data Loaded */}
          {!loading && !error && data && topOpp && (
            <>
              {/* Hero Section — Total from database */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="space-y-6"
              >
                <div>
                  <div className="text-[72px] md:text-[96px] font-bold text-foreground tracking-tighter leading-none dark:glow-text flex items-baseline gap-2">
                    {formatINR(totalOpportunity)}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-medium text-muted-foreground mt-2 tracking-tight">
                    Unrealized Revenue Opportunity
                  </h1>
                </div>
                
                <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed border-l-2 border-primary/40 pl-6">
                  Computed from {globalStats?.totalCustomers} customers, {globalStats?.totalOrders} orders, and ₹{globalStats?.avgOrderValue?.toLocaleString("en-IN")} average order value.
                  <span className="block text-xs mt-2 text-muted-foreground/70 font-mono">
                    Database Status: StyleNova D2C Store Synced | Active Database Connection | Updated: {data.metadata.generatedAt ? new Date(data.metadata.generatedAt).toLocaleTimeString() : ""}
                  </span>
                </p>

                {/* Global Tier Distribution */}
                {globalStats && (
                  <div className="flex gap-2 flex-wrap">
                    {globalStats.tierDistribution.map((t) => (
                      <div key={t.tier} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent border border-border text-xs font-medium">
                        <span className={cn(
                          "h-2 w-2 rounded-full",
                          t.tier === "CHAMPION" ? "bg-emerald-500" :
                          t.tier === "LOYAL" ? "bg-blue-500" :
                          t.tier === "POTENTIAL" ? "bg-amber-500" :
                          t.tier === "AT_RISK" ? "bg-orange-500" :
                          "bg-red-500"
                        )} />
                        <span className="text-foreground">{t.tier}</span>
                        <span className="text-muted-foreground">{t.count} ({t.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Top Opportunity (Highest Revenue) */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="mt-16"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">Highest Priority Initiative</span>
                </div>

                <div className="bg-card border border-border rounded-[32px] p-8 md:p-12 shadow-xl hover:border-primary/30 transition-colors group relative overflow-hidden">
                  {/* Subtle background glow */}
                  <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/3 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                  
                  <div className="grid md:grid-cols-2 gap-12 relative z-10">
                    {/* Left Side: The Value */}
                    <div className="space-y-8">
                      <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent border border-border text-xs font-semibold uppercase tracking-widest text-foreground mb-6">
                          <TopIcon className="h-3 w-3" /> {topOpp.type}
                        </div>
                        <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">{topOpp.title}</h2>
                        <p className="text-lg text-muted-foreground leading-relaxed">{topOpp.whyExists}</p>
                      </div>

                      <div className="flex items-end gap-6">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-semibold">Predicted Impact</div>
                          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{formatINR(topOpp.revenue)}</div>
                        </div>
                        <div className="pb-1.5 border-l border-border pl-6">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Data Confidence</div>
                          <div className="text-xl font-medium text-foreground flex items-center gap-2">
                            {topOpp.overallConfidence}% <ShieldCheck className="h-4 w-4 text-emerald-500" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Side: The Context & Action */}
                    <div className="flex flex-col justify-between space-y-8 bg-muted/50 p-8 rounded-3xl border border-border">
                      <div className="space-y-6">
                        <div>
                          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-widest mb-2">
                            <Activity className="h-3.5 w-3.5" /> Window of Opportunity: {topOpp.windowOfOpportunity}
                          </div>
                          <h4 className="text-base font-semibold text-foreground mb-1">Why Now?</h4>
                          <p className="text-sm text-muted-foreground">{topOpp.whyNow}</p>
                        </div>

                        <div className="pt-6 border-t border-border">
                          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-widest mb-2">
                            <AlertCircle className="h-3.5 w-3.5" /> Revenue at Risk
                          </div>
                          <p className="text-sm text-muted-foreground">{topOpp.waitConsequence}</p>
                        </div>
                      </div>

                      {/* Hierarchical Actions */}
                      <div className="space-y-3 pt-6">
                        <button 
                          onClick={() => window.dispatchEvent(new CustomEvent('nova-chat', { detail: `Launch the ${topOpp.title} initiative.` }))}
                          className="w-full py-4 rounded-xl bg-foreground text-background text-[15px] font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02]"
                        >
                          <Play className="h-4 w-4 fill-current" /> Launch Initiative
                        </button>
                        <div className="flex gap-3">
                          <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('nova-chat', { detail: `Show me the strategy for ${topOpp.title}.` }))}
                            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-colors shadow-sm"
                          >
                            Review Strategy
                          </button>
                          <button 
                            onClick={() => setExpandedId(expandedId === topOpp.id ? null : topOpp.id)}
                            className="flex-1 py-3 rounded-xl bg-accent border border-border text-foreground text-sm font-medium hover:bg-muted transition-colors flex items-center justify-center gap-2"
                          >
                            View Evidence {expandedId === topOpp.id ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progressive Disclosure Panel */}
                  <AnimatePresence>
                    {expandedId === topOpp.id && (
                      <EvidencePanel opp={topOpp} />
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Secondary Opportunities */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="pt-8 space-y-6"
              >
                <h3 className="text-sm font-bold tracking-widest text-muted-foreground uppercase flex items-center gap-3">
                  Other Discovered Opportunities <span className="h-px flex-1 bg-border" />
                </h3>

                <div className="grid md:grid-cols-2 gap-6">
                  {restOpps.map((opp) => {
                    const OppIcon = TYPE_ICONS[opp.type] ?? Target;
                    return (
                      <div key={opp.id} className="bg-card border border-border hover:border-primary/30 p-8 rounded-3xl transition-colors shadow-sm hover:shadow-md group">
                        <div className="flex justify-between items-start mb-8">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{opp.type}</div>
                            <h3 className="text-xl font-bold text-foreground mb-1">{opp.title}</h3>
                            <div className="text-sm text-muted-foreground">{opp.audienceSize} profiles</div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors">{formatINR(opp.revenue)}</div>
                            <div className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500 mt-1">{opp.windowOfOpportunity}</div>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-8">{opp.whyExists}</p>

                        <div className="flex items-center justify-between pt-6 border-t border-border">
                          <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('nova-chat', { detail: `Show me the strategy for ${opp.title}.` }))}
                            className="text-sm font-semibold text-foreground flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            Review <ArrowRight className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => setExpandedId(expandedId === opp.id ? null : opp.id)}
                            className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Evidence
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedId === opp.id && (
                            <EvidencePanel opp={opp} isSmall />
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}

        </div>
      </div>
      
      {/* Right Column: Reactive Copilot Chat */}
      <div 
        className="hidden lg:flex flex-col w-[450px] border-l border-border backdrop-blur-md shadow-2xl z-10 relative transition-colors duration-300 text-white overflow-hidden"
        style={{ backgroundColor: mounted ? (theme === 'dark' ? 'rgba(0,0,0,0.4)' : '#0033a0') : '#0033a0' }}
      >
        <AgentChat />
      </div>
    </div>
  );
}

// ── Evidence Panel — shows full data provenance ─────────────────────────────

function EvidencePanel({ opp, isSmall = false }: { opp: Opportunity, isSmall?: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden mt-8 pt-8 border-t border-border"
    >
      <div className={cn("grid gap-6", isSmall ? "grid-cols-1" : "md:grid-cols-3")}>
        
        {/* Block 1: The Math — full formula provenance */}
        <div className="bg-muted p-6 rounded-2xl border border-border">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Calculation</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-1">Formula Applied</div>
              <div className="font-mono text-xs text-primary/80 bg-primary/10 p-2 rounded-lg border border-primary/20">
                {opp.formula}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-1">Result</div>
              <div className="text-lg font-bold text-foreground">{formatINR(opp.revenue)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase mb-1">Assumptions</div>
              <div className="text-xs text-muted-foreground italic">
                {opp.assumptions}
              </div>
            </div>
          </div>
        </div>

        {/* Block 2: Trust Scores */}
        <div className="bg-muted p-6 rounded-2xl border border-border">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Trust Metrics</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-foreground">Data Integrity</span>
              <span className="text-sm font-semibold text-foreground">{opp.dataConfidence}%</span>
            </div>
            <div className="w-full bg-border rounded-full h-1.5"><div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${opp.dataConfidence}%` }} /></div>
            
            <div className="flex justify-between items-center pt-2">
              <span className="text-sm text-foreground">Predictive Model</span>
              <span className="text-sm font-semibold text-foreground">{opp.modelConfidence}%</span>
            </div>
            <div className="w-full bg-border rounded-full h-1.5"><div className="bg-primary h-1.5 rounded-full" style={{ width: `${opp.modelConfidence}%` }} /></div>

            <div className="text-[10px] text-muted-foreground mt-2 italic">
              Data Integrity = % of cohort with both phone + email (reachability).
              Model = prediction confidence from conversion benchmarks.
            </div>
          </div>
        </div>

        {/* Block 3: Data Provenance */}
        <div className={cn("bg-muted p-6 rounded-2xl border border-border", isSmall && "hidden")}>
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Data Sources</span>
          </div>
          <div className="space-y-3">
            {opp.dataSources && Object.entries(opp.dataSources).map(([key, source]) => (
              <div key={key}>
                <div className="text-[10px] font-semibold text-foreground uppercase">{key}</div>
                <div className="font-mono text-[10px] text-muted-foreground bg-background/50 p-1.5 rounded border border-border mt-0.5 break-all">
                  {source}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// ── Architecture Diagram Subcomponents ──────────────────────────────────────

function Node({ icon: Icon, label, sub, glow }: { icon: any, label: string, sub: string, glow?: string }) {
  return (
    <div className="flex flex-col items-center text-center w-full md:w-auto z-10 relative">
      <div className={cn(
        "h-12 w-12 rounded-xl flex items-center justify-center mb-3 border bg-card",
        glow === 'amber' ? "border-amber-500/30 shadow-[0_0_15px_-3px_rgba(245,158,11,0.3)]" :
        glow === 'purple' ? "border-purple-500/30 shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)]" :
        glow === 'emerald' ? "border-emerald-500/30 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]" :
        "border-border"
      )}>
        <Icon className={cn(
          "h-5 w-5",
          glow === 'amber' ? "text-amber-500" :
          glow === 'purple' ? "text-purple-500" :
          glow === 'emerald' ? "text-emerald-500" :
          "text-muted-foreground"
        )} />
      </div>
      <span className="text-xs font-bold text-foreground whitespace-nowrap">{label}</span>
      <span className="text-[10px] text-muted-foreground font-medium mt-1 uppercase tracking-widest">{sub}</span>
    </div>
  );
}

function Connection() {
  return (
    <div className="hidden md:flex flex-1 items-center justify-center relative min-w-[40px] z-0">
      <div className="h-px w-full bg-border absolute top-1/2 -translate-y-1/2" />
      <motion.div 
        animate={{ x: [0, 40, 0], opacity: [0, 1, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="h-1.5 w-1.5 rounded-full bg-primary absolute top-1/2 -translate-y-1/2 shadow-[0_0_10px_2px_rgba(124,58,237,0.5)]" 
      />
    </div>
  );
}
