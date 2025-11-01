#users/admin.py

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'telegram_id', 'telegram_username', 'is_paid', 'created_at')
    list_filter = ('is_paid', 'is_staff', 'is_superuser')
    search_fields = ('username', 'telegram_username', 'telegram_id')
    
    fieldsets = UserAdmin.fieldsets + (
        ('Telegram Info', {
            'fields': ('telegram_id', 'telegram_username', 'is_paid', 'auth_token')
        }),
    )