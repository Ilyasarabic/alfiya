# content/models.py

from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class Block(models.Model):
    title = models.CharField(max_length=255)
    description = models.TextField()
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order']
    
    def __str__(self):
        return self.title

class Lesson(models.Model):
    block = models.ForeignKey(Block, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['block__order', 'order']
    
    def __str__(self):
        return f"{self.block.title} - {self.title}"

class Word(models.Model):
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='words')
    arabic = models.CharField(max_length=255)
    translation = models.CharField(max_length=255)
    transcription = models.CharField(max_length=255, blank=True)
    audio = models.FileField(upload_to='words/audio/', blank=True, null=True)
    image = models.ImageField(upload_to='words/images/', blank=True, null=True)
    example_verse = models.TextField(blank=True)
    example_translation = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        ordering = ['lesson__block__order', 'lesson__order', 'order']
    
    def __str__(self):
        return f"{self.arabic} - {self.translation}"

class UserProgress(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='progress')
    word = models.ForeignKey(Word, on_delete=models.CASCADE)
    is_learned = models.BooleanField(default=False)
    correct_answers = models.PositiveIntegerField(default=0)
    total_attempts = models.PositiveIntegerField(default=0)
    last_reviewed = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['user', 'word']
    
    @property
    def accuracy(self):
        if self.total_attempts == 0:
            return 0
        return (self.correct_answers / self.total_attempts) * 100

    def save(self, *args, **kwargs):
        # Автоматически помечаем слово как выученное при accuracy >= 80%
        if self.accuracy >= 80 and self.total_attempts >= 3:
            self.is_learned = True
        super().save(*args, **kwargs)

class BlockTest(models.Model):
    block = models.OneToOneField(Block, on_delete=models.CASCADE, related_name='test')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    passing_score = models.PositiveIntegerField(default=80)
    
    def __str__(self):
        return f"Тест: {self.block.title}"

class UserBlockTest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='block_tests')
    block_test = models.ForeignKey(BlockTest, on_delete=models.CASCADE)
    score = models.PositiveIntegerField(default=0)
    is_passed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ['user', 'block_test']