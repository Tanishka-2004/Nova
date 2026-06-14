export const maxDuration = 60;

import { prisma } from "@nova/database";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ─── Real Data Context Loader ────────────────────────────────────────────────
// Queries the database BEFORE calling the LLM so every strategy is grounded
// in actual customer data. The LLM receives these stats but may NOT override them.

interface DataContext {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  tierDistribution: Record<string, number>;
  tierCounts: Record<string, number>;
}

async function loadDataContext(): Promise<DataContext> {
  const [customerCount, orderStats, tierGroups] = await Promise.all([
    prisma.customer.count(),
    prisma.order.aggregate({
      _count: { id: true },
      _sum: { amount: true },
      _avg: { amount: true },
      where: { status: { not: "CANCELLED" } },
    }),
    prisma.customer.groupBy({
      by: ["rfmTier"],
      _count: { id: true },
    }),
  ]);

  const tierDistribution: Record<string, number> = {};
  const tierCounts: Record<string, number> = {};
  for (const t of tierGroups) {
    tierDistribution[t.rfmTier] = Math.round((t._count.id / customerCount) * 1000) / 10;
    tierCounts[t.rfmTier] = t._count.id;
  }

  return {
    totalCustomers: customerCount,
    totalOrders: orderStats._count.id ?? 0,
    totalRevenue: Math.round((orderStats._sum.amount ?? 0) * 100) / 100,
    avgOrderValue: Math.round((orderStats._avg.amount ?? 0) * 100) / 100,
    tierDistribution,
    tierCounts,
  };
}

// ─── Segment-specific data loader ─────────────────────────────────────────────

interface SegmentData {
  audienceSize: number;
  avgOrderValue: number;
  totalSpend: number;
}

async function loadSegmentData(goal: string): Promise<{ segment: SegmentData; segmentName: string; query: string }> {
  const g = goal.toLowerCase();

  if (g.includes("dormant") || g.includes("inactive") || g.includes("bring back") || g.includes("win back") || g.includes("re-engage")) {
    const audienceSize = await prisma.customer.count({ where: { rfmTier: { in: ["AT_RISK", "LOST"] } } });
    const aov = await prisma.order.aggregate({
      _avg: { amount: true }, _sum: { amount: true },
      where: { customer: { rfmTier: { in: ["AT_RISK", "LOST"] } }, status: { not: "CANCELLED" } },
    });
    return {
      segment: { audienceSize, avgOrderValue: Math.round((aov._avg.amount ?? 0) * 100) / 100, totalSpend: Math.round((aov._sum.amount ?? 0) * 100) / 100 },
      segmentName: "Dormant High-Value Loyalists (AT_RISK + LOST RFM Tiers)",
      query: "RFM Tier: At-Risk & Lost",
    };
  }

  if (g.includes("loyal") || g.includes("reward") || g.includes("vip") || g.includes("retention")) {
    const audienceSize = await prisma.customer.count({ where: { rfmTier: { in: ["CHAMPION", "LOYAL"] } } });
    const aov = await prisma.order.aggregate({
      _avg: { amount: true }, _sum: { amount: true },
      where: { customer: { rfmTier: { in: ["CHAMPION", "LOYAL"] } }, status: { not: "CANCELLED" } },
    });
    return {
      segment: { audienceSize, avgOrderValue: Math.round((aov._avg.amount ?? 0) * 100) / 100, totalSpend: Math.round((aov._sum.amount ?? 0) * 100) / 100 },
      segmentName: "Top-Tier Loyalty Champions (CHAMPION + LOYAL RFM Tiers)",
      query: "RFM Tier: Champions & Loyalists",
    };
  }

  if (g.includes("churn") || g.includes("risk") || g.includes("leaving") || g.includes("cancel")) {
    const audienceSize = await prisma.customer.count({
      where: { rfmTier: { in: ["CHAMPION", "LOYAL"] }, rfmRecency: { lt: 4 } },
    });
    const effectiveSize = audienceSize > 0 ? audienceSize : await prisma.customer.count({ where: { rfmTier: { in: ["AT_RISK"] } } });
    const aov = await prisma.order.aggregate({
      _avg: { amount: true }, _sum: { amount: true },
      where: { customer: { rfmTier: { in: ["CHAMPION", "LOYAL", "AT_RISK"] } }, status: { not: "CANCELLED" } },
    });
    return {
      segment: { audienceSize: effectiveSize, avgOrderValue: Math.round((aov._avg.amount ?? 0) * 100) / 100, totalSpend: Math.round((aov._sum.amount ?? 0) * 100) / 100 },
      segmentName: "High-Churn-Risk Customers",
      query: "RFM Tier: Churn-Risk VIPs",
    };
  }

  if (g.includes("launch") || g.includes("new") || g.includes("promote") || g.includes("product")) {
    const audienceSize = await prisma.customer.count({ where: { rfmTier: "POTENTIAL", orderCount: { gte: 1 } } });
    const aov = await prisma.order.aggregate({
      _avg: { amount: true }, _sum: { amount: true },
      where: { customer: { rfmTier: "POTENTIAL" }, status: { not: "CANCELLED" } },
    });
    return {
      segment: { audienceSize, avgOrderValue: Math.round((aov._avg.amount ?? 0) * 100) / 100, totalSpend: Math.round((aov._sum.amount ?? 0) * 100) / 100 },
      segmentName: "Adjacent Category Buyers (POTENTIAL tier with purchases)",
      query: "RFM Tier: Potential Tier with 1+ Purchase",
    };
  }

  // Default: all customers with at least 2 orders (repeat purchase potential)
  const audienceSize = await prisma.customer.count({ where: { orderCount: { gte: 2 } } });
  const aov = await prisma.order.aggregate({
    _avg: { amount: true }, _sum: { amount: true },
    where: { customer: { orderCount: { gte: 2 } }, status: { not: "CANCELLED" } },
  });
  return {
    segment: { audienceSize, avgOrderValue: Math.round((aov._avg.amount ?? 0) * 100) / 100, totalSpend: Math.round((aov._sum.amount ?? 0) * 100) / 100 },
    segmentName: "Repeat Buyer Upsell Cohort (2+ orders)",
    query: "RFM Tier: Repeat Buyers with 2+ Purchases",
  };
}

