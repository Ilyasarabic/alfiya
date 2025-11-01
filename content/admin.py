# content/admin.py

from django.contrib import admin
from .models import Block, Lesson, Word, BlockTest

class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1

class WordInline(admin.TabularInline):
    model = Word
    extra = 3

@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ('title', 'order', 'is_active', 'created_at')
    list_editable = ('order', 'is_active')
    list_filter = ('is_active', 'created_at')
    search_fields = ('title', 'description')
    inlines = [LessonInline]

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'block', 'order', 'is_active')
    list_editable = ('order', 'is_active')
    list_filter = ('block', 'is_active')
    search_fields = ('title', 'block__title')
    inlines = [WordInline]

@admin.register(Word)
class WordAdmin(admin.ModelAdmin):
    list_display = ('arabic', 'translation', 'lesson', 'order')
    list_editable = ('order',)
    list_filter = ('lesson__block', 'lesson')
    search_fields = ('arabic', 'translation', 'transcription')

@admin.register(BlockTest)
class BlockTestAdmin(admin.ModelAdmin):
    list_display = ('block', 'passing_score')
    list_filter = ('block',)