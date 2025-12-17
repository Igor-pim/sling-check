/**
 * Cloudflare Worker для прокси запросов к AI API
 * Решает проблему CORS для GitHub Pages
 */

// Разрешенные origins
const ALLOWED_ORIGINS = [
  'https://igor-pim.github.io',
  'http://localhost:8001',
  'http://127.0.0.1:8001'
];

// CORS заголовки
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version, Authorization',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env) {
    // Обработка preflight запросов
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS
      });
    }

    // Проверяем метод
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: CORS_HEADERS
      });
    }

    try {
      const url = new URL(request.url);

      // Определяем целевой API
      let targetUrl;
      let apiKeyHeader;
      let extraHeaders = {};

      if (url.pathname.startsWith('/anthropic/')) {
        targetUrl = 'https://api.anthropic.com' + url.pathname.replace('/anthropic', '');
        apiKeyHeader = request.headers.get('x-api-key');
        extraHeaders['x-api-key'] = apiKeyHeader;
        extraHeaders['anthropic-version'] = request.headers.get('anthropic-version') || '2023-06-01';
      } else if (url.pathname.startsWith('/openai/')) {
        targetUrl = 'https://api.openai.com' + url.pathname.replace('/openai', '');
        apiKeyHeader = request.headers.get('Authorization');
        extraHeaders['Authorization'] = apiKeyHeader;
      } else {
        return new Response(JSON.stringify({ error: 'Unknown API endpoint' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // Получаем тело запроса
      const body = await request.text();

      // Отправляем запрос к целевому API
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...extraHeaders
        },
        body: body
      });

      // Получаем ответ
      const responseData = await response.text();

      // Возвращаем ответ с CORS заголовками
      return new Response(responseData, {
        status: response.status,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json'
        }
      });

    } catch (error) {
      return new Response(JSON.stringify({
        error: error.message || 'Internal Server Error'
      }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      });
    }
  }
};
