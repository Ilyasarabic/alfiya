// static/js/block_test.js

class BlockTestPage {
    constructor() {
        this.auth = auth;
        this.blockId = this.getBlockIdFromUrl();
        this.testData = null;
        this.currentQuestion = 0;
        this.userAnswers = {};
        this.startTime = null;
        this.timerInterval = null;
        this.elapsedTime = 0;
    }

    getBlockIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/block-test\/(\d+)\//);
        return match ? parseInt(match[1]) : null;
    }

    async initialize() {
        console.log('🚀 Initializing block test for ID:', this.blockId);
        
        if (!this.blockId) {
            this.showError('Блок не найден');
            return;
        }

        try {
            await this.auth.initialize();
            await this.loadTestData();
        } catch (error) {
            console.error('❌ Error initializing block test:', error);
            this.showError('Ошибка загрузки теста: ' + error.message);
        }
    }

    async loadTestData() {
        this.showLoadingState();
        
        try {
            console.log('🔄 Loading test data for block:', this.blockId);
            
            this.testData = await this.auth.apiCall(`/block-test/${this.blockId}/start/`);
            
            console.log('📊 Test data loaded:', this.testData);
            
            if (!this.testData || !this.testData.words) {
                throw new Error('Не удалось загрузить вопросы теста');
            }

            console.log('✅ Test data ready, words count:', this.testData.words.length);
            this.renderTestInterface();
            this.hideLoadingState();
            this.startTest();
            
        } catch (error) {
            console.error('❌ Error loading test data:', error);
            this.hideLoadingState();
            this.showError('Ошибка загрузки теста: ' + error.message);
        }
    }

    renderTestInterface() {
        const container = document.querySelector('.test-container');
        container.innerHTML = `
            <div class="test-header">
                <div class="test-icon">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <h2 class="test-title">${this.testData.title || 'Финальный тест блока'}</h2>
                <p class="test-description">
                    ${this.testData.description || 'Проверьте свои знания всех слов из этого блока'}
                </p>
            </div>

            <div class="test-progress">
                <div class="progress-info">
                    <span class="progress-text">Вопрос <span id="current-question">1</span> из ${this.testData.words.length}</span>
                    <span class="timer" id="test-timer">00:00</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="test-progress-fill" style="width: 0%"></div>
                </div>
            </div>

            <div class="question-container" id="question-container">
                <!-- Вопросы будут рендериться здесь -->
            </div>

            <div class="test-actions">
                <button class="btn-outline" onclick="blockTest.cancelTest()">
                    <i class="fas fa-times"></i>
                    Прервать тест
                </button>
                <button class="btn-primary" id="next-button" onclick="blockTest.nextQuestion()" disabled>
                    <i class="fas fa-arrow-right"></i>
                    Следующий вопрос
                </button>
            </div>
        `;
    }

    startTest() {
        this.startTime = new Date();
        this.startTimer();
        this.showQuestion(0);
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.elapsedTime++;
            const minutes = Math.floor(this.elapsedTime / 60).toString().padStart(2, '0');
            const seconds = (this.elapsedTime % 60).toString().padStart(2, '0');
            document.getElementById('test-timer').textContent = `${minutes}:${seconds}`;
        }, 1000);
    }

    showQuestion(questionIndex) {
        this.currentQuestion = questionIndex;
        const word = this.testData.words[questionIndex];
        
        if (!word) {
            this.finishTest();
            return;
        }

        document.getElementById('current-question').textContent = questionIndex + 1;
        const progress = ((questionIndex) / this.testData.words.length) * 100;
        document.getElementById('test-progress-fill').style.width = `${progress}%`;

        const container = document.getElementById('question-container');
        container.innerHTML = this.createQuestionHTML(word, questionIndex);

        document.getElementById('next-button').disabled = true;
        this.playWordAudio(word);
    }

    createQuestionHTML(word, index) {
        return `
            <div class="question-card">
                <div class="question-header">
                    <div class="question-number">Вопрос ${index + 1}</div>
                    ${word.audio_url ? `
                        <button class="audio-btn" onclick="blockTest.playWordAudio(${JSON.stringify(word).replace(/"/g, '&quot;')})">
                            <i class="fas fa-volume-up"></i>
                            Произнести слово
                        </button>
                    ` : ''}
                </div>
                
                <div class="word-display">
                    <div class="arabic-word">${word.arabic}</div>
                    ${word.transcription ? `<div class="transcription">${word.transcription}</div>` : ''}
                </div>

                <div class="answer-section">
                    <label class="answer-label">Напишите перевод этого слова:</label>
                    <input type="text" 
                           class="answer-input" 
                           id="answer-input-${index}"
                           placeholder="Введите перевод..."
                           oninput="blockTest.checkAnswer(${index})"
                           onkeypress="blockTest.handleKeyPress(event, ${index})"
                           autocomplete="off">
                    
                    <div class="answer-feedback" id="feedback-${index}"></div>
                </div>
            </div>
        `;
    }

    playWordAudio(word) {
        if (word.audio_url) {
            const audio = new Audio(word.audio_url);
            audio.play().catch(e => {
                console.log('Audio play failed (user interaction required):', e);
            });
        }
    }

    checkAnswer(questionIndex) {
        const input = document.getElementById(`answer-input-${questionIndex}`);
        const feedback = document.getElementById(`feedback-${questionIndex}`);
        const nextButton = document.getElementById('next-button');
        
        const userAnswer = input.value.trim();
        const currentWord = this.testData.words[questionIndex];
        
        if (!currentWord) {
            console.error('Word not found for question:', questionIndex);
            return;
        }
        
        // Используем transcription как правильный ответ (так как translation отсутствует)
        const correctAnswer = currentWord.transcription ? currentWord.transcription.trim().toLowerCase() : '';
        const userAnswerLower = userAnswer.toLowerCase();
        
        this.userAnswers[currentWord.id] = userAnswer;
        
        if (userAnswerLower === correctAnswer && userAnswer.length > 0) {
            feedback.innerHTML = '<i class="fas fa-check"></i> Верно!';
            feedback.className = 'answer-feedback correct';
            nextButton.disabled = false;
        } else if (userAnswer.length > 0) {
            feedback.innerHTML = '<i class="fas fa-times"></i> Попробуйте еще раз';
            feedback.className = 'answer-feedback incorrect';
            nextButton.disabled = true;
        } else {
            feedback.innerHTML = '';
            feedback.className = 'answer-feedback';
            nextButton.disabled = true;
        }
    }

    handleKeyPress(event, questionIndex) {
        if (event.key === 'Enter') {
            const nextButton = document.getElementById('next-button');
            if (!nextButton.disabled) {
                this.nextQuestion();
            }
        }
    }

    nextQuestion() {
        const nextIndex = this.currentQuestion + 1;
        if (nextIndex < this.testData.words.length) {
            this.showQuestion(nextIndex);
        } else {
            this.finishTest();
        }
    }

    async finishTest() {
        clearInterval(this.timerInterval);
        
        const totalQuestions = this.testData.words.length;
        let correctAnswers = 0;
        
        this.testData.words.forEach(word => {
            if (!word) return;
            
            const userAnswer = this.userAnswers[word.id];
            const correctAnswer = (word.transcription || '').toLowerCase();
            
            if (userAnswer && userAnswer.toLowerCase() === correctAnswer) {
                correctAnswers++;
            }
        });
        
        const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
        const isPassed = score >= (this.testData.passing_score || 80);
        
        console.log('🎯 Test results:', { score, correctAnswers, totalQuestions, isPassed });
        
        this.showResults(score, correctAnswers, totalQuestions, isPassed);
        await this.submitTestResults(score, isPassed);
    }

    async submitTestResults(score, isPassed) {
        try {
            const result = await this.auth.apiCall(`/block-test/${this.testData.test_id || this.blockId}/submit/`, 'POST', {
                answers: this.userAnswers,
                score: score,
                time_spent: this.elapsedTime,
                is_passed: isPassed
            });
            
            console.log('📤 Test results submitted:', result);
            
        } catch (error) {
            console.error('❌ Error submitting test results:', error);
        }
    }

    showResults(score, correct, total, isPassed) {
        const container = document.querySelector('.test-container');
        container.innerHTML = `
            <div class="results-container">
                <div class="results-icon ${isPassed ? 'passed' : 'failed'}">
                    <i class="fas ${isPassed ? 'fa-trophy' : 'fa-times'}"></i>
                </div>
                
                <h2 class="results-title">${isPassed ? 'Поздравляем!' : 'Попробуйте еще раз'}</h2>
                
                <div class="score-display">
                    <div class="score-value ${isPassed ? 'passed' : 'failed'}">${score}%</div>
                    <div class="score-details">${correct} из ${total} правильных ответов</div>
                    <div class="time-details">Время: ${Math.floor(this.elapsedTime / 60)}:${(this.elapsedTime % 60).toString().padStart(2, '0')}</div>
                </div>
                
                <div class="results-message">
                    ${isPassed ? 
                        'Вы успешно прошли тест! Следующий блок разблокирован.' : 
                        `Для прохождения нужно набрать ${this.testData.passing_score || 80}%. Попробуйте еще раз после повторения слов.`
                    }
                </div>
                
                <div class="results-actions">
                    <button class="btn-outline" onclick="blockTest.retryTest()">
                        <i class="fas fa-redo"></i>
                        ${isPassed ? 'Пройти еще раз' : 'Попробовать снова'}
                    </button>
                    <button class="btn-primary" onclick="blockTest.returnToBlock()">
                        <i class="fas fa-arrow-left"></i>
                        Вернуться к блоку
                    </button>
                    ${isPassed ? `
                        <button class="btn-secondary" onclick="blockTest.goToNextBlock()">
                            <i class="fas fa-arrow-right"></i>
                            Следующий блок
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    cancelTest() {
        if (confirm('Прервать тест? Прогресс будет потерян.')) {
            clearInterval(this.timerInterval);
            this.returnToBlock();
        }
    }

    retryTest() {
        clearInterval(this.timerInterval);
        this.currentQuestion = 0;
        this.userAnswers = {};
        this.elapsedTime = 0;
        this.startTime = new Date();
        this.renderTestInterface();
        this.startTest();
    }

    returnToBlock() {
        window.location.href = `/app/block/${this.blockId}/`;
    }

    goToNextBlock() {
        window.location.href = '/dashboard/';
    }

    showLoadingState() {
        document.body.classList.add('loading');
    }

    hideLoadingState() {
        document.body.classList.remove('loading');
    }

    showError(message) {
        const container = document.querySelector('.test-container');
        container.innerHTML = `
            <div class="error-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
                <button onclick="blockTest.returnToBlock()">Вернуться к блоку</button>
            </div>
        `;
    }
}

const blockTest = new BlockTestPage();
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 block_test.js loaded and initializing...');
    blockTest.initialize();
});