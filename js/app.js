// Основная логика приложения SlingCheck
class SlingCheckApp {
  constructor() {
    this.selectedImage = null;
    this.currentModel = CONFIG.defaultModel;
    this.currentMode = CONFIG.defaultAnalysisMode;
    this.apiKeys = this.loadApiKeys();
    this.useCustomPrompts = false;

    this.initElements();
    this.initEventListeners();
    this.setupModelSelector();
    this.setupModeSelector();
    this.updateUIForModel();
    this.updateUIForMode();
  }

  // Инициализация DOM элементов
  initElements() {
    this.elements = {
      imageInput: document.getElementById('imageInput'),
      imagePreview: document.getElementById('imagePreview'),
      previewContainer: document.getElementById('previewContainer'),
      uploadBtn: document.getElementById('uploadBtn'),
      uploadArea: document.getElementById('uploadArea'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      clearImageBtn: document.getElementById('clearImageBtn'),
      modelSelect: document.getElementById('modelSelect'),
      modelHint: document.getElementById('modelHint'),
      modeSelect: document.getElementById('modeSelect'),
      modeDescription: document.getElementById('modeDescription'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      saveKeyBtn: document.getElementById('saveKeyBtn'),
      resultsContainer: document.getElementById('results'),
      loadingIndicator: document.getElementById('loading'),
      loadingText: document.getElementById('loadingText'),
      loadingStep: document.getElementById('loadingStep'),
      helpBtn: document.getElementById('helpBtn'),
      helpModal: document.getElementById('helpModal'),
      modalClose: document.getElementById('modalClose'),
      // Редактор промптов
      showPromptEditor: document.getElementById('showPromptEditor'),
      promptEditorSection: document.getElementById('promptEditorSection'),
      systemPrompt: document.getElementById('systemPrompt'),
      userPrompt: document.getElementById('userPrompt'),
      resetPromptsBtn: document.getElementById('resetPromptsBtn'),
      copyPromptsBtn: document.getElementById('copyPromptsBtn'),
      // Ручной выбор позиции
      manualPositionEnabled: document.getElementById('manualPositionEnabled'),
      manualPositionSection: document.getElementById('manualPositionSection'),
      manualPosition: document.getElementById('manualPosition'),
      manualAge: document.getElementById('manualAge'),
      manualLegs: document.getElementById('manualLegs')
    };

    // Проверка критических элементов
    const required = ['imageInput', 'uploadBtn', 'analyzeBtn', 'modelSelect', 'modeSelect', 'apiKeyInput'];
    const missing = required.filter(key => !this.elements[key]);
    if (missing.length > 0) {
      console.error('Отсутствуют элементы:', missing);
      throw new Error(`Не найдены элементы: ${missing.join(', ')}`);
    }
  }

  // Настройка обработчиков событий
  initEventListeners() {
    // Загрузка изображения
    this.elements.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
    this.elements.uploadBtn.addEventListener('click', () => this.elements.imageInput.click());
    
    // Очистка изображения
    if (this.elements.clearImageBtn) {
      this.elements.clearImageBtn.addEventListener('click', () => this.clearImage());
    }

    // Drag & Drop
    const dropZone = this.elements.uploadArea;
    if (dropZone) {
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
      dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleImageFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Анализ
    this.elements.analyzeBtn.addEventListener('click', () => this.analyzeImage());

    // Смена модели
    this.elements.modelSelect.addEventListener('change', (e) => {
      this.currentModel = e.target.value;
      this.updateUIForModel();
    });

    // Смена режима
    this.elements.modeSelect.addEventListener('change', (e) => {
      this.currentMode = e.target.value;
      this.updateUIForMode();
    });

    // Сохранение API ключа
    this.elements.saveKeyBtn.addEventListener('click', () => this.saveApiKey());
    this.elements.apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.saveApiKey();
    });

    // Модальное окно
    this.elements.helpBtn.addEventListener('click', () => this.openHelpModal());
    this.elements.modalClose.addEventListener('click', () => this.closeHelpModal());
    this.elements.helpModal.addEventListener('click', (e) => {
      if (e.target === this.elements.helpModal) this.closeHelpModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.helpModal.style.display === 'flex') {
        this.closeHelpModal();
      }
    });

    // Редактор промптов
    if (this.elements.showPromptEditor) {
      this.elements.showPromptEditor.addEventListener('change', (e) => {
        this.togglePromptEditor(e.target.checked);
      });
    }
    if (this.elements.resetPromptsBtn) {
      this.elements.resetPromptsBtn.addEventListener('click', () => this.resetPrompts());
    }
    if (this.elements.copyPromptsBtn) {
      this.elements.copyPromptsBtn.addEventListener('click', () => this.copyPrompts());
    }

    // Отслеживание изменений в промптах
    if (this.elements.systemPrompt) {
      this.elements.systemPrompt.addEventListener('input', () => this.onPromptChange());
    }
    if (this.elements.userPrompt) {
      this.elements.userPrompt.addEventListener('input', () => this.onPromptChange());
    }

    // Ручной выбор позиции
    if (this.elements.manualPositionEnabled) {
      this.elements.manualPositionEnabled.addEventListener('change', (e) => {
        this.toggleManualPosition(e.target.checked);
      });
    }
  }

