from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    # Auth
    path("auth/register/", views.register),
    path("auth/login/", views.login),
    path("auth/refresh/", TokenRefreshView.as_view()),
    # Audits / Contrats
    path("audit/", views.audit_parcel),
    path("audits/", views.audit_list),
    path("audits/<int:pk>/", views.audit_detail),
    path("audits/<int:pk>/interpretation/", views.audit_interpretation),
    # Contracts (onboarding)
    path("contracts/", views.contract_list),
    path("contracts/create/", views.contract_create),
    path("contracts/<int:pk>/", views.contract_detail),
    path("dashboard-stats/", views.dashboard_stats),
    # Claims (Réclamations / Ta3wid)
    path("claims/", views.claim_list),
    path("claims/create/", views.claim_create),
    path("claims/<int:pk>/", views.claim_detail),
    path("claims/<int:pk>/status/", views.claim_update_status),
]
