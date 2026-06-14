"""
Delivery simulation engine.

Simulates realistic message delivery timelines and fires webhook callbacks
to the main application as each message progresses through its lifecycle:

    QUEUED → SENT (1-3s) → DELIVERED (3-10s) → READ (5-30s, 40%) → CLICKED (5-20s, 15% overall)

10% of messages fail at the SENT stage with a random failure reason.
"""

import asyncio
import logging
import random
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Background task management
# ---------------------------------------------------------------------------
# A global set holds strong references to every running simulation task.
# Without this, the event loop only keeps weak references and the GC may
# collect tasks before they finish.
_background_tasks: set[asyncio.Task] = set()
_active_simulation_count: int = 0


def get_active_simulation_count() -> int:
    """Return the number of message simulations currently in-flight."""
    return _active_simulation_count


def create_background_task(coro) -> asyncio.Task:
    """Create a background task with proper reference management.

    The task is added to ``_background_tasks`` and automatically removed
    via a done-callback when it completes.
    """
    task = asyncio.create_task(coro)
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)
    return task


# ---------------------------------------------------------------------------
# Webhook delivery
# ---------------------------------------------------------------------------

_FAILURE_REASONS = [
    "Invalid phone number",
    "Number not registered on WhatsApp",
    "Rate limit exceeded",
    "Template not approved",
    "Recipient blocked sender",
]


async def post_webhook(
    callback_url: str,
    payload: dict,
    max_retries: int = 3,
) -> None:
    """POST *payload* as JSON to *callback_url* with exponential-backoff retry."""
    async with httpx.AsyncClient() as client:
        for attempt in range(max_retries):
            try:
                response = await client.post(
                    callback_url,
                    json=payload,
                    timeout=10.0,
                    headers={"Content-Type": "application/json"},
                )
                response.raise_for_status()
                logger.info(
                    "Webhook delivered: %s → %s",
                    payload["message_id"],
                    payload["status"],
                )
                return
            except (httpx.HTTPError, httpx.TimeoutException) as exc:
                if attempt < max_retries - 1:
                    wait = (2**attempt) + random.uniform(0, 1)
                    logger.warning(
                        "Webhook retry %d for %s: %s",
                        attempt + 1,
                        payload["message_id"],
                        exc,
                    )
                    await asyncio.sleep(wait)
                else:
                    logger.error(
                        "Webhook failed after %d retries: %s: %s",
                        max_retries,
                        payload["message_id"],
                        exc,
                    )


# ---------------------------------------------------------------------------
# Single-message simulation
# ---------------------------------------------------------------------------


async def simulate_single_message(
    message_id: str,
    campaign_id: str,
    channel: str,
    callback_url: str,
) -> None:
    """Simulate the full delivery lifecycle for a single message.

    The function sleeps between stages to mimic real-world delivery
    latency, then fires a webhook for each status transition.
    """
    global _active_simulation_count  # noqa: PLW0603
    _active_simulation_count += 1

    try:
        # Add initial jitter to spread load across the batch
        await asyncio.sleep(random.uniform(0.1, 2.0))

        # ── Stage 1: SENT (1-3 s) ─────────────────────────────────────
        # 10 % chance of failure at this stage
        if random.random() < 0.10:
            await asyncio.sleep(random.uniform(0.5, 2.0))
            await post_webhook(
                callback_url,
                {
                    "message_id": message_id,
                    "campaign_id": campaign_id,
                    "status": "failed",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "metadata": {
                        "failure_reason": random.choice(_FAILURE_REASONS),
                    },
                },
            )
            return

        await asyncio.sleep(random.uniform(1, 3))
        payload_sent = {
            "message_id": message_id,
            "campaign_id": campaign_id,
            "status": "sent",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {"channel": channel},
        }
        await post_webhook(callback_url, payload_sent)

        # Simulate Idempotency check: 15% chance of sending a duplicate callback
        if random.random() < 0.15:
            logger.info("Simulating duplicate webhook (SENT) for %s", message_id)
            await post_webhook(callback_url, payload_sent)

        # ── Stage 2: DELIVERED (3-10 s after sent) ────────────────────
        await asyncio.sleep(random.uniform(3, 10))
        await post_webhook(
            callback_url,
            {
                "message_id": message_id,
                "campaign_id": campaign_id,
                "status": "delivered",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "metadata": {"channel": channel},
            },
        )

        # ── Stage 3: READ & CLICKED (5-30 s, 40 % chance) ───────
        if random.random() < 0.40:
            # 15% chance of out-of-order event delivery (CLICKED arrives before READ)
            if random.random() < 0.15:
                logger.info("Simulating out-of-order webhook delivery (CLICKED before READ) for %s", message_id)
                await asyncio.sleep(random.uniform(5, 15))
                # Send CLICKED first
                await post_webhook(
                    callback_url,
                    {
                        "message_id": message_id,
                        "campaign_id": campaign_id,
                        "status": "clicked",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "metadata": {"channel": channel},
                    },
                )
                # Send READ second
                await asyncio.sleep(random.uniform(2, 5))
                await post_webhook(
                    callback_url,
                    {
                        "message_id": message_id,
                        "campaign_id": campaign_id,
                        "status": "read",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "metadata": {"channel": channel},
                    },
                )
            else:
                # Normal order
                await asyncio.sleep(random.uniform(5, 30))
                await post_webhook(
                    callback_url,
                    {
                        "message_id": message_id,
                        "campaign_id": campaign_id,
                        "status": "read",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "metadata": {"channel": channel},
                    },
                )

                # ── Stage 4: CLICKED (5-20 s after read, ~35 % of reads ≈ 15 % overall)
                if random.random() < 0.35:
                    await asyncio.sleep(random.uniform(5, 20))
                    await post_webhook(
                        callback_url,
                        {
                            "message_id": message_id,
                            "campaign_id": campaign_id,
                            "status": "clicked",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "metadata": {"channel": channel},
                        },
                    )
    finally:
        _active_simulation_count -= 1


# ---------------------------------------------------------------------------
# Batch launcher
# ---------------------------------------------------------------------------


async def simulate_batch(
    campaign_id: str,
    messages: list[dict],
    callback_url: str,
) -> None:
    """Launch delivery simulations for every message in the batch.

    Each message gets its own background task so they run concurrently and
    the ``/send`` endpoint can return immediately.
    """
    for msg in messages:
        create_background_task(
            simulate_single_message(
                message_id=msg["id"],
                campaign_id=campaign_id,
                channel=msg["channel"],
                callback_url=callback_url,
            )
        )
    logger.info(
        "Launched %d simulations for campaign %s",
        len(messages),
        campaign_id,
    )
