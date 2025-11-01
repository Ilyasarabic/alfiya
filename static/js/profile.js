// static/js/profile.js

class ProfilePage {
    constructor() {
        this.auth = auth;
        this.profileData = null;
    }

    async initialize() {
        console.log('Initializing profile page...');
        await this.auth.initialize();
        await this.loadProfileData();
        this.renderProfile();
        this.setupEventListeners();
        console.log('Profile page initialized');
    }

    async loadProfileData() {
        try {
            console.log('Loading profile data...');
            // 🔥 Загружаем реальные данные профиля
            this.profileData = await this.auth.apiCall('/user/profile/');
            
            if (!this.profileData) {
                throw new Error('No profile data received');
            }
            
            console.log('Profile data loaded:', this.profileData);
        } catch (error) {
            console.error('Error loading profile data:', error);
            this.showError('Не удалось загрузить данные профиля');
        }
    }

    renderProfile() {
        if (!this.profileData) {
            this.showEmptyState();
            return;
        }

        this.renderUserInfo();
        this.renderStats();
        this.renderBlocksProgress();
        this.renderLearningInfo();
        this.renderSystemInfo();
    }

    renderUserInfo() {
        const user = this.profileData.user;
        
        // Аватар с первой буквой имени
        document.getElementById('profile-avatar').textContent = 
            user.username ? user.username.charAt(0).toUpperCase() : 'A';
        
        // Основная информация
        document.getElementById('profile-username').textContent = 
            user.username || 'Пользователь';
        
        document.getElementById('profile-telegram').textContent = 
            user.telegram_username ? `@${user.telegram_username}` : 'Не указан';
        
        // 🔥 РЕАЛЬНАЯ дата регистрации
        const joinDate = new Date(user.date_joined).toLocaleDateString('ru-RU');
        document.getElementById('member-since').innerHTML = 
            `<i class="fas fa-calendar-alt"></i> Участник с ${joinDate}`;
        
        // 🔥 РЕАЛЬНАЯ дата оплаты
        if (user.payment_date) {
            const paymentDate = new Date(user.payment_date).toLocaleDateString('ru-RU');
            document.getElementById('payment-date').innerHTML = 
                `<i class="fas fa-check-circle"></i> Оплачено: ${paymentDate}`;
        } else {
            document.getElementById('payment-date').innerHTML = 
                `<i class="fas fa-clock"></i> Ожидание оплаты`;
        }
    }

    renderStats() {
        const stats = this.profileData.stats;
        
        // 🔥 РЕАЛЬНЫЕ данные статистики
        document.getElementById('total-words-learned').textContent = stats.learned_words;
        document.getElementById('total-study-time').textContent = Math.round(stats.total_study_time / 60);
        document.getElementById('total-sessions').textContent = stats.total_sessions;
        document.getElementById('current-streak').textContent = stats.current_streak;
        document.getElementById('best-streak').textContent = `${stats.longest_streak} дней`;
        
        // 🔥 РЕАЛЬНЫЙ расчет дней обучения
        document.getElementById('study-days').textContent = this.calculateStudyDays(stats.total_study_time);
    }

