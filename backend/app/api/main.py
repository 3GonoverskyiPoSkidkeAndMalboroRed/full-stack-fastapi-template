from fastapi import APIRouter

from app.api.routes import (
    brands,
    cart,
    categories,
    items,
    login,
    orders,
    payment_cards,
    private,
    sizes,
    users,
    utils,
    wishlist,
)
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(utils.router)
api_router.include_router(items.router)
api_router.include_router(categories.router)
api_router.include_router(sizes.router)
api_router.include_router(brands.router)
api_router.include_router(cart.router)
api_router.include_router(wishlist.router)
api_router.include_router(orders.router)
api_router.include_router(payment_cards.router)


if settings.ENVIRONMENT == "local":
    api_router.include_router(private.router)