// ─── Data-grounded fallback strategy ──────────────────────────────────────────
// Uses REAL database numbers. LLM-equivalent fields (persona, copy) are static
// templates, but all metrics come from the database context.

function generateFallbackStrategy(goal: string, ctx: DataContext, segData: { segment: SegmentData; segmentName: string; query: string }) {
  const g = goal.toLowerCase();
  const { segment, segmentName, query } = segData;

  // Conversion assumptions (labeled, not hidden)
  const ctr = 0.28;
  const conversion = 0.042;
  const estimatedRevenue = Math.round(segment.audienceSize * ctr * conversion * segment.avgOrderValue);
  const openRate = "47%";
  const roi = segment.avgOrderValue > 0 ? `${Math.round(estimatedRevenue / (segment.audienceSize * 2))}x` : "N/A";

  // Channel selection logic (deterministic, based on audience size)
  const channel = segment.audienceSize > 300 ? "SMS" as const :
                   segment.audienceSize > 50 ? "WHATSAPP" as const : "EMAIL" as const;
  const channelReasoning = channel === "WHATSAPP"
    ? `WhatsApp achieves 47% open rates vs 22% for email. For a cohort of ${segment.audienceSize} customers, personal-feeling messages outperform newsletters.`
    : channel === "SMS"
    ? `SMS has 98% open rate. For a large cohort of ${segment.audienceSize} customers, SMS ensures maximum reach.`
    : `Email allows rich product storytelling for ${segment.audienceSize} targeted customers.`;

  // Persona selection (LLM-equivalent, but deterministic for fallback)
  let personaName = "The Emerging Loyalist";
  let personaCharacteristics = [
    `One of ${segment.audienceSize} customers in this cohort.`,
    `Average order value: ₹${segment.avgOrderValue.toLocaleString("en-IN")}.`,
    "Responds to progress-based messaging and milestone framing.",
  ];
  let personaStrategy = "Nudge toward next purchase with data-driven personalization.";
  let campaignVariantA = `Hi {{first_name}}! Based on your history with us, we've curated something special. Your next order unlocks exclusive benefits. Tap to see →`;
  let campaignVariantB = `{{first_name}}, you're one of our valued customers. We've saved your favourites and added a surprise. Come back and see what's new.`;

  if (g.includes("dormant") || g.includes("inactive") || g.includes("bring back") || g.includes("win back")) {
    personaName = "The Sleepy VIP";
    personaCharacteristics = [
      `${segment.audienceSize} customers haven't purchased recently.`,
      `Historical AOV: ₹${segment.avgOrderValue.toLocaleString("en-IN")}.`,
      "Previously showed strong brand affinity before going quiet.",
    ];
    personaStrategy = "Re-activate through personalised, value-first outreach that makes them feel missed — not marketed to.";
    campaignVariantA = `Hi {{first_name}}! It's been a while — we've missed you. As one of our top customers, you get first access to our new arrivals before anyone else. Tap to see what's new →`;
    campaignVariantB = `We noticed you haven't visited recently, {{first_name}}. We've saved your favourites. Your complimentary upgrade is waiting — come back and claim it.`;
  } else if (g.includes("loyal") || g.includes("reward") || g.includes("vip")) {
    personaName = "The Brand Evangelist";
    personaCharacteristics = [
      `Top-tier customer — one of ${segment.audienceSize} Champions/Loyals.`,
      `Average spend: ₹${segment.avgOrderValue.toLocaleString("en-IN")} per order.`,
      "Emotionally invested in the brand. Loves exclusivity.",
    ];
    personaStrategy = "Deepen loyalty by making them feel like insiders — give them access, not just discounts.";
    campaignVariantA = `{{first_name}}, you're in our Top customers 🏆 As a thank-you, here's your exclusive invite to our Members-Only Preview.`;
    campaignVariantB = `Your loyalty means everything to us, {{first_name}}. We've unlocked a special reward — tap to reveal your personalised gift.`;
  } else if (g.includes("churn") || g.includes("risk")) {
    personaName = "The One-Time Experimenter";
    personaCharacteristics = [
      `${segment.audienceSize} high-value customers showing churn signals.`,
      `₹${segment.totalSpend.toLocaleString("en-IN")} total LTV at risk.`,
      "Needs a concrete reason to return — value proof required.",
    ];
    personaStrategy = "Convert at-risk buyers into retained customers with urgency and social proof.";
    campaignVariantA = `{{first_name}}, customers like you came back within 30 days. Here's why — and your exclusive offer: [link]`;
    campaignVariantB = `Quick question, {{first_name}} — was there something we got wrong? We'd love a second chance. Here's something special for your next order.`;
  } else if (g.includes("launch") || g.includes("new") || g.includes("promote") || g.includes("product")) {
    personaName = "The Curious Explorer";
    personaCharacteristics = [
      `${segment.audienceSize} customers with purchase history and cross-sell potential.`,
      `Average order: ₹${segment.avgOrderValue.toLocaleString("en-IN")}.`,
      "Loves discovering new things. Responds to 'first access' framing.",
    ];
    personaStrategy = "Position the new launch as a discovery — give them early access before the public drop.";
    campaignVariantA = `You asked for it, {{first_name}} — it's here. Introducing our latest, exclusively for early access members. You have 24 hours before the public launch.`;
    campaignVariantB = `{{first_name}}, based on what you've loved before, we think you'll be obsessed with our newest drop. Here's your private preview link.`;
  }

  return {
    audienceName: segmentName,
    whyThisAudience: [
      `${segment.audienceSize} customers identified via RFM segmentation (${query}).`,
      `Cohort average order value: ₹${segment.avgOrderValue.toLocaleString("en-IN")} (from prisma.order.aggregate).`,
      `Total cohort historical spend: ₹${segment.totalSpend.toLocaleString("en-IN")}.`,
    ],
    personaName,
    personaCharacteristics,
    personaStrategy,
    recommendedChannel: channel,
    channelReasoning,
    campaignVariantA,
    campaignVariantB,
    criticScore: 88,
    criticStrengths: [
      "Strategy grounded in real database metrics, not assumptions.",
      `Targeting verified cohort of ${segment.audienceSize} customers with ₹${segment.avgOrderValue.toLocaleString("en-IN")} AOV.`,
    ],
    criticWeaknesses: ["Conversion rate assumptions (28% CTR, 4.2% conv) are industry benchmarks — actual performance may vary."],
    criticRecommendations: ["Run an A/B test with 10% of the cohort before full deployment to calibrate conversion assumptions."],
    audienceSize: segment.audienceSize,
    openRate,
    ctr: `${(ctr * 100).toFixed(0)}%`,
    conversionRate: `${(conversion * 100).toFixed(1)}%`,
    estimatedRevenue,
    roi,
    // ── Data source classification ──
    fieldSources: {
      audienceName: "database",
      audienceSize: "database",
      whyThisAudience: "database",
      avgOrderValue: "database",
      estimatedRevenue: "database + assumptions",
      openRate: "industry benchmark (assumption)",
      ctr: "industry benchmark (assumption)",
      conversionRate: "industry benchmark (assumption)",
      roi: "deterministic (revenue / cost)",
      personaName: "llm-equivalent (fallback template)",
      personaCharacteristics: "database + llm",
      personaStrategy: "llm-equivalent (fallback template)",
      recommendedChannel: "deterministic (audience size threshold)",
      channelReasoning: "llm-equivalent with database context",
      campaignVariantA: "llm-equivalent (fallback template)",
      campaignVariantB: "llm-equivalent (fallback template)",
      criticScore: "static benchmark",
      criticStrengths: "database-grounded assessment",
      criticWeaknesses: "honest assumption disclosure",
      criticRecommendations: "domain knowledge",
    },
  };
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userGoal = messages?.findLast((m: any) => m.role === "user")?.content ?? "grow revenue";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (chunk: string) => controller.enqueue(encoder.encode(chunk));

      const toolCallId = `call_${Date.now()}`;
      send(`9:${JSON.stringify({
        toolCallId,
        toolName: "developMarketingStrategy",
        args: { goal: userGoal },
      })}\n`);

      // ── Load REAL data context from database ──
      let dataCtx: DataContext;
      let segData: { segment: SegmentData; segmentName: string; query: string };

      try {
        [dataCtx, segData] = await Promise.all([
          loadDataContext(),
          loadSegmentData(userGoal),
        ]);
      } catch (dbError) {
        console.error("Database query failed, using minimal context:", dbError);
        dataCtx = { totalCustomers: 0, totalOrders: 0, totalRevenue: 0, avgOrderValue: 0, tierDistribution: {}, tierCounts: {} };
        segData = { segment: { audienceSize: 0, avgOrderValue: 0, totalSpend: 0 }, segmentName: "Unknown", query: "failed" };
      }

      let strategyData: any = null;

      // ── Build data-aware system prompt ──
      const dataContextPrompt = `
REAL BUSINESS DATA (from database — do NOT override these numbers):
- Total Customers: ${dataCtx.totalCustomers}
- Total Orders: ${dataCtx.totalOrders}
- Total Revenue: ₹${dataCtx.totalRevenue.toLocaleString("en-IN")}
- Average Order Value: ₹${dataCtx.avgOrderValue.toLocaleString("en-IN")}
- RFM Tier Distribution: ${JSON.stringify(dataCtx.tierCounts)}

TARGET SEGMENT for this goal:
- Segment: ${segData.segmentName}
- Audience Size: ${segData.segment.audienceSize} (from query: ${segData.query})
- Segment AOV: ₹${segData.segment.avgOrderValue.toLocaleString("en-IN")}
- Segment Total Spend: ₹${segData.segment.totalSpend.toLocaleString("en-IN")}

CRITICAL RULES:
1. You MUST use the exact audienceSize (${segData.segment.audienceSize}) provided above. Do NOT invent a different number.
2. You MUST use the exact avgOrderValue (₹${segData.segment.avgOrderValue}) for revenue calculations.
3. estimatedRevenue must be calculated as: audienceSize × CTR × conversionRate × AOV. Show the formula.
4. You generate: persona, strategy, copy, channel reasoning, critic assessment.
5. You do NOT generate: audience size, AOV, customer counts, revenue — those come from the database.
`;

      // Try Gemini first if key is present
      if (GEMINI_API_KEY) {
        try {
          const geminiModel = process.env.GEMINI_CHAT_MODEL || "gemini-2.5-flash";
          const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/${geminiModel}:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `You are Nova, an elite AI Marketing Strategist. The user gives a business goal. Respond ONLY with a valid JSON object matching the requested schema. Do not wrap in markdown or backticks (e.g. do not write \`\`\`json).

${dataContextPrompt}

Requested JSON schema:
{
  "audienceName": string (use the segment name from data above),
  "whyThisAudience": [string, string, string] (reference real data),
  "personaName": string,
  "personaCharacteristics": [string, string, string],
  "personaStrategy": string,
  "recommendedChannel": "EMAIL" | "SMS" | "WHATSAPP" | "RCS",
  "channelReasoning": string,
  "campaignVariantA": string (use {{first_name}}),
  "campaignVariantB": string (use {{first_name}}),
  "criticScore": number (0-100),
  "criticStrengths": [string, string],
  "criticWeaknesses": [string],
  "criticRecommendations": [string],
  "audienceSize": ${segData.segment.audienceSize} (MUST be this exact number),
  "openRate": string,
  "ctr": string,
  "conversionRate": string,
  "estimatedRevenue": number (calculate from audienceSize × CTR × convRate × ₹${segData.segment.avgOrderValue}),
  "roi": string (MUST be a short multiplier string, e.g. "8.5x" or "12x")
}

Goal: "${userGoal}"`
                    }
                  ]
                }
              ]
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text.trim());
              // Force database values — LLM cannot override
              parsed.audienceSize = segData.segment.audienceSize;
              strategyData = parsed;
            }
          } else {
            console.error("Gemini API error:", response.status, await response.text());
          }
        } catch (err) {
          console.error("Gemini call error:", err);
        }
      }

      // Try OpenAI if Gemini key is missing or failed
      if (!strategyData && OPENAI_API_KEY) {
        try {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: process.env.OPENAI_CHAT_MODEL || "gpt-3.5-turbo",
              response_format: { type: "json_object" },
              messages: [
                {
                  role: "system",
                  content: `You are Nova, an elite AI Marketing Strategist. Respond ONLY with valid JSON.

${dataContextPrompt}

Use the exact schema provided. Use {{first_name}} in campaign copy.`,
                },
                { role: "user", content: `Goal: "${userGoal}"` },
              ],
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const ai = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
            // Force database values
            ai.audienceSize = segData.segment.audienceSize;
            strategyData = ai;
          }
        } catch (_) {
          // Fall through to data-grounded fallback
        }
      }

      // Use data-grounded fallback if LLM failed
      if (!strategyData) {
        strategyData = generateFallbackStrategy(userGoal, dataCtx, segData);
      }

      const result = {
        goal: userGoal,
        audienceName: strategyData.audienceName,
        whyThisAudience: strategyData.whyThisAudience,
        personaName: strategyData.personaName,
        personaCharacteristics: strategyData.personaCharacteristics,
        personaStrategy: strategyData.personaStrategy,
        recommendedChannel: strategyData.recommendedChannel,
        channelReasoning: strategyData.channelReasoning,
        campaignVariantA: strategyData.campaignVariantA,
        campaignVariantB: strategyData.campaignVariantB,
        criticScore: strategyData.criticScore,
        criticStrengths: strategyData.criticStrengths,
        criticWeaknesses: strategyData.criticWeaknesses,
        criticRecommendations: strategyData.criticRecommendations,
        metrics: {
          audienceSize: segData.segment.audienceSize, // ALWAYS from database
          confidenceScore: strategyData.criticScore,
          churnRisk: "High",
          predictions: {
            openRate: strategyData.openRate,
            ctr: strategyData.ctr,
            conversionRate: strategyData.conversionRate,
            orders: Math.max(1, Math.round(segData.segment.audienceSize * 0.02)),
            revenue: strategyData.estimatedRevenue,
            roi: strategyData.roi,
          },
        },
        // ── Data source classification (Rule 6) ──
        fieldSources: strategyData.fieldSources ?? {
          audienceName: "database",
          audienceSize: "database",
          estimatedRevenue: "database + assumptions",
          avgOrderValue: "database",
          personaName: "llm",
          personaCharacteristics: "llm",
          personaStrategy: "llm",
          recommendedChannel: "llm + database context",
          channelReasoning: "llm",
          campaignVariantA: "llm",
          campaignVariantB: "llm",
          criticScore: "llm",
          openRate: "industry benchmark",
          ctr: "industry benchmark",
          conversionRate: "industry benchmark",
        },
        dataContext: {
          totalCustomers: dataCtx.totalCustomers,
          avgOrderValue: dataCtx.avgOrderValue,
          segmentQuery: segData.query,
        },
      };

      send(`a:${JSON.stringify([{ toolCallId, toolName: "developMarketingStrategy", result }])}\n`);
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
