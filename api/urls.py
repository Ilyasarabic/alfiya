# api/urls.py

from django.urls import path
from . import views

urlpatterns = [
    # Auth & Payment
    path('payment/webhook/', views.payment_webhook, name='payment_webhook'),
    path('create_user/', views.create_user, name='create_user'),
    path('verify_token/', views.verify_token, name='verify_token'),
    
    # User
    path('user/profile/', views.user_profile, name='user_profile'),
    
    # Dashboard & Progress
    path('dashboard/', views.dashboard, name='api_dashboard'),
    path('progress/detail/', views.progress_detail, name='progress_detail'),
    path('progress/detailed/', views.progress_detailed, name='progress_detailed'),
    
    # Content
    path('blocks/<int:block_id>/', views.block_detail, name='block_detail'),
    path('lessons/<int:lesson_id>/', views.lesson_detail, name='lesson_detail'),
    
    # Progress Tracking - ВСЕ POST методы
    path('progress/update/', views.update_progress, name='update_progress'),
    path('lessons/complete/', views.complete_lesson, name='complete_lesson'),
    path('blocks/complete/', views.complete_block, name='complete_block'),
    path('sessions/start/', views.start_study_session, name='start_study_session'),
    path('sessions/end/', views.end_study_session, name='end_study_session'),
    
    # Tests
    path('block-test/<int:block_id>/start/', views.start_block_test, name='start_block_test'),
    path('block-test/<int:test_id>/submit/', views.submit_block_test, name='submit_block_test'),
]