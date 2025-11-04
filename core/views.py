# core/views.py

from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
import json

def home(request):
    """Главная страница (лендинг)"""
    if request.user.is_authenticated and request.user.is_paid:
        return redirect('dashboard')
    return render(request, 'home.html')

def pwa_app(request):
    """PWA приложение - страница входа"""
    print(f"🔐 PWA App - User: {request.user.username if request.user.is_authenticated else 'Anonymous'}")
    
    # Если пользователь уже авторизован и оплатил - сразу на дашборд
    if request.user.is_authenticated and request.user.is_paid:
        print(f"✅ User already authenticated, redirecting to dashboard")
        return redirect('dashboard')
    
    # Проверяем токен из URL параметра
    token = request.GET.get('token')
    if token:
        user = authenticate(request, token=token)
        if user is not None and user.is_paid:
            login(request, user)
            request.session.save()
            print(f"✅ User logged in via token, redirecting to dashboard")
            return redirect('dashboard')
        else:
            print(f"❌ Token authentication failed")
    
    # Иначе показываем страницу авторизации
    return render(request, 'app.html')

@login_required
def dashboard(request):
    """Dashboard страница - требует авторизации"""
    print(f"🔐 Dashboard - User: {request.user.username}")
    print(f"🔐 Dashboard - Authenticated: {request.user.is_authenticated}")
    print(f"🔐 Dashboard - Is Paid: {request.user.is_paid}")
    
    # Дополнительная проверка оплаты
    if not request.user.is_paid:
        print(f"❌ Dashboard access denied - user not paid: {request.user.username}")
        # Перенаправляем на страницу авторизации вместо 403
        return redirect('pwa_app')
    
    print(f"✅ Dashboard access granted: {request.user.username}")
    return render(request, 'dashboard.html')

@login_required
def progress_page(request):
    """Страница прогресса - требует авторизации"""
    if not request.user.is_paid:
        return redirect('pwa_app')
    return render(request, 'progress.html')

@login_required
def courses_page(request):
    """Страница курсов - требует авторизации"""
    if not request.user.is_paid:
        return redirect('pwa_app')
    return render(request, 'courses.html')

@login_required
def profile_page(request):
    """Страница профиля - требует авторизации"""
    if not request.user.is_paid:
        return redirect('pwa_app')
    return render(request, 'profile.html')

@login_required
def block_detail_page(request, block_id):
    """Страница деталей блока - требует авторизации"""
    if not request.user.is_paid:
        return redirect('pwa_app')
    return render(request, 'block_detail.html')

@login_required
def lesson_detail_page(request, lesson_id):
    """Страница деталей урока - требует авторизации"""
    if not request.user.is_paid:
        return redirect('pwa_app')
    return render(request, 'lesson_detail.html')

@login_required
def block_test_page(request, block_id):
    """Страница теста блока - требует авторизации"""
    if not request.user.is_paid:
        return redirect('pwa_app')
    return render(request, 'block_test.html', {'block_id': block_id})

def install_page(request):
    """Страница установки PWA"""
    return render(request, 'install.html')

def logout_view(request):
    """Выход из системы"""
    logout(request)
    return redirect('home')

def token_login(request):
    """API endpoint для входа по токену"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            token = data.get('token')

            if not token:
                return JsonResponse({'success': False, 'error': 'Токен обязателен'})

            user = authenticate(request, token=token)
            if user is not None and user.is_paid:
                login(request, user)
                request.session.save()

                return JsonResponse({
                    'success': True,
                    'redirect_url': '/dashboard/'
                })
            else:
                return JsonResponse({
                    'success': False,
                    'error': 'Неверный токен или доступ не оплачен'
                })

        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    return JsonResponse({'success': False, 'error': 'Метод не разрешен'})

def handler404(request, exception):
    return render(request, '404.html', status=404)

def handler500(request):
    return render(request, '500.html', status=500)
