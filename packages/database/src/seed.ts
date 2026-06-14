// ──────────────────────────────────────────────────────────────
// Nova Database Seed Script
// Run with: pnpm db:seed  (uses tsx)
// ──────────────────────────────────────────────────────────────

import { prisma } from './index.js'
import { generateCustomers } from './seed-data/customers.js'
import { products } from './seed-data/products.js'
import { generateOrders } from './seed-data/orders.js'
import { calculateRfmScores, type RfmScores } from './rfm.js'

// ─── Configuration ───────────────────────────────────────────

const CUSTOMER_COUNT = 500
const CUSTOMER_BATCH_SIZE = 100
const ORDER_BATCH_SIZE = 200

// ─── Helpers ─────────────────────────────────────────────────

function log(msg: string) {
  console.log(`  [seed] ${msg}`)
}

function logHeader(msg: string) {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${msg}`)
  console.log('═'.repeat(60))
}

// ─── Step 1: Clear existing data ─────────────────────────────

async function clearData() {
  logHeader('Step 1/6 — Clearing existing data')

  // Delete in dependency order (children first)
  const deletions = [
    prisma.campaignMessage.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.segmentCustomer.deleteMany(),
    prisma.segment.deleteMany(),
    prisma.order.deleteMany(),
    prisma.customer.deleteMany(),
  ]

  // Execute sequentially to respect foreign keys
  for (const deletion of deletions) {
    await deletion
  }

  log('All tables cleared ✓')
}

// ─── Step 2: Seed customers ─────────────────────────────────

async function seedCustomers(): Promise<string[]> {
  logHeader(`Step 2/6 — Generating ${CUSTOMER_COUNT} customers`)

  const customerData = generateCustomers(CUSTOMER_COUNT)
  log(`Generated ${customerData.length} customer profiles`)

  const customerIds: string[] = []

  // Insert in batches
  for (let i = 0; i < customerData.length; i += CUSTOMER_BATCH_SIZE) {
    const batch = customerData.slice(i, i + CUSTOMER_BATCH_SIZE)
    const batchNum = Math.floor(i / CUSTOMER_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(customerData.length / CUSTOMER_BATCH_SIZE)

    // Use createManyAndReturn to get IDs back
    const created = await prisma.customer.createManyAndReturn({
      data: batch.map((c) => ({
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        state: c.state,
        country: c.country,
        age: c.age,
        gender: c.gender,
        source: c.source,
      })),
      select: { id: true },
    })

    customerIds.push(...created.map((c) => c.id))
    log(`  Batch ${batchNum}/${totalBatches}: inserted ${batch.length} customers`)
  }

  log(`Total customers inserted: ${customerIds.length} ✓`)
  return customerIds
}

// ─── Step 3: Seed orders ─────────────────────────────────────

async function seedOrders(customerIds: string[]): Promise<number> {
  logHeader('Step 3/6 — Generating orders (power-law distribution)')

  const customers = customerIds.map((id) => ({ id }))
  const orderData = generateOrders(customers, products)
  log(`Generated ${orderData.length} orders for ${customerIds.length} customers`)

  // Insert in batches
  for (let i = 0; i < orderData.length; i += ORDER_BATCH_SIZE) {
    const batch = orderData.slice(i, i + ORDER_BATCH_SIZE)
    const batchNum = Math.floor(i / ORDER_BATCH_SIZE) + 1
    const totalBatches = Math.ceil(orderData.length / ORDER_BATCH_SIZE)

    await prisma.order.createMany({
      data: batch.map((o) => ({
        customerId: o.customerId,
        orderNumber: o.orderNumber,
        amount: o.amount,
        items: o.items,
        status: o.status,
        channel: o.channel,
        createdAt: o.createdAt,
      })),
    })

    log(`  Batch ${batchNum}/${totalBatches}: inserted ${batch.length} orders`)
  }

  log(`Total orders inserted: ${orderData.length} ✓`)
  return orderData.length
}

// ─── Step 4: Update denormalized customer fields ─────────────

async function updateCustomerAggregates() {
  logHeader('Step 4/6 — Updating customer aggregates (totalSpent, orderCount, lastOrderAt)')

  const aggregates = await prisma.order.groupBy({
    by: ['customerId'],
    _sum: { amount: true },
    _count: { id: true },
    _max: { createdAt: true },
    where: {
      status: { not: 'CANCELLED' }
    }
  })

  log(`Updating aggregates for ${aggregates.length} customers...`)

  // Update in batches using transactions
  const updateBatchSize = 50
  for (let i = 0; i < aggregates.length; i += updateBatchSize) {
    const batch = aggregates.slice(i, i + updateBatchSize)
    await prisma.$transaction(
      batch.map((agg) =>
        prisma.customer.update({
          where: { id: agg.customerId },
          data: {
            totalSpent: agg._sum.amount ?? 0,
            orderCount: agg._count.id ?? 0,
            lastOrderAt: agg._max.createdAt,
          },
        })
      ),
      { timeout: 30000 }
    )
  }

  log('Customer aggregates updated from order data ✓')
}

// ─── Step 5: Calculate & update RFM scores ───────────────────

async function updateRfmScores() {
  logHeader('Step 5/6 — Calculating RFM scores')

  // Fetch all customers with their aggregate data
  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      lastOrderAt: true,
      orderCount: true,
      totalSpent: true,
    },
  })

  log(`Scoring ${customers.length} customers...`)

  const rfmInputs = customers.map((c) => ({
    lastOrderAt: c.lastOrderAt,
    orderCount: c.orderCount,
    totalSpent: c.totalSpent,
  }))

  const scores: RfmScores[] = calculateRfmScores(rfmInputs)

  // Update in batches using transactions
  const updateBatchSize = 50
  for (let i = 0; i < customers.length; i += updateBatchSize) {
    const batch = customers.slice(i, i + updateBatchSize)
    const batchScores = scores.slice(i, i + updateBatchSize)

    await prisma.$transaction(
      batch.map((customer, j) =>
        prisma.customer.update({
          where: { id: customer.id },
          data: {
            rfmRecency: batchScores[j].rfmRecency,
            rfmFrequency: batchScores[j].rfmFrequency,
            rfmMonetary: batchScores[j].rfmMonetary,
            rfmScore: batchScores[j].rfmScore,
            rfmTier: batchScores[j].rfmTier,
          },
        }),
      ),
      { timeout: 30000 }
    )
  }

  log('RFM scores updated for all customers ✓')
}

// ─── Step 6: Print summary ───────────────────────────────────

async function printSummary() {
  logHeader('Step 6/6 — Seed Summary')

  const customerCount = await prisma.customer.count()
  const orderCount = await prisma.order.count()

  // Average order value
  const avgResult = await prisma.order.aggregate({
    _avg: { amount: true },
  })
  const avgOrderValue = avgResult._avg.amount ?? 0

  // RFM tier distribution
  const tierDistribution = await prisma.customer.groupBy({
    by: ['rfmTier'],
    _count: { id: true },
    orderBy: { rfmTier: 'asc' },
  })

  // Order channel distribution
  const channelDistribution = await prisma.order.groupBy({
    by: ['channel'],
    _count: { id: true },
  })

  // Customer source distribution
  const sourceDistribution = await prisma.customer.groupBy({
    by: ['source'],
    _count: { id: true },
  })

  console.log('\n  📊 Database Statistics')
  console.log('  ─────────────────────────────────────')
  console.log(`  Customers:        ${customerCount}`)
  console.log(`  Orders:           ${orderCount}`)
  console.log(`  Avg Order Value:  ₹${avgOrderValue.toFixed(2)}`)
  console.log(`  Orders/Customer:  ${(orderCount / customerCount).toFixed(1)}`)

  console.log('\n  🏆 RFM Tier Distribution')
  console.log('  ─────────────────────────────────────')
  for (const tier of tierDistribution) {
    const pct = ((tier._count.id / customerCount) * 100).toFixed(1)
    const bar = '█'.repeat(Math.round(Number(pct) / 2))
    console.log(`  ${tier.rfmTier.padEnd(12)} ${String(tier._count.id).padStart(4)}  (${pct.padStart(5)}%)  ${bar}`)
  }

  console.log('\n  📱 Order Channels')
  console.log('  ─────────────────────────────────────')
  for (const ch of channelDistribution) {
    const pct = ((ch._count.id / orderCount) * 100).toFixed(1)
    console.log(`  ${ch.channel.padEnd(12)} ${String(ch._count.id).padStart(4)}  (${pct.padStart(5)}%)`)
  }

  console.log('\n  🔍 Customer Sources')
  console.log('  ─────────────────────────────────────')
  for (const src of sourceDistribution) {
    const pct = ((src._count.id / customerCount) * 100).toFixed(1)
    console.log(`  ${src.source.padEnd(14)} ${String(src._count.id).padStart(4)}  (${pct.padStart(5)}%)`)
  }

  console.log('')
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log('\n🌱 Nova Database Seeder — StyleNova D2C Brand\n')
  const startTime = Date.now()

  try {
    await clearData()
    const customerIds = await seedCustomers()
    await seedOrders(customerIds)
    await updateCustomerAggregates()
    await updateRfmScores()
    await printSummary()

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`\n✅ Seed completed successfully in ${elapsed}s\n`)
  } catch (error) {
    console.error('\n❌ Seed failed:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
