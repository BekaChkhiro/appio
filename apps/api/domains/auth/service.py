"""Firebase token verification + user sync to Neon."""

import structlog
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from appio_db import User
from apps.api.core.exceptions import ForbiddenError
from apps.api.core.security import FirebaseUser

logger = structlog.stdlib.get_logger()

# Common disposable email domains. Extend as needed.
DISPOSABLE_DOMAINS = frozenset({
    "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
    "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
    "dispostable.com", "mailnesia.com", "trashmail.com", "tempail.com",
    "fakeinbox.com", "mailcatch.com", "tempr.email", "discard.email",
    "temp-mail.org", "minutemail.com", "maildrop.cc", "10minutemail.com",
    "getairmail.com", "mohmal.com", "emailondeck.com", "burnermail.io",
    "inboxbear.com", "mailsac.com", "harakirimail.com",
})


def is_disposable_email(email: str) -> bool:
    """Check if an email uses a known disposable domain."""
    domain = email.rsplit("@", 1)[-1].lower()
    return domain in DISPOSABLE_DOMAINS


async def sync_user(db: AsyncSession, firebase_user: FirebaseUser) -> User:
    """Look up or create a user from Firebase claims.

    On first request: creates user row in Neon.
    On subsequent requests: returns existing user (updates name/avatar if changed).
    """
    if is_disposable_email(firebase_user.email):
        raise ForbiddenError(detail="Disposable email addresses are not allowed")

    result = await db.execute(
        select(User).where(User.firebase_uid == firebase_user.uid)
    )
    user = result.scalar_one_or_none()

    if user is None:
        # First login — create user.
        # Handle race condition: if two concurrent requests both see user=None,
        # one will succeed and the other hits a unique-constraint violation.
        try:
            user = User(
                firebase_uid=firebase_user.uid,
                email=firebase_user.email,
                name=firebase_user.name,
                avatar=firebase_user.picture,
                tier="free",
            )
            db.add(user)
            await db.flush()  # Assign ID without committing (commit happens in get_db)
            logger.info("user_created", user_id=str(user.id), email=user.email)
        except IntegrityError:
            await db.rollback()
            # The other request won the race — fetch the existing row
            result = await db.execute(
                select(User).where(User.firebase_uid == firebase_user.uid)
            )
            user = result.scalar_one()
    else:
        # Update profile fields if they changed in Firebase
        changed = False
        if firebase_user.name and user.name != firebase_user.name:
            user.name = firebase_user.name
            changed = True
        if firebase_user.picture and user.avatar != firebase_user.picture:
            user.avatar = firebase_user.picture
            changed = True
        if user.email != firebase_user.email:
            user.email = firebase_user.email
            changed = True
        if changed:
            await db.flush()

    return user
