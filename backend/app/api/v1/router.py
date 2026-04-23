from fastapi import APIRouter

from app.api.v1 import (
    auth,
    clients,
    payments,
    products,
    reports,
    route_streets,
    route_templates,
    routes,
    sales,
    streets,
    users,
)

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(streets.router)
router.include_router(clients.router)
router.include_router(users.router)
router.include_router(routes.router)
router.include_router(route_streets.router)
router.include_router(route_templates.router)
router.include_router(sales.router)
router.include_router(payments.router)
router.include_router(reports.router)
router.include_router(products.router)
