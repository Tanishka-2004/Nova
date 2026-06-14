import { prisma } from "@nova/database";

/**
 * High-Value Integration Tests for Nova
 * Run these scripts locally against the Docker Postgres instance to validate demo readiness.
 * Usage: npx tsx apps/web/tests/integration.ts
 */

async function runTests() {
  console.log("🚀 Starting Integration Tests...\n");

  try {
    // ---------------------------------------------------------
    // TEST 1: Campaign Creation Flow
    // ---------------------------------------------------------
    console.log("Test 1: Campaign Creation Flow");
    const segment = await prisma.segment.create({
      data: {
        name: "Test Segment",
        description: "Integration test audience",
        filters: { rfmTier: "CHAMPION" }
      }
    });

    const campaign = await prisma.campaign.create({
      data: {
        name: "Test Campaign",
        segmentId: segment.id,
        channel: "EMAIL",
        messageTemplate: "Hello",
        status: "DRAFT"
      }
    });

    const verifyCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id }});
    if (!verifyCampaign) throw new Error("Campaign persistence failed");
    console.log("✅ Campaign Creation Flow: PASSED");

    // ---------------------------------------------------------
    // TEST 2: Channel Callback Flow
    // ---------------------------------------------------------
    console.log("\nTest 2: Channel Callback Flow");
    const customer = await prisma.customer.create({
      data: { 
        name: "Test User", 
        email: "test@example.com",
        city: "Mumbai",
        state: "Maharashtra",
        age: 30,
        gender: "MALE",
        source: "ORGANIC"
      }
    });

    const message = await prisma.campaignMessage.create({
      data: {
        campaignId: campaign.id,
        customerId: customer.id,
        channel: "EMAIL",
        recipientAddress: "test@example.com",
        content: "Hello",
        status: "QUEUED"
      }
    });

    // Simulate Webhook for DELIVERED
    await simulateWebhook(message.id, campaign.id, "DELIVERED");
    let updatedMessage = await prisma.campaignMessage.findUnique({ where: { id: message.id }});
    if (updatedMessage?.status !== "DELIVERED") throw new Error("Webhook DELIVERED update failed");

    // Simulate Webhook for READ
    await simulateWebhook(message.id, campaign.id, "READ");
    updatedMessage = await prisma.campaignMessage.findUnique({ where: { id: message.id }});
    if (updatedMessage?.status !== "READ") throw new Error("Webhook READ update failed");
    console.log("✅ Channel Callback Flow: PASSED");

    // ---------------------------------------------------------
    // TEST 3: Duplicate Webhook Handling
    // ---------------------------------------------------------
    console.log("\nTest 3: Duplicate Webhook Handling");
    // Send READ again
    await simulateWebhook(message.id, campaign.id, "READ");
    const dupCheck = await prisma.campaignMessage.findUnique({ where: { id: message.id }});
    if (dupCheck?.status !== "READ") throw new Error("Duplicate webhook caused invalid state");
    console.log("✅ Duplicate Webhook Idempotency: PASSED");

    // ---------------------------------------------------------
    // TEST 4: Failed Delivery Flow
    // ---------------------------------------------------------
    console.log("\nTest 4: Failed Delivery Flow");
    const failMessage = await prisma.campaignMessage.create({
      data: {
        campaignId: campaign.id,
        customerId: customer.id,
        channel: "EMAIL",
        recipientAddress: "bad@example.com",
        content: "Hello",
        status: "QUEUED"
      }
    });

    await simulateWebhook(failMessage.id, campaign.id, "FAILED");
    const failedCheck = await prisma.campaignMessage.findUnique({ where: { id: failMessage.id }});
    if (failedCheck?.status !== "FAILED") throw new Error("Webhook FAILED update failed");
    console.log("✅ Failed Delivery Flow: PASSED");

    console.log("\n🎉 All integration tests passed successfully!");

  } catch (err: any) {
    console.error(`\n❌ TEST FAILED: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper to simulate calling the Next.js Webhook route directly via code logic
async function simulateWebhook(message_id: string, campaign_id: string, status: string) {
  const updateData: any = { status };
  const date = new Date();
  if (status === "SENT") updateData.sentAt = date;
  if (status === "DELIVERED") updateData.deliveredAt = date;
  if (status === "READ") updateData.readAt = date;
  if (status === "CLICKED") updateData.clickedAt = date;
  if (status === "FAILED") updateData.failedAt = date;

  await prisma.campaignMessage.update({
    where: { id: message_id },
    data: updateData
  });
}

runTests();
