// static/js/dashboard.js

// Объявляем функцию глобально
window.initializeDashboard = async function() {
    console.log('Initializing dashboard...');
    await dashboard.initialize();
};

class Dashboard {
    constructor() {
        this.auth = auth;
        this.dashboardData = null;
    }

    async initialize() {
        console.log('Dashboard initialization started');

        // Инициализируем аутентификацию
        await this.auth.initialize();

        // Загружаем данные дашборда
        await this.loadDashboardData();

        // Рендерим дашборд
        this.renderDashboard();

        // Настраиваем обработчики событий
        this.setupEventListeners();

        console.log('Dashboard initialized successfully');
    }

    async loadDashboardData() {
        try {
            console.log('Loading dashboard data...');
            this.showLoadingState();

            this.dashboardData = await this.auth.apiCall('/dashboard/');

            if (!this.dashboardData) {
                throw new Error('Failed to load dashboard data');
            }

            console.log('Dashboard data loaded:', this.dashboardData);
            this.hideLoadingState();
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showErrorState('Не удалось загрузить данные');
        }
    }

    renderDashboard() {
        if (!this.dashboardData) {
            console.log('No dashboard data to render');
            return;
        }

        console.log('Rendering dashboard...');
        this.renderUserInfo();
        this.renderStats();
        this.renderBlocks();
        this.setupAnimations();
    }

    renderUserInfo() {
        const user = this.dashboardData.user;
        const stats = this.dashboardData.stats;
        const avatar = document.getElementById('user-avatar');
        const greeting = document.getElementById('greeting-text');
        const motivation = document.getElementById('user-motivation');

        // Set avatar with first letter of username
        if (user && user.username) {
            avatar.textContent = user.username.charAt(0).toUpperCase();
        } else {
            avatar.textContent = '👋';
        }

        // Set greeting based on time
        const hour = new Date().getHours();
        let timeGreeting = 'السلام عليكم';

        if (hour < 6) timeGreeting = 'تهجد مبارك';
        else if (hour < 12) timeGreeting = 'صباح الخير';
        else if (hour < 18) timeGreeting = 'مساء الخير';
        else timeGreeting = 'مساء الخير';

        const userName = user?.username || 'Ученик';
        greeting.textContent = `${timeGreeting}, ${userName}!`;

        // Real motivation based on data
        const progress = stats.progress_percentage || 0;
        const todayWords = stats.today_words || 0;
        const streak = stats.current_streak || 0;

        if (todayWords > 0) {
            motivation.textContent = `Сегодня: ${todayWords} новых слов`;
        } else if (streak > 0) {
            motivation.textContent = `Не прерывайте серию ${streak} дней!`;
        } else if (progress === 0) {
            motivation.textContent = 'Начните с первого блока';
        } else if (progress < 25) {
            motivation.textContent = 'Отличное начало! Продолжайте!';
        } else if (progress < 50) {
            motivation.textContent = 'Вы на четверти пути!';
        } else if (progress < 75) {
            motivation.textContent = 'Больше половины пройдено!';
        } else {
            motivation.textContent = 'Почти у цели! Осталось немного!';
        }
    }

    renderStats() {
        const stats = this.dashboardData.stats;

        // Learned words
        document.getElementById('learned-words').textContent = stats.learned_words || 0;

        // Progress bar
        const progressBar = document.getElementById('words-progress-bar');
        const progressPercentage = stats.progress_percentage || 0;
        progressBar.style.width = `${progressPercentage}%`;

        // Today's words
        document.getElementById('today-words').textContent = stats.today_words || 0;

        // Weekly trend - real logic
        const trendElement = document.getElementById('trend-text');
        if (stats.today_words > 0) {
            trendElement.innerHTML = `
                <i class="fas fa-arrow-up"></i>
                +${stats.today_words} с начала дня
            `;
            trendElement.className = 'stat-trend positive';
        } else if (stats.current_streak > 0) {
            trendElement.innerHTML = `
                <i class="fas fa-fire"></i>
                Серия ${stats.current_streak} дней
            `;
            trendElement.className = 'stat-trend neutral';
        } else {
            trendElement.innerHTML = `
                <i class="fas fa-seedling"></i>
                Готов к обучению
            `;
            trendElement.className = 'stat-trend neutral';
        }
    }

    renderBlocks() {
        const container = document.getElementById('blocks-container');
        const blocks = this.dashboardData.blocks;

        if (!blocks || blocks.length === 0) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-book-open"></i>
                    <p>Учебные блоки временно недоступны</p>
                    <button onclick="dashboard.refreshData()">Обновить</button>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        blocks.forEach(block => {
            const blockElement = this.createBlockElement(block);
            container.appendChild(blockElement);
        });
    }

