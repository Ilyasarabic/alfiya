//static/js/auth.js

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('auth_token');
        this.user = null;
        this.apiBase = '/api';
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        console.log('Initializing auth...');

        try {
            // 1. Сначала пробуем токен из URL (для PWA)
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            
            if (urlToken) {
                console.log('Found token in URL, verifying...');
                const result = await this.verifyToken(urlToken);
                if (result.valid) {
                    this.token = urlToken;
                    this.user = result.user;
                    localStorage.setItem('auth_token', urlToken);
                    
                    // Убираем токен из URL
                    const newUrl = window.location.pathname;
                    window.history.replaceState({}, '', newUrl);
                    
                    console.log('Authenticated from URL token');
                    this.isInitialized = true;
                    return true;
                }
            }
            
            // 2. Пробуем токен из localStorage
            if (this.token) {
                console.log('Found token in localStorage, verifying...');
                const result = await this.verifyToken(this.token);
                if (result.valid) {
                    this.user = result.user;
                    console.log('Authenticated from localStorage token');
                    this.isInitialized = true;
                    return true;
                } else {
                    // Невалидный токен - удаляем
                    localStorage.removeItem('auth_token');
                    this.token = null;
                }
            }
            
            // 3. 🔥 КРИТИЧЕСКИ ВАЖНО: Пробуем сессию Django с правильными настройками
            try {
                console.log('Trying Django session authentication...');
                const response = await this.apiCall('/dashboard/', {
                    method: 'GET',
                    credentials: 'include'  // 🔥 ОБЯЗАТЕЛЬНО для сессий
                });
                
                if (response && response.user) {
                    this.user = response.user;
                    console.log('Authenticated from Django session');
                    this.isInitialized = true;
                    return true;
                }
            } catch (sessionError) {
                console.log('Django session not available:', sessionError.message);
            }
            
            // Не авторизован
            console.log('User not authenticated');
            this.isInitialized = true;
            return false;
            
        } catch (error) {
            console.error('Auth initialization error:', error);
            this.isInitialized = true;
            return false;
        }
    }

    async apiCall(endpoint, options = {}) {
        const url = `${this.apiBase}${endpoint}`;
        
        // 🔥 КРИТИЧЕСКИ ВАЖНЫЕ НАСТРОЙКИ ДЛЯ СЕССИЙ
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest',
            },
            credentials: 'include',  // 🔥 ОБЯЗАТЕЛЬНО ДЛЯ ОТПРАВКИ COOKIES
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

        // Добавляем токен в заголовки, если есть (для резервного метода)
        if (this.token && !endpoint.includes('/verify_token/')) {
            mergedOptions.headers['Authorization'] = `Token ${this.token}`;
        }

        try {
            console.log(`🔐 Making API call to: ${url}`, { 
                method: mergedOptions.method,
                endpoint: endpoint,
                withCredentials: mergedOptions.credentials === 'include'
            });
            
            const response = await fetch(url, mergedOptions);
            
            // 🔥 ДЕТАЛЬНАЯ ОБРАБОТКА ОТВЕТА
            console.log(`🔐 API Response from ${endpoint}:`, {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });
            
            if (response.status === 403) {
                const errorData = await response.json().catch(() => ({}));
                console.error('❌ Access forbidden:', errorData);
                this.handlePaymentRequired();
                throw new Error(errorData.error || 'Доступ запрещен');
            }
            
            if (response.status === 401) {
                console.error('❌ Unauthorized');
                this.handleUnauthorized();
                throw new Error('Не авторизован');
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`❌ HTTP error! status: ${response.status}`, errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log(`✅ API response from ${endpoint}:`, data);
            return data;
            
        } catch (error) {
            console.error(`💥 API call failed: ${url}`, error);
            throw error;
        }
    }

    async verifyToken(token) {
        try {
            const response = await fetch(`${this.apiBase}/verify_token/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken(),
                },
                credentials: 'include',  // 🔥 ДЛЯ СЕССИЙ
                body: JSON.stringify({ token: token })
            });

            if (!response.ok) {
                return { valid: false };
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Token verification failed:', error);
            return { valid: false };
        }
    }

    getCSRFToken() {
        // Пробуем разные варианты имени куки CSRF
        const csrfCookieNames = ['csrftoken', 'alfiya_csrftoken'];
        
        for (const cookieName of csrfCookieNames) {
            const cookieValue = document.cookie
                .split('; ')
                .find(row => row.startsWith(`${cookieName}=`))
                ?.split('=')[1];
                
            if (cookieValue) {
                console.log(`🔐 Found CSRF token: ${cookieName}`);
                return cookieValue;
            }
        }
        
        console.log('🔐 No CSRF token found');
        return '';
    }

    handlePaymentRequired() {
        console.error('Payment required - user not paid');
        // Более мягкая обработка - не всегда нужно редиректить
        if (confirm('Доступ запрещен. Оплатите доступ для использования приложения. Перейти на главную?')) {
            window.location.href = '/';
        }
    }

    handleUnauthorized() {
        console.log('User unauthorized, clearing auth data...');
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        
        // Перенаправляем на главную
        window.location.href = '/';
    }

    isAuthenticated() {
        return !!(this.user && this.user.is_paid);
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        window.location.href = '/';
    }

    // Вспомогательный метод для проверки статуса
    async checkAuthStatus() {
        try {
            await this.initialize();
            return this.isAuthenticated();
        } catch (error) {
            console.error('Auth status check failed:', error);
            return false;
        }
    }

    // 🔥 НОВЫЙ МЕТОД: Проверка сессии и кук
    async debugSession() {
        console.log('🔐 Debug session info:');
        console.log('🔐 Cookies:', document.cookie);
        console.log('🔐 LocalStorage token:', localStorage.getItem('auth_token'));
        console.log('🔐 User object:', this.user);
        console.log('🔐 CSRF Token:', this.getCSRFToken());
        
        try {
            const testResponse = await fetch('/api/dashboard/', {
                method: 'GET',
                credentials: 'include'
            });
            console.log('🔐 Session test response:', testResponse.status, testResponse.statusText);
        } catch (error) {
            console.error('🔐 Session test failed:', error);
        }
    }
}

// Global auth instance
const auth = new AuthManager();

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing auth...');
    auth.initialize().then(authenticated => {
        console.log('✅ Auth initialization completed, authenticated:', authenticated);
        
        // 🔥 ДЛЯ ОТЛАДКИ: проверяем сессию после инициализации
        if (authenticated) {
            auth.debugSession();
        }
    });
});