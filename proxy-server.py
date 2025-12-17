#!/usr/bin/env python3
"""
Простой CORS прокси-сервер для перенаправления запросов к AI API
Решает проблему CORS при локальной разработке
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import json
import urllib.request
import urllib.error
import socket

class CORSProxyHandler(BaseHTTPRequestHandler):
    def _set_cors_headers(self):
        """Устанавливает CORS заголовки"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, x-api-key, anthropic-version, Authorization')

    def do_OPTIONS(self):
        """Обработка preflight запросов"""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_POST(self):
        """Обработка POST запросов"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)

        # Определяем целевой API
        if '/anthropic/' in self.path:
            target_url = 'https://api.anthropic.com' + self.path.replace('/anthropic', '')
            api_key_header = 'x-api-key'
            extra_headers = {'anthropic-version': self.headers.get('anthropic-version', '2023-06-01')}
        elif '/openai/' in self.path:
            target_url = 'https://api.openai.com' + self.path.replace('/openai', '')
            api_key_header = 'Authorization'
            extra_headers = {}
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error": "Unknown API endpoint"}')
            return

        # Подготавливаем заголовки для целевого API
        headers = {
            'Content-Type': 'application/json',
        }

        # Добавляем API ключ
        if api_key_header in self.headers:
            headers[api_key_header] = self.headers[api_key_header]
        elif 'Authorization' in self.headers:
            headers['Authorization'] = self.headers['Authorization']

        headers.update(extra_headers)

        try:
            # Отправляем запрос к целевому API с таймаутом 120 секунд
            req = urllib.request.Request(
                target_url,
                data=post_data,
                headers=headers,
                method='POST'
            )

            with urllib.request.urlopen(req, timeout=120) as response:
                response_data = response.read()

                # Отправляем ответ клиенту с CORS заголовками
                self.send_response(response.status)
                self._set_cors_headers()
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(response_data)

        except urllib.error.HTTPError as e:
            # Обработка ошибок API
            error_data = e.read()
            self.send_response(e.code)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_data)

        except socket.timeout:
            # Обработка таймаута
            self.send_response(504)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'error': 'Request timeout (120s exceeded)'}).encode()
            self.wfile.write(error_response)

        except Exception as e:
            # Обработка других ошибок
            self.send_response(500)
            self._set_cors_headers()
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'error': str(e)}).encode()
            self.wfile.write(error_response)

    def log_message(self, format, *args):
        """Логирование запросов"""
        print(f"[PROXY] {self.address_string()} - {format % args}")

def run_proxy(port=8002):
    """Запуск прокси-сервера"""
    server_address = ('', port)

    try:
        httpd = HTTPServer(server_address, CORSProxyHandler)
    except OSError as e:
        if e.errno == 98 or e.errno == 48:  # Address already in use (Linux/Mac)
            print(f'❌ Ошибка: Порт {port} уже занят')
            print(f'💡 Попробуйте остановить другой процесс: pkill -f "proxy-server.py"')
            print(f'   Или используйте другой порт: python3 proxy-server.py --port <номер>')
            return
        else:
            raise

    print(f'🔄 CORS Proxy сервер запущен на http://localhost:{port}')
    print(f'📡 Перенаправляет запросы к Anthropic и OpenAI API')
    print(f'🛑 Для остановки нажмите Ctrl+C\n')
    httpd.serve_forever()

if __name__ == '__main__':
    try:
        run_proxy(8002)
    except KeyboardInterrupt:
        print('\n✅ Прокси-сервер остановлен')