    createBlockElement(block) {
        const div = document.createElement('div');
        div.className = `block-card ${block.is_locked ? 'locked' : 'active'}`;

        // Reliable progress calculation
        let progressPercentage = 0;
        let progressText = '';
        let lessonsCompleted = 0;
        let totalLessons = 0;

        if (block.progress) {
            lessonsCompleted = block.progress.lessons_completed || 0;
            totalLessons = block.progress.total_lessons || 0;
        }

        if (totalLessons > 0) {
            progressPercentage = Math.round((lessonsCompleted / totalLessons) * 100);
            progressText = `${lessonsCompleted}/${totalLessons} уроков`;
        } else if (block.total_words > 0) {
            const learnedWords = block.learned_words || 0;
            progressPercentage = Math.round((learnedWords / block.total_words) * 100);
            progressText = `${learnedWords}/${block.total_words} слов`;
        } else {
            progressText = 'Новый блок';
            progressPercentage = 0;
        }

        const statusHtml = block.is_locked ?
            `<span class="status-locked">
                <i class="fas fa-lock"></i>
                Заблокировано
            </span>` :
            `<span class="status-active">
                <i class="fas fa-play"></i>
                Доступно
            </span>`;

        const lockOverlay = block.is_locked ?
            `<div class="lock-overlay">
                <div class="lock-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <div class="lock-text">
                    ${this.getUnlockMessage(block)}
                </div>
            </div>` : '';

        div.innerHTML = `
            <div class="block-header">
                <div class="block-title">
                    <div class="block-icon">
                        <i class="fas ${block.is_locked ? 'fa-lock' : lessonsCompleted > 0 ? 'fa-play-circle' : 'fa-play'}"></i>
                    </div>
                    ${block.title || 'Блок обучения'}
                </div>
                <div class="block-status">
                    ${statusHtml}
                </div>
            </div>
            <div class="block-description">
                ${block.description || 'Изучение новых слов'}
            </div>
            <div class="block-progress">
                <div class="progress-text">
                    ${progressText}
                </div>
                <div class="progress-percent">${progressPercentage}%</div>
            </div>
            ${lockOverlay}
        `;

        if (!block.is_locked) {
            div.addEventListener('click', () => this.openBlock(block.id));
            div.style.cursor = 'pointer';
        }

        return div;
    }

    getUnlockMessage(block) {
        if (block.order === 1) {
            return 'Начните обучение';
        } else {
            return 'Пройдите предыдущий блок для разблокировки';
        }
    }

    openBlock(blockId) {
        console.log('Opening block:', blockId);
        window.location.href = `/app/block/${blockId}/`;
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Navigation
        const navHome = document.getElementById('nav-home');
        if (navHome) {
            navHome.addEventListener('click', (e) => {
                e.preventDefault();
                this.setActiveNav('home');
            });
        }

        // Refresh on pull down
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });

        document.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const diff = touchY - touchStartY;

            if (diff > 100 && window.scrollY === 0) {
                this.refreshData();
            }
        });
    }

    setActiveNav(navItem) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNav = document.getElementById(`nav-${navItem}`);
        if (activeNav) {
            activeNav.classList.add('active');
        }
    }

    setupAnimations() {
        // Add floating animation to stat cards with delays
        const statCards = document.querySelectorAll('.stat-card');
        statCards.forEach((card, index) => {
            card.style.animationDelay = `${index * 0.2}s`;
            card.classList.add('floating');
        });

        // Add click animations
        const interactiveElements = document.querySelectorAll('.stat-card, .profile-btn, .block-card.active');
        interactiveElements.forEach(element => {
            element.addEventListener('click', function() {
                this.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            });
        });
    }

    showLoadingState() {
        document.body.classList.add('loading');
    }

    hideLoadingState() {
        document.body.classList.remove('loading');
    }

    showErrorState(message) {
        const container = document.getElementById('blocks-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button onclick="dashboard.refreshData()">Попробовать снова</button>
                </div>
            `;
        }
    }

    async refreshData() {
        console.log('Refreshing dashboard data...');
        await this.loadDashboardData();
        this.renderDashboard();
    }
}

// Создаем глобальный экземпляр dashboard
window.dashboard = new Dashboard();

// 🔥 ИСПРАВЛЕННЫЙ Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        // ✅ ПРАВИЛЬНЫЙ ПУТЬ - /sw.js (без static/)
        navigator.serviceWorker.register('/sw.js')
            .then(function(registration) {
                console.log('✅ ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(function(error) {
                console.log('❌ ServiceWorker registration failed: ', error);
            });
    });
}

// Function to open profile (called from HTML)
window.openProfile = function() {
    console.log('Opening profile...');
    window.location.href = "{% url 'profile' %}";
};

// PWA Display Mode Detection
if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('🚀 Running in PWA standalone mode');
    document.body.classList.add('pwa-standalone');
    
    // Добавляем специальные стили для PWA режима
    const style = document.createElement('style');
    style.textContent = `
        .pwa-standalone .bottom-nav {
            padding-bottom: env(safe-area-inset-bottom);
        }
        .pwa-standalone header {
            padding-top: env(safe-area-inset-top);
        }
    `;
    document.head.appendChild(style);
} else {
    console.log('🌐 Running in browser mode');
}

// PWA Install Prompt for Dashboard
window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA install prompt available on dashboard');
    e.preventDefault();
    
    // Можно показать кастомную кнопку установки в дашборде
    setTimeout(() => {
        if (window.deferredPrompt) {
            showDashboardInstallPrompt();
        }
    }, 10000); // Через 10 секунд
});

function showDashboardInstallPrompt() {
    if (!window.deferredPrompt) return;

    const installBtn = document.createElement('button');
    installBtn.innerHTML = '📲 Установить приложение';
    installBtn.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: var(--primary);
        color: white;
        border: none;
        padding: 12px 16px;
        border-radius: 25px;
        font-size: 14px;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
    `;

    installBtn.onclick = async () => {
        if (!window.deferredPrompt) return;

        window.deferredPrompt.prompt();
        const { outcome } = await window.deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('User accepted install from dashboard');
            installBtn.remove();
        }

        window.deferredPrompt = null;
    };

    document.body.appendChild(installBtn);

    // Автоматически убираем через 30 секунд
    setTimeout(() => {
        if (installBtn.parentNode) {
            installBtn.remove();
        }
    }, 30000);
}
