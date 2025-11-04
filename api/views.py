# api/views.py

import hmac
import hashlib
import json
import random
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from django.conf import settings
from django.db import transaction
from django.db.models import Count, Avg, Sum
from django.utils import timezone
from users.models import User
from content.models import Block, Lesson, Word, UserProgress, BlockTest, UserBlockTest
from progress.models import (
    UserStats, DailyProgress, LessonProgress, BlockProgress,
    Achievement, UserAchievement, StudySession
)
from .models import PaymentRecord

# 🔥 ВАЖНО: Импорт для работы с CSRF куками
from django.views.decorators.csrf import ensure_csrf_cookie

@csrf_exempt
@require_POST
def payment_webhook(request):
    """Вебхук для обработки платежей от Продамуса - ТОЛЬКО проверка оплаты"""
    received_signature = request.headers.get('X-Signature')
    if not received_signature:
        return JsonResponse({'error': 'No signature'}, status=400)

    payload = json.loads(request.body.decode('utf-8'))
    expected_signature = hmac.new(
        settings.PAYMENT_SHARED_SECRET.encode(),
        msg=json.dumps(payload, sort_keys=True).encode(),
        digestmod=hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(received_signature, expected_signature):
        return JsonResponse({'error': 'Invalid signature'}, status=400)

    telegram_id = payload.get('telegram_id')
    username = payload.get('username', '')

    try:
        # Сохраняем запись о платеже
        payment_record, created = PaymentRecord.objects.get_or_create(
            telegram_id=telegram_id,
            defaults={
                'username': username,
                'status': 'paid',
                'paid_at': datetime.now()
            }
        )

        if not created:
            payment_record.status = 'paid'
            payment_record.paid_at = datetime.now()
            payment_record.save()

        return JsonResponse({
            'status': 'success',
            'message': 'Payment recorded successfully',
            'telegram_id': telegram_id
        })

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def create_user(request):
    """Создание пользователя после оплаты - вызывается ботом"""
    telegram_id = request.data.get('telegram_id')
    username = request.data.get('username', '')

    if not telegram_id:
        return Response({'error': 'telegram_id required'}, status=400)

    try:
        # 🔥 УБРАНА ПРОВЕРКА ОПЛАТЫ - LeadTech УЖЕ ПРОВЕРИЛ ОПЛАТУ
        # Просто создаем пользователя

        # Проверяем, не создан ли уже пользователь
        existing_user = User.objects.filter(telegram_id=telegram_id).first()
        if existing_user:
            return Response({
                'status': 'success',
                'user_exists': True,
                'app_url': f"https://ilyasarabic.ru/app/?token={existing_user.auth_token}"
            })

        # Создаем пользователя
        with transaction.atomic():
            user = User.objects.create(
                telegram_id=telegram_id,
                username=username,
                telegram_username=username,
                is_paid=True,
                payment_date=timezone.now()
            )

        # Генерируем URL для приложения
        app_url = f"https://ilyasarabic.ru/app/?token={user.auth_token}"

        return Response({
            'status': 'success',
            'user_created': True,
            'app_url': app_url,
            'user_id': user.id
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@permission_classes([AllowAny])
def verify_token(request):
    """Проверка токена доступа"""
    token = request.data.get('token')

    if not token:
        return Response({'error': 'Token required'}, status=400)

    try:
        user = User.objects.get(auth_token=token, is_paid=True)
        return Response({
            'valid': True,
            'user': {
                'id': user.id,
                'username': user.username,
                'telegram_username': user.telegram_username,
                'is_paid': user.is_paid,
                'payment_date': user.payment_date,
            }
        })
    except User.DoesNotExist:
        return Response({'valid': False}, status=404)

@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie  # 🔥 ДОБАВЛЕНО ДЛЯ CSRF ЗАЩИТЫ
def complete_lesson(request):
    """Отметить урок как завершенный"""
    user = request.user

    print(f"🔐 API Complete Lesson - User: {user.username}, Paid: {user.is_paid}")

    lesson_id = request.data.get('lesson_id')
    score = request.data.get('score', 0)

    try:
        lesson = Lesson.objects.get(id=lesson_id)

        # Обновляем прогресс урока
        lesson_progress, created = LessonProgress.objects.get_or_create(
            user=user,
            lesson=lesson
        )
        lesson_progress.is_completed = True
        lesson_progress.completed_at = timezone.now()
        lesson_progress.accuracy = score
        lesson_progress.save()

        # Обновляем прогресс блока
        block_progress, created = BlockProgress.objects.get_or_create(
            user=user,
            block=lesson.block
        )
        block_progress.update_progress()

        # Проверяем, все ли уроки блока завершены
        block_lessons = Lesson.objects.filter(block=lesson.block, is_active=True)
        completed_lessons = LessonProgress.objects.filter(
            user=user,
            lesson__in=block_lessons,
            is_completed=True
        )

        all_lessons_completed = completed_lessons.count() == block_lessons.count()

        return Response({
            'success': True,
            'lesson_completed': True,
            'all_lessons_completed': all_lessons_completed,
            'block_id': lesson.block.id
        })

    except Lesson.DoesNotExist:
        return Response({'error': 'Lesson not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie  # 🔥 ДОБАВЛЕНО ДЛЯ CSRF ЗАЩИТЫ
def complete_block(request):
    """Отметить блок как завершенный и разблокировать следующий"""
    user = request.user

    print(f"🔐 API Complete Block - User: {user.username}, Paid: {user.is_paid}")

    block_id = request.data.get('block_id')

    try:
        block = Block.objects.get(id=block_id)

        # Отмечаем блок завершенным
        block_progress, created = BlockProgress.objects.get_or_create(
            user=user,
            block=block
        )
        block_progress.is_completed = True
        block_progress.completed_at = timezone.now()
        block_progress.save()

        # Находим следующий блок
        next_block = Block.objects.filter(
            order=block.order + 1,
            is_active=True
        ).first()

        # Если есть следующий блок, создаем для него прогресс
        if next_block:
            BlockProgress.objects.get_or_create(
                user=user,
                block=next_block
            )

        return Response({
            'success': True,
            'block_completed': True,
            'next_block_available': next_block is not None,
            'next_block_id': next_block.id if next_block else None
        })

    except Block.DoesNotExist:
        return Response({'error': 'Block not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """Dashboard API - требует авторизации"""
    user = request.user

    print(f"🔐 API Dashboard - User: {user.username}, Paid: {user.is_paid}")

    try:
        # Общая статистика
        total_words = Word.objects.count()
        learned_words = UserProgress.objects.filter(user=user, is_learned=True).count()

        # Статистика из UserStats
        user_stats, _ = UserStats.objects.get_or_create(user=user)

        # Ежедневный прогресс
        today = timezone.now().date()
        daily_progress, _ = DailyProgress.objects.get_or_create(user=user, date=today)

        # Блоки с прогрессом
        blocks = []
        for block in Block.objects.filter(is_active=True).order_by('order'):
            block_words = Word.objects.filter(lesson__block=block)
            learned_block_words = UserProgress.objects.filter(
                user=user,
                word__in=block_words,
                is_learned=True
            ).count()

            # Прогресс блока
            block_progress, _ = BlockProgress.objects.get_or_create(user=user, block=block)

            # Проверяем, пройден ли предыдущий блок
            is_locked = False
            if block.order > 1:
                prev_block = Block.objects.filter(order=block.order-1, is_active=True).first()
                if prev_block:
                    prev_block_progress = BlockProgress.objects.filter(
                        user=user,
                        block=prev_block,
                        is_completed=True
                    ).exists()
                    is_locked = not prev_block_progress

            blocks.append({
                'id': block.id,
                'title': block.title,
                'description': block.description,
                'order': block.order,
                'total_words': block_words.count(),
                'learned_words': learned_block_words,
                'is_locked': is_locked,
                'progress': {
                    'is_completed': block_progress.is_completed,
                    'lessons_completed': block_progress.lessons_completed,
                    'total_lessons': block_progress.total_lessons,
                    'overall_accuracy': block_progress.overall_accuracy,
                }
            })

        # Достижения
        user_achievements = UserAchievement.objects.filter(user=user).select_related('achievement')
        achievements_data = [
            {
                'name': ua.achievement.name,
                'description': ua.achievement.description,
                'icon': ua.achievement.icon,
                'earned_at': ua.earned_at,
            }
            for ua in user_achievements
        ]

        return Response({
            'user': {
                'username': user.username,
                'telegram_username': user.telegram_username,
                'is_paid': user.is_paid,
                'payment_date': user.payment_date,
            },
            'stats': {
                'total_words': total_words,
                'learned_words': learned_words,
                'progress_percentage': round((learned_words / total_words * 100), 2) if total_words > 0 else 0,
                'total_study_time': user_stats.total_study_time,
                'total_sessions': user_stats.total_sessions,
                'current_streak': user_stats.current_streak,
                'longest_streak': user_stats.longest_streak,
                'today_words': daily_progress.words_learned,
                'today_lessons': daily_progress.lessons_completed,
                'today_time': daily_progress.time_studied,
            },
            'blocks': blocks,
            'achievements': achievements_data,
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def progress_detailed(request):
    """Детальная статистика прогресса с графиками"""
    user = request.user

    print(f"🔐 API Progress Detailed - User: {user.username}, Paid: {user.is_paid}")

    try:
        # Основная статистика
        user_stats, _ = UserStats.objects.get_or_create(user=user)
        total_words = Word.objects.count()
        learned_words = UserProgress.objects.filter(user=user, is_learned=True).count()

        # Рассчитываем среднюю точность
        user_progress = UserProgress.objects.filter(user=user)
        average_accuracy = 0
        if user_progress.exists():
            total_accuracy = sum(progress.accuracy for progress in user_progress)
            average_accuracy = round(total_accuracy / user_progress.count(), 1)

        # Прогресс за последние 30 дней
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        daily_progress = DailyProgress.objects.filter(
            user=user,
            date__gte=thirty_days_ago
        ).order_by('date')

        # Данные для графика
        chart_data = []
        for progress in daily_progress:
            chart_data.append({
                'date': progress.date.strftime('%Y-%m-%d'),
                'words_learned': progress.words_learned,
                'lessons_completed': progress.lessons_completed,
                'time_studied': progress.time_studied,
                'accuracy': progress.accuracy,
            })

        # Заполняем пропущенные дни нулями
        today = timezone.now().date()
        complete_chart_data = []
        for i in range(30):
            date = today - timedelta(days=29 - i)
            date_str = date.strftime('%Y-%m-%d')

            existing_data = next((item for item in chart_data if item['date'] == date_str), None)
            if existing_data:
                complete_chart_data.append(existing_data)
            else:
                complete_chart_data.append({
                    'date': date_str,
                    'words_learned': 0,
                    'lessons_completed': 0,
                    'time_studied': 0,
                    'accuracy': 0,
                })

        # Статистика по блокам
        blocks_progress = []
        for block in Block.objects.filter(is_active=True).order_by('order'):
            block_words = Word.objects.filter(lesson__block=block)
            learned_block_words = UserProgress.objects.filter(
                user=user,
                word__in=block_words,
                is_learned=True
            ).count()

            block_progress, _ = BlockProgress.objects.get_or_create(user=user, block=block)

            # Рассчитываем точность для блока
            block_user_progress = UserProgress.objects.filter(user=user, word__in=block_words)
            block_accuracy = 0
            if block_user_progress.exists():
                total_block_accuracy = sum(progress.accuracy for progress in block_user_progress)
                block_accuracy = round(total_block_accuracy / block_user_progress.count(), 1)

            blocks_progress.append({
                'id': block.id,
                'title': block.title,
                'total_words': block_words.count(),
                'learned_words': learned_block_words,
                'progress_percentage': round((learned_block_words / block_words.count() * 100), 2) if block_words.count() > 0 else 0,
                'is_completed': block_progress.is_completed,
                'accuracy': block_accuracy,
            })

        # Статистика по времени суток
        study_sessions = StudySession.objects.filter(user=user, start_time__gte=thirty_days_ago)
        time_distribution = {
            'morning': 0,    # 6:00-12:00
            'afternoon': 0,  # 12:00-18:00
            'evening': 0,    # 18:00-24:00
            'night': 0,      # 0:00-6:00
        }

        for session in study_sessions:
            hour = session.start_time.hour
            if 6 <= hour < 12:
                time_distribution['morning'] += session.duration
            elif 12 <= hour < 18:
                time_distribution['afternoon'] += session.duration
            elif 18 <= hour < 24:
                time_distribution['evening'] += session.duration
            else:
                time_distribution['night'] += session.duration

        # Достижения
        achievements = UserAchievement.objects.filter(user=user).select_related('achievement')
        achievements_list = [
            {
                'name': ua.achievement.name,
                'description': ua.achievement.description,
                'icon': ua.achievement.icon,
                'earned_at': ua.earned_at.strftime('%Y-%m-%d') if ua.earned_at else 'Недавно',
            }
            for ua in achievements
        ]

        # Привычки обучения
        total_study_days = DailyProgress.objects.filter(user=user, words_learned__gt=0).count()
        words_per_day = learned_words / total_study_days if total_study_days > 0 else 0

        # Определяем любимое время для учебы
        favorite_time = 'evening'  # по умолчанию
        if time_distribution:
            favorite_time = max(time_distribution, key=time_distribution.get)

        return Response({
            'overview': {
                'total_words': total_words,
                'learned_words': learned_words,
                'progress_percentage': round((learned_words / total_words * 100), 2) if total_words > 0 else 0,
                'total_study_time': user_stats.total_study_time,
                'total_sessions': user_stats.total_sessions,
                'current_streak': user_stats.current_streak,
                'longest_streak': user_stats.longest_streak,
                'average_accuracy': average_accuracy,
            },
            'chart_data': complete_chart_data,
            'blocks_progress': blocks_progress,
            'time_distribution': time_distribution,
            'achievements': achievements_list,
            'study_habits': {
                'favorite_time': favorite_time,
                'average_session_time': user_stats.total_study_time / user_stats.total_sessions if user_stats.total_sessions > 0 else 0,
                'words_per_day': round(words_per_day, 1),
                'total_study_days': total_study_days,
            }
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def progress_detail(request):
    """Детальная статистика прогресса - требует авторизации"""
    user = request.user

    print(f"🔐 API Progress Detail - User: {user.username}, Paid: {user.is_paid}")

    try:
        # Еженедельный прогресс
        week_ago = timezone.now().date() - timedelta(days=7)
        weekly_progress = DailyProgress.objects.filter(
            user=user,
            date__gte=week_ago
        ).order_by('date')

        weekly_data = [
            {
                'date': progress.date.strftime('%Y-%m-%d'),
                'words_learned': progress.words_learned,
                'lessons_completed': progress.lessons_completed,
                'time_studied': progress.time_studied,
                'accuracy': progress.accuracy,
            }
            for progress in weekly_progress
        ]

        # Статистика по блокам
        block_progress = BlockProgress.objects.filter(user=user).select_related('block')
        blocks_data = []
        for bp in block_progress:
            block_words = Word.objects.filter(lesson__block=bp.block)
            learned_words = UserProgress.objects.filter(
                user=user,
                word__in=block_words,
                is_learned=True
            ).count()

            blocks_data.append({
                'block_id': bp.block.id,
                'title': bp.block.title,
                'is_completed': bp.is_completed,
                'lessons_completed': bp.lessons_completed,
                'total_lessons': bp.total_lessons,
                'learned_words': learned_words,
                'total_words': block_words.count(),
                'overall_accuracy': bp.overall_accuracy,
            })

        # Последние сессии
        recent_sessions = StudySession.objects.filter(user=user).order_by('-start_time')[:5]
        sessions_data = [
            {
                'start_time': session.start_time.strftime('%Y-%m-%d %H:%M'),
                'duration': session.duration,
                'lessons_count': session.lessons_studied.count(),
                'words_count': session.words_reviewed.count(),
                'accuracy': session.average_accuracy,
            }
            for session in recent_sessions
        ]

        return Response({
            'weekly_progress': weekly_data,
            'blocks_progress': blocks_data,
            'recent_sessions': sessions_data,
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def block_detail(request, block_id):
    """Детали блока - требует авторизации"""
    user = request.user

    print(f"🔐 API Block Detail - User: {user.username}, Paid: {user.is_paid}")

    try:
        block = Block.objects.get(id=block_id)
        lessons = []

        # Получаем все уроки блока в правильном порядке
        block_lessons = block.lessons.filter(is_active=True).order_by('order')

        for index, lesson in enumerate(block_lessons):
            lesson_words = []
            lesson_progress, _ = LessonProgress.objects.get_or_create(
                user=user,
                lesson=lesson
            )

            # ПРОВЕРКА БЛОКИРОВКИ УРОКА - ИСПРАВЛЕННАЯ ЛОГИКА
            is_locked = False
            if index > 0:  # Все уроки кроме первого
                prev_lesson = block_lessons.filter(order=lesson.order-1).first()
                if prev_lesson:
                    prev_lesson_progress = LessonProgress.objects.filter(
                        user=user,
                        lesson=prev_lesson,
                        is_completed=True
                    ).first()
                    is_locked = not prev_lesson_progress or not prev_lesson_progress.is_completed

            for word in lesson.words.all().order_by('order'):
                progress, _ = UserProgress.objects.get_or_create(
                    user=user,
                    word=word
                )

                lesson_words.append({
                    'id': word.id,
                    'arabic': word.arabic,
                    'translation': word.translation,
                    'transcription': word.transcription,
                    'audio_url': word.audio.url if word.audio else None,
                    'image_url': word.image.url if word.image else None,
                    'example_verse': word.example_verse,
                    'example_translation': word.example_translation,
                    'is_learned': progress.is_learned,
                    'accuracy': progress.accuracy,
                })

            lessons.append({
                'id': lesson.id,
                'title': lesson.title,
                'order': lesson.order,
                'is_locked': is_locked,
                'progress': {
                    'is_completed': lesson_progress.is_completed,
                    'accuracy': lesson_progress.accuracy,
                    'time_spent': lesson_progress.time_spent,
                },
                'words': lesson_words,
            })

        return Response({
            'block': {
                'id': block.id,
                'title': block.title,
                'description': block.description,
            },
            'lessons': lessons,
        })

    except Block.DoesNotExist:
        return Response({'error': 'Block not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def lesson_detail(request, lesson_id):
    """Детали урока - требует авторизации"""
    user = request.user

    print(f"🔐 API Lesson Detail - User: {user.username}, Paid: {user.is_paid}")

    try:
        lesson = Lesson.objects.get(id=lesson_id)

        # ПРОВЕРКА БЛОКИРОВКИ УРОКА ПЕРЕД ЗАГРУЗКОЙ
        if lesson.order > 1:
            prev_lesson = Lesson.objects.filter(
                block=lesson.block,
                order=lesson.order-1
            ).first()
            if prev_lesson:
                prev_lesson_progress = LessonProgress.objects.filter(
                    user=user,
                    lesson=prev_lesson,
                    is_completed=True
                ).first()
                if not prev_lesson_progress or not prev_lesson_progress.is_completed:
                    return Response({
                        'error': 'Урок заблокирован. Сначала завершите предыдущий урок.',
                        'is_locked': True
                    }, status=403)

        words_data = []

        lesson_progress, _ = LessonProgress.objects.get_or_create(
            user=user,
            lesson=lesson
        )

        for word in lesson.words.all().order_by('order'):
            progress, _ = UserProgress.objects.get_or_create(
                user=user,
                word=word
            )

            words_data.append({
                'id': word.id,
                'arabic': word.arabic,
                'translation': word.translation,
                'transcription': word.transcription,
                'audio_url': word.audio.url if word.audio else None,
                'image_url': word.image.url if word.image else None,
                'example_verse': word.example_verse,
                'example_translation': word.example_translation,
                'is_learned': progress.is_learned,
                'accuracy': progress.accuracy,
            })

        return Response({
            'lesson': {
                'id': lesson.id,
                'title': lesson.title,
                'block_title': lesson.block.title,
                'progress': {
                    'is_completed': lesson_progress.is_completed,
                    'accuracy': lesson_progress.accuracy,
                    'time_spent': lesson_progress.time_spent,
                }
            },
            'words': words_data,
        })

    except Lesson.DoesNotExist:
        return Response({'error': 'Lesson not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie  # 🔥 ДОБАВЛЕНО ДЛЯ CSRF ЗАЩИТЫ
def update_progress(request):
    """Обновление прогресса после упражнения - требует авторизации"""
    user = request.user

    # 🔥 ДЕТАЛЬНАЯ ОТЛАДКА
    print(f"🔐 API Update Progress - User: {user.username}")
    print(f"🔐 API Update Progress - Authenticated: {request.user.is_authenticated}")
    print(f"🔐 API Update Progress - Is Paid: {user.is_paid}")
    print(f"🔐 API Update Progress - Session ID: {request.session.session_key}")
    print(f"🔐 API Update Progress - Session keys: {list(request.session.keys())}")

    word_id = request.data.get('word_id')
    is_correct = request.data.get('is_correct', False)
    time_spent = request.data.get('time_spent', 0)  # в секундах
    lesson_id = request.data.get('lesson_id')

    print(f"🔐 API Update Progress - Data: word_id={word_id}, is_correct={is_correct}, lesson_id={lesson_id}")

    try:
        word = Word.objects.get(id=word_id)
        lesson = Lesson.objects.get(id=lesson_id) if lesson_id else None

        with transaction.atomic():
            # Обновляем прогресс слова
            progress, created = UserProgress.objects.get_or_create(
                user=user,
                word=word
            )

            progress.total_attempts += 1
            if is_correct:
                progress.correct_answers += 1

            # Сохраняем - автоматически проверит is_learned в модели
            progress.save()

            # Обновляем прогресс урока
            if lesson:
                lesson_progress, _ = LessonProgress.objects.get_or_create(
                    user=user,
                    lesson=lesson
                )

                # Пересчитываем точность урока на основе слов
                lesson_words_progress = UserProgress.objects.filter(
                    user=user,
                    word__lesson=lesson
                )

                if lesson_words_progress.exists():
                    total_accuracy = sum(p.accuracy for p in lesson_words_progress)
                    lesson_progress.accuracy = total_accuracy / lesson_words_progress.count()

                # Добавляем время
                lesson_progress.time_spent += time_spent // 60  # конвертируем в минуты

                # Проверяем, завершен ли урок (все слова выучены)
                learned_words = UserProgress.objects.filter(
                    user=user,
                    word__lesson=lesson,
                    is_learned=True
                ).count()
                total_words = lesson.words.count()

                if learned_words == total_words and total_words > 0:
                    lesson_progress.is_completed = True
                    lesson_progress.completed_at = timezone.now()

                lesson_progress.save()

            # Обновляем ежедневный прогресс
            today = timezone.now().date()
            daily_progress, _ = DailyProgress.objects.get_or_create(
                user=user,
                date=today
            )

            if is_correct and created:
                daily_progress.words_learned += 1

            daily_progress.time_studied += time_spent // 60

            # Пересчитываем среднюю точность за день
            today_progress = UserProgress.objects.filter(
                user=user,
                last_reviewed__date=today
            )
            if today_progress.count() > 0:
                daily_progress.accuracy = sum(p.accuracy for p in today_progress) / today_progress.count()

            daily_progress.save()

            # Обновляем UserStats
            user_stats, _ = UserStats.objects.get_or_create(user=user)
            user_stats.total_study_time += time_spent // 60
            user_stats.save()

            # Проверяем достижения
            check_achievements(user)

        print(f"✅ API Update Progress - Success: word_id={word_id}")
        return Response({
            'success': True,
            'progress': {
                'is_learned': progress.is_learned,
                'accuracy': progress.accuracy,
                'correct_answers': progress.correct_answers,
                'total_attempts': progress.total_attempts,
            }
        })

    except Word.DoesNotExist:
        print(f"❌ API Update Progress - Word not found: {word_id}")
        return Response({'error': 'Word not found'}, status=404)
    except Lesson.DoesNotExist:
        print(f"❌ API Update Progress - Lesson not found: {lesson_id}")
        return Response({'error': 'Lesson not found'}, status=404)
    except Exception as e:
        print(f"❌ API Update Progress - Error: {str(e)}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie  # 🔥 ДОБАВЛЕНО ДЛЯ CSRF ЗАЩИТЫ
def start_study_session(request):
    """Начало сессии изучения - требует авторизации"""
    user = request.user

    print(f"🔐 API Start Session - User: {user.username}, Paid: {user.is_paid}")

    session = StudySession.objects.create(user=user)

    return Response({
        'session_id': session.id,
        'start_time': session.start_time,
    })

@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie  # 🔥 ДОБАВЛЕНО ДЛЯ CSRF ЗАЩИТЫ
def end_study_session(request):
    """Завершение сессии изучения - требует авторизации"""
    user = request.user

    print(f"🔐 API End Session - User: {user.username}, Paid: {user.is_paid}")

    session_id = request.data.get('session_id')
    lessons_studied = request.data.get('lessons_studied', [])
    words_reviewed = request.data.get('words_reviewed', [])
    average_accuracy = request.data.get('average_accuracy', 0)

    try:
        session = StudySession.objects.get(id=session_id, user=user)
        session.end_time = timezone.now()
        session.average_accuracy = average_accuracy

        # Добавляем уроки и слова
        if lessons_studied:
            session.lessons_studied.set(lessons_studied)
        if words_reviewed:
            session.words_reviewed.set(words_reviewed)

        session.save()

        # Обновляем UserStats
        user_stats, _ = UserStats.objects.get_or_create(user=user)
        user_stats.total_sessions += 1
        user_stats.save()

        return Response({
            'success': True,
            'session': {
                'id': session.id,
                'duration': session.duration,
                'lessons_count': session.lessons_studied.count(),
                'words_count': session.words_reviewed.count(),
            }
        })

    except StudySession.DoesNotExist:
        return Response({'error': 'Session not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def start_block_test(request, block_id):
    """Начало теста блока - требует авторизации"""
    user = request.user

    print(f"🔐 API Start Block Test - User: {user.username}, Paid: {user.is_paid}")

    try:
        block = Block.objects.get(id=block_id)
        block_test, created = BlockTest.objects.get_or_create(block=block)

        # Проверяем, завершены ли все уроки блока
        block_lessons = Lesson.objects.filter(block=block, is_active=True)
        completed_lessons = LessonProgress.objects.filter(
            user=user,
            lesson__in=block_lessons,
            is_completed=True
        )

        if completed_lessons.count() < block_lessons.count():
            return Response({
                'error': 'Сначала завершите все уроки этого блока',
                'lessons_completed': completed_lessons.count(),
                'total_lessons': block_lessons.count()
            }, status=403)

        # Выбираем 10 случайных слов из блока
        block_words = Word.objects.filter(lesson__block=block)
        test_words = random.sample(list(block_words), min(10, block_words.count()))

        test_data = []
        for word in test_words:
            test_data.append({
                'id': word.id,
                'arabic': word.arabic,
                'audio_url': word.audio.url if word.audio else None,
                'transcription': word.transcription,
            })

        return Response({
            'test_id': block_test.id,
            'title': block_test.title,
            'description': block_test.description,
            'passing_score': block_test.passing_score,
            'words': test_data,
        })

    except Block.DoesNotExist:
        return Response({'error': 'Block not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
@ensure_csrf_cookie  # 🔥 ДОБАВЛЕНО ДЛЯ CSRF ЗАЩИТЫ
def submit_block_test(request, test_id):
    """Отправка результатов теста блока - требует авторизации"""
    user = request.user

    print(f"🔐 API Submit Block Test - User: {user.username}, Paid: {user.is_paid}")

    try:
        block_test = BlockTest.objects.get(id=test_id)
        user_answers = request.data.get('answers', {})

        correct_answers = 0
        total_questions = len(user_answers)

        # Проверяем ответы
        for word_id, user_translation in user_answers.items():
            try:
                word = Word.objects.get(id=word_id)
                # Простая проверка - можно улучшить
                if user_translation.lower().strip() == word.translation.lower().strip():
                    correct_answers += 1
            except Word.DoesNotExist:
                continue

        score = (correct_answers / total_questions * 100) if total_questions > 0 else 0
        is_passed = score >= block_test.passing_score

        # Сохраняем результат теста
        user_test, created = UserBlockTest.objects.get_or_create(
            user=user,
            block_test=block_test
        )
        user_test.score = score
        user_test.is_passed = is_passed
        user_test.save()

        # Обновляем прогресс блока
        if is_passed:
            block_progress, _ = BlockProgress.objects.get_or_create(
                user=user,
                block=block_test.block
            )
            block_progress.is_completed = True
            block_progress.completed_at = timezone.now()
            block_progress.save()

            # Разблокируем следующий блок
            next_block = Block.objects.filter(
                order=block_test.block.order + 1,
                is_active=True
            ).first()

            if next_block:
                BlockProgress.objects.get_or_create(
                    user=user,
                    block=next_block
                )

        return Response({
            'score': round(score, 2),
            'is_passed': is_passed,
            'correct_answers': correct_answers,
            'total_questions': total_questions,
            'passing_score': block_test.passing_score,
        })

    except BlockTest.DoesNotExist:
        return Response({'error': 'Test not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
@authentication_classes([SessionAuthentication])
@permission_classes([IsAuthenticated])
def user_profile(request):
    """Профиль пользователя - требует авторизации"""
    user = request.user

    print(f"🔐 API User Profile - User: {user.username}, Paid: {user.is_paid}")

    try:
        # Получаем статистику пользователя
        user_stats, _ = UserStats.objects.get_or_create(user=user)

        # Общая статистика
        total_words = Word.objects.count()
        learned_words = UserProgress.objects.filter(user=user, is_learned=True).count()

        # Прогресс по блокам
        block_progress = BlockProgress.objects.filter(user=user).select_related('block')
        blocks_data = []
        for bp in block_progress:
            block_words = Word.objects.filter(lesson__block=bp.block)
            learned_block_words = UserProgress.objects.filter(
                user=user,
                word__in=block_words,
                is_learned=True
            ).count()

            blocks_data.append({
                'block_id': bp.block.id,
                'title': bp.block.title,
                'is_completed': bp.is_completed,
                'learned_words': learned_block_words,
                'total_words': block_words.count(),
                'overall_accuracy': bp.overall_accuracy,
            })

        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'telegram_username': user.telegram_username,
                'is_paid': user.is_paid,
                'payment_date': user.payment_date,
                'date_joined': user.date_joined,
            },
            'stats': {
                'total_words': total_words,
                'learned_words': learned_words,
                'progress_percentage': round((learned_words / total_words * 100), 2) if total_words > 0 else 0,
                'total_study_time': user_stats.total_study_time,
                'total_sessions': user_stats.total_sessions,
                'current_streak': user_stats.current_streak,
                'longest_streak': user_stats.longest_streak,
            },
            'blocks_progress': blocks_data,
        })

    except Exception as e:
        return Response({'error': str(e)}, status=500)

def check_achievements(user):
    """Проверка и выдача достижений"""
    try:
        learned_words_count = UserProgress.objects.filter(user=user, is_learned=True).count()

        # Достижение за первое слово
        if learned_words_count >= 1:
            achievement, created = Achievement.objects.get_or_create(
                achievement_type='first_words',
                defaults={
                    'name': 'Первый шаг',
                    'description': 'Выучите первое слово',
                    'icon': '🎯',
                }
            )
            if created:
                UserAchievement.objects.get_or_create(user=user, achievement=achievement)

        # Достижение за 10 слов
        if learned_words_count >= 10:
            achievement, created = Achievement.objects.get_or_create(
                achievement_type='words_10',
                defaults={
                    'name': 'Десять слов',
                    'description': 'Выучите 10 слов',
                    'icon': '🔟',
                }
            )
            if created:
                UserAchievement.objects.get_or_create(user=user, achievement=achievement)

        # Достижение за 50 слов
        if learned_words_count >= 50:
            achievement, created = Achievement.objects.get_or_create(
                achievement_type='words_50',
                defaults={
                    'name': 'Пятьдесят слов',
                    'description': 'Выучите 50 слов',
                    'icon': '🌟',
                }
            )
            if created:
                UserAchievement.objects.get_or_create(user=user, achievement=achievement)

        # Достижение за 100 слов
        if learned_words_count >= 100:
            achievement, created = Achievement.objects.get_or_create(
                achievement_type='words_100',
                defaults={
                    'name': 'Сто слов',
                    'description': 'Выучите 100 слов',
                    'icon': '💯',
                }
            )
            if created:
                UserAchievement.objects.get_or_create(user=user, achievement=achievement)

    except Exception as e:
        print(f"Achievement check error: {e}")
