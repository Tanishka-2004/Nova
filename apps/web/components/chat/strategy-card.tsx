import { useState, useEffect } from "react";
import { Users, Target, BarChart3, AlertCircle, CheckCircle2, Loader2, Send, Mail, Smartphone, Activity, Database } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function StrategyProposalCard({ result }: { result: any }) {
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [campaignStats, setCampaignStats] = useState<any>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  if (!result) return null;

  const metrics = result.metrics?.predictions ?? {};

  const handleLaunch = async () => {
    setIsLaunching(true);
    toast.info("Preparing campaign segment and template...");
    try {
      const res = await fetch("/api/campaign/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: result.goal || "Marketing Campaign",
          channel: result.recommendedChannel,
          messageTemplate: result.campaignVariantA,
          segmentName: result.audienceName
        })
      });
      const data = await res.json();
      if (data.success) {
        setCampaignId(data.campaignId);
        toast.success("Campaign launched successfully!", {
          description: `Dispatched to ${data.recipientCount} target profiles.`
        });
      } else {
        throw new Error(data.error || "Failed to launch");
      }
    } catch (err: any) {
      console.error("Launch error:", err);
      toast.error("Launch failed", { description: err.message });
      setIsLaunching(false);
    }
  };

  useEffect(() => {
    if (!campaignId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/campaign/status?id=${campaignId}`);
        const data = await res.json();
        if (data.id) {
          setCampaignStats(data);
          if (data.status === "COMPLETED") {
            toast.success("Campaign execution completed!");
            clearInterval(interval);
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll();
    const interval = setInterval(poll, 1500);
    return () => clearInterval(interval);
  }, [campaignId]);

  const total = campaignStats?.recentMessages?.length || 20;
  const stats = campaignStats?.stats || { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
  const processed = stats.delivered + stats.read + stats.clicked + stats.failed + stats.sent;
  const progressPercent = Math.min(100, Math.round(((processed - stats.sent) / total) * 100));

  const renderVariantCopy = (variant: any) => {
    if (!variant) return null;
    if (typeof variant === "string") {
      return <p className="text-xs text-white leading-relaxed">{variant}</p>;
    }
    if (typeof variant === "object") {
      return (
        <div className="space-y-1.5 text-xs">
          {variant.subject && (
            <div className="font-semibold text-cyan-300">
              <span className="text-slate-500 uppercase text-[9px] mr-1">Subject:</span> {variant.subject}
            </div>
          )}
          {variant.body && (
            <div className="text-slate-300 leading-relaxed whitespace-pre-line">
              {variant.body}
            </div>
          )}
        </div>
      );
    }
    return <p className="text-xs text-white leading-relaxed">{JSON.stringify(variant)}</p>;
  };

  return (
    <div className="mt-4 animate-in slide-in-from-bottom-4 fade-in duration-700 w-full rounded-2xl overflow-hidden border border-white/10 relative bg-black/40 backdrop-blur-md">
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />

      <div className="px-4 py-4 border-b border-white/10 bg-white/[0.03]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${campaignId ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
              {campaignId ? `Executing: ${campaignStats?.status || 'SENDING'}` : 'Strategy Ready'}
            </span>
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/20">
            {result.metrics?.confidenceScore ?? 92}% Confidence
          </span>
        </div>
        <h3 className="text-base font-bold text-white leading-snug">
          {result.goal ?? "Marketing Strategy"}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          Targeting <span className="text-white font-medium">{result.audienceName}</span>{" "}
          — {result.metrics?.audienceSize} users
        </p>
        {result.dataContext && (
          <div className="text-[9px] text-slate-500 mt-1.5 font-mono flex flex-wrap gap-x-3">
            <span>CRM Database: {result.dataContext.totalCustomers} customers</span>
            <span>AOV: ₹{result.dataContext.avgOrderValue?.toLocaleString("en-IN")}</span>
            <span>Audience Rules: {result.dataContext.segmentQuery}</span>
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-5">
        
        {campaignId ? (
          <div className="space-y-4 p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 animate-in fade-in duration-500">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-300">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Activity className="h-3.5 w-3.5 animate-pulse" /> Live Delivery Loop
              </span>
              <span>{progressPercent}% Complete</span>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/10">
              <div 
                className="bg-cyan-400 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="grid grid-cols-5 gap-1 text-center">
              {[
                { label: "Queued", val: total - processed, color: "text-slate-400" },
                { label: "Sent",   val: stats.sent,        color: "text-blue-300" },
                { label: "Deliv.", val: stats.delivered,   color: "text-cyan-300" },
                { label: "Read",   val: stats.read,        color: "text-indigo-300" },
                { label: "Click",  val: stats.clicked,     color: "text-emerald-400" },
              ].map(({ label, val, color }) => (
                <div key={label} className="p-1.5 rounded bg-white/[0.03] border border-white/5 flex flex-col">
                  <span className={`text-xs font-bold ${color}`}>{val}</span>
                  <span className="text-[8px] text-slate-500 mt-0.5 uppercase tracking-tight">{label}</span>
                </div>
              ))}
            </div>

            {campaignStats?.recentMessages && campaignStats.recentMessages.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live Event Webhooks</div>
                <div className="space-y-1 max-h-[100px] overflow-y-auto pr-1">
                  {campaignStats.recentMessages.slice(0, 3).map((m: any) => (
                    <div key={m.id} className="text-[10px] flex justify-between items-center py-0.5 px-1.5 rounded bg-black/20 text-slate-300 border border-white/5">
                      <span className="truncate max-w-[150px] font-mono">{m.recipientAddress}</span>
                      <span className={m.status === 'CLICKED' ? 'text-emerald-400 font-semibold' : 
                                      m.status === 'READ' ? 'text-indigo-400' :
                                      m.status === 'FAILED' ? 'text-red-400' : 'text-slate-400'}>
                        {m.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Open Rate", value: metrics.openRate, color: "text-cyan-300" },
              { label: "CTR",       value: metrics.ctr,      color: "text-white" },
              { label: "Conv.",     value: metrics.conversionRate, color: "text-white" },
              { label: "ROI",       value: metrics.roi,      color: "text-emerald-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col items-center p-2 rounded-lg bg-white/5 border border-white/10 overflow-hidden min-w-0">
                <span 
                  className={cn(
                    "font-bold text-center w-full truncate px-0.5",
                    color,
                    (value && String(value).length > 6) ? "text-[10px]" : "text-sm"
                  )}
                  title={String(value)}
                >
                  {value}
                </span>
                <span className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wide truncate w-full text-center">{label}</span>
              </div>
            ))}
          </div>
        )}

        <div>
          <h4 className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mb-2 uppercase tracking-widest">
            <Users className="h-3 w-3 text-indigo-400" /> Why This Audience
          </h4>
          <ul className="space-y-1">
            {result.whyThisAudience?.map((reason: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                <span className="text-indigo-400 mt-0.5 shrink-0">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-3 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-20 h-20 bg-indigo-500/10 blur-2xl rounded-full" />
          <div className="text-[9px] text-indigo-400 font-bold mb-0.5 uppercase tracking-widest">AI Persona</div>
          <h4 className="text-sm font-bold text-white mb-1.5">{result.personaName}</h4>
          <div className="space-y-0.5 mb-2">
            {result.personaCharacteristics?.map((char: string, i: number) => (
              <div key={i} className="text-[11px] text-slate-400">✓ {char}</div>
            ))}
          </div>
          <div className="text-[11px] text-indigo-200 italic border-l-2 border-indigo-500/50 pl-2">
            "{result.personaStrategy}"
          </div>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mb-2 uppercase tracking-widest">
            <Target className="h-3 w-3 text-emerald-400" /> Channel: {result.recommendedChannel}
          </h4>
          <div className="text-xs text-slate-400 p-2.5 rounded-lg bg-black/40 border border-white/5 leading-relaxed">
            {result.channelReasoning}
          </div>
        </div>

        <div>
          <h4 className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 mb-2 uppercase tracking-widest">
            <BarChart3 className="h-3 w-3 text-purple-400" /> Campaign Copy
          </h4>
          <div className="space-y-2">
            <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-500/5 relative">
              <div className="text-[9px] font-bold uppercase text-indigo-400 tracking-widest mb-1">Variant A — Control</div>
              {renderVariantCopy(result.campaignVariantA)}
            </div>
            <div className="p-3 rounded-xl border border-white/10 bg-white/5 relative">
              <div className="text-[9px] font-bold uppercase text-slate-400 tracking-widest mb-1">Variant B — Test</div>
              {renderVariantCopy(result.campaignVariantB)}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-black/50 border border-white/5">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-black border border-white/10 shrink-0">
              <span className="text-lg font-bold text-white leading-none">{result.criticScore}</span>
              <span className="text-[8px] text-slate-500 uppercase">Score</span>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider mb-0.5">AI Critic</div>
              <div className="text-[10px] text-slate-400">Campaign quality assessment</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div>
              <div className="text-[9px] font-bold text-emerald-400 mb-1 uppercase">Strengths</div>
              {result.criticStrengths?.map((s: string, i: number) => (
                <div key={i} className="text-[10px] text-slate-400 flex gap-1"><span className="text-emerald-500">✓</span> {s}</div>
              ))}
            </div>
            <div>
              <div className="text-[9px] font-bold text-amber-400 mb-1 uppercase">Weaknesses</div>
              {result.criticWeaknesses?.map((s: string, i: number) => (
                <div key={i} className="text-[10px] text-slate-400 flex gap-1"><span className="text-amber-500">⚠</span> {s}</div>
              ))}
            </div>
          </div>
          {result.criticRecommendations?.[0] && (
            <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-300">
              <span className="font-semibold text-indigo-400">Recommendation: </span>
              {result.criticRecommendations[0]}
            </div>
          )}
        </div>

        {/* Data Source Classification (Rule 6) */}
        {result.fieldSources && (
          <div className="p-3 rounded-xl bg-black/50 border border-white/5">
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Database className="h-3 w-3" /> Field Source Classification
            </div>
            <div className="grid grid-cols-2 gap-1">
              {Object.entries(result.fieldSources).slice(0, 8).map(([key, source]: [string, any]) => (
                <div key={key} className="flex items-center gap-1.5 text-[9px]">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                    source === "database" ? "bg-emerald-400" :
                    source === "llm" ? "bg-purple-400" :
                    source?.includes("database") ? "bg-cyan-400" :
                    "bg-slate-500"
                  }`} />
                  <span className="text-slate-500 truncate">{key}</span>
                  <span className={`font-medium ml-auto shrink-0 ${
                    source === "database" ? "text-emerald-400" :
                    source === "llm" ? "text-purple-400" :
                    "text-slate-400"
                  }`}>{source === "database" ? "DB" : source === "llm" ? "AI" : "Hybrid"}</span>
                </div>
              ))}
            </div>
            <div className="text-[8px] text-slate-600 mt-2 flex gap-3">
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-emerald-400" /> Database</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-purple-400" /> LLM</span>
              <span className="flex items-center gap-1"><span className="h-1 w-1 rounded-full bg-cyan-400" /> Hybrid</span>
            </div>
          </div>
        )}
      </div>

      {!campaignId && (
        <div className="px-4 py-3 bg-black/60 border-t border-white/5 flex items-center justify-between gap-2">
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent("nova-chat", {
                detail: `Challenge the strategy proposal for "${result.goal || 'grow revenue'}". Give me an alternative channel, segment, or copywriting approach.`
              }));
            }}
            className="text-[10px] font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" /> Challenge
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => {
                window.dispatchEvent(new CustomEvent("nova-chat", {
                  detail: `I want to edit this campaign proposal. Let's customize the copy or the target segment filter.`
                }));
              }}
              className="px-3 py-1.5 rounded-full border border-white/10 text-white text-xs font-medium hover:bg-white/5 transition-all"
            >
              Edit
            </button>
            <button 
              onClick={handleLaunch}
              disabled={isLaunching}
              className="px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-slate-200 hover:scale-105 disabled:opacity-50 disabled:scale-100 transition-all shadow-[0_0_15px_-3px_rgba(255,255,255,0.5)] flex items-center gap-1.5"
            >
              {isLaunching ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> Launching...
                </>
              ) : (
                <>Launch →</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
