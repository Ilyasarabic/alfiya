// static/js/app.js

class App {
    constructor() {
        this.auth = auth;
        this.currentPage = null;
    }

    async initialize() {
        try {
            // Initialize authentication
            await this.auth.initialize();
            
            // Hide loading screen
            this.hideLoadingScreen();
            
            // Show bottom navigation
            this.showBottomNav();
            
            // Load current page based on URL
            await this.loadCurrentPage();
            
            // Setup navigation
            this.setupNavigation();
            
            // Register service worker
            this.registerServiceWorker();
            
        } catch (error) {
            console.error('App initialization failed:', error);
            this.showErrorScreen('Ошибка загрузки приложения');
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    showErrorScreen(message) {
        const appContainer = document.getElementById('app-container');
        appContainer.innerHTML = `
            <div class="error-screen">
                <div class="error-content">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Ошибка</h2>
                    <p>${message}</p>
                    <button onclick="location.reload()" class="btn-primary">
                        Попробовать снова
                    </button>
                </div>
            </div>
        `;
    }

    showBottomNav() {
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }
    }

    async loadCurrentPage() {
        const path = window.location.pathname;
        
        // Map URLs to page components
        const pageMap = {
            '/dashboard/': 'dashboard',
            '/progress/': 'progress',
            '/courses/': 'courses',
            '/profile/': 'profile',
            '/app/': 'dashboard' // Default to dashboard for /app/
        };

        const page = pageMap[path] || 'dashboard';
        await this.loadPage(page);
    }

    async loadPage(pageName) {
        try {
            // Show loading state
            this.showLoadingState();
            
            // Update active nav
            this.setActiveNav(pageName);
            
            // Load page content
            const response = await fetch(`/templates/${pageName}.html`);
            const content = await response.text();
            
            // Update app container
            const appContainer = document.getElementById('app-container');
            appContainer.innerHTML = content;
            
            // Initialize page-specific JavaScript
            await this.initializePageScript(pageName);
            
            // Hide loading state
            this.hideLoadingState();
            
            this.currentPage = pageName;
            
        } catch (error) {
            console.error(`Error loading page ${pageName}:`, error);
            this.showErrorState(`Не удалось загрузить страницу ${pageName}`);
        }
    }

    async initializePageScript(pageName) {
        const scriptMap = {
            'dashboard': '/static/js/dashboard.js',
            'progress': '/static/js/progress.js',
            'courses': '/static/js/courses.js',
            'profile': '/static/js/profile.js'
        };

        const scriptPath = scriptMap[pageName];
        if (scriptPath) {
            // Remove existing script if any
            const existingScript = document.querySelector(`script[src="${scriptPath}"]`);
            if (existingScript) {
                existingScript.remove();
            }

            // Load new script
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = scriptPath;
                script.onload = resolve;
                script.onerror = reject;
                document.body.appendChild(script);
            });
        }
    }

    setActiveNav(pageName) {
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Add active class to current page nav item
        const navItem = document.getElementById(`nav-${pageName}`);
        if (navItem) {
            navItem.classList.add('active');
        }
    }

    setupNavigation() {
        // Handle navigation clicks
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.id.replace('nav-', '');
                this.navigateTo(page);
            });
        });

        // Handle browser back/forward
        window.addEventListener('popstate', (e) => {
            this.loadCurrentPage();
        });
    }

    async navigateTo(pageName) {
        const pathMap = {
            'dashboard': '/dashboard/',
            'progress': '/progress/',
            'courses': '/courses/',
            'profile': '/profile/'
        };

        const path = pathMap[pageName];
        if (path) {
            // Update URL without reload
            window.history.pushState({}, '', path);
            await this.loadPage(pageName);
        }
    }

    showLoadingState() {
        const appContainer = document.getElementById('app-container');
        appContainer.classList.add('loading');
    }

    hideLoadingState() {
        const appContainer = document.getElementById('app-container');
        appContainer.classList.remove('loading');
    }

    showErrorState(message) {
        const appContainer = document.getElementById('app-container');
        appContainer.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Ошибка</h3>
                <p>${message}</p>
                <button onclick="app.loadCurrentPage()" class="btn-primary">
                    Обновить
                </button>
            </div>
        `;
    }

    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/static/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered:', registration);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New Service Worker installing...');
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New update available
                                this.showUpdateNotification();
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    showUpdateNotification() {
        // Show update notification to user
        if (confirm('Доступна новая версия приложения. Обновить?')) {
            window.location.reload();
        }
    }
}

// Global app instance
const app = new App();

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    app.initialize();
});

// Export for use in other modules
window.app = app;