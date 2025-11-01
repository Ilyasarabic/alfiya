// static/js/lesson_detail.js
class LessonDetailPage {
    constructor() {
        this.auth = auth;
        this.lessonId = this.getLessonIdFromUrl();
        this.lessonData = null;
        this.currentStage = 'cards';
        this.currentCardIndex = 0;
        this.isCardFlipped = false;
        
        this.exerciseData = {
            trueFalse: {
                title: 'Верно/Неверно',
                description: 'Определите, соответствует ли перевод слову',
                questions: [],
                currentIndex: 0,
                score: 0,
                total: 0
            },
            audio: {
                title: 'Аудио тест', 
                description: 'Прослушайте слово и выберите правильный перевод',
                questions: [],
                currentIndex: 0,
                score: 0,
                total: 0
            },
            writing: {
                title: 'Письмо',
                description: 'Напишите перевод услышанного слова',
                questions: [],
                currentIndex: 0,
                score: 0,
                total: 0
            }
        };
        
        this.audioCache = new Map();
        this.domCache = new Map();
        this.lessonStartTime = Date.now();
        this.isLessonCompleted = false;
    }

    getLessonIdFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/lesson\/(\d+)\//);
        return match ? parseInt(match[1]) : null;
    }

    async initialize() {
        console.log('Initializing lesson page for ID:', this.lessonId);
        
        if (!this.lessonId) {
            this.showError('Урок не найден');
            return;
        }

        try {
            await this.auth.initialize();
            console.log('Auth initialized, loading lesson data...');
            await this.loadLessonData();
            this.initializeExercises();
            this.renderLesson();
            this.setupEventListeners();
            console.log('Lesson page initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Ошибка загрузки урока: ' + error.message);
        }
    }

    async loadLessonData() {
        this.showLoadingState();
        try {
            console.log('Fetching lesson data for ID:', this.lessonId);
            
            this.lessonData = await this.auth.apiCall(`/lessons/${this.lessonId}/`);
            
            if (!this.lessonData) {
                throw new Error('No lesson data received from server');
            }
            
            if (this.lessonData.error && this.lessonData.is_locked) {
                throw new Error(this.lessonData.error);
            }
            
            console.log('Lesson data loaded:', {
                lesson: this.lessonData.lesson,
                wordsCount: this.lessonData.words?.length
            });
            
            await this.preloadAudioFiles();
            this.hideLoadingState();
        } catch (error) {
            console.error('Error loading lesson data:', error);
            this.hideLoadingState();
            
            if (error.message.includes('заблокирован')) {
                this.showError(error.message);
            } else {
                throw new Error('Не удалось загрузить данные урока: ' + error.message);
            }
        }
    }

    initializeExercises() {
        const words = this.lessonData.words;
        if (!words || words.length === 0) {
            console.warn('No words found for lesson');
            return;
        }

        console.log('Initializing exercises for lesson:', this.lessonId);
        console.log('Available words:', words.length);

        // 🔥 УЛУЧШЕННЫЕ УПРАЖНЕНИЯ - БОЛЕЕ РАЗНООБРАЗНЫЕ И НЕПРЕДСКАЗУЕМЫЕ

        // True/False: 3 случайных слова со СМЕШАННЫМИ ответами
        const tfWords = this.getRandomWords(words, 3);
        this.exerciseData.trueFalse.questions = tfWords.map((word, index) => {
            // 70% правильных ответов, 30% неправильных для разнообразия
            const isCorrect = Math.random() > 0.3;
            return {
                word,
                correctAnswer: isCorrect,
                userAnswer: null,
                isCorrect: false,
                displayedTranslation: isCorrect ? 
                    word.translation : 
                    this.getWrongTranslation(words, word)
            };
        });
        this.exerciseData.trueFalse.total = tfWords.length;

        // Audio: 3 случайных слова с УМНЫМИ вариантами ответов
        const audioWords = this.getRandomWords(words, 3);
        this.exerciseData.audio.questions = audioWords.map(word => ({
            word,
            options: this.generateSmartAudioOptions(words, word),
            userAnswer: null,
            isCorrect: false
        }));
        this.exerciseData.audio.total = audioWords.length;

        // Writing: 3 случайных слова (уникальные от других упражнений)
        const usedWordIds = new Set([
            ...tfWords.map(w => w.id),
            ...audioWords.map(w => w.id)
        ]);
        const availableWords = words.filter(w => !usedWordIds.has(w.id));
        const writingWords = this.getRandomWords(
            availableWords.length > 0 ? availableWords : words, 
            3
        );
        this.exerciseData.writing.questions = writingWords.map(word => ({
            word,
            userAnswer: '',
            isCorrect: false
        }));
        this.exerciseData.writing.total = writingWords.length;

        console.log('Exercises initialized:', {
            trueFalse: this.exerciseData.trueFalse.questions.length,
            audio: this.exerciseData.audio.questions.length,
            writing: this.exerciseData.writing.questions.length,
            trueFalseMix: this.exerciseData.trueFalse.questions.map(q => q.correctAnswer)
        });
    }

    getRandomWords(words, count) {
        const shuffled = [...words].sort(() => Math.random() - 0.5);
        return shuffled.slice(0, Math.min(count, words.length));
    }

    // 🔥 УЛУЧШЕННЫЙ МЕТОД: получаем реалистичные неправильные переводы
    getWrongTranslation(allWords, correctWord) {
        const otherWords = allWords.filter(w => w.id !== correctWord.id);
        
        if (otherWords.length === 0) {
            return 'неизвестное слово';
        }
        
        // Предпочитаем слова из того же урока для реалистичности
        const randomWord = otherWords[Math.floor(Math.random() * otherWords.length)];
        return randomWord.translation;
    }

    // 🔥 УЛУЧШЕННЫЙ МЕТОД: умные варианты для аудио теста
    generateSmartAudioOptions(allWords, correctWord) {
        const options = [{ text: correctWord.translation, isCorrect: true }];
        const otherWords = allWords.filter(w => w.id !== correctWord.id);
        
        // Выбираем слова с похожей длиной перевода для реалистичности
        const similarLengthWords = otherWords.filter(w => 
            Math.abs(w.translation.length - correctWord.translation.length) <= 3
        );
        
        const candidates = similarLengthWords.length > 0 ? similarLengthWords : otherWords;
        
        for (let i = 0; i < 3 && candidates.length > 0; i++) {
            const randomIndex = Math.floor(Math.random() * candidates.length);
            const randomWord = candidates.splice(randomIndex, 1)[0];
            options.push({ text: randomWord.translation, isCorrect: false });
        }
        
        // Если не хватило слов, добираем из оставшихся
        while (options.length < 4 && otherWords.length > 0) {
            const randomIndex = Math.floor(Math.random() * otherWords.length);
            const randomWord = otherWords.splice(randomIndex, 1)[0];
            if (!options.some(opt => opt.text === randomWord.translation)) {
                options.push({ text: randomWord.translation, isCorrect: false });
            }
        }
        
        return options.sort(() => Math.random() - 0.5);
    }

    async preloadAudioFiles() {
        if (!this.lessonData?.words) return;
        
        console.log('Preloading audio files...');
        const audioPromises = this.lessonData.words.map(async (word) => {
            if (word.audio_url) {
                try {
                    const audio = new Audio();
                    audio.src = word.audio_url;
                    audio.preload = 'auto';
                    
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            console.log(`Audio timeout: ${word.audio_url}`);
                            resolve();
                        }, 3000);
                        
                        audio.addEventListener('canplaythrough', () => {
                            clearTimeout(timeout);
                            console.log(`Audio loaded: ${word.audio_url}`);
                            resolve();
                        }, { once: true });
                        
                        audio.addEventListener('error', (e) => {
                            clearTimeout(timeout);
                            console.warn(`Audio load error: ${word.audio_url}`, e);
                            reject(e);
                        }, { once: true });
                    });
                    
                    this.audioCache.set(word.audio_url, audio);
                } catch (error) {
                    console.warn(`Audio preload failed: ${word.audio_url}`, error);
                }
            }
        });
        
        await Promise.allSettled(audioPromises);
        console.log('Audio preloading completed');
    }

    renderLesson() {
        if (!this.lessonData) {
            this.showError('Данные урока не загружены');
            return;
        }

        const lesson = this.lessonData.lesson;
        console.log('Rendering lesson:', lesson.title);
        
        this.getCachedElement('lesson-title').textContent = lesson.title;
        this.hideProgressBar();
        this.renderCurrentCard();
    }

    getCachedElement(id) {
        if (!this.domCache.has(id)) {
            this.domCache.set(id, document.getElementById(id));
        }
        return this.domCache.get(id);
    }

    renderCurrentCard() {
        if (!this.lessonData?.words?.length) {
            this.showError('Слова не найдены в уроке');
            return;
        }

        const word = this.lessonData.words[this.currentCardIndex];
        if (!word) {
            this.showError('Ошибка данных слова');
            return;
        }
        
        console.log('Rendering card:', this.currentCardIndex, word.arabic);
        
        this.isCardFlipped = false;
        this.getCachedElement('single-card').classList.remove('flipped');
        this.updateCardSide('front', word);
        this.updateCardSide('back', word);
        this.updateCardNavigation();
        this.updateProgressDots();
    }

    updateCardSide(side, word) {
        const prefix = side === 'front' ? 'card' : 'card-back';
        const elements = {
            image: this.getCachedElement(`${prefix}-image`),
            arabic: this.getCachedElement(`${prefix}-arabic`),
            transcription: this.getCachedElement(`${prefix}-transcription`),
            translation: this.getCachedElement(`${prefix}-translation`),
            exampleVerse: this.getCachedElement(`${prefix}-example-verse`),
            exampleTranslation: this.getCachedElement(`${prefix}-example-translation`),
            audioBtn: this.getCachedElement(`${prefix}-audio-btn`)
        };

        if (!elements.image || !elements.arabic) {
            console.error('Card elements not found for side:', side);
            return;
        }

        // Image
        if (word.image_url) {
            elements.image.innerHTML = '';
            const img = new Image();
            img.src = word.image_url;
            img.alt = word.arabic || 'Арабское слово';
            img.className = 'word-image';
            img.onerror = () => {
                console.warn('Image load failed:', word.image_url);
                this.showDefaultImage(elements.image);
            };
            img.onload = () => console.log('Image loaded:', word.image_url);
            elements.image.appendChild(img);
        } else {
            this.showDefaultImage(elements.image);
        }
        
        // Text content
        elements.arabic.textContent = word.arabic || '...';
        if (elements.transcription) elements.transcription.textContent = word.transcription || '';
        if (elements.translation) elements.translation.textContent = word.translation || 'Перевод не указан';
        if (elements.exampleVerse) elements.exampleVerse.textContent = word.example_verse || 'Пример не указан';
        if (elements.exampleTranslation) elements.exampleTranslation.textContent = word.example_translation || 'Перевод примера не указан';
        
        // Audio button
        if (elements.audioBtn) {
            const hasAudio = word.audio_url && this.audioCache.has(word.audio_url);
            elements.audioBtn.style.display = hasAudio ? 'flex' : 'none';
            console.log('Audio button state:', hasAudio, word.audio_url);
        }
    }

    showDefaultImage(container) {
        if (container) {
            container.innerHTML = '<div class="word-image" style="background: var(--gradient-primary); display: flex; align-items: center; justify-content: center;"><i class="fas fa-image" style="font-size: 48px; color: rgba(255, 255, 255, 0.8);"></i></div>';
        }
    }

    updateCardNavigation() {
        const totalCards = this.lessonData.words.length;
        const prevBtn = this.getCachedElement('prev-card-btn');
        const nextBtn = this.getCachedElement('next-card-btn');
        
        if (prevBtn) prevBtn.disabled = this.currentCardIndex === 0;
        if (nextBtn) nextBtn.disabled = this.currentCardIndex === totalCards - 1;
        
        console.log('Card navigation updated:', {
            current: this.currentCardIndex,
            total: totalCards,
            prevDisabled: this.currentCardIndex === 0,
            nextDisabled: this.currentCardIndex === totalCards - 1
        });
    }

    updateProgressDots() {
        const container = this.getCachedElement('cards-progress');
        if (!container) return;
        
        container.innerHTML = '';
        const totalCards = this.lessonData.words.length;
        
        for (let i = 0; i < totalCards; i++) {
            const dot = document.createElement('div');
            dot.className = `progress-dot ${i === this.currentCardIndex ? 'active' : ''}`;
            dot.addEventListener('click', () => this.goToCard(i));
            container.appendChild(dot);
        }
        
        console.log('Progress dots updated:', totalCards, 'dots');
    }

    goToCard(index) {
        if (index >= 0 && index < this.lessonData.words.length) {
            console.log('Going to card:', index);
            this.currentCardIndex = index;
            this.renderCurrentCard();
        }
    }

    nextCard() {
        if (this.currentCardIndex < this.lessonData.words.length - 1) {
            this.currentCardIndex++;
            this.renderCurrentCard();
        }
    }

    previousCard() {
        if (this.currentCardIndex > 0) {
            this.currentCardIndex--;
            this.renderCurrentCard();
        }
    }

    flipCard() {
        this.isCardFlipped = !this.isCardFlipped;
        const card = this.getCachedElement('single-card');
        if (card) {
            card.classList.toggle('flipped', this.isCardFlipped);
            console.log('Card flipped:', this.isCardFlipped);
        }
    }

    playCurrentAudio() {
        const word = this.lessonData.words[this.currentCardIndex];
        if (word?.audio_url) {
            console.log('Playing audio for word:', word.arabic);
            this.playAudio(word.audio_url);
        } else {
            console.warn('No audio URL for current word');
        }
    }

    playAudio(audioUrl) {
        const cachedAudio = this.audioCache.get(audioUrl);
        const audio = cachedAudio || new Audio(audioUrl);
        
        console.log('Playing audio:', audioUrl, 'cached:', !!cachedAudio);
        
        audio.currentTime = 0;
        audio.play().catch(error => {
            console.error('Audio play error:', error);
            this.showToast('Ошибка воспроизведения аудио', 'error');
        });
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'error' ? 'var(--error)' : 'var(--primary)'};
            color: white;
            padding: 12px 20px;
            border-radius: var(--border-radius);
            z-index: 10000;
            font-weight: 600;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3000);
    }

    startExercises() {
        console.log('Starting exercises...');
        this.showProgressBar();
        this.startTrueFalseExercise();
    }

    startTrueFalseExercise() {
        this.exerciseData.trueFalse.currentIndex = 0;
        this.exerciseData.trueFalse.score = 0;
        this.goToStage('exercise1');
        this.showTrueFalseQuestion(0);
    }

    showTrueFalseQuestion(index) {
        const exercise = this.exerciseData.trueFalse;
        
        if (index >= exercise.questions.length) {
            console.log('True/False exercise completed, starting audio exercise');
            this.startAudioExercise();
            return;
        }

        const question = exercise.questions[index];
        const container = this.getCachedElement('true-false-content');
        
        this.updateExerciseCounter('true-false', index + 1, exercise.questions.length);
        
        if (container) {
            container.innerHTML = this.generateTrueFalseHTML(question, index);
        }
        
        console.log('Showing True/False question:', index + 1, 'of', exercise.questions.length);
    }

    generateTrueFalseHTML(question, index) {
        const word = question.word;
        return `
            ${word.image_url ? `
                <img src="${word.image_url}" 
                     alt="${word.arabic}" 
                     class="true-false-image"
                     onerror="this.style.display='none'">
            ` : ''}
            
            <div class="true-false-question">
                "${word.arabic}" означает "${question.displayedTranslation}"?
            </div>
            
            <div class="true-false-buttons">
                <button class="btn-true" onclick="lesson.handleTrueFalseAnswer(true, ${index})">
                    <i class="fas fa-check"></i> Верно
                </button>
                <button class="btn-false" onclick="lesson.handleTrueFalseAnswer(false, ${index})">
                    <i class="fas fa-times"></i> Неверно
                </button>
            </div>
        `;
    }

    async handleTrueFalseAnswer(userAnswer, questionIndex) {
        const exercise = this.exerciseData.trueFalse;
        const question = exercise.questions[questionIndex];
        
        const isCorrect = userAnswer === question.correctAnswer;
        question.userAnswer = userAnswer;
        question.isCorrect = isCorrect;

        if (isCorrect) {
            exercise.score++;
        }

        console.log('True/False answer:', {
            question: questionIndex,
            userAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect,
            currentScore: exercise.score
        });

        this.showTrueFalseFeedback(questionIndex, isCorrect);
        
        try {
            await this.updateWordProgress(question.word.id, isCorrect, this.lessonId);
        } catch (error) {
            console.warn('Progress save failed, continuing...');
        }

        exercise.currentIndex = questionIndex + 1;
        
        setTimeout(() => {
            this.showTrueFalseQuestion(exercise.currentIndex);
        }, 1000);
    }

    showTrueFalseFeedback(questionIndex, isCorrect) {
        const buttons = document.querySelectorAll('.btn-true, .btn-false');
        buttons.forEach(btn => {
            btn.disabled = true;
            btn.style.background = isCorrect ? 'var(--gradient-secondary)' : 'var(--gradient-accent)';
        });
    }

    startAudioExercise() {
        this.exerciseData.audio.currentIndex = 0;
        this.exerciseData.audio.score = 0;
        this.goToStage('exercise2');
        this.showAudioQuestion(0);
    }

    showAudioQuestion(index) {
        const exercise = this.exerciseData.audio;
        
        if (index >= exercise.questions.length) {
            console.log('Audio exercise completed, starting writing exercise');
            this.startWritingExercise();
            return;
        }

        const question = exercise.questions[index];
        const container = this.getCachedElement('audio-test-content');
        
        this.updateExerciseCounter('audio', index + 1, exercise.questions.length);
        
        if (container) {
            container.innerHTML = this.generateAudioHTML(question, index);
        }
        
        console.log('Showing Audio question:', index + 1, 'of', exercise.questions.length);
    }

    generateAudioHTML(question, index) {
        const word = question.word;
        return `
            ${word.image_url ? `
                <img src="${word.image_url}" 
                     alt="${word.arabic}" 
                     class="audio-test-image"
                     onerror="this.style.display='none'">
            ` : ''}
            
            ${word.audio_url ? `
                <button class="audio-btn-large" onclick="lesson.playAudio('${word.audio_url}')">
                    <i class="fas fa-volume-up"></i>
                </button>
            ` : ''}
            
            <div class="audio-options">
                ${question.options.map((option, i) => `
                    <div class="audio-option" onclick="lesson.handleAudioAnswer(${option.isCorrect}, ${index}, ${i})">
                        ${option.text}
                    </div>
                `).join('')}
            </div>
        `;
    }

    async handleAudioAnswer(isCorrect, questionIndex, optionIndex) {
        const exercise = this.exerciseData.audio;
        const question = exercise.questions[questionIndex];
        
        question.userAnswer = optionIndex;
        question.isCorrect = isCorrect;

        if (isCorrect) {
            exercise.score++;
        }

        console.log('Audio answer:', {
            question: questionIndex,
            option: optionIndex,
            isCorrect,
            currentScore: exercise.score
        });

        this.showAudioFeedback(questionIndex, optionIndex, isCorrect);
        
        try {
            await this.updateWordProgress(question.word.id, isCorrect, this.lessonId);
        } catch (error) {
            console.warn('Progress save failed, continuing...');
        }

        exercise.currentIndex = questionIndex + 1;
        
        setTimeout(() => {
            this.showAudioQuestion(exercise.currentIndex);
        }, 1000);
    }

    showAudioFeedback(questionIndex, selectedIndex, isCorrect) {
        const options = document.querySelectorAll('.audio-option');
        const exercise = this.exerciseData.audio;
        const question = exercise.questions[questionIndex];
        
        options.forEach((option, index) => {
            option.classList.remove('selected', 'correct', 'incorrect');
            
            if (index === selectedIndex) {
                option.classList.add('selected');
                option.classList.add(isCorrect ? 'correct' : 'incorrect');
            }
            
            if (!isCorrect && question.options[index].isCorrect) {
                option.classList.add('correct');
            }
            
            option.style.pointerEvents = 'none';
        });
    }

    startWritingExercise() {
        this.exerciseData.writing.currentIndex = 0;
        this.exerciseData.writing.score = 0;
        this.goToStage('exercise3');
        this.showWritingQuestion(0);
    }

    showWritingQuestion(index) {
        const exercise = this.exerciseData.writing;
        
        if (index >= exercise.questions.length) {
            console.log('Writing exercise completed, showing results');
            this.showResults();
            return;
        }

        const question = exercise.questions[index];
        const container = this.getCachedElement('writing-content');
        
        this.updateExerciseCounter('writing', index + 1, exercise.questions.length);
        
        if (container) {
            container.innerHTML = this.generateWritingHTML(question, index);
        }
        
        console.log('Showing Writing question:', index + 1, 'of', exercise.questions.length);
    }

    generateWritingHTML(question, index) {
        const word = question.word;
        return `
            ${word.image_url ? `
                <img src="${word.image_url}" 
                     alt="${word.arabic}" 
                     class="writing-image"
                     onerror="this.style.display='none'">
            ` : ''}
            
            ${word.audio_url ? `
                <div class="writing-audio">
                    <button class="audio-btn-large" onclick="lesson.playAudio('${word.audio_url}')">
                        <i class="fas fa-volume-up"></i>
                    </button>
                </div>
            ` : ''}
            
            <div class="writing-input-container">
                <input type="text" 
                       class="writing-input" 
                       placeholder="Напишите перевод..."
                       id="writing-answer-${index}"
                       autocomplete="off">
                <div class="writing-feedback" id="writing-feedback-${index}"></div>
            </div>
            
            <button class="btn-primary" onclick="lesson.handleWritingAnswer(${index})">
                <i class="fas fa-check"></i> Проверить
            </button>
        `;
    }

    async handleWritingAnswer(questionIndex) {
        const input = document.getElementById(`writing-answer-${questionIndex}`);
        const feedback = document.getElementById(`writing-feedback-${questionIndex}`);
        const exercise = this.exerciseData.writing;
        const question = exercise.questions[questionIndex];
        
        if (!input || !feedback || !question) {
            console.error('Writing answer elements not found');
            return;
        }
        
        const userAnswer = input.value.trim().toLowerCase();
        
        if (!userAnswer) {
            this.showToast('Введите ответ', 'warning');
            return;
        }
        
        const correctAnswer = question.word.translation.toLowerCase();
        const isCorrect = userAnswer === correctAnswer;
        
        question.userAnswer = userAnswer;
        question.isCorrect = isCorrect;

        if (isCorrect) {
            exercise.score++;
            feedback.textContent = 'Правильно! ✓';
            feedback.className = 'writing-feedback correct';
        } else {
            feedback.textContent = `Неправильно. Правильный ответ: ${question.word.translation}`;
            feedback.className = 'writing-feedback incorrect';
        }

        feedback.style.display = 'block';
        input.disabled = true;
        
        console.log('Writing answer:', {
            question: questionIndex,
            userAnswer,
            correctAnswer,
            isCorrect,
            currentScore: exercise.score
        });

        try {
            await this.updateWordProgress(question.word.id, isCorrect, this.lessonId);
        } catch (error) {
            console.warn('Progress save failed, continuing...');
        }

        exercise.currentIndex = questionIndex + 1;
        
        setTimeout(() => {
            this.showWritingQuestion(exercise.currentIndex);
        }, 1500);
    }

    async updateWordProgress(wordId, isCorrect, lessonId) {
        try {
            console.log('Updating word progress:', { wordId, isCorrect, lessonId });
            
            const result = await this.auth.apiCall('/progress/update/', {
                method: 'POST',
                body: JSON.stringify({
                    word_id: wordId,
                    is_correct: isCorrect,
                    lesson_id: lessonId,
                    time_spent: Math.round((Date.now() - this.lessonStartTime) / 1000)
                })
            });
            
            console.log('Word progress updated:', result);
            return result;
        } catch (error) {
            console.error('Progress update error:', error);
            this.showToast('Ошибка сохранения прогресса', 'error');
            throw error;
        }
    }

    async showResults() {
        console.log('Showing results...');
        this.goToStage('results');
        
        const totalScore = this.exerciseData.trueFalse.score + 
                          this.exerciseData.audio.score + 
                          this.exerciseData.writing.score;
        const totalQuestions = this.exerciseData.trueFalse.questions.length + 
                              this.exerciseData.audio.questions.length + 
                              this.exerciseData.writing.questions.length;
        const percentage = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;
        
        console.log('Final results:', {
            trueFalse: `${this.exerciseData.trueFalse.score}/${this.exerciseData.trueFalse.questions.length}`,
            audio: `${this.exerciseData.audio.score}/${this.exerciseData.audio.questions.length}`,
            writing: `${this.exerciseData.writing.score}/${this.exerciseData.writing.questions.length}`,
            total: `${totalScore}/${totalQuestions}`,
            percentage: percentage + '%'
        });
        
        const finalScoreElement = this.getCachedElement('final-score');
        if (finalScoreElement) {
            finalScoreElement.textContent = `${percentage}%`;
        }
        
        let description = '';
        if (percentage >= 90) {
            description = 'Отличный результат! Вы прекрасно усвоили материал. 🎯';
        } else if (percentage >= 70) {
            description = 'Хороший результат! Продолжайте в том же духе. 💪';
        } else if (percentage >= 50) {
            description = 'Неплохо, но есть куда стремиться. Повторите материал. 📚';
        } else {
            description = 'Рекомендуем повторить урок для лучшего усвоения. 🔄';
        }
        
        const descriptionElement = this.getCachedElement('results-description');
        if (descriptionElement) {
            descriptionElement.textContent = description;
        }
        
        await this.saveLessonCompletion(percentage);
    }

    async saveLessonCompletion(score) {
        if (this.isLessonCompleted) {
            console.log('Lesson already marked as completed');
            return;
        }

        try {
            console.log('Saving lesson completion...', {
                lesson_id: this.lessonId,
                score: score
            });

            const result = await this.auth.apiCall('/lessons/complete/', {
                method: 'POST',
                body: JSON.stringify({
                    lesson_id: this.lessonId,
                    score: score
                })
            });

            console.log('Lesson completion saved:', result);
            
            this.isLessonCompleted = true;

            if (result.lesson_completed) {
                this.showToast('Урок завершен! 🎉', 'success');
                
                if (result.all_lessons_completed) {
                    this.showToast('Все уроки блока завершены! Тест теперь доступен. 🏆', 'success');
                }
            }

        } catch (error) {
            console.error('Lesson completion error:', error);
            this.showToast('Ошибка сохранения прогресса урока', 'error');
        }
    }

    goToStage(stage) {
        console.log('Going to stage:', stage);
        
        document.querySelectorAll('.lesson-stage').forEach(el => {
            el.classList.remove('active');
        });
        
        const stageElement = this.getCachedElement(`stage-${stage}`);
        if (stageElement) {
            stageElement.classList.add('active');
        }
        
        this.updateProgressBar(stage);
        this.currentStage = stage;
    }

    updateProgressBar(stage) {
        const stages = ['cards', 'exercise1', 'exercise2', 'exercise3', 'results'];
        const currentIndex = stages.indexOf(stage);
        const progress = (currentIndex / (stages.length - 1)) * 100;
        const progressBar = this.getCachedElement('progress-bar');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        console.log('Progress bar updated:', { stage, progress: progress + '%' });
    }

    showProgressBar() {
        const progressElement = this.getCachedElement('lesson-progress');
        if (progressElement) {
            progressElement.classList.add('visible');
            console.log('Progress bar shown');
        }
    }

    hideProgressBar() {
        const progressElement = this.getCachedElement('lesson-progress');
        if (progressElement) {
            progressElement.classList.remove('visible');
            console.log('Progress bar hidden');
        }
    }

    updateExerciseCounter(exerciseType, current, total) {
        const counter = this.getCachedElement(`${exerciseType}-counter`);
        if (counter) {
            counter.textContent = `${current}/${total}`;
        }
    }

    restartLesson() {
        console.log('Restarting lesson...');
        
        this.currentStage = 'cards';
        this.currentCardIndex = 0;
        this.isCardFlipped = false;
        this.isLessonCompleted = false;
        
        Object.values(this.exerciseData).forEach(exercise => {
            exercise.currentIndex = 0;
            exercise.score = 0;
            exercise.questions.forEach(q => {
                q.userAnswer = null;
                q.isCorrect = false;
            });
        });
        
        this.lessonStartTime = Date.now();
        this.hideProgressBar();
        this.goToStage('cards');
        this.renderCurrentCard();
        
        this.showToast('Урок перезапущен', 'info');
    }

    goToDashboard() {
        console.log('Going to dashboard...');
        window.location.href = '/dashboard/';
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && this.currentStage === 'exercise3') {
                const exercise = this.exerciseData.writing;
                this.handleWritingAnswer(exercise.currentIndex);
            }
        });

        let touchStartX = 0;
        const card = this.getCachedElement('single-card');
        
        if (card) {
            card.addEventListener('touchstart', (e) => {
                touchStartX = e.touches[0].clientX;
            });

            card.addEventListener('touchend', (e) => {
                const touchEndX = e.changedTouches[0].clientX;
                const diff = touchStartX - touchEndX;
                
                if (Math.abs(diff) > 50) {
                    if (diff > 0) {
                        this.nextCard();
                    } else {
                        this.previousCard();
                    }
                }
            });
        }

        document.addEventListener('submit', (e) => {
            e.preventDefault();
        });

        console.log('Event listeners setup completed');
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
        
        const container = document.querySelector('.lesson-container');
        if (container) {
            container.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 40px 20px;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: var(--warning); margin-bottom: 20px;"></i>
                    <p style="font-size: 16px; color: var(--text-primary); margin-bottom: 20px;">${message}</p>
                    <button onclick="window.history.back()" style="background: var(--gradient-primary); color: white; border: none; padding: 12px 24px; border-radius: var(--border-radius); font-weight: 600; cursor: pointer;">
                        Вернуться назад
                    </button>
                </div>
            `;
        }
    }
}

const lesson = new LessonDetailPage();
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing lesson...');
    lesson.initialize();
});