  // Настройка селектора моделей
  setupModelSelector() {
    this.elements.modelSelect.innerHTML = '';

    Object.entries(CONFIG.models).forEach(([key, model]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = model.name + (model.recommended ? ' ⭐' : '');
      this.elements.modelSelect.appendChild(option);
    });

    this.elements.modelSelect.value = this.currentModel;
  }

  // Настройка селектора режимов
  setupModeSelector() {
    this.elements.modeSelect.innerHTML = '';

    Object.entries(CONFIG.analysisModes).forEach(([key, mode]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = mode.name + (mode.recommended ? ' ⭐' : '');
      this.elements.modeSelect.appendChild(option);
    });

    this.elements.modeSelect.value = this.currentMode;
  }

  // Обновление UI при смене модели
  updateUIForModel() {
    const model = CONFIG.models[this.currentModel];
    const apiKey = this.apiKeys[this.currentModel];

    if (apiKey) {
      this.elements.apiKeyInput.value = apiKey;
      this.elements.apiKeyInput.type = 'password';
    } else {
      this.elements.apiKeyInput.value = '';
      this.elements.apiKeyInput.type = 'text';
    }

    this.elements.apiKeyInput.placeholder = `API ключ для ${model.name}`;
    
    // Подсказка для модели
    if (this.elements.modelHint) {
      if (model.recommended) {
        this.elements.modelHint.textContent = '⭐ Рекомендуется для лучшего качества';
        this.elements.modelHint.style.color = '#10B981';
      } else {
        this.elements.modelHint.textContent = '';
      }
    }
  }

  // Обновление UI при смене режима
  updateUIForMode() {
    const mode = CONFIG.analysisModes[this.currentMode];
    
    if (this.elements.modeDescription) {
      let desc = mode.description;
      if (mode.steps > 1) {
        desc += ` (${mode.steps} вызова API)`;
      }
      this.elements.modeDescription.textContent = desc;
    }

    // Обновляем промпты в редакторе
    this.loadPromptsForMode();
  }

  // Загрузка промптов для текущего режима
  loadPromptsForMode() {
    if (this.currentMode === 'twoStep') {
      // Для двухэтапного показываем только первый этап
      const prompts = PROMPTS.twoStep.step1;
      if (this.elements.systemPrompt) {
        this.elements.systemPrompt.value = prompts.system;
      }
      if (this.elements.userPrompt) {
        this.elements.userPrompt.value = prompts.user + '\n\n--- ЭТАП 2 генерируется автоматически ---';
      }
    } else {
      const prompts = PROMPTS[this.currentMode];
      if (prompts && this.elements.systemPrompt) {
        this.elements.systemPrompt.value = prompts.system;
      }
      if (prompts && this.elements.userPrompt) {
        this.elements.userPrompt.value = prompts.user;
      }
    }
    
    this.useCustomPrompts = false;
    aiClient.clearCustomPrompts();
  }

  // Переключение редактора промптов
  togglePromptEditor(show) {
    if (this.elements.promptEditorSection) {
      this.elements.promptEditorSection.style.display = show ? 'block' : 'none';
      if (show) {
        this.loadPromptsForMode();
      }
    }
  }

  // Переключение ручного выбора позиции
  toggleManualPosition(show) {
    if (this.elements.manualPositionSection) {
      this.elements.manualPositionSection.style.display = show ? 'block' : 'none';
    }
  }

