from django.contrib import admin
from .models import ParcelAudit


@admin.register(ParcelAudit)
class ParcelAuditAdmin(admin.ModelAdmin):
    list_display = ["latitude", "longitude", "current_ndvi", "deviation_score", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["report_data"]
