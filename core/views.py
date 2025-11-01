# core/views.py

from django.shortcuts import render, redirect
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponseForbidden
import json

def home(request):
    """Главная страница (лендинг)"""
    # Если пользователь уже авторизован, перенаправляем на дашборд
    if request.user.is_authenticated and request.user.is_paid:
        return redirect('dashboard')
    return render(request, 'home.html')

def pwa_app(request):
    """PWA приложение - точка входа"""
    # Проверяем токен из URL параметра
    token = request.GET.get('token')
    
    print(f"🔐 PWA App - Token: {token}")
    print(f"🔐 PWA App - User before auth: {request.user.is_authenticated}")
    print(f"🔐 PWA App - Session key before: {request.session.session_key}")
    
    if token:
        # Пытаемся аутентифицировать пользователя по токену
        user = authenticate(request, token=token)
        if user is not None and user.is_paid:
            login(request, user)
            
            # 🔥 КРИТИЧЕСКИ ВАЖНО: принудительно сохраняем и обновляем сессию
            request.session.save()
            request.session.modified = True
            
            print(f"✅ User logged in: {user.username}")
            print(f"✅ Session key after: {request.session.session_key}")
            print(f"✅ User is paid: {user.is_paid}")
            
            # Перенаправляем на дашборд после успешной аутентификации
            response = redirect('dashboard')
            
            # 🔥 Убедимся, что сессионная кука установлена правильно
            response.set_cookie(
                'alfiya_sessionid',
                request.session.session_key,
                max_age=30*24*60*60,  # 30 дней
                httponly=True,
                samesite='Lax'
            )
            
            return response
        else:
            # Если токен невалидный, показываем ошибку
            print(f"❌ Token authentication failed for token: {token}")
            return render(request, 'app.html', {'error': 'Неверный токен доступа'})
    
    # Если пользователь уже авторизован, перенаправляем на дашборд
    if request.user.is_authenticated and request.user.is_paid:
        print(f"✅ User already authenticated: {request.user.username}")
        return redirect('dashboard')
    
    # Иначе показываем страницу авторизации
    print("🔐 No token found, showing app page")
    return render(request, 'app.html')

@login_required
def dashboard(request):
    """Dashboard страница - требует авторизации"""
    print(f"🔐 Dashboard - User: {request.user.username}")
    print(f"🔐 Dashboard - Authenticated: {request.user.is_authenticated}")
    print(f"🔐 Dashboard - Is Paid: {request.user.is_paid}")
    print(f"🔐 Dashboard - Session key: {request.session.session_key}")
    
    # Дополнительная проверка, что пользователь оплатил доступ
    if not request.user.is_paid:
        print(f"❌ Dashboard access denied - user not paid: {request.user.username}")
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    print(f"✅ Dashboard access granted: {request.user.username}")
    return render(request, 'dashboard.html')

@login_required
def progress_page(request):
    """Страница прогресса - требует авторизации"""
    if not request.user.is_paid:
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    return render(request, 'progress.html')

@login_required
def courses_page(request):
    """Страница курсов - требует авторизации"""
    if not request.user.is_paid:
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    return render(request, 'courses.html')

@login_required
def profile_page(request):
    """Страница профиля - требует авторизации"""
    if not request.user.is_paid:
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    return render(request, 'profile.html')

@login_required
def block_detail_page(request, block_id):
    """Страница деталей блока - требует авторизации"""
    if not request.user.is_paid:
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    return render(request, 'block_detail.html')

@login_required
def lesson_detail_page(request, lesson_id):
    """Страница деталей урока - требует авторизации"""
    print(f"🔐 Lesson Detail - User: {request.user.username}")
    print(f"🔐 Lesson Detail - Is Paid: {request.user.is_paid}")
    print(f"🔐 Lesson Detail - Session: {request.session.session_key}")
    
    if not request.user.is_paid:
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    return render(request, 'lesson_detail.html')

# 🔥 НУЖНЫЙ VIEW ДЛЯ ТЕСТА БЛОКА
@login_required
def block_test_page(request, block_id):
    """Страница теста блока - требует авторизации"""
    print(f"🔐 Block Test Page - User: {request.user.username}, Block: {block_id}")
    
    if not request.user.is_paid:
        return HttpResponseForbidden("Доступ запрещен. Обратитесь в поддержку.")
    
    return render(request, 'block_test.html', {'block_id': block_id})

def logout_view(request):
    """Выход из системы"""
    print(f"🔐 Logout - User: {request.user.username}")
    logout(request)
    return redirect('home')

def token_login(request):
    """API endpoint для входа по токену (для AJAX запросов)"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            token = data.get('token')
            
            if not token:
                return JsonResponse({'success': False, 'error': 'Токен обязателен'})
            
            user = authenticate(request, token=token)
            if user is not None and user.is_paid:
                login(request, user)
                # Сохраняем сессию
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