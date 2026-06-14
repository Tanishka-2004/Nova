import { prisma } from "@nova/database";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message_id, campaign_id, status, timestamp } = body;

    if (!message_id || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize status to uppercase for Prisma enum and validation
    const upperStatus = status.toUpperCase();

    // Map FastAPI status to Prisma enum (though they are matching strings, let's cast safely)
    const validStatuses = ["QUEUED", "SENT", "DELIVERED", "READ", "CLICKED", "FAILED"];
    if (!validStatuses.includes(upperStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Fetch current message status to handle out-of-order delivery
    const currentMsg = await prisma.campaignMessage.findUnique({
      where: { id: message_id },
      select: { status: true }
    });

    if (!currentMsg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    const STATUS_HIERARCHY: Record<string, number> = {
      QUEUED: 0,
      SENT: 1,
      DELIVERED: 2,
      READ: 3,
      CLICKED: 4,
      FAILED: 4
    };

    const currentLevel = STATUS_HIERARCHY[currentMsg.status] ?? 0;
    const incomingLevel = STATUS_HIERARCHY[upperStatus] ?? 0;

    const updateData: any = {};
    const date = timestamp ? new Date(timestamp) : new Date();

    if (upperStatus === "SENT") updateData.sentAt = date;
    if (upperStatus === "DELIVERED") updateData.deliveredAt = date;
    if (upperStatus === "READ") updateData.readAt = date;
    if (upperStatus === "CLICKED") updateData.clickedAt = date;
    if (upperStatus === "FAILED") updateData.failedAt = date;

    // Only update the main status column if the incoming event is further along in the lifecycle
    if (incomingLevel > currentLevel) {
      updateData.status = upperStatus;
    }

    const updatedMsg = await prisma.campaignMessage.update({
      where: { id: message_id },
      data: updateData
    });

    // Re-aggregate campaign stats for the campaign
    if (updatedMsg.campaignId) {
      const statsResult = await prisma.campaignMessage.groupBy({
        by: ['status'],
        _count: { id: true },
        where: { campaignId: updatedMsg.campaignId }
      });

      const statsObj = { sent: 0, delivered: 0, read: 0, clicked: 0, failed: 0 };
      for (const row of statsResult) {
        const s = row.status.toLowerCase();
        if (s in statsObj) {
          statsObj[s as keyof typeof statsObj] = row._count.id;
        }
      }

      // If all messages have reached a terminal or semi-terminal state, mark campaign COMPLETED
      const totalMessages = statsResult.reduce((sum: number, row: any) => sum + row._count.id, 0);
      const processedCount = statsObj.delivered + statsObj.read + statsObj.clicked + statsObj.failed + statsObj.sent;
      const isCompleted = processedCount >= totalMessages && statsObj.sent === 0;

      await prisma.campaign.update({
        where: { id: updatedMsg.campaignId },
        data: {
          stats: JSON.stringify(statsObj),
          status: isCompleted ? "COMPLETED" : "SENDING"
        }
      });
    }

    return NextResponse.json({ success: true, message_id, status: upperStatus });
    
  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
