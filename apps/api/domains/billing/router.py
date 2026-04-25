"""Stripe webhook handler.

Design notes:
- Raw body is required for HMAC signature verification. We read it via
  `Request.body()` and pass directly to stripe.Webhook.construct_event.
- Idempotency is enforced by marking event.id in Redis with SET NX + 7d TTL.
- Each event handler updates the user's tier to an explicit value (not a
  delta) so duplicate processing is safe even if the Redis claim fails.
- No middleware on this path should re-read or rewrite the request body.
"""

from __future__ import annotations

import stripe
import structlog
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.config import settings
from apps.api.dependencies import get_db

from .service import (
    TIER_FREE,
    get_user_by_email,
    get_user_by_stripe_customer,
    mark_event_processed,
    resolve_tier_from_price,
    set_user_tier,
)

router = APIRouter()
logger = structlog.stdlib.get_logger()


@router.post("/webhook/stripe", status_code=status.HTTP_200_OK)
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(None, alias="Stripe-Signature"),
    db: AsyncSession = Depends(get_db),
):
    """Handle Stripe subscription lifecycle events.

    Returns 200 quickly. Verifies signature via raw body (never parse JSON
    before verification — it'd break the HMAC).
    """
    if not settings.stripe_webhook_secret:
        logger.error("stripe_webhook_secret_missing")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Stripe billing is not configured",
        )
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe-Signature header",
        )

    raw_body = await request.body()
    try:
        event = stripe.Webhook.construct_event(
            payload=raw_body,
            sig_header=stripe_signature,
            secret=settings.stripe_webhook_secret,
        )
    except ValueError:
        # Malformed JSON payload
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )

    event_id = event["id"]
    event_type = event["type"]

    is_first = await mark_event_processed(event_id)
    if not is_first:
        logger.info("stripe_event_duplicate_skipped", event_id=event_id, type=event_type)
        return {"received": True, "duplicate": True}

    logger.info("stripe_event_received", event_id=event_id, type=event_type)

    try:
        handler = _EVENT_HANDLERS.get(event_type)
        if handler is not None:
            await handler(db, event["data"]["object"])
        # Events without a handler are acknowledged so Stripe stops retrying.
    except Exception:
        logger.exception(
            "stripe_event_handler_failed", event_id=event_id, type=event_type
        )
        # Propagate 500 so Stripe retries. We already logged; don't swallow.
        raise

    return {"received": True}


# ---------------------------------------------------------------------------
# Event handlers
# ---------------------------------------------------------------------------

async def _handle_checkout_session_completed(
    db: AsyncSession, session: dict
) -> None:
    """Link a Stripe customer to the Appio user on first successful checkout.

    The actual tier change happens via customer.subscription.created, which
    fires after this. Here we just persist the customer_id mapping.
    """
    customer_id = session.get("customer")
    email = (session.get("customer_email") or "").lower() or None
    client_reference_id = session.get("client_reference_id")

    if not customer_id:
        logger.warning("checkout_session_missing_customer", session_id=session.get("id"))
        return

    user = None
    if client_reference_id:
        user = await get_user_by_stripe_customer(db, client_reference_id)
    if user is None and email:
        user = await get_user_by_email(db, email)
    if user is None:
        logger.warning(
            "checkout_session_user_not_found",
            customer_id=customer_id,
            email=email,
            client_reference_id=client_reference_id,
        )
        return

    if user.stripe_customer_id != customer_id:
        user.stripe_customer_id = customer_id
        await db.flush()


async def _handle_subscription_upserted(
    db: AsyncSession, subscription: dict
) -> None:
    """Apply the tier implied by an active/trialing subscription."""
    customer_id = subscription.get("customer")
    sub_status = subscription.get("status", "")
    price_id = _extract_price_id(subscription)

    if not customer_id:
        return

    user = await get_user_by_stripe_customer(db, customer_id)
    if user is None:
        logger.warning(
            "subscription_user_not_found",
            customer_id=customer_id,
            status=sub_status,
        )
        return

    # Stripe subscription statuses:
    #   active, trialing → grant entitlement
    #   past_due → keep entitlement during grace period
    #   canceled, unpaid, incomplete, incomplete_expired → downgrade
    if sub_status in ("active", "trialing", "past_due"):
        tier = resolve_tier_from_price(price_id)
    else:
        tier = TIER_FREE

    await set_user_tier(db, user, tier=tier, stripe_customer_id=customer_id)


async def _handle_subscription_deleted(
    db: AsyncSession, subscription: dict
) -> None:
    """Downgrade to free when a subscription is fully canceled."""
    customer_id = subscription.get("customer")
    if not customer_id:
        return
    user = await get_user_by_stripe_customer(db, customer_id)
    if user is None:
        return
    await set_user_tier(db, user, tier=TIER_FREE)


async def _handle_invoice_payment_failed(
    db: AsyncSession, invoice: dict
) -> None:
    """Log payment failure. Entitlement stays active during Stripe's dunning
    window; a later customer.subscription.updated with status 'unpaid' or
    'canceled' performs the actual downgrade."""
    logger.warning(
        "stripe_invoice_payment_failed",
        customer_id=invoice.get("customer"),
        invoice_id=invoice.get("id"),
        attempt_count=invoice.get("attempt_count"),
    )


def _extract_price_id(subscription: dict) -> str | None:
    """Pull the first subscription item's price ID."""
    items = (subscription.get("items") or {}).get("data") or []
    if not items:
        return None
    price = items[0].get("price") or {}
    return price.get("id")


_EVENT_HANDLERS = {
    "checkout.session.completed": _handle_checkout_session_completed,
    "customer.subscription.created": _handle_subscription_upserted,
    "customer.subscription.updated": _handle_subscription_upserted,
    "customer.subscription.deleted": _handle_subscription_deleted,
    "invoice.payment_failed": _handle_invoice_payment_failed,
}
