// @ts-nocheck
"use client";

import { Send, Sparkles, Bot, User, AlertCircle, CheckCircle2, Activity, Users, Mail, BarChart3, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState, FormEvent } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { StrategyProposalCard } from "./strategy-card";

// ── Types ──────────────────────────────────────────────────────────────────────
type Role = "user" | "assistant";

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  result?: unknown;
  state: "call" | "result";
}

interface Message {
  id: string;
  role: Role;
  content: string;
  toolInvocations?: ToolInvocation[];
}

// ── ThoughtStream ──────────────────────────────────────────────────────────────
const THOUGHT_STEPS = [
  { id: 1, text: "Analyzing purchase behavior...", icon: Activity },
  { id: 2, text: "Calculating customer value scores...", icon: BarChart3 },
  { id: 3, text: "Identifying churn-risk customers...", icon: AlertCircle },
  { id: 4, text: "Building target audience...", icon: Users },
  { id: 5, text: "Selecting communication channel...", icon: Mail },
  { id: 6, text: "Generating campaign copy...", icon: Sparkles },
  { id: 7, text: "Predicting campaign performance...", icon: TrendingUp },
  { id: 8, text: "Strategy ready.", icon: CheckCircle2 },
];

function ThoughtStream({ state }: { state: "call" | "result" }) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    if (state === "result") {
      setActiveStepIndex(THOUGHT_STEPS.length);
      return;
    }
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < THOUGHT_STEPS.length - 1 ? prev + 1 : prev));
    }, 850);
    return () => clearInterval(interval);
  }, [state]);

  if (state === "result") return null;

  return (
    <div className="mt-4 p-5 rounded-2xl bg-white/10 backdrop-blur-md w-full min-w-[280px] shadow-lg border border-white/20">
      <div className="flex items-center gap-3 mb-4 border-b border-white/10 pb-3">
        <div className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span className="font-semibold text-cyan-300 text-xs tracking-widest uppercase">Agent Reasoning</span>
      </div>
      <div className="space-y-3">
        {THOUGHT_STEPS.map((step, index) => {
          if (index > activeStepIndex) return null;
          const isCompleted = index < activeStepIndex;
          const isActive = index === activeStepIndex;
          return (
            <div key={step.id} className="flex items-center gap-3 animate-in slide-in-from-left-2 fade-in duration-300">
              <div className={cn(
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                isCompleted ? "bg-emerald-500/30 border-emerald-500/50" :
                isActive ? "bg-cyan-500/30 border-cyan-500/50" : "bg-transparent border-white/20"
              )}>
                {isCompleted ? <CheckCircle2 className="h-3 w-3 text-emerald-300" /> :
                 isActive ? <div className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-ping" /> :
                 <div className="h-1.5 w-1.5 rounded-full bg-white/40" />}
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                isCompleted ? "text-white/70" :
                isActive ? "text-cyan-300" : "text-white/50"
              )}>
                {step.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Stream parser ──────────────────────────────────────────────────────────────
async function streamChat(
  userMessage: string,
  history: Message[],
  onToolCall: (inv: ToolInvocation) => void,
  onToolResult: (toolCallId: string, result: unknown) => void,
) {
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok || !res.body) throw new Error(`API error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      const prefix = line[0];
      const json = line.slice(2); // strip "X:" prefix

      try {
        if (prefix === "9") {
          // Tool call
          const data = JSON.parse(json);
          onToolCall({ ...data, state: "call" });
        } else if (prefix === "a") {
          // Tool results array
          const results: { toolCallId: string; result: unknown }[] = JSON.parse(json);
          for (const r of results) {
            onToolResult(r.toolCallId, r.result);
          }
        }
      } catch (_) {
        // skip malformed lines
      }
    }
  }
}

// ── AgentChat ──────────────────────────────────────────────────────────────────
export function AgentChat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // ── Core send function ──
  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);
    setIsLoading(true);

    // Append user message
    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: text };
    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", toolInvocations: [] };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      await streamChat(
        text,
        messages,
        (toolInvocation) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, toolInvocations: [...(m.toolInvocations ?? []), toolInvocation] }
                : m
            )
          );
        },
        (toolCallId, result) => {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              return {
                ...m,
                toolInvocations: (m.toolInvocations ?? []).map((inv) =>
                  inv.toolCallId === toolCallId ? { ...inv, result, state: "result" } : inv
                ),
              };
            })
          );
        }
      );
    } catch (err: any) {
      setError(err.message || "Unknown error");
      toast.error("Nova encountered an error", { description: err.message });
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Handle "Launch Initiative" button events from page.tsx ──
  useEffect(() => {
    const handleNovaChatEvent = (e: CustomEvent) => {
      if (e.detail && !isLoading) {
        toast.success("Command intercepted by Nova", { description: e.detail });
        send(e.detail);
      }
    };
    window.addEventListener("nova-chat", handleNovaChatEvent as EventListener);
    return () => window.removeEventListener("nova-chat", handleNovaChatEvent as EventListener);
  }, [isLoading, messages]);

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
    setInput("");
  };

  const handleSuggestionClick = (suggestion: string) => {
    send(suggestion);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden p-3">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-4 px-1 shrink-0">
        <div className="h-8 w-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-white tracking-tight">Nova</h1>
          <p className="text-[10px] text-cyan-200 font-medium tracking-widest uppercase opacity-90">Autonomous AI Strategist</p>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto min-h-0 mb-3 px-1 space-y-4 scrollbar-hide">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="h-20 w-20 rounded-3xl bg-white/10 flex items-center justify-center border border-white/20 shadow-[0_0_40px_-10px_rgba(255,255,255,0.2)]">
              <Bot className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-3 max-w-md">
              <h2 className="text-3xl font-bold tracking-tight text-white">How can I help you grow?</h2>
              <p className="text-white/80 leading-relaxed text-sm">
                I can analyze your customers, build precise segments, and launch multi-channel campaigns autonomously.
              </p>
              <div className="flex justify-center mt-2">
                <span className="text-cyan-300 text-xs font-semibold tracking-wide bg-cyan-500/10 border border-cyan-500/20 px-4 py-2 rounded-full inline-flex items-center gap-1.5 animate-pulse">
                  ← Select an initiative on the left to begin
                </span>
              </div>
            </div>

            <div className="mt-8 mb-4 w-full flex flex-col items-center">
              <button
                onClick={() => handleSuggestionClick("Bring back high-value customers who have not purchased in 60 days.")}
                className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-white px-8 font-bold text-secondary transition-all duration-300 hover:scale-105 shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)]"
              >
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-black/10" />
                </div>
                <span className="flex items-center gap-2">
                  🚀 <span className="tracking-wide">Start Interview Demo</span>
                </span>
              </button>
              <p className="text-[10px] text-white/60 mt-3 tracking-widest uppercase">14-Step Autonomous Flow</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl mt-4">
              {[
                "Increase repeat purchases.",
                "Reward our loyal customers.",
                "Promote our new coffee launch.",
                "Identify high churn-risk users.",
              ].map((s, i) => (
                <button
                  key={i}
                  className="text-sm p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:border-white/40 hover:bg-white/10 transition-all text-left text-white/80 hover:text-white shadow-sm"
                  onClick={() => handleSuggestionClick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-8 pb-10">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex items-start gap-3 min-w-0 max-w-[95%] animate-in slide-in-from-bottom-2 fade-in duration-300",
                  message.role === "user" ? "ml-auto flex-row-reverse" : ""
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-full flex items-center justify-center ring-1",
                    message.role === "user"
                      ? "bg-white text-secondary ring-white/50"
                      : "bg-white/20 text-white ring-white/40 shadow-[0_0_15px_-2px_rgba(255,255,255,0.3)]"
                  )}
                >
                  {message.role === "user" ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>

                {/* Bubble */}
                <div
                  className={cn(
                    "min-w-0 flex-1 px-3 py-2.5 rounded-xl text-sm leading-relaxed flex flex-col overflow-hidden",
                    message.role === "user"
                      ? "bg-white text-secondary font-medium shadow-md"
                      : "bg-transparent text-white/90 border-none px-0"
                  )}
                >
                  {message.content && <div>{message.content}</div>}

                  {message.toolInvocations?.map((tool) => {
                    if (tool.toolName === "developMarketingStrategy") {
                      return (
                        <div key={tool.toolCallId} className="w-full mt-4">
                          <ThoughtStream state={tool.state} />
                          {tool.state === "result" && <StrategyProposalCard result={tool.result} />}
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            ))}

            {/* General loading dots (when no tool call yet) */}
            {isLoading && messages[messages.length - 1]?.toolInvocations?.length === 0 && (
              <div className="flex items-start gap-3 max-w-[85%] animate-in fade-in">
                <div className="shrink-0 h-8 w-8 rounded-full bg-white/20 ring-1 ring-white/40 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="px-5 py-4 rounded-2xl bg-transparent">
                  <div className="flex space-x-1.5 items-center h-4">
                    <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce" style={{ animationDelay: "-0.3s" }} />
                    <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce" style={{ animationDelay: "-0.15s" }} />
                    <div className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-bounce" />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex flex-col items-center justify-center p-4 mt-4 bg-red-500/20 border border-red-500/40 rounded-xl text-white text-sm max-w-sm mx-auto backdrop-blur-md">
                <div className="flex items-center gap-2 mb-2 text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Connection Error</span>
                </div>
                <p className="mb-3 text-center opacity-90">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} className="h-px w-full" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-auto shrink-0">
        <form 
          onSubmit={handleFormSubmit}
          className="relative flex items-center p-1.5 rounded-xl bg-white/10 backdrop-blur-md shadow-2xl border border-white/20 focus-within:border-white/50 focus-within:bg-white/15 transition-all"
        >
          <input
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-white/40 text-white disabled:opacity-50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your campaign goal..."
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 h-8 w-8 mr-0.5 rounded-lg bg-white hover:bg-white/90 text-secondary flex items-center justify-center transition-all disabled:opacity-40 disabled:bg-white/20 disabled:text-white/50 disabled:cursor-not-allowed"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
        <div className="text-center mt-2">
          <p className="text-[10px] text-white/40">
            Verify critical segments before broadcasting.
          </p>
        </div>
      </div>
    </div>
  );
}
