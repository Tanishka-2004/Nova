import { prisma } from "@nova/database";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, channel, messageTemplate, segmentName } = body;

    if (!name || !channel || !messageTemplate) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Resolve or create segment
    let segment = await prisma.segment.findFirst({
      where: { name: segmentName || "Target Audience" }
    });

    if (!segment) {
      segment = await prisma.segment.create({
        data: {
          name: segmentName || "Target Audience",
          description: `Automatically created segment for ${name}`,
          filters: {}
        }
      });
    }

    // 2. Fetch target customers
    let rfmTiers: any[] = [];
    const lowerName = (segmentName || "").toLowerCase();
    if (lowerName.includes("dormant") || lowerName.includes("inactive")) {
      rfmTiers = ["AT_RISK", "LOST"];
    } else if (lowerName.includes("vip") || lowerName.includes("loyal")) {
      rfmTiers = ["CHAMPION", "LOYAL"];
    } else {
      rfmTiers = ["POTENTIAL", "LOYAL"];
    }

    let customers = await prisma.customer.findMany({
      where: {
        rfmTier: { in: rfmTiers }
      },
      take: 20
    });

    // Fallback if no customers match the RFM tier query
    if (customers.length === 0) {
      customers = await prisma.customer.findMany({
        take: 10
      });
    }

    // 3. Create Campaign
    const campaign = await prisma.campaign.create({
      data: {
        name,
        segmentId: segment.id,
        channel: channel.toUpperCase(),
        messageTemplate,
        status: "SENDING",
        launchedAt: new Date(),
        stats: JSON.stringify({ sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 })
      }
    });

    // 4. Create Campaign Messages
    const campaignMessages = [];
    for (const customer of customers) {
      const firstName = customer.name.split(" ")[0];
      const renderedContent = messageTemplate.replace(/\{\{\s*first_name\s*\}\}/g, firstName);
      const recipientAddress = channel.toUpperCase() === "EMAIL" ? customer.email : (customer.phone || "+919999999999");

      const msg = await prisma.campaignMessage.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          channel: channel.toUpperCase(),
          recipientAddress,
          content: renderedContent,
          status: "QUEUED"
        }
      });

      campaignMessages.push({
        id: msg.id,
        to: recipientAddress,
        channel: channel.toUpperCase(),
        content: renderedContent
      });
    }

    // 5. Call FastAPI Channel Service
    const channelServiceUrl = process.env.CHANNEL_SERVICE_URL;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!channelServiceUrl || !appUrl) {
      console.error("CHANNEL_SERVICE_URL or NEXT_PUBLIC_APP_URL is not configured.");
      return NextResponse.json(
        { error: "Channel service misconfigured. Missing required environment variables." },
        { status: 500 }
      );
    }

    const callbackUrl = `${appUrl}/api/webhooks/delivery`;

    try {
      const response = await fetch(`${channelServiceUrl}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.id,
          messages: campaignMessages,
          callback_url: callbackUrl
        })
      });

      if (!response.ok) {
        console.error("FastAPI Channel Service responded with error:", response.status, await response.text());
      }
    } catch (err) {
      console.error("Failed to connect to FastAPI Channel Service:", err);
    }

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      recipientCount: customers.length
    });

  } catch (error: any) {
    console.error("Campaign launch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
