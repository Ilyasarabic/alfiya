# progress/models.py

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from content.models import Block, Lesson, Word

User = get_user_model()

class UserStats(models.Model):
    """Общая статистика пользователя"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='stats')
    total_study_time = models.PositiveIntegerField(default=0)  # в минутах
    total_sessions = models.PositiveIntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)  # текущая серия дней
    longest_streak = models.PositiveIntegerField(default=0)
    last_active = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Статистика пользователя'
        verbose_name_plural = 'Статистика пользователей'

    def __str__(self):
        return f"Статистика {self.user.username}"

class DailyProgress(models.Model):
    """Ежедневный прогресс"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='daily_progress')
    date = models.DateField(auto_now_add=True)
    words_learned = models.PositiveIntegerField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    time_studied = models.PositiveIntegerField(default=0)  # в минутах
    accuracy = models.FloatField(default=0)  # средняя точность за день
    
    class Meta:
        unique_together = ['user', 'date']
        verbose_name = 'Ежедневный прогресс'
        verbose_name_plural = 'Ежедневный прогресс'
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.username} - {self.date}"

class LessonProgress(models.Model):
    """Прогресс по уроку"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lesson_progress')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='user_progress')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    accuracy = models.FloatField(default=0)
    time_spent = models.PositiveIntegerField(default=0)  # в минутах
    
    class Meta:
        unique_together = ['user', 'lesson']
        verbose_name = 'Прогресс урока'
        verbose_name_plural = 'Прогресс уроков'

    def __str__(self):
        status = "✓" if self.is_completed else "✗"
        return f"{self.user.username} - {self.lesson.title} {status}"

    def save(self, *args, **kwargs):
        # При завершении урока обновляем прогресс блока
        if self.is_completed and not self.completed_at:
            self.completed_at = timezone.now()
            
            # Обновляем BlockProgress
            block_progress, created = BlockProgress.objects.get_or_create(
                user=self.user,
                block=self.lesson.block
            )
            block_progress.update_progress()
            
        super().save(*args, **kwargs)

class BlockProgress(models.Model):
    """Прогресс по блоку"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='block_progress')
    block = models.ForeignKey(Block, on_delete=models.CASCADE, related_name='user_progress')
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    overall_accuracy = models.FloatField(default=0)
    lessons_completed = models.PositiveIntegerField(default=0)
    total_lessons = models.PositiveIntegerField(default=0)
    
    class Meta:
        unique_together = ['user', 'block']
        verbose_name = 'Прогресс блока'
        verbose_name_plural = 'Прогресс блоков'

    def __str__(self):
        status = "✓" if self.is_completed else "✗"
        return f"{self.user.username} - {self.block.title} {status}"

    def save(self, *args, **kwargs):
        # Автоматически вычисляем общее количество уроков
        self.total_lessons = self.block.lessons.filter(is_active=True).count()
        super().save(*args, **kwargs)

    def update_progress(self):
        """Обновляет прогресс блока на основе завершенных уроков"""
        from django.utils import timezone
        
        completed_lessons = LessonProgress.objects.filter(
            user=self.user,
            lesson__block=self.block,
            is_completed=True
        )
        
        self.lessons_completed = completed_lessons.count()
        
        # Рассчитываем общую точность
        if completed_lessons.exists():
            total_accuracy = sum(lesson.accuracy for lesson in completed_lessons)
            self.overall_accuracy = round(total_accuracy / completed_lessons.count(), 1)
        
        # Проверяем, завершен ли блок
        self.is_completed = self.lessons_completed >= self.total_lessons
        if self.is_completed and not self.completed_at:
            self.completed_at = timezone.now()
        
        self.save()

class Achievement(models.Model):
    """Достижения пользователя"""
    ACHIEVEMENT_TYPES = [
        ('first_lesson', 'Первый урок'),
        ('perfect_lesson', 'Идеальный урок'),
        ('streak_3', 'Серия 3 дня'),
        ('streak_7', 'Серия 7 дней'),
        ('streak_30', 'Серия 30 дней'),
        ('block_completed', 'Блок завершен'),
        ('words_100', '100 слов выучено'),
        ('words_500', '500 слов выучено'),
        ('words_1000', '1000 слов выучено'),
        ('speed_learner', 'Быстрый ученик'),
    ]
    
    name = models.CharField(max_length=100)
    description = models.TextField()
    achievement_type = models.CharField(max_length=50, choices=ACHIEVEMENT_TYPES)
    icon = models.CharField(max_length=50, default='🏆')  # эмодзи или путь к иконке
    condition = models.JSONField(default=dict)  # условия получения
    
    class Meta:
        verbose_name = 'Достижение'
        verbose_name_plural = 'Достижения'

    def __str__(self):
        return self.name

class UserAchievement(models.Model):
    """Достижения, полученные пользователем"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE)
    earned_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'achievement']
        verbose_name = 'Полученное достижение'
        verbose_name_plural = 'Полученные достижения'

    def __str__(self):
        return f"{self.user.username} - {self.achievement.name}"

class StudySession(models.Model):
    """Сессия изучения"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='study_sessions')
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    duration = models.PositiveIntegerField(default=0)  # в минутах
    lessons_studied = models.ManyToManyField(Lesson, blank=True)
    words_reviewed = models.ManyToManyField(Word, blank=True)
    average_accuracy = models.FloatField(default=0)
    
    class Meta:
        verbose_name = 'Сессия изучения'
        verbose_name_plural = 'Сессии изучения'
        ordering = ['-start_time']

    def __str__(self):
        return f"{self.user.username} - {self.start_time.strftime('%Y-%m-%d %H:%M')}"

    def save(self, *args, **kwargs):
        if self.end_time and self.start_time:
            delta = self.end_time - self.start_time
            self.duration = delta.total_seconds() // 60
        super().save(*args, **kwargs)