  // Получение ручной позиции
  getManualPositionData() {
    if (!this.elements.manualPositionEnabled?.checked) {
      return null;
    }
    
    const position = this.elements.manualPosition?.value;
    const age = this.elements.manualAge?.value || null;
    const legs = this.elements.manualLegs?.value || null;
    
    if (!position) {
      return null;
    }
    
    return { position, age, legs };
  }

  // Обработка изменения промптов
  onPromptChange() {
    this.useCustomPrompts = true;
    aiClient.setCustomPrompts(
      this.elements.systemPrompt.value,
      this.elements.userPrompt.value
    );
  }

  // Сброс промптов
  resetPrompts() {
    this.loadPromptsForMode();
    this.showSuccess('Промпты сброшены');
  }

  // Копирование промптов
  copyPrompts() {
    const text = `=== SYSTEM ===\n${this.elements.systemPrompt.value}\n\n=== USER ===\n${this.elements.userPrompt.value}`;
    navigator.clipboard.writeText(text).then(() => {
      this.showSuccess('Скопировано в буфер');
    });
  }

  // Загрузка API ключей
  loadApiKeys() {
    const keys = {};
    Object.entries(CONFIG.models).forEach(([modelKey, model]) => {
      const savedKey = localStorage.getItem(model.apiKeyStorageKey);
      if (savedKey) {
        keys[modelKey] = savedKey;
      }
    });
    return keys;
  }

  // Сохранение API ключа
  saveApiKey() {
    const apiKey = this.elements.apiKeyInput.value.trim();
    if (!apiKey) {
      this.showError('Введите API ключ');
      return;
    }

    const model = CONFIG.models[this.currentModel];
    localStorage.setItem(model.apiKeyStorageKey, apiKey);
    this.apiKeys[this.currentModel] = apiKey;
    this.elements.apiKeyInput.type = 'password';
    this.showSuccess('API ключ сохранён');
  }

