"""Message-send endpoint."""

from fastapi import APIRouter

from app.schemas.message import SendRequest, SendResponse
from app.services.delivery_simulator import simulate_batch

router = APIRouter()


@router.post("/send", response_model=SendResponse)
async def send_messages(request: SendRequest) -> SendResponse:
    """Accept a batch of messages and launch asynchronous delivery simulation.

    The endpoint returns immediately with the number of accepted messages.
    Status updates are delivered asynchronously via webhooks to the
    ``callback_url`` provided in the request.
    """
    # Convert Pydantic models to plain dicts for the simulator
    messages = [
        {
            "id": msg.id,
            "to": msg.to,
            "channel": msg.channel,
            "content": msg.content,
        }
        for msg in request.messages
    ]

    # Launch async simulation (returns immediately)
    await simulate_batch(
        campaign_id=request.campaign_id,
        messages=messages,
        callback_url=str(request.callback_url),
    )

    return SendResponse(
        accepted=len(request.messages),
        campaign_id=request.campaign_id,
        status="processing",
    )
