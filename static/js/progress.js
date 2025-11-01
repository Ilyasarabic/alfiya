// static/js/progress.js
class ProgressPage {
    constructor() {
        this.auth = auth;
        this.detailedData = null;
    }

    async initialize() {
        console.log('Initializing progress page...');
        await this.auth.initialize();
        await this.loadDetailedProgressData();
        this.renderProgressPage();
        console.log('Progress page initialized');
    }

    async loadDetailedProgressData() {
        try {
            console.log('Loading detailed progress data...');
            // 🔥 Используем endpoint с полными данными для графиков
            this.detailedData = await this.auth.apiCall('/progress/detailed/');
            
            if (!this.detailedData) {
                throw new Error('No progress data received');
            }
            
            console.log('Detailed progress data loaded:', this.detailedData);
        } catch (error) {
            console.error('Error loading detailed progress:', error);
            this.showError('Не удалось загрузить данные прогресса');
        }
    }

    renderProgressPage() {
        if (!this.detailedData) {
            this.showError('Данные не загружены');
            return;
        }

        this.renderOverview();
        this.renderWeeklyActivity();
        this.renderBlocksProgress();
        this.renderTimeDistribution();
        this.renderStudyHabits();
        this.renderAchievements();
    }

    renderOverview() {
        const overview = this.detailedData.overview;
        
        document.getElementById('overall-progress').textContent = 
            `${overview.progress_percentage}%`;
        document.getElementById('total-study-time').textContent = 
            this.formatTime(overview.total_study_time);
        document.getElementById('total-sessions').textContent = 
            overview.total_sessions;
        document.getElementById('current-streak').textContent = 
            `${overview.current_streak} дней`;
        document.getElementById('longest-streak').textContent = 
            `${overview.longest_streak} дней`;
        document.getElementById('average-accuracy').textContent = 
            `${overview.average_accuracy}%`;
        
        // Прогресс бар
        const progressBar = document.getElementById('overall-progress-bar');
        if (progressBar) {
            progressBar.style.width = `${overview.progress_percentage}%`;
        }
    }

    renderWeeklyActivity() {
        const chartData = this.detailedData.chart_data;
        const container = document.getElementById('weekly-activity');
        
        if (!chartData || chartData.length === 0) {
            container.innerHTML = '<div class="no-data">Нет данных за последние 30 дней</div>';
            return;
        }

        // Берем последние 7 дней для отображения
        const last7Days = chartData.slice(-7);
        
        const html = `
            <div class="weekly-header">
                <h3>Активность за неделю</h3>
                <div class="weekly-stats">
                    <span class="stat-badge">
                        <i class="fas fa-book"></i>
                        ${this.getWeeklyTotal(last7Days, 'words_learned')} слов
                    </span>
                    <span class="stat-badge">
                        <i class="fas fa-clock"></i>
                        ${this.getWeeklyTotal(last7Days, 'time_studied')} мин
                    </span>
                </div>
            </div>
            <div class="days-grid">
                ${last7Days.map(day => this.renderDayBar(day)).join('')}
            </div>
        `;
        
        container.innerHTML = html;
    }

    renderDayBar(dayData) {
        const words = dayData.words_learned || 0;
        const time = dayData.time_studied || 0;
        const maxWords = 20; // Максимум для 100% высоты
        
        const wordsHeight = Math.min((words / maxWords) * 100, 100);
        const timeHeight = Math.min((time / 60) * 100, 100); // Максимум 60 минут = 100%
        
        const date = new Date(dayData.date);
        const dayName = this.getDayName(date.getDay());
        const dayNumber = date.getDate();
        
        return `
            <div class="day-bar">
                <div class="bar-container">
                    <div class="time-bar" style="height: ${timeHeight}%"
                         title="${time} мин изучения"></div>
                    <div class="words-bar" style="height: ${wordsHeight}%"
                         title="${words} слов изучено"></div>
                </div>
                <div class="day-label">
                    <div class="day-name">${dayName}</div>
                    <div class="day-number">${dayNumber}</div>
                </div>
                <div class="day-stats">
                    <small>${words} сл</small>
                    <small>${time} мин</small>
                </div>
            </div>
        `;
    }

    renderBlocksProgress() {
        const blocks = this.detailedData.blocks_progress;
        const container = document.getElementById('blocks-progress');
        
        if (!blocks || blocks.length === 0) {
            container.innerHTML = '<div class="no-data">Нет данных по блокам</div>';
            return;
        }

        container.innerHTML = blocks.map(block => `
            <div class="block-progress-item ${block.is_completed ? 'completed' : ''}">
                <div class="block-progress-header">
                    <div class="block-title">
                        <i class="fas ${block.is_completed ? 'fa-check-circle' : 'fa-play-circle'}"></i>
                        ${block.title}
                    </div>
                    <div class="block-percent">${block.progress_percentage}%</div>
                </div>
                
                <div class="block-progress-bar">
                    <div class="block-progress-fill" 
                         style="width: ${block.progress_percentage}%"></div>
                </div>
                
                <div class="block-progress-details">
                    <div class="block-stat">
                        <i class="fas fa-book"></i>
                        ${block.learned_words}/${block.total_words} слов
                    </div>
                    <div class="block-stat">
                        <i class="fas fa-bullseye"></i>
                        ${block.accuracy}% точность
                    </div>
                    <div class="block-stat">
                        <i class="fas ${block.is_completed ? 'fa-check success' : 'fa-clock warning'}"></i>
                        ${block.is_completed ? 'Завершен' : 'В процессе'}
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderTimeDistribution() {
        const timeData = this.detailedData.time_distribution;
        const container = document.getElementById('time-distribution');
        
        if (!timeData) return;

        const totalTime = Object.values(timeData).reduce((sum, time) => sum + time, 0);
        
        const html = `
            <div class="time-distribution-grid">
                <div class="time-slot ${this.getMaxTimeSlot(timeData) === 'morning' ? 'highlight' : ''}">
                    <div class="time-icon">
                        <i class="fas fa-sun"></i>
                    </div>
                    <div class="time-label">Утро</div>
                    <div class="time-value">${timeData.morning} мин</div>
                    <div class="time-percent">${totalTime > 0 ? Math.round((timeData.morning / totalTime) * 100) : 0}%</div>
                </div>
                
                <div class="time-slot ${this.getMaxTimeSlot(timeData) === 'afternoon' ? 'highlight' : ''}">
                    <div class="time-icon">
                        <i class="fas fa-sun"></i>
                    </div>
                    <div class="time-label">День</div>
                    <div class="time-value">${timeData.afternoon} мин</div>
                    <div class="time-percent">${totalTime > 0 ? Math.round((timeData.afternoon / totalTime) * 100) : 0}%</div>
                </div>
                
                <div class="time-slot ${this.getMaxTimeSlot(timeData) === 'evening' ? 'highlight' ? 'highlight' : ''}">
                    <div class="time-icon">
                        <i class="fas fa-moon"></i>
                    </div>
                    <div class="time-label">Вечер</div>
                    <div class="time-value">${timeData.evening} мин</div>
                    <div class="time-percent">${totalTime > 0 ? Math.round((timeData.evening / totalTime) * 100) : 0}%</div>
                </div>
                
                <div class="time-slot ${this.getMaxTimeSlot(timeData) === 'night' ? 'highlight' : ''}">
                    <div class="time-icon">
                        <i class="fas fa-star"></i>
                    </div>
                    <div class="time-label">Ночь</div>
                    <div class="time-value">${timeData.night} мин</div>
                    <div class="time-percent">${totalTime > 0 ? Math.round((timeData.night / totalTime) * 100) : 0}%</div>
                </div>
            </div>
            
            <div class="time-summary">
                <i class="fas fa-info-circle"></i>
                Любимое время для учебы: <strong>${this.getTimeSlotName(this.detailedData.study_habits?.favorite_time)}</strong>
            </div>
        `;
        
        container.innerHTML = html;
    }

    renderStudyHabits() {
        const habits = this.detailedData.study_habits;
        const container = document.getElementById('study-habits');
        
        if (!habits) return;

        container.innerHTML = `
            <div class="habits-grid">
                <div class="habit-card">
                    <div class="habit-icon">
                        <i class="fas fa-fire"></i>
                    </div>
                    <div class="habit-content">
                        <div class="habit-value">${habits.words_per_day}</div>
                        <div class="habit-label">слов в день в среднем</div>
                    </div>
                </div>
                
                <div class="habit-card">
                    <div class="habit-icon">
                        <i class="fas fa-calendar"></i>
                    </div>
                    <div class="habit-content">
                        <div class="habit-value">${habits.total_study_days}</div>
                        <div class="habit-label">дней обучения</div>
                    </div>
                </div>
                
                <div class="habit-card">
                    <div class="habit-icon">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="habit-content">
                        <div class="habit-value">${Math.round(habits.average_session_time)}</div>
                        <div class="habit-label">мин за сессию</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderAchievements() {
        const achievements = this.detailedData.achievements;
        const container = document.getElementById('achievements-list');
        
        if (!achievements || achievements.length === 0) {
            container.innerHTML = '<div class="no-data">Достижений пока нет</div>';
            return;
        }

        container.innerHTML = achievements.map(achievement => `
            <div class="achievement-card">
                <div class="achievement-icon">
                    ${achievement.icon}
                </div>
                <div class="achievement-content">
                    <div class="achievement-name">${achievement.name}</div>
                    <div class="achievement-description">${achievement.description}</div>
                    <div class="achievement-date">Получено: ${achievement.earned_at}</div>
                </div>
            </div>
        `).join('');
    }

    // Вспомогательные методы
    formatTime(minutes) {
        if (minutes < 60) return `${minutes} мин`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours} ч ${mins} мин` : `${hours} ч`;
    }

    getDayName(dayIndex) {
        const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
        return days[dayIndex];
    }

    getWeeklyTotal(days, field) {
        return days.reduce((sum, day) => sum + (day[field] || 0), 0);
    }

    getMaxTimeSlot(timeData) {
        if (!timeData) return 'evening';
        return Object.keys(timeData).reduce((a, b) => timeData[a] > timeData[b] ? a : b);
    }

    getTimeSlotName(slot) {
        const names = {
            'morning': 'Утро',
            'afternoon': 'День', 
            'evening': 'Вечер',
            'night': 'Ночь'
        };
        return names[slot] || 'Вечер';
    }

    showError(message) {
        const container = document.getElementById('progress-content');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${message}</p>
                    <button onclick="progressPage.initialize()">Попробовать снова</button>
                </div>
            `;
        }
    }
}

// Глобальная инициализация
const progressPage = new ProgressPage();
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing progress page...');
    progressPage.initialize();
});