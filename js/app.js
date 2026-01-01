// Основная логика приложения SlingCheck v3.0
// Поддержка загрузки 3 фото (спереди, сзади, сбоку)
class SlingCheckApp {
  constructor() {
    // Хранилище загруженных изображений
    this.images = {
      front: null,
      back: null,
      side: null
    };

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
      // Информация о ребёнке
      childAge: document.getElementById('childAge'),
      childWeight: document.getElementById('childWeight'),

      // Загрузка фото - спереди
      imageInputFront: document.getElementById('imageInputFront'),
      uploadBtnFront: document.getElementById('uploadBtnFront'),
      uploadAreaFront: document.getElementById('uploadAreaFront'),
      previewSlotFront: document.getElementById('previewSlotFront'),
      imagePreviewFront: document.getElementById('imagePreviewFront'),
      clearBtnFront: document.getElementById('clearBtnFront'),

      // Загрузка фото - сзади
      imageInputBack: document.getElementById('imageInputBack'),
      uploadBtnBack: document.getElementById('uploadBtnBack'),
      uploadAreaBack: document.getElementById('uploadAreaBack'),
      previewSlotBack: document.getElementById('previewSlotBack'),
      imagePreviewBack: document.getElementById('imagePreviewBack'),
      clearBtnBack: document.getElementById('clearBtnBack'),

      // Загрузка фото - сбоку
      imageInputSide: document.getElementById('imageInputSide'),
      uploadBtnSide: document.getElementById('uploadBtnSide'),
      uploadAreaSide: document.getElementById('uploadAreaSide'),
      previewSlotSide: document.getElementById('previewSlotSide'),
      imagePreviewSide: document.getElementById('imagePreviewSide'),
      clearBtnSide: document.getElementById('clearBtnSide'),

      // Основные элементы управления
      analyzeBtn: document.getElementById('analyzeBtn'),
      clearAllBtn: document.getElementById('clearAllBtn'),
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
    const required = ['analyzeBtn', 'modelSelect', 'modeSelect', 'apiKeyInput'];
    const missing = required.filter(key => !this.elements[key]);
    if (missing.length > 0) {
      console.error('Отсутствуют элементы:', missing);
      throw new Error(`Не найдены элементы: ${missing.join(', ')}`);
    }
  }