  // Обработка выбора изображения
  handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) this.handleImageFile(file);
  }

  // Валидация и обработка файла
  handleImageFile(file) {
    if (!CONFIG.app.acceptedFormats.includes(file.type)) {
      this.showError(CONFIG.ui.ru.errors.invalidFormat);
      return;
    }
    if (file.size > CONFIG.app.maxImageSize) {
      this.showError(CONFIG.ui.ru.errors.tooLarge);
      return;
    }

    this.selectedImage = file;
    this.displayImagePreview(file);
    this.elements.analyzeBtn.disabled = false;
  }

  // Отображение превью
  displayImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.elements.imagePreview.src = e.target.result;
      this.elements.previewContainer.style.display = 'block';
      this.elements.uploadArea.style.display = 'none';
    };
    reader.readAsDataURL(file);
  }

  // Очистка изображения
  clearImage() {
    this.selectedImage = null;
    this.elements.imagePreview.src = '';
    this.elements.previewContainer.style.display = 'none';
    this.elements.uploadArea.style.display = 'block';
    this.elements.analyzeBtn.disabled = true;
    this.elements.imageInput.value = '';
    this.elements.resultsContainer.innerHTML = '';
  }

  // Анализ изображения
  async analyzeImage() {
    if (!this.selectedImage) {
      this.showError(CONFIG.ui.ru.errors.noImage);
      return;
    }

    const apiKey = this.apiKeys[this.currentModel];
    if (!apiKey) {
      this.showError(CONFIG.ui.ru.errors.noApiKey);
      this.elements.apiKeyInput.focus();
      return;
    }

    // Проверяем ручную позицию
    const manualData = this.getManualPositionData();
    if (this.elements.manualPositionEnabled?.checked && !manualData?.position) {
      this.showError('Выберите позицию ребёнка');
      return;
    }

    this.showLoading(true);
    this.elements.analyzeBtn.disabled = true;
    this.elements.resultsContainer.innerHTML = '';

    try {
      const mode = CONFIG.analysisModes[this.currentMode];
      let result;

      // Если указана ручная позиция — используем специальный режим
      if (manualData) {
        const legsText = manualData.legs ? manualData.legs : 'определит модель';
        const ageText = manualData.age ? manualData.age : 'определит модель';
        this.updateLoadingText('Анализируем с указанной позицией...', `Позиция: ${manualData.position}`);
        result = await aiClient.analyzeWithManualPosition(
          this.selectedImage,
          this.currentModel,
          apiKey,
          manualData.position,
          manualData.age,
          manualData.legs
        );
      } else {
        // Обычный анализ
        if (mode.steps > 1) {
          this.updateLoadingText('Этап 1: Определение позиции...', `Режим: ${mode.name}`);
        } else {
          this.updateLoadingText('Анализируем фото...', `Модель: ${CONFIG.models[this.currentModel].name}`);
        }

        const callbacks = {
          onStep1Complete: (response, parsed) => {
            this.updateLoadingText('Этап 2: Полный анализ...', `Позиция: ${parsed.position}`);
          }
        };

        result = await aiClient.analyze(
          this.selectedImage,
          this.currentModel,
          apiKey,
          this.currentMode,
          callbacks
        );
      }

      this.displayResults(result, manualData);

    } catch (error) {
      console.error('Ошибка анализа:', error);
      this.showError(CONFIG.ui.ru.errors.apiError + error.message);
    } finally {
      this.showLoading(false);
      this.elements.analyzeBtn.disabled = false;
    }
  }

  // Обновление текста загрузки
  updateLoadingText(main, sub) {
    if (this.elements.loadingText) {
      this.elements.loadingText.textContent = main;
    }
    if (this.elements.loadingStep) {
      this.elements.loadingStep.textContent = sub || '';
    }
  }

  // Отображение результатов
  displayResults(analysisText, manualData = null) {
    const mode = CONFIG.analysisModes[this.currentMode];
    const model = CONFIG.models[this.currentModel];

    let infoLine = `Модель: ${model.name}`;
    if (manualData) {
      infoLine += ` | 📍 ${manualData.position}`;
      if (manualData.age) {
        infoLine += ` | ${manualData.age}`;
      }
    } else {
      infoLine += ` | Режим: ${mode.name}`;
    }
    if (this.useCustomPrompts) {
      infoLine += ' | ⚠️ Кастомный промпт';
    }

    this.elements.resultsContainer.innerHTML = `
      <div class="result-card">
        <h3>📋 Результат анализа</h3>
        <div class="analysis-text">${this.formatAnalysis(analysisText)}</div>
        <div class="model-info">
          <small>${infoLine}</small>
        </div>
      </div>
    `;

    this.elements.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Форматирование текста анализа
  formatAnalysis(text) {
    return '<div class="markdown-content">' + text
      // Headers
      .replace(/^### (.*$)/gm, '<h4>$1</h4>')
      .replace(/^## (.*$)/gm, '<h3>$1</h3>')
      .replace(/^# (.*$)/gm, '<h2>$1</h2>')
      // Bold and italic
      .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      // Tables (simple)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim());
        if (cells.every(c => c.trim().match(/^[-:]+$/))) {
          return ''; // Skip separator row
        }
        const cellTags = cells.map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cellTags}</tr>`;
      })
      // Checkboxes
      .replace(/\[✓\]/g, '✅')
      .replace(/\[ \]/g, '⬜')
      .replace(/\[x\]/gi, '✅')
      // Horizontal rules
      .replace(/^---$/gm, '<hr>')
      // Line breaks and paragraphs
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')
      + '</div>';
  }

  // Показ/скрытие загрузки
  showLoading(show) {
    this.elements.loadingIndicator.style.display = show ? 'flex' : 'none';
  }

  // Показ ошибки
  showError(message) {
    this.elements.resultsContainer.innerHTML = `
      <div class="error-message">
        <strong>❌ Ошибка:</strong> ${message}
      </div>
    `;
  }

  // Показ успешного сообщения
  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = '✅ ' + message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Модальное окно
  openHelpModal() {
    this.elements.helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  closeHelpModal() {
    this.elements.helpModal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  const env = CONFIG.isProduction() ? 'PRODUCTION' : 'DEVELOPMENT';
  console.log(`🚀 SlingCheck v2.0 запущен в режиме: ${env}`);
  console.log(`📊 Доступные модели:`, Object.keys(CONFIG.models).join(', '));
  console.log(`🔧 Режимы анализа:`, Object.keys(CONFIG.analysisModes).join(', '));

  window.app = new SlingCheckApp();
});
