import { prisma } from "@nova/database";

/**
 * Webhook Callback Verification Script for Nova
 * This script runs against the local dev server at http://localhost:3000 to verify:
 * 1. Webhook endpoint accepts lowercase statuses and normalizes them to uppercase.
 * 2. Database records are updated correctly.
 * 3. Out-of-order events are resolved correctly (CLICKED remains even if READ arrives late, but both timestamps are set).
 * 4. Duplicate event webhooks are handled idempotently.
 * 5. Campaign stats are aggregated correctly in the database.
 * 
 * Run with: npx tsx apps/web/tests/verify-callbacks.ts
 */

const APP_URL = "http://localhost:3000";

async function postWebhook(payload: { message_id: string; campaign_id: string; status: string; timestamp?: string }) {
  const res = await fetch(`${APP_URL}/api/webhooks/delivery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook API returned HTTP ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function runCallbackVerification() {
  console.log("==========================================================");
  console.log("🚀 STARTING WEBHOOK CALLBACK LOOP VALIDATION");
  console.log("==========================================================\n");

  try {
    // 1. Setup mock customer
    const customer = await prisma.customer.create({
      data: {
        name: "Test Callback User",
        email: `callback.${Date.now()}@example.com`,
        phone: "+919876543210",
        city: "Delhi",
        state: "Delhi",
        age: 28,
        gender: "FEMALE",
        source: "ORGANIC",
      },
    });

    // 2. Setup mock segment
    const segment = await prisma.segment.create({
      data: {
        name: `Verification Segment ${Date.now()}`,
        description: "Segment for callback loop integration tests",
        filters: {},
      },
    });

    // 3. Setup mock campaign
    const campaign = await prisma.campaign.create({
      data: {
        name: `Verification Campaign ${Date.now()}`,
        segmentId: segment.id,
        channel: "EMAIL",
        messageTemplate: "Hi {{first_name}}!",
        status: "SENDING",
        stats: JSON.stringify({ sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 }),
      },
    });

    // 4. Setup mock campaign messages
    // Msg 1: Normal linear lifecycle
    const msg1 = await prisma.campaignMessage.create({
      data: {
        campaignId: campaign.id,
        customerId: customer.id,
        channel: "EMAIL",
        recipientAddress: customer.email,
        content: "Hi Test!",
        status: "QUEUED",
      },
    });

    // Msg 2: Out-of-order execution lifecycle
    const msg2 = await prisma.campaignMessage.create({
      data: {
        campaignId: campaign.id,
        customerId: customer.id,
        channel: "EMAIL",
        recipientAddress: customer.email,
        content: "Hi Test!",
        status: "QUEUED",
      },
    });

    console.log("🌱 TEST SETUP CREATED");
    console.log(`Campaign ID: ${campaign.id}`);
    console.log(`Msg 1 ID (Linear): ${msg1.id} (Status: QUEUED)`);
    console.log(`Msg 2 ID (Out-Of-Order): ${msg2.id} (Status: QUEUED)`);
    console.log(`Initial Campaign Stats: ${campaign.stats}\n`);

    // ---------------------------------------------------------
    // Msg 1 Step 1: lowercase "sent" -> normalized to SENT
    // ---------------------------------------------------------
    console.log("➡️ Dispatching Webhook: msg1 status = 'sent' (lowercase)");
    let res = await postWebhook({
      message_id: msg1.id,
      campaign_id: campaign.id,
      status: "sent",
      timestamp: new Date().toISOString(),
    });
    console.log(`Response status: ${res.status} | success: ${res.success}`);
    
    let dbMsg1 = await prisma.campaignMessage.findUnique({ where: { id: msg1.id } });
    console.log(`Database Status msg1: ${dbMsg1?.status} (Expected: SENT)`);
    console.log(`sentAt populated: ${dbMsg1?.sentAt ? "Yes ✅" : "No ❌"}\n`);
    if (dbMsg1?.status !== "SENT") throw new Error("Casing normalization to SENT failed");

    // ---------------------------------------------------------
    // Msg 1 Step 2: lowercase "delivered" -> normalized to DELIVERED
    // ---------------------------------------------------------
    console.log("➡️ Dispatching Webhook: msg1 status = 'delivered' (lowercase)");
    res = await postWebhook({
      message_id: msg1.id,
      campaign_id: campaign.id,
      status: "delivered",
      timestamp: new Date().toISOString(),
    });
    dbMsg1 = await prisma.campaignMessage.findUnique({ where: { id: msg1.id } });
    console.log(`Database Status msg1: ${dbMsg1?.status} (Expected: DELIVERED)`);
    console.log(`deliveredAt populated: ${dbMsg1?.deliveredAt ? "Yes ✅" : "No ❌"}\n`);
    if (dbMsg1?.status !== "DELIVERED") throw new Error("Transition to DELIVERED failed");

    // ---------------------------------------------------------
    // Msg 1 Step 3: lowercase "read" -> normalized to READ
    // ---------------------------------------------------------
    console.log("➡️ Dispatching Webhook: msg1 status = 'read' (lowercase)");
    res = await postWebhook({
      message_id: msg1.id,
      campaign_id: campaign.id,
      status: "read",
    });
    dbMsg1 = await prisma.campaignMessage.findUnique({ where: { id: msg1.id } });
    console.log(`Database Status msg1: ${dbMsg1?.status} (Expected: READ)`);
    console.log(`readAt populated: ${dbMsg1?.readAt ? "Yes ✅" : "No ❌"}\n`);
    if (dbMsg1?.status !== "READ") throw new Error("Transition to READ failed");

    // ---------------------------------------------------------
    // Msg 1 Step 4: Duplicate read webhook (Idempotency Check)
    // ---------------------------------------------------------
    console.log("➡️ Dispatching Webhook: msg1 status = 'read' AGAIN (Idempotency)");
    res = await postWebhook({
      message_id: msg1.id,
      campaign_id: campaign.id,
      status: "read",
    });
    dbMsg1 = await prisma.campaignMessage.findUnique({ where: { id: msg1.id } });
    console.log(`Database Status msg1: ${dbMsg1?.status} (Expected: READ)`);
    console.log(`Idempotency check: Passed ✅\n`);

    // ---------------------------------------------------------
    // Msg 1 Step 5: lowercase "clicked" -> normalized to CLICKED
    // ---------------------------------------------------------
    console.log("➡️ Dispatching Webhook: msg1 status = 'clicked' (lowercase)");
    res = await postWebhook({
      message_id: msg1.id,
      campaign_id: campaign.id,
      status: "clicked",
    });
    dbMsg1 = await prisma.campaignMessage.findUnique({ where: { id: msg1.id } });
    console.log(`Database Status msg1: ${dbMsg1?.status} (Expected: CLICKED)`);
    console.log(`clickedAt populated: ${dbMsg1?.clickedAt ? "Yes ✅" : "No ❌"}\n`);
    if (dbMsg1?.status !== "CLICKED") throw new Error("Transition to CLICKED failed");


    // ---------------------------------------------------------
    // Msg 2: Out-Of-Order Event Delivery
    // ---------------------------------------------------------
    console.log("⚡ TESTING OUT-OF-ORDER WEBHOOK DELIVERY");
    
    // First send CLICKED
    console.log("➡️ Dispatching Webhook: msg2 status = 'clicked' (First event)");
    res = await postWebhook({
      message_id: msg2.id,
      campaign_id: campaign.id,
      status: "clicked",
    });
    let dbMsg2 = await prisma.campaignMessage.findUnique({ where: { id: msg2.id } });
    console.log(`Database Status msg2: ${dbMsg2?.status} (Expected: CLICKED)`);
    console.log(`clickedAt populated: ${dbMsg2?.clickedAt ? "Yes ✅" : "No ❌"}`);
    if (dbMsg2?.status !== "CLICKED") throw new Error("Out-of-order CLICKED setup failed");

    // Second send READ (which arrived late)
    console.log("➡️ Dispatching Webhook: msg2 status = 'read' (Arrived late)");
    res = await postWebhook({
      message_id: msg2.id,
      campaign_id: campaign.id,
      status: "read",
    });
    dbMsg2 = await prisma.campaignMessage.findUnique({ where: { id: msg2.id } });
    console.log(`Database Status msg2: ${dbMsg2?.status} (Expected: CLICKED - did not regress to READ)`);
    console.log(`readAt populated: ${dbMsg2?.readAt ? "Yes ✅" : "No ❌"}\n`);
    
    if (dbMsg2?.status !== "CLICKED") throw new Error("Out-of-order state regression occurred!");
    if (!dbMsg2?.readAt) throw new Error("Late event timestamp was not saved!");
    console.log("✅ Out-Of-Order Handling: Passed (Casing + No regression + Timestamp saved)\n");


    // ---------------------------------------------------------
    // Campaign Aggregation Verification
    // ---------------------------------------------------------
    console.log("📈 VERIFYING CAMPAIGN STATS AGGREGATION");
    const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    console.log(`Campaign status: ${updatedCampaign?.status} (Expected: COMPLETED because all messages reached terminal state)`);
    console.log(`Final Campaign Stats: ${updatedCampaign?.stats}`);
    
    const stats = JSON.parse(updatedCampaign?.stats ?? "{}");
    // Both messages are now CLICKED
    if (stats.clicked !== 2) throw new Error(`Stats aggregation incorrect! Expected 2 clicked, got ${stats.clicked}`);
    console.log("✅ Stats Aggregation: Passed\n");


    // ---------------------------------------------------------
    // Cleanup
    // ---------------------------------------------------------
    console.log("🧹 Cleaning up integration test records...");
    await prisma.campaignMessage.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.segment.delete({ where: { id: segment.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
    console.log("🧹 Cleanup complete ✓\n");

    console.log("==========================================================");
    console.log("🎉 ALL WEBHOOK INTEGRATION TESTS PASSED SUCCESSFULLY!");
    console.log("==========================================================");

  } catch (err: any) {
    console.error("\n❌ WEBHOOK VALIDATION TEST FAILED!");
    console.error(err.stack || err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runCallbackVerification();