  // Настройка обработчиков событий
  initEventListeners() {
    // Загрузка изображений - спереди
    this.setupImageSlot('Front', 'front');
    this.setupImageSlot('Back', 'back');
    this.setupImageSlot('Side', 'side');

    // Очистка всех
    if (this.elements.clearAllBtn) {
      this.elements.clearAllBtn.addEventListener('click', () => this.clearAllImages());
    }

    // Анализ
    this.elements.analyzeBtn.addEventListener('click', () => this.analyzeImages());

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

  // Настройка слота загрузки изображения
  setupImageSlot(suffix, slot) {
    const input = this.elements[`imageInput${suffix}`];
    const btn = this.elements[`uploadBtn${suffix}`];
    const uploadArea = this.elements[`uploadArea${suffix}`];
    const previewSlot = this.elements[`previewSlot${suffix}`];
    const preview = this.elements[`imagePreview${suffix}`];
    const clearBtn = this.elements[`clearBtn${suffix}`];

    if (!input || !btn) return;

    // Клик на кнопку
    btn.addEventListener('click', () => input.click());

    // Выбор файла
    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handleImageFile(e.target.files[0], slot);
      }
    });

    // Drag & Drop
    if (uploadArea) {
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });
      uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
          this.handleImageFile(e.dataTransfer.files[0], slot);
        }
      });
    }

    // Очистка
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearImage(slot));
    }
  }

  // Валидация и обработка файла
  handleImageFile(file, slot) {
    if (!CONFIG.app.acceptedFormats.includes(file.type)) {
      this.showError(CONFIG.ui.ru.errors.invalidFormat);
      return;
    }
    if (file.size > CONFIG.app.maxImageSize) {
      this.showError(CONFIG.ui.ru.errors.tooLarge);
      return;
    }

    this.images[slot] = file;
    this.displayImagePreview(file, slot);
    this.updateAnalyzeButton();
  }

  // Отображение превью
  displayImagePreview(file, slot) {
    const suffix = slot.charAt(0).toUpperCase() + slot.slice(1);
    const uploadArea = this.elements[`uploadArea${suffix}`];
    const previewSlot = this.elements[`previewSlot${suffix}`];
    const preview = this.elements[`imagePreview${suffix}`];

    if (!preview || !previewSlot || !uploadArea) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      uploadArea.style.display = 'none';
      previewSlot.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  // Очистка одного изображения
  clearImage(slot) {
    const suffix = slot.charAt(0).toUpperCase() + slot.slice(1);
    const input = this.elements[`imageInput${suffix}`];
    const uploadArea = this.elements[`uploadArea${suffix}`];
    const previewSlot = this.elements[`previewSlot${suffix}`];
    const preview = this.elements[`imagePreview${suffix}`];

    this.images[slot] = null;
    if (input) input.value = '';
    if (preview) preview.src = '';
    if (uploadArea) uploadArea.style.display = 'flex';
    if (previewSlot) previewSlot.style.display = 'none';

    this.updateAnalyzeButton();
  }

  // Очистка всех изображений
  clearAllImages() {
    ['front', 'back', 'side'].forEach(slot => this.clearImage(slot));
    this.elements.resultsContainer.innerHTML = '';
  }

  // Проверка наличия хотя бы одного изображения
  hasAnyImage() {
    return Object.values(this.images).some(img => img !== null);
  }

  // Получение загруженных изображений
  getUploadedImages() {
    const result = [];
    if (this.images.front) result.push({ file: this.images.front, label: 'Спереди' });
    if (this.images.back) result.push({ file: this.images.back, label: 'Сзади' });
    if (this.images.side) result.push({ file: this.images.side, label: 'Сбоку' });
    return result;
  }

  // Обновление состояния кнопки анализа
  updateAnalyzeButton() {
    this.elements.analyzeBtn.disabled = !this.hasAnyImage();
  }

  // Получение информации о ребёнке
  getChildInfo() {
    return {
      age: this.elements.childAge?.value || null,
      weight: this.elements.childWeight?.value || null
    };
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
      } else if (model.provider === 'lanit') {
        this.elements.modelHint.textContent = '🏢 Корпоративный vLLM (требуется доступ к LANIT)';
        this.elements.modelHint.style.color = '#6366F1';
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

  // Анализ изображений
  async analyzeImages() {
    if (!this.hasAnyImage()) {
      this.showError('Пожалуйста, загрузите хотя бы одно фото');
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
      const uploadedImages = this.getUploadedImages();
      const childInfo = this.getChildInfo();
      const model = CONFIG.models[this.currentModel];
      const mode = CONFIG.analysisModes[this.currentMode];

      this.updateLoadingText(
        `Анализируем ${uploadedImages.length} фото...`,
        `Модель: ${model.name}`
      );

      let result;

      if (manualData) {
        // Анализ с ручной позицией
        result = await aiClient.analyzeMultipleWithManualPosition(
          uploadedImages,
          this.currentModel,
          apiKey,
          manualData,
          childInfo
        );
      } else {
        // Стандартный анализ
        result = await aiClient.analyzeMultiple(
          uploadedImages,
          this.currentModel,
          apiKey,
          this.currentMode,
          childInfo,
          (step, info) => this.updateLoadingText(step, info)
        );
      }

      this.displayResults(result, uploadedImages.length, childInfo, manualData);

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
  displayResults(analysisText, imageCount, childInfo, manualData = null) {
    const mode = CONFIG.analysisModes[this.currentMode];
    const model = CONFIG.models[this.currentModel];

    let infoLine = `Модель: ${model.name}`;
    infoLine += ` | Фото: ${imageCount}`;

    if (childInfo.age) {
      infoLine += ` | Возраст: ${childInfo.age}`;
    }
    if (childInfo.weight) {
      infoLine += ` | Вес: ${childInfo.weight} кг`;
    }
    if (manualData) {
      infoLine += ` | 📍 ${manualData.position}`;
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
  console.log(`🚀 SlingCheck v3.0 запущен в режиме: ${env}`);
  console.log(`📊 Доступные модели:`, Object.keys(CONFIG.models).join(', '));
  console.log(`🔧 Режимы анализа:`, Object.keys(CONFIG.analysisModes).join(', '));

  window.app = new SlingCheckApp();
});
