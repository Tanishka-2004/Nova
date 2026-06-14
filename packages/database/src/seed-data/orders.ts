// ──────────────────────────────────────────────────────────────
// Order Data Generator
// Generates realistic orders with power-law distribution
// ──────────────────────────────────────────────────────────────

import { type Product } from './products.js'

export interface GeneratedOrder {
  customerId: string
  orderNumber: string
  amount: number
  items: Array<{ name: string; qty: number; price: number }>
  status: 'PLACED' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED'
  channel: 'WEBSITE' | 'APP' | 'STORE'
  createdAt: Date
}

// ─── Helpers ─────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Power-law distribution for order counts.
 * Most customers get few orders; a small % get many.
 * Roughly: ~20% of customers generate ~60% of orders.
 */
function getOrderCountForCustomer(): number {
  const r = Math.random()
  if (r < 0.30) return 1                    // 30% → 1 order
  if (r < 0.50) return 2                    // 20% → 2 orders
  if (r < 0.65) return 3                    // 15% → 3 orders
  if (r < 0.75) return randomInt(4, 5)      // 10% → 4-5 orders
  if (r < 0.85) return randomInt(5, 7)      // 10% → 5-7 orders
  if (r < 0.92) return randomInt(7, 10)     //  7% → 7-10 orders
  if (r < 0.97) return randomInt(10, 12)    //  5% → 10-12 orders
  return randomInt(12, 15)                   //  3% → 12-15 orders
}

function generateOrderStatus(): GeneratedOrder['status'] {
  const r = Math.random()
  if (r < 0.80) return 'DELIVERED'   // 80%
  if (r < 0.90) return 'SHIPPED'     // 10%
  if (r < 0.95) return 'CONFIRMED'   //  5%
  if (r < 0.98) return 'PLACED'      //  3%
  return 'CANCELLED'                  //  2%
}

function generateOrderChannel(): GeneratedOrder['channel'] {
  const r = Math.random()
  if (r < 0.50) return 'WEBSITE'     // 50%
  if (r < 0.85) return 'APP'         // 35%
  return 'STORE'                      // 15%
}

/**
 * Generate a random date within the last N months.
 * More recent dates are slightly more likely (recency bias).
 */
function randomDateInLastMonths(months: number): Date {
  const now = new Date()
  const msInMonth = 30.44 * 24 * 60 * 60 * 1000
  const maxMs = months * msInMonth

  // Slight recency bias: square root to skew towards recent
  const r = Math.sqrt(Math.random())
  const msAgo = (1 - r) * maxMs

  return new Date(now.getTime() - msAgo)
}

/**
 * Generate a StyleNova order number: SN-YYYYMM-XXXXX
 */
let orderSequence = 10000
function generateOrderNumber(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  orderSequence++
  return `SN-${year}${month}-${String(orderSequence).padStart(5, '0')}`
}

// ─── Main Generator ─────────────────────────────────────────

/**
 * Generate orders for a set of customers using the product catalog.
 * Uses power-law distribution: ~20% of customers generate ~60% of orders.
 *
 * @param customers Array of customer objects with `id` field
 * @param productCatalog Array of products with name, category, basePrice
 * @returns Array of order data objects
 */
export function generateOrders(
  customers: Array<{ id: string }>,
  productCatalog: Product[],
): GeneratedOrder[] {
  const allOrders: GeneratedOrder[] = []

  for (const customer of customers) {
    const numOrders = getOrderCountForCustomer()

    // Generate order dates spread over last 12 months, sorted chronologically
    const orderDates: Date[] = []
    for (let i = 0; i < numOrders; i++) {
      orderDates.push(randomDateInLastMonths(12))
    }
    orderDates.sort((a, b) => a.getTime() - b.getTime())

    for (let i = 0; i < numOrders; i++) {
      const orderDate = orderDates[i]
      const numItems = randomInt(1, 5)

      // Pick random products for this order (no duplicates in same order)
      const shuffled = [...productCatalog].sort(() => Math.random() - 0.5)
      const selectedProducts = shuffled.slice(0, numItems)

      const items = selectedProducts.map((p) => ({
        name: p.name,
        qty: randomInt(1, 3),
        price: p.basePrice,
      }))

      const amount = items.reduce((sum, item) => sum + item.price * item.qty, 0)

      allOrders.push({
        customerId: customer.id,
        orderNumber: generateOrderNumber(orderDate),
        amount: Math.round(amount * 100) / 100,
        items,
        status: generateOrderStatus(),
        channel: generateOrderChannel(),
        createdAt: orderDate,
      })
    }
  }

  return allOrders
}
