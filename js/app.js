// Основная логика приложения SlingCheck
class SlingCheckApp {
  constructor() {
    this.selectedImage = null;
    this.currentModel = CONFIG.defaultModel;
    this.apiKeys = this.loadApiKeys();

    this.initElements();
    this.initEventListeners();
    this.setupModelSelector();
    this.updateUIForModel();
  }

  // Инициализация DOM элементов
  initElements() {
    this.elements = {
      imageInput: document.getElementById('imageInput'),
      imagePreview: document.getElementById('imagePreview'),
      previewContainer: document.getElementById('previewContainer'),
      uploadBtn: document.getElementById('uploadBtn'),
      analyzeBtn: document.getElementById('analyzeBtn'),
      modelSelect: document.getElementById('modelSelect'),
      apiKeyInput: document.getElementById('apiKeyInput'),
      saveKeyBtn: document.getElementById('saveKeyBtn'),
      resultsContainer: document.getElementById('results'),
      loadingIndicator: document.getElementById('loading'),
      helpBtn: document.getElementById('helpBtn'),
      helpModal: document.getElementById('helpModal'),
      modalClose: document.getElementById('modalClose')
    };

    // Проверяем наличие критических элементов
    const requiredElements = ['imageInput', 'uploadBtn', 'analyzeBtn', 'modelSelect', 'apiKeyInput'];
    const missingElements = requiredElements.filter(key => !this.elements[key]);

    if (missingElements.length > 0) {
      console.error('Отсутствуют необходимые DOM элементы:', missingElements);
      throw new Error(`Не найдены элементы: ${missingElements.join(', ')}`);
    }
  }

  // Настройка обработчиков событий
  initEventListeners() {
    // Загрузка изображения
    this.elements.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
    this.elements.uploadBtn.addEventListener('click', () => this.elements.imageInput.click());

    // Drag & Drop
    const dropZone = document.querySelector('.upload-area');
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handleImageFile(files[0]);
      }
    });

    // Анализ
    this.elements.analyzeBtn.addEventListener('click', () => this.analyzeImage());

    // Смена модели
    this.elements.modelSelect.addEventListener('change', (e) => {
      this.currentModel = e.target.value;
      this.updateUIForModel();
    });

    // Сохранение API ключа
    this.elements.saveKeyBtn.addEventListener('click', () => this.saveApiKey());

    // Enter для сохранения ключа
    this.elements.apiKeyInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveApiKey();
      }
    });

    // Модальное окно помощи
    this.elements.helpBtn.addEventListener('click', () => this.openHelpModal());
    this.elements.modalClose.addEventListener('click', () => this.closeHelpModal());

    // Закрытие модального окна при клике вне его
    this.elements.helpModal.addEventListener('click', (e) => {
      if (e.target === this.elements.helpModal) {
        this.closeHelpModal();
      }
    });

    // Закрытие модального окна по Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.elements.helpModal.style.display === 'flex') {
        this.closeHelpModal();
      }
    });
  }

  // Настройка селектора моделей
  setupModelSelector() {
    this.elements.modelSelect.innerHTML = '';

    Object.entries(CONFIG.models).forEach(([key, model]) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = model.name;
      this.elements.modelSelect.appendChild(option);
    });

    this.elements.modelSelect.value = this.currentModel;
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

    // Обновляем placeholder
    this.elements.apiKeyInput.placeholder = `API ключ для ${model.name}`;
  }

  // Загрузка API ключей из localStorage
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
    this.showSuccess('API ключ сохранен');
  }

  // Обработка выбора изображения
  handleImageSelect(event) {
    const file = event.target.files[0];
    if (file) {
      this.handleImageFile(file);
    }
  }

  // Валидация и обработка файла изображения
  handleImageFile(file) {
    // Проверка типа файла
    if (!CONFIG.app.acceptedFormats.includes(file.type)) {
      this.showError(CONFIG.ui.ru.errors.invalidFormat);
      return;
    }

    // Проверка размера
    if (file.size > CONFIG.app.maxImageSize) {
      this.showError(CONFIG.ui.ru.errors.tooLarge);
      return;
    }

    this.selectedImage = file;
    this.displayImagePreview(file);
    this.elements.analyzeBtn.disabled = false;
  }

  // Отображение превью изображения
  displayImagePreview(file) {
    const reader = new FileReader();

    reader.onload = (e) => {
      this.elements.imagePreview.src = e.target.result;
      this.elements.previewContainer.style.display = 'block';
    };

    reader.readAsDataURL(file);
  }

  // Анализ изображения
  async analyzeImage() {
    // Проверки
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

    // Показываем индикатор загрузки
    this.showLoading(true);
    this.elements.analyzeBtn.disabled = true;
    this.elements.resultsContainer.innerHTML = '';

    try {
      // Вызываем API
      const result = await aiClient.analyze(
        this.selectedImage,
        this.currentModel,
        apiKey
      );

      // Отображаем результат
      this.displayResults(result);

    } catch (error) {
      console.error('Ошибка анализа:', error);
      this.showError(CONFIG.ui.ru.errors.apiError + error.message);
    } finally {
      this.showLoading(false);
      this.elements.analyzeBtn.disabled = false;
    }
  }

  // Отображение результатов анализа
  displayResults(analysisText) {
    this.elements.resultsContainer.innerHTML = `
      <div class="result-card">
        <h3>Результат анализа</h3>
        <div class="analysis-text">${this.formatAnalysis(analysisText)}</div>
        <div class="model-info">
          <small>Проанализировано с помощью ${CONFIG.models[this.currentModel].name}</small>
        </div>
      </div>
    `;

    // Прокручиваем к результатам
    this.elements.resultsContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Форматирование текста анализа (markdown-like)
  formatAnalysis(text) {
    // Простое форматирование для читаемости
    return '<p>' + text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>') + '</p>';
  }

  // Показ/скрытие индикатора загрузки
  showLoading(show) {
    if (show) {
      this.elements.loadingIndicator.style.display = 'flex';
    } else {
      this.elements.loadingIndicator.style.display = 'none';
    }
  }

  // Показ ошибки
  showError(message) {
    this.elements.resultsContainer.innerHTML = `
      <div class="error-message">
        <strong>Ошибка:</strong> ${message}
      </div>
    `;
  }

  // Показ успешного сообщения
  showSuccess(message) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Открытие модального окна помощи
  openHelpModal() {
    this.elements.helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
  }

  // Закрытие модального окна помощи
  closeHelpModal() {
    this.elements.helpModal.style.display = 'none';
    document.body.style.overflow = ''; // Восстанавливаем прокрутку
  }
}

// Инициализация приложения после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
  // Информация об окружении
  const env = CONFIG.isProduction() ? 'PRODUCTION' : 'DEVELOPMENT';
  const endpoint = CONFIG.models.claude.endpoint;
  console.log(`🚀 SlingCheck запущен в режиме: ${env}`);
  console.log(`📡 API Endpoint (Claude): ${endpoint}`);

  window.app = new SlingCheckApp();
});
