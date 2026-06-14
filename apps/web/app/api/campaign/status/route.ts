import { prisma } from "@nova/database";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });
    }

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        messages: {
          select: {
            id: true,
            status: true,
            recipientAddress: true,
            updatedAt: true,
            failureReason: true
          },
          orderBy: { updatedAt: "desc" },
          take: 10
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Parse stats string safely
    let stats = { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
    try {
      if (campaign.stats) {
        stats = typeof campaign.stats === "string" ? JSON.parse(campaign.stats) : campaign.stats;
      }
    } catch (e) {
      console.error("Failed to parse campaign stats:", e);
    }

    return NextResponse.json({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      launchedAt: campaign.launchedAt,
      completedAt: campaign.completedAt,
      stats,
      recentMessages: campaign.messages
    });

  } catch (error: any) {
    console.error("Campaign status fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