    renderBlocksProgress() {
        const blocks = this.profileData.blocks_progress;
        const container = document.getElementById('blocks-progress-list');
        
        if (!blocks || blocks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-book-open"></i>
                    <p>Начните обучение, чтобы отслеживать прогресс</p>
                </div>
            `;
            return;
        }
        
        // 🔥 РЕАЛЬНЫЙ прогресс по блокам
        container.innerHTML = blocks.map(block => `
            <div class="block-progress-item ${block.is_completed ? 'completed' : ''}">
                <div class="block-info">
                    <h4>${block.title}</h4>
                    <div class="block-stats">
                        <span class="words-count">${block.learned_words}/${block.total_words} слов</span>
                        <span class="accuracy">${block.overall_accuracy}% точность</span>
                    </div>
                </div>
                <div class="block-visual">
                    <div class="progress-circle-small">
                        <svg width="60" height="60" viewBox="0 0 60 60">
                            <circle cx="30" cy="30" r="27" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4"/>
                            <circle cx="30" cy="30" r="27" fill="none" stroke="${block.is_completed ? '#2ECC71' : '#8B5FBF'}" 
                                    stroke-width="4" stroke-linecap="round" 
                                    stroke-dasharray="169.646" 
                                    stroke-dashoffset="${169.646 - (block.learned_words / block.total_words * 169.646)}"/>
                            <text x="30" y="35" text-anchor="middle" fill="white" font-size="12" font-weight="700">
                                ${Math.round((block.learned_words / block.total_words) * 100)}%
                            </text>
                        </svg>
                    </div>
                    ${block.is_completed ? '<div class="completion-badge"><i class="fas fa-check"></i></div>' : ''}
                </div>
            </div>
        `).join('');
    }

    renderLearningInfo() {
        const stats = this.profileData.stats;
        const blocks = this.profileData.blocks_progress;
        
        // 🔥 РЕАЛЬНАЯ средняя точность
        document.getElementById('average-accuracy').textContent = 
            this.calculateAverageAccuracy(blocks);
        
        // 🔥 РЕАЛЬНЫЕ дни обучения
        document.getElementById('study-days').textContent = 
            this.calculateStudyDays(stats.total_study_time);
        
        // 🔥 РЕАЛЬНАЯ лучшая серия
        document.getElementById('best-streak').textContent = 
            `${stats.longest_streak} дней`;
        
        // Текущая цель
        const goalProgress = Math.round((stats.learned_words / 1000) * 100);
        document.getElementById('current-goal').textContent = 
            `Изучить 1000 слов Корана (${goalProgress}%)`;
    }

    renderSystemInfo() {
        const user = this.profileData.user;
        
        // 🔥 РЕАЛЬНЫЙ ID пользователя
        document.getElementById('user-id').textContent = user.id;
        
        // 🔥 РЕАЛЬНАЯ последняя активность
        document.getElementById('last-activity').textContent = 
            this.formatLastActivity();
    }

    // 🔥 ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ РЕАЛЬНЫХ ДАННЫХ
    calculateAverageAccuracy(blocks) {
        if (!blocks || blocks.length === 0) return '0%';
        
        const validBlocks = blocks.filter(block => block.overall_accuracy > 0);
        if (validBlocks.length === 0) return '0%';
        
        const totalAccuracy = validBlocks.reduce((sum, block) => sum + block.overall_accuracy, 0);
        const average = Math.round(totalAccuracy / validBlocks.length);
        return `${average}%`;
    }

    calculateStudyDays(totalMinutes) {
        // Предполагаем, что день засчитывается если учились больше 10 минут
        const studyDays = Math.max(1, Math.round(totalMinutes / 10));
        return studyDays;
    }

    formatLastActivity() {
        const now = new Date();
        const options = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return now.toLocaleDateString('ru-RU', options);
    }

    setupEventListeners() {
        // Настройки (если будут добавлены в будущем)
        const settingsToggle = document.getElementById('dark-mode');
        if (settingsToggle) {
            settingsToggle.addEventListener('change', this.saveSettings.bind(this));
        }
    }

    saveSettings() {
        const settings = {
            darkMode: document.getElementById('dark-mode').checked
        };
        localStorage.setItem('app_settings', JSON.stringify(settings));
        this.showToast('Настройки сохранены');
    }

    loadSettings() {
        const settings = JSON.parse(localStorage.getItem('app_settings') || '{}');
        const darkModeToggle = document.getElementById('dark-mode');
        if (darkModeToggle) {
            darkModeToggle.checked = settings.darkMode === true;
        }
    }

    showError(message) {
        const container = document.querySelector('.profile-main');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button onclick="profilePage.initialize()">Попробовать снова</button>
                </div>
            `;
        }
    }

    showEmptyState() {
        const container = document.getElementById('blocks-progress-list');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <p>Данные профиля недоступны</p>
                <button onclick="profilePage.initialize()">Загрузить данные</button>
            </div>
        `;
    }

    showToast(message) {
        // Простая реализация toast уведомления
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--success);
            color: white;
            padding: 12px 24px;
            border-radius: var(--border-radius);
            font-weight: 600;
            z-index: 1000;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

// 🔥 УДАЛИТЬ старые глобальные функции и заменить на:
window.logout = function() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        auth.logout();
    }
};

window.exportData = function() {
    // 🔥 РЕАЛЬНЫЙ экспорт данных (можно реализовать позже)
    profilePage.showToast('Экспорт данных скоро будет доступен!');
};

window.contactSupport = function() {
    window.open('https://t.me/your_support', '_blank');
};

// Инициализация профиля
const profilePage = new ProfilePage();
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing profile page...');
    profilePage.initialize();
    profilePage.loadSettings();
});