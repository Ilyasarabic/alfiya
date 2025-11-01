// static/js/block_detail.js

class BlockDetailPage {
    constructor() {
        this.auth = auth;
        this.blockId = this.getBlockIdFromUrl();
        this.blockData = null;
    }

    getBlockIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/block\/(\d+)\//);
        return match ? parseInt(match[1]) : null;
    }

    async initialize() {
        console.log('Initializing block detail page for ID:', this.blockId);
        
        if (!this.blockId) {
            this.showError('Блок не найден');
            return;
        }

        try {
            await this.auth.initialize();
            console.log('Auth initialized, loading block data...');
            await this.loadBlockData();
            this.renderBlockDetail();
            this.setupEventListeners();
            console.log('Block detail page initialized successfully');
        } catch (error) {
            console.error('Error initializing block detail:', error);
            this.showError('Ошибка загрузки блока: ' + error.message);
        }
    }

    async loadBlockData() {
        this.showLoadingState();
        try {
            console.log('Fetching block data for ID:', this.blockId);
            this.blockData = await this.auth.apiCall(`/blocks/${this.blockId}/`);
            
            if (!this.blockData) {
                throw new Error('No block data received from server');
            }
            
            console.log('Block data loaded:', {
                block: this.blockData.block,
                lessonsCount: this.blockData.lessons?.length
            });
            
            this.hideLoadingState();
        } catch (error) {
            console.error('Error loading block data:', error);
            this.hideLoadingState();
            throw new Error('Не удалось загрузить данные блока: ' + error.message);
        }
    }

    renderBlockDetail() {
        if (!this.blockData) {
            this.showError('Данные блока не загружены');
            return;
        }

        const block = this.blockData.block;
        console.log('Rendering block:', block.title);
        
        // Update page title
        document.getElementById('block-title').textContent = block.title;
        
        // Render block info
        this.renderBlockInfo();
        
        // Render lessons
        this.renderLessons();
        
        // Update test button
        this.updateTestButton();
    }

    renderBlockInfo() {
        const block = this.blockData.block;
        const container = document.getElementById('block-info');
        
        const totalLessons = this.blockData.lessons.length;
        const completedLessons = this.blockData.lessons.filter(lesson => 
            lesson.progress.is_completed
        ).length;
        
        const completionRate = totalLessons > 0 ? 
            Math.round((completedLessons / totalLessons) * 100) : 0;

        console.log('Block info:', {
            totalLessons,
            completedLessons,
            completionRate
        });

        container.innerHTML = `
            <div class="block-overview">
                <div class="overview-stats">
                    <div class="stat">
                        <div class="stat-value">${totalLessons}</div>
                        <div class="stat-label">уроков</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${completedLessons}</div>
                        <div class="stat-label">завершено</div>
                    </div>
                    <div class="stat">
                        <div class="stat-value">${completionRate}%</div>
                        <div class="stat-label">прогресс</div>
                    </div>
                </div>
                <div class="block-description">
                    <p>${block.description}</p>
                </div>
            </div>
        `;
    }

    renderLessons() {
        const lessons = this.blockData.lessons;
        const container = document.getElementById('lessons-container');
        
        if (!lessons || lessons.length === 0) {
            container.innerHTML = '<div class="error-state"><p>Уроки не найдены</p></div>';
            return;
        }

        console.log('Rendering lessons:', lessons.length);

        container.innerHTML = lessons.map((lesson, index) => {
            const isLocked = this.isLessonLocked(lesson, index);
            const isCompleted = lesson.progress.is_completed;
            
            console.log(`Lesson ${lesson.title}: locked=${isLocked}, completed=${isCompleted}`);

            return `
                <div class="lesson-card compact ${isLocked ? 'locked' : ''} ${isCompleted ? 'completed' : ''}" 
                     ${!isLocked ? `onclick="blockDetail.openLesson(${lesson.id})"` : ''}>
                    
                    ${isLocked ? `
                        <div class="lock-overlay">
                            <div class="lock-icon">
                                <i class="fas fa-lock"></i>
                            </div>
                            <div class="lock-text">
                                Пройдите предыдущий урок для разблокировки
                            </div>
                        </div>
                    ` : ''}
                    
                    <div class="lesson-header">
                        <div class="lesson-icon">
                            <i class="fas ${
                                isLocked ? 'fa-lock' : 
                                isCompleted ? 'fa-check-circle' : 'fa-play-circle'
                            }"></i>
                        </div>
                        <div class="lesson-info">
                            <h3>${lesson.title}</h3>
                            <p>${lesson.words.length} слов для изучения</p>
                        </div>
                        <div class="lesson-status">
                            ${isLocked ? 
                                `<span class="status-locked">
                                    <i class="fas fa-lock"></i>
                                    Заблокировано
                                </span>` :
                                isCompleted ?
                                `<span class="status-completed">
                                    <i class="fas fa-check"></i>
                                    Завершено
                                </span>` :
                                `<span class="status-pending">
                                    <i class="fas fa-play"></i>
                                    Доступно
                                </span>`
                            }
                        </div>
                    </div>
                    
                    <div class="lesson-progress">
                        <div class="progress-text">
                            <span class="progress-count">
                                ${this.getLearnedWordsCount(lesson)}/${lesson.words.length} слов изучено
                            </span>
                            <span class="progress-percent">${this.getLessonProgress(lesson)}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${this.getLessonProgress(lesson)}%"></div>
                        </div>
                    </div>
                    
                    ${!isLocked && !isCompleted ? `
                        <div class="words-preview">
                            ${lesson.words.slice(0, 3).map(word => `
                                <div class="word-badge ${word.is_learned ? 'learned' : ''}">
                                    ${word.arabic}
                                </div>
                            `).join('')}
                            ${lesson.words.length > 3 ? 
                                `<div class="word-badge">+${lesson.words.length - 3}</div>` : ''
                            }
                        </div>
                        
                        <div class="quick-progress">
                            <button class="quick-action" onclick="event.stopPropagation(); blockDetail.startQuickReview(${lesson.id})">
                                <i class="fas fa-bolt"></i>
                                Быстрый обзор
                            </button>
                            <button class="quick-action" onclick="event.stopPropagation(); blockDetail.startLesson(${lesson.id})">
                                <i class="fas fa-play"></i>
                                Начать урок
                            </button>
                        </div>
                    ` : ''}
                    
                    ${isLocked ? `
                        <div class="unlock-info">
                            <i class="fas fa-info-circle"></i>
                            Завершите урок "${this.getPreviousLessonTitle(index)}" для разблокировки
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    isLessonLocked(lesson, index) {
        // Первый урок всегда доступен
        if (index === 0) return false;
        
        // Проверяем, завершен ли предыдущий урок
        const previousLesson = this.blockData.lessons[index - 1];
        const isPreviousCompleted = previousLesson.progress.is_completed;
        
        console.log(`Lesson ${lesson.title} lock check: previous=${previousLesson.title}, completed=${isPreviousCompleted}`);
        
        return !isPreviousCompleted;
    }

    getPreviousLessonTitle(currentIndex) {
        if (currentIndex === 0) return '';
        return this.blockData.lessons[currentIndex - 1].title;
    }

    getLearnedWordsCount(lesson) {
        return lesson.words.filter(word => word.is_learned).length;
    }

    getLessonProgress(lesson) {
        if (lesson.words.length === 0) return 0;
        return Math.round((this.getLearnedWordsCount(lesson) / lesson.words.length) * 100);
    }

    updateTestButton() {
        const testButton = document.getElementById('test-button');
        const allLessonsCompleted = this.blockData.lessons.every(lesson => 
            lesson.progress.is_completed
        );
        
        console.log('Test button update:', { allLessonsCompleted });

        if (allLessonsCompleted) {
            testButton.disabled = false;
            testButton.innerHTML = `
                <i class="fas fa-clipboard-check"></i>
                Начать финальный тест блока
            `;
            testButton.style.background = 'var(--gradient-primary)';
        } else {
            testButton.disabled = true;
            testButton.innerHTML = `
                <i class="fas fa-lock"></i>
                Завершите все уроки для доступа к тесту
            `;
            testButton.style.background = 'var(--gradient-warning)';
        }
    }

    openLesson(lessonId) {
        console.log('Opening lesson:', lessonId);
        window.location.href = `/app/lesson/${lessonId}/`;
    }

    startLesson(lessonId) {
        this.openLesson(lessonId);
    }

    startQuickReview(lessonId) {
        console.log('Quick review for lesson:', lessonId);
        // Можно добавить модальное окно с быстрыми карточками
        this.showToast('Функция быстрого обзора будет доступна в следующем обновлении!', 'info');
    }

    async submitTestResults(score, isPassed) {
        if (isPassed) {
            try {
                console.log('Submitting test results:', { score, isPassed });
                
                const result = await this.auth.apiCall('/blocks/complete/', 'POST', {
                    block_id: this.blockId
                });
                
                console.log('Block completion saved:', result);
                
                if (result.next_block_available) {
                    this.showToast('Блок завершен! Следующий блок разблокирован.', 'success');
                    // Обновляем данные чтобы показать разблокированный блок
                    setTimeout(() => {
                        this.refreshData();
                    }, 1500);
                } else {
                    this.showToast('Блок завершен!', 'success');
                }
                
            } catch (error) {
                console.error('Error saving block progress:', error);
                this.showToast('Ошибка сохранения прогресса блока', 'error');
            }
        }
    }

    showToast(message, type = 'success') {
        // Создаем контейнер для уведомлений если его нет
        let notifications = document.getElementById('progress-notifications');
        if (!notifications) {
            notifications = document.createElement('div');
            notifications.id = 'progress-notifications';
            notifications.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 300px;
            `;
            document.body.appendChild(notifications);
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            background: ${type === 'success' ? 'var(--success)' : 
                         type === 'error' ? 'var(--error)' : 
                         type === 'warning' ? 'var(--warning)' : 'var(--primary)'};
            color: white;
            padding: 12px 20px;
            border-radius: var(--border-radius);
            margin-bottom: 10px;
            font-weight: 600;
            animation: slideIn 0.3s ease-out;
            box-shadow: var(--shadow);
        `;
        
        notifications.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, 3000);
    }

    setupEventListeners() {
        console.log('Setting up event listeners for block detail...');
        
        // Добавляем обработчики для быстрых действий
        document.addEventListener('click', (e) => {
            if (e.target.closest('.quick-action')) {
                e.stopPropagation();
            }
        });

        // Обновляем прогресс при возвращении на страницу
        window.addEventListener('focus', () => {
            console.log('Window focused, refreshing block data...');
            this.refreshData();
        });

        // Обработчик для кнопки теста
        const testButton = document.getElementById('test-button');
        if (testButton) {
            testButton.addEventListener('click', (e) => {
                if (!testButton.disabled) {
                    this.startBlockTest();
                } else {
                    this.showToast('Завершите все уроки блока для доступа к тесту!', 'warning');
                }
            });
        }

        console.log('Event listeners setup completed');
    }

    async refreshData() {
        console.log('Refreshing block data...');
        await this.loadBlockData();
        this.renderBlockDetail();
    }

    async startBlockTest() {
        console.log('Starting block test for block:', this.blockId);
        
        try {
            // Загружаем данные теста через API
            const response = await this.auth.apiCall(`/block-test/${this.blockId}/start/`);
            
            if (response && response.words) {
                console.log('Block test data loaded:', response);
                // Переходим на страницу теста
                window.location.href = `/app/block-test/${this.blockId}/`;
            } else {
                throw new Error('Не удалось загрузить данные теста');
            }
            
        } catch (error) {
            console.error('Error starting block test:', error);
            
            // Улучшенная обработка ошибок
            if (error.message && error.message.includes('Сначала завершите все уроки')) {
                this.showToast('Завершите все уроки блока перед тестом!', 'warning');
            } else if (error.message && error.message.includes('Payment required')) {
                this.showToast('Доступ к тесту требует оплаты', 'error');
            } else {
                this.showToast('Ошибка при запуске теста. Попробуйте снова.', 'error');
            }
        }
    }

    showLoadingState() {
        document.body.classList.add('loading');
        console.log('Loading state shown');
    }

    hideLoadingState() {
        document.body.classList.remove('loading');
        console.log('Loading state hidden');
    }

    showError(message) {
        console.error('Showing error:', message);
        
        const container = document.getElementById('block-info');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--warning); margin-bottom: 20px;"></i>
                    <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 20px;">${message}</p>
                    <button onclick="blockDetail.initialize()" style="background: var(--gradient-primary); color: white; border: none; padding: 12px 24px; border-radius: var(--border-radius); font-weight: 600; cursor: pointer; margin-right: 10px;">
                        Попробовать снова
                    </button>
                    <button onclick="window.history.back()" style="background: rgba(255, 255, 255, 0.1); color: var(--text-primary); border: 1px solid rgba(255, 255, 255, 0.2); padding: 12px 24px; border-radius: var(--border-radius); font-weight: 600; cursor: pointer;">
                        Назад
                    </button>
                </div>
            `;
        }
    }
}

// Global function for HTML onclick
async function startBlockTest() {
    if (blockDetail.blockData && !document.getElementById('test-button').disabled) {
        await blockDetail.startBlockTest();
    } else {
        blockDetail.showToast('Завершите все уроки блока для доступа к тесту!', 'warning');
    }
}

// Initialize block detail page
const blockDetail = new BlockDetailPage();
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing block detail...');
    blockDetail.initialize();
});