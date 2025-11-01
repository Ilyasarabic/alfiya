# progress/admin.py

from django.contrib import admin
from .models import (
    UserStats, DailyProgress, LessonProgress, 
    BlockProgress, Achievement, UserAchievement, StudySession
)

@admin.register(UserStats)
class UserStatsAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_study_time', 'total_sessions', 'current_streak', 'last_active')
    list_filter = ('last_active',)
    search_fields = ('user__username', 'user__telegram_username')

@admin.register(DailyProgress)
class DailyProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'date', 'words_learned', 'lessons_completed', 'time_studied', 'accuracy')
    list_filter = ('date',)
    search_fields = ('user__username',)
    date_hierarchy = 'date'

@admin.register(LessonProgress)
class LessonProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'lesson', 'is_completed', 'accuracy', 'time_spent')
    list_filter = ('is_completed', 'lesson__block')
    search_fields = ('user__username', 'lesson__title')

@admin.register(BlockProgress)
class BlockProgressAdmin(admin.ModelAdmin):
    list_display = ('user', 'block', 'is_completed', 'overall_accuracy', 'lessons_completed', 'total_lessons')
    list_filter = ('is_completed', 'block')
    search_fields = ('user__username', 'block__title')

@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('name', 'achievement_type', 'icon')
    list_filter = ('achievement_type',)
    search_fields = ('name', 'description')

@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement', 'earned_at')
    list_filter = ('achievement', 'earned_at')
    search_fields = ('user__username', 'achievement__name')

@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ('user', 'start_time', 'duration', 'average_accuracy')
    list_filter = ('start_time',)
    search_fields = ('user__username',)
    date_hierarchy = 'start_time'