// Конфигурация моделей AI и API endpoints
const CONFIG = {
  // URL вашего Cloudflare Worker
  workerUrl: 'https://slingcheck-proxy.04848.workers.dev',

  // Определение окружения
  isProduction: () => {
    // Production только если домен содержит github.io или другой production домен
    const hostname = window.location.hostname;
    return hostname.includes('github.io') ||
           hostname.includes('githubusercontent.com') ||
           hostname.includes('pages.dev'); // Cloudflare Pages
  },

  // Получение хоста для прокси (используется текущий хост)
  getProxyHost: () => {
    // Используем текущий хост для прокси, чтобы работало с разных устройств в локальной сети
    return `${window.location.protocol}//${window.location.hostname}:8002`;
  },

  // Получение endpoint в зависимости от окружения
  getEndpoint: (provider, path) => {
    if (CONFIG.isProduction()) {
      // Production: через Cloudflare Worker
      return `${CONFIG.workerUrl}/${provider}${path}`;
    } else {
      // Development: через локальный прокси на том же хосте
      return `${CONFIG.getProxyHost()}/${provider}${path}`;
    }
  },

  // Доступные модели для анализа
  models: {
    claude: {
      name: 'Claude 3.5 Sonnet',
      id: 'claude-3-5-sonnet-20241022',
      provider: 'anthropic',
      maxTokens: 4096,
      supportsVision: true,
      get endpoint() {
        return CONFIG.getEndpoint('anthropic', '/v1/messages');
      },
      apiKeyStorageKey: 'slingcheck_claude_api_key'
    },
    claude4: {
      name: 'Claude Sonnet 4.5',
      id: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      maxTokens: 8192,
      supportsVision: true,
      get endpoint() {
        return CONFIG.getEndpoint('anthropic', '/v1/messages');
      },
      apiKeyStorageKey: 'slingcheck_claude_api_key'
    },
    gpt4: {
      name: 'GPT-4 Turbo',
      id: 'gpt-4-turbo',
      provider: 'openai',
      maxTokens: 4096,
      supportsVision: true,
      get endpoint() {
        return CONFIG.getEndpoint('openai', '/v1/chat/completions');
      },
      apiKeyStorageKey: 'slingcheck_openai_api_key'
    },
    gpt4o: {
      name: 'GPT-4o',
      id: 'gpt-4o',
      provider: 'openai',
      maxTokens: 4096,
      supportsVision: true,
      get endpoint() {
        return CONFIG.getEndpoint('openai', '/v1/chat/completions');
      },
      apiKeyStorageKey: 'slingcheck_openai_api_key'
    }
  },

  // Модель по умолчанию
  defaultModel: 'claude',

  // Настройки приложения
  app: {
    maxImageSize: 5 * 1024 * 1024, // 5MB
    acceptedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    compressionQuality: 0.8,
    maxImageDimension: 1920
  },

  // UI тексты
  ui: {
    ru: {
      title: 'SlingCheck - Проверка слинга/рюкзака',
      subtitle: 'Загрузите фото, и AI оценит правильность положения ребенка',
      uploadButton: 'Выбрать фото',
      analyzeButton: 'Анализировать',
      analyzing: 'Анализирую...',
      selectModel: 'Выберите модель AI:',
      apiKeyPlaceholder: 'Введите API ключ',
      apiKeyLabel: 'API ключ:',
      saveApiKey: 'Сохранить ключ',
      errors: {
        noImage: 'Пожалуйста, выберите изображение',
        noApiKey: 'Пожалуйста, введите API ключ',
        invalidFormat: 'Неподдерживаемый формат. Используйте JPG, PNG или WebP',
        tooLarge: 'Файл слишком большой. Максимум 5MB',
        apiError: 'Ошибка API: ',
        networkError: 'Ошибка сети. Проверьте соединение'
      }
    }
  }
};

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
