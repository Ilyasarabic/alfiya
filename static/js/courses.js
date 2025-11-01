//static/js/courses.js

class CoursesPage {
    constructor() {
        this.auth = auth;
    }

    async initialize() {
        await this.auth.initialize();
        this.renderCourses();
    }

    renderCourses() {
        const blocks = dashboard.dashboardData.blocks;
        const container = document.getElementById('courses-container');
        
        container.innerHTML = blocks.map(block => `
            <div class="course-card ${block.is_locked ? 'locked' : ''}">
                <div class="course-header">
                    <div class="course-icon">
                        <i class="fas ${this.getBlockIcon(block.order)}"></i>
                    </div>
                    <div class="course-info">
                        <h3>${block.title}</h3>
                        <p>${block.description}</p>
                    </div>
                    <div class="course-status">
                        ${block.is_locked ? 
                            '<i class="fas fa-lock"></i>' : 
                            '<i class="fas fa-play"></i>'
                        }
                    </div>
                </div>
                <div class="course-progress">
                    <div class="progress-text">
                        ${block.learned_words}/${block.total_words} слов
                    </div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(block.learned_words / block.total_words) * 100}%"></div>
                    </div>
                </div>
                ${!block.is_locked ? `
                    <div class="course-actions">
                        <button class="btn-primary" onclick="startBlock(${block.id})">
                            Продолжить
                        </button>
                    </div>
                ` : ''}
            </div>
        `).join('');
    }

    getBlockIcon(order) {
        const icons = [
            'fa-seedling',
            'fa-leaf',
            'fa-tree',
            'fa-apple-alt',
            'fa-star',
            'fa-gem',
            'fa-crown'
        ];
        return icons[order % icons.length] || 'fa-book';
    }
}

// Global functions
function startReview() {
    alert('Функция повторения скоро будет доступна!');
}

function startTest() {
    alert('Функция тестирования скоро будет доступна!');
}

function openAchievements() {
    alert('Функция достижений скоро будет доступна!');
}

function startBlock(blockId) {
    window.location.href = `/app/block/${blockId}/`;
}

// Initialize courses page
document.addEventListener('DOMContentLoaded', function() {
    const coursesPage = new CoursesPage();
    coursesPage.initialize();
});