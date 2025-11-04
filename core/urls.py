# core/urls.py

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('api.urls')),

    # PWA файлы - ДОЛЖНЫ БЫТЬ В КОРНЕ!
    path('sw.js', TemplateView.as_view(
        template_name='sw.js', 
        content_type='application/javascript'
    ), name='sw.js'),
    
    path('manifest.json', TemplateView.as_view(
        template_name='manifest.json', 
        content_type='application/json'
    ), name='manifest.json'),

    # Frontend routes
    path('', views.home, name='home'),
    path('app/', views.pwa_app, name='pwa_app'),
    path('login/token/', views.token_login, name='token_login'),
    path('logout/', views.logout_view, name='logout'),

    # Protected routes (require authentication)
    path('dashboard/', views.dashboard, name='dashboard'),
    path('progress/', views.progress_page, name='progress'),
    path('courses/', views.courses_page, name='courses'),
    path('profile/', views.profile_page, name='profile'),

    # Content pages (protected)
    path('app/block/<int:block_id>/', views.block_detail_page, name='block_detail_page'),
    path('app/lesson/<int:lesson_id>/', views.lesson_detail_page, name='lesson_detail_page'),

    # Маршруты для тестов
    path('app/block-test/<int:block_id>/', views.block_test_page, name='block_test_page'),

    # Страница установки PWA
    path('install/', views.install_page, name='install'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
