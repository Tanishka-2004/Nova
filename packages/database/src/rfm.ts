// ──────────────────────────────────────────────────────────────
// RFM Scoring Utility
// Recency / Frequency / Monetary analysis for customer segmentation
// ──────────────────────────────────────────────────────────────

export type RfmTier = 'CHAMPION' | 'LOYAL' | 'POTENTIAL' | 'AT_RISK' | 'LOST'

export interface RfmScores {
  rfmRecency: number
  rfmFrequency: number
  rfmMonetary: number
  rfmScore: number
  rfmTier: RfmTier
}

export interface RfmInput {
  lastOrderAt: Date | null
  orderCount: number
  totalSpent: number
}

// ─── Helpers ─────────────────────────────────────────────────

/**
 * Calculate the percentile rank of `value` within a sorted (ascending) array.
 * Returns 0–10 scale.
 */
function percentileScore(value: number, sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0
  if (sortedValues.length === 1) return value > 0 ? 5 : 0

  // Count how many values are below this value
  let below = 0
  for (const v of sortedValues) {
    if (v < value) below++
    else break // sorted, so we can stop
  }

  const percentile = below / (sortedValues.length - 1) // 0..1
  return Math.round(percentile * 100) / 10 // 0..10, one decimal
}

/**
 * Recency scoring – inversely proportional to days since last order.
 * Customers with a more recent order get a higher score.
 * Customers who have never ordered get 0.
 */
function recencyScore(
  daysSinceLastOrder: number | null,
  maxDays: number,
): number {
  if (daysSinceLastOrder === null) return 0
  if (maxDays === 0) return 10

  // Invert: fewer days = higher score
  const score = Math.max(0, 1 - daysSinceLastOrder / maxDays) * 10
  return Math.round(score * 10) / 10
}

/**
 * Assign tier based on composite RFM score.
 */
function assignTier(score: number): RfmTier {
  if (score >= 8) return 'CHAMPION'
  if (score >= 6) return 'LOYAL'
  if (score >= 4) return 'POTENTIAL'
  if (score >= 2) return 'AT_RISK'
  return 'LOST'
}

// ─── Main Function ───────────────────────────────────────────

/**
 * Calculate RFM scores for a cohort of customers.
 *
 * All scores are computed *relative* to the cohort:
 * - Recency:   inversely proportional to days since last order, scaled 0-10
 * - Frequency: percentile of order count within the cohort, scaled 0-10
 * - Monetary:  percentile of total spend within the cohort, scaled 0-10
 * - Composite: 0.3 * R + 0.3 * F + 0.4 * M
 *
 * @param customers Array of customer data with lastOrderAt, orderCount, totalSpent
 * @returns Map from array index → RfmScores
 */
export function calculateRfmScores(customers: RfmInput[]): RfmScores[] {
  if (customers.length === 0) return []

  const now = new Date()

  // ── Compute raw values ──────────────────────────────────
  const daysSinceOrder: (number | null)[] = customers.map((c) => {
    if (!c.lastOrderAt) return null
    const diffMs = now.getTime() - new Date(c.lastOrderAt).getTime()
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))
  })

  const orderCounts = customers.map((c) => c.orderCount)
  const totalSpends = customers.map((c) => c.totalSpent)

  // ── Prepare sorted arrays for percentile calculation ────
  const sortedOrderCounts = [...orderCounts].sort((a, b) => a - b)
  const sortedTotalSpends = [...totalSpends].sort((a, b) => a - b)

  // Max days for recency normalization (only among customers who have ordered)
  const validDays = daysSinceOrder.filter((d): d is number => d !== null)
  const maxDays = validDays.length > 0 ? Math.max(...validDays) : 0

  // ── Score each customer ─────────────────────────────────
  return customers.map((customer, i) => {
    const r = recencyScore(daysSinceOrder[i], maxDays)
    const f = percentileScore(orderCounts[i], sortedOrderCounts)
    const m = percentileScore(totalSpends[i], sortedTotalSpends)

    const composite = Math.round((0.3 * r + 0.3 * f + 0.4 * m) * 10) / 10
    const tier = assignTier(composite)

    return {
      rfmRecency: r,
      rfmFrequency: f,
      rfmMonetary: m,
      rfmScore: composite,
      rfmTier: tier,
    }
  })
}
