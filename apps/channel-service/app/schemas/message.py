"""Pydantic models for the channel service API."""

from pydantic import BaseModel


class MessagePayload(BaseModel):
    """A single message to be delivered."""

    id: str  # CampaignMessage ID from main app
    to: str  # recipient address (phone/email)
    channel: str  # whatsapp | sms | email | rcs
    content: str  # message body


class SendRequest(BaseModel):
    """Request to send a batch of messages for a campaign."""

    campaign_id: str
    callback_url: str  # URL to POST status updates to
    messages: list[MessagePayload]


class SendResponse(BaseModel):
    """Response after accepting a batch of messages."""

    accepted: int
    campaign_id: str
    status: str = "processing"


class WebhookPayload(BaseModel):
    """Status update payload sent to the callback URL."""

    message_id: str
    campaign_id: str
    status: str  # sent | delivered | read | clicked | failed
    timestamp: str  # ISO 8601
    metadata: dict = {}


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    service: str
    active_simulations: int
