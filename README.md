# SlingCheck - AI-проверка эргономики слинга

MVP приложение для анализа правильности положения ребенка в слинге или рюкзаке-переноске с использованием AI Vision API (Claude или GPT-4).

## Возможности

- Загрузка фото через drag-and-drop или выбор файла
- Выбор между Claude 3.5 Sonnet, Claude Sonnet 4.5, GPT-4 Turbo и GPT-4o
- Анализ эргономики положения ребенка
- Конкретные рекомендации по исправлению ошибок
- Адаптивный дизайн для PC и смартфонов
- Хранение API ключей в браузере (localStorage)

## Структура проекта

```
sling-check/
├── index.html           # Главная страница
├── css/
│   └── style.css       # Стили приложения
├── js/
│   ├── config.js       # Конфигурация моделей и API
│   ├── api.js          # API клиент для Claude/OpenAI
│   └── app.js          # Основная логика приложения
├── config/
│   └── prompts.json    # Экспертные промпты для анализа
└── assets/
    └── icons/          # Иконки (опционально)
```

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/yourusername/sling-check.git
cd sling-check
```

### 2. Получение API ключа

Вам понадобится API ключ от одного из провайдеров:

**Claude (Anthropic):**
- Зарегистрируйтесь на https://console.anthropic.com/
- Создайте API ключ в разделе API Keys
- Модель: `claude-3-5-sonnet-20241022`

**OpenAI:**
- Зарегистрируйтесь на https://platform.openai.com/
- Создайте API ключ в разделе API Keys
- Модели: `gpt-4-turbo` или `gpt-4o`

### 3. Локальный запуск

#### Простой способ (рекомендуется):

```bash
./start.sh
```

Этот скрипт автоматически запустит:
- CORS прокси-сервер на порту 8002
- Веб-сервер на порту 8001

Откройте http://localhost:8001 в браузере.

Для остановки:
```bash
./stop.sh
```

#### Ручной запуск:

1. **Запустите CORS прокси-сервер** (решает проблему CORS):
```bash
python3 proxy-server.py &
```

2. **Запустите веб-сервер**:
```bash
python3 -m http.server 8001
```

3. Откройте http://localhost:8001 в браузере.

### 4. Использование

1. Выберите модель AI (Claude или GPT-4)
2. Введите API ключ и нажмите "Сохранить"
3. Загрузите фото ребенка в слинге/рюкзаке
4. Нажмите "Анализировать"
5. Получите детальную оценку и рекомендации

## Деплой на GitHub Pages

### Подготовка

1. Создайте репозиторий на GitHub
2. Инициализируйте git и запушьте код:

```bash
git init
git add .
git commit -m "Initial commit: SlingCheck MVP"
git branch -M main
git remote add origin https://github.com/yourusername/sling-check.git
git push -u origin main
```

### Включение GitHub Pages

1. Перейдите в Settings репозитория
2. В разделе "Pages" выберите:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
3. Сохраните настройки

Через несколько минут приложение будет доступно по адресу:
`https://yourusername.github.io/sling-check/`

## Конфигурация

### Изменение промптов

Отредактируйте `config/prompts.json` для настройки экспертного анализа:

```json
{
  "slingAnalysis": {
    "system": "Системный промпт...",
    "userPrompt": "Инструкции для анализа...",
    "examples": [...]
  }
}
```

### Добавление новых моделей

В `js/config.js` добавьте новую модель в объект `CONFIG.models`:

```javascript
yourModel: {
  name: 'Model Name',
  id: 'model-id',
  provider: 'anthropic', // или 'openai'
  maxTokens: 4096,
  supportsVision: true,
  endpoint: 'https://api.example.com/v1/...',
  apiKeyStorageKey: 'slingcheck_yourmodel_api_key'
}
```

## Безопасность

- API ключи хранятся только в localStorage браузера
- Ключи не передаются на сторонние серверы (кроме API провайдеров)
- Изображения обрабатываются локально и отправляются напрямую в API
- Рекомендуется использовать на доверенных устройствах

## Технические детали

- **Фронтенд:** Vanilla JavaScript (ES6+)
- **Стили:** CSS3 с CSS Variables
- **AI API:** Anthropic Claude / OpenAI GPT-4
- **CORS Proxy:** Python HTTP сервер (решает проблему CORS)
- **Хранилище:** localStorage (браузер)
- **Максимальный размер изображения:** 5MB
- **Поддерживаемые форматы:** JPG, PNG, WebP

### Архитектура

```
Браузер → Веб-сервер (8001) → SlingCheck App
                ↓
         CORS Proxy (8002) → Anthropic/OpenAI API
```

**CORS Proxy** решает проблему CORS (Cross-Origin Resource Sharing):
- Перехватывает запросы к AI API
- Добавляет необходимые CORS заголовки
- Перенаправляет запросы к реальным API
- Возвращает ответы клиенту

## Ограничения MVP

- Нет серверной части (все в браузере)
- API ключи хранятся в localStorage
- Нет истории анализов
- Нет возможности сравнения фото
- Нет мультиязычности (только русский)

## Развитие проекта

Возможные улучшения:
- [ ] Добавить историю анализов
- [ ] Сравнение до/после
- [ ] Мультиязычность (английский, испанский)
- [ ] Темная тема
- [ ] Экспорт результатов в PDF
- [ ] Видео-анализ
- [ ] Интеграция с Telegram Bot

## Лицензия

MIT License

## Контакты

Если у вас есть вопросы или предложения, создайте Issue в репозитории.

---

**Важно:** Это приложение предоставляет автоматический анализ, но не заменяет консультацию с сертифицированным консультантом по слингоношению.
