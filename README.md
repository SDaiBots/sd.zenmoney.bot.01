# ZenMoney Telegram Bot

Telegram-бот для синхронизации данных между ZenMoney и Supabase. Бот позволяет просматривать счета и теги из ZenMoney, а также синхронизировать их с базой данных Supabase.

## 🎯 Описание проекта

Бот предоставляет следующие возможности:
- **Просмотр счетов** из ZenMoney API
- **Синхронизация счетов** с базой данных Supabase
- **Синхронизация тегов** с базой данных Supabase
- **Веб-интерфейс** для мониторинга состояния бота

## 🏗️ Архитектура

### Основные компоненты

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram Bot  │    │   Node.js App   │    │   Supabase DB   │
│                 │◄──►│                 │◄──►│                 │
│ - Команды       │    │ - Webhook       │    │ - zm_accounts   │
│ - Сообщения     │    │ - API клиенты   │    │ - zm_tags       │
│ - Ответы        │    │ - Синхронизация │    │ - Представления │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   ZenMoney API  │
                       │                 │
                       │ - /v8/diff      │
                       │ - Счета         │
                       │ - Теги          │
                       └─────────────────┘
```

### Технологический стек

- **Backend**: Node.js + Express
- **База данных**: Supabase (PostgreSQL)
- **API интеграции**: 
  - ZenMoney API (получение счетов и тегов)
  - Telegram Bot API (обработка команд)
- **Развертывание**: Docker + Render.com
- **Контроль версий**: GitHub

## 📋 Функциональность

### Основные возможности

1. **Команды бота**:
   - `/start` - приветствие и список команд
   - `/accounts` - просмотр всех счетов из ZenMoney
   - `/accounts_upd` - синхронизация счетов с Supabase
   - `/tags_upd` - синхронизация тегов с Supabase

2. **Синхронизация данных**:
   - Получение счетов из ZenMoney API
   - Получение тегов из ZenMoney API
   - Очистка и обновление таблиц в Supabase
   - Обработка ошибок и валидация данных

3. **Веб-интерфейс**:
   - Endpoint `/` - статус сервера
   - Endpoint `/bot-info` - информация о боте и статистика
   - Webhook `/webhook` - обработка сообщений от Telegram

4. **База данных**:
   - Таблица `zm_accounts` - счета из ZenMoney
   - Таблица `zm_tags` - теги из ZenMoney
   - Представления для удобного доступа к данным
   - Функции для работы с иерархией тегов

## 🚀 Установка и настройка

### Предварительные требования

- Node.js 18+
- Telegram Bot Token (от @BotFather)
- ZenMoney API Token
- Supabase проект с настроенными таблицами
- Docker (для контейнеризации)

### Локальная установка

1. **Клонирование репозитория**:
```bash
git clone <repository-url>
cd pella_zenmoney_bot
```

2. **Установка зависимостей**:
```bash
npm install
```

3. **Настройка переменных окружения**:
```bash
cp env.example .env
```

Заполните `.env` файл:
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Server Configuration
PORT=3000
NODE_ENV=development

# ZenMoney API Configuration
ZENMONEY_TOKEN=your_zenmoney_token_here

# Supabase Configuration
SB_PROJECT_ID=your_supabase_project_id_here
SB_TOKEN=your_supabase_anon_key_here
```

4. **Запуск приложения**:
```bash
npm run dev
```

## 🗄️ Структура базы данных

### Таблица `zm_accounts`

Основные поля:
- `id` (UUID) - уникальный идентификатор счета
- `user_id` (INTEGER) - ID пользователя в ZenMoney
- `instrument_id` (INTEGER) - ID валюты
- `type` (VARCHAR) - тип счета: debt, checking, ccard, cash, deposit
- `title` (VARCHAR) - название счета
- `balance` (DECIMAL) - текущий баланс
- `start_balance` (DECIMAL) - начальный баланс
- `credit_limit` (DECIMAL) - кредитный лимит
- `in_balance` (BOOLEAN) - учитывать в общем балансе
- `private` (BOOLEAN) - приватный счет
- `savings` (BOOLEAN) - сберегательный счет
- `archive` (BOOLEAN) - архивный счет
- `changed` (BIGINT) - timestamp последнего изменения

### Таблица `zm_tags`

Основные поля:
- `id` (UUID) - уникальный идентификатор тега
- `user_id` (INTEGER) - ID пользователя ZenMoney
- `title` (TEXT) - название тега/статьи
- `parent_id` (UUID) - ID родительского тега (иерархия)
- `color` (BIGINT) - цвет тега в числовом формате
- `icon` (TEXT) - иконка тега
- `show_income` (BOOLEAN) - показывать в доходах
- `show_outcome` (BOOLEAN) - показывать в расходах
- `archive` (BOOLEAN) - архивный статус
- `changed` (TIMESTAMP) - время последнего изменения

### Представления и функции

- `active_zm_tags` - активные (не архивные) теги
- `zm_tags_with_parent` - теги с информацией о родительском теге
- `get_child_tags(parent_tag_id)` - получение всех дочерних тегов
- `get_parent_tags(child_tag_id)` - получение всех родительских тегов

## 🔧 API и интеграции

### ZenMoney API

- **Endpoint**: `https://api.zenmoney.ru/v8/diff`
- **Метод**: POST
- **Данные**: получение счетов и тегов
- **Аутентификация**: Bearer token

### Supabase API

- **Клиент**: `@supabase/supabase-js`
- **Операции**: вставка, удаление, выборка данных
- **Таблицы**: `zm_accounts`, `zm_tags`

## 🚀 Развертывание на Render.com

### О платформе Render.com

Render.com - это современная платформа для развертывания и хостинга приложений с поддержкой:
- **Автоматическое развертывание** из GitHub репозиториев
- **Docker контейнеризация** для изоляции приложений
- **Переменные окружения** для безопасного хранения секретов
- **Мониторинг и логирование** встроенные инструменты
- **Масштабирование** автоматическое и ручное
- **SSL сертификаты** автоматическая настройка HTTPS

### Подготовка к развертыванию

1. **Создание Dockerfile**:
```dockerfile
FROM node:18-alpine
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем пользователя для безопасности
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"]
```

2. **Создание .dockerignore**:
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
```

3. **Настройка переменных окружения** в Render.com:
   - Перейдите в настройки проекта в Render.com
   - Добавьте переменную `TELEGRAM_BOT_TOKEN`
   - Убедитесь в корректности токена бота

### Развертывание через Render.com

1. **Подключение репозитория**:
   - Войдите в Render.com
   - Создайте новый Web Service
   - Подключите GitHub репозиторий
   - Выберите ветку для развертывания (обычно `main`)

2. **Настройка автодеплоя**:
   - Включите автоматическое развертывание при push в выбранную ветку
   - Настройте уведомления о статусе развертывания
   - Укажите команды для сборки (если нужны)

3. **Настройка домена**:
   - Render.com автоматически предоставляет поддомен
   - Можно настроить собственный домен
   - SSL сертификат настраивается автоматически

### Настройка Telegram Webhook

После развертывания на Render.com:

1. **Получите URL приложения**:
   ```
   https://your-app-name.onrender.com
   ```

2. **Настройте Webhook**:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
        -H "Content-Type: application/json" \
        -d '{"url": "https://your-app-name.onrender.com/webhook"}'
   ```

3. **Проверьте статус Webhook**:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

### Мониторинг и логирование

Render.com предоставляет встроенные инструменты:

- **Логи приложения** в реальном времени
- **Метрики производительности** CPU, память, сеть
- **Статус развертывания** история и уведомления
- **Алерты** при критических ошибках
- **Масштабирование** автоматическое при высокой нагрузке

### Рекомендации по оптимизации

1. **Производительность**:
   - Используйте `npm ci` вместо `npm install`
   - Минимизируйте размер Docker образа
   - Настройте кэширование для статических ресурсов

2. **Безопасность**:
   - Никогда не коммитьте секреты в код
   - Используйте переменные окружения
   - Регулярно обновляйте зависимости

3. **Мониторинг**:
   - Настройте алерты на критические ошибки
   - Мониторьте использование ресурсов
   - Ведите логи всех операций

## 📝 Использование

### Команды бота

- `/start` - приветствие и список доступных команд
- `/accounts` - просмотр всех счетов из ZenMoney API
- `/accounts_upd` - синхронизация счетов с базой данных Supabase
- `/tags_upd` - синхронизация тегов с базой данных Supabase

### Примеры использования

1. **Просмотр счетов**:
   ```
   /accounts
   ```
   Бот отправит детальную информацию о каждом счете из ZenMoney

2. **Синхронизация счетов**:
   ```
   /accounts_upd
   ```
   Бот очистит таблицу `zm_accounts` в Supabase и загрузит актуальные данные

3. **Синхронизация тегов**:
   ```
   /tags_upd
   ```
   Бот очистит таблицу `zm_tags` в Supabase и загрузит актуальные данные

### Веб-интерфейс

- `GET /` - статус сервера
- `GET /bot-info` - информация о боте и статистика пользователей
- `POST /webhook` - webhook для получения сообщений от Telegram

## 🔒 Безопасность

- Хранение API ключей в переменных окружения
- Валидация всех входящих данных
- Базовая защита от SQL-инъекций
- Логирование операций для аудита

## 🧪 Тестирование

- Ручное тестирование команд бота
- Тестирование интеграции с ZenMoney API
- Проверка синхронизации данных с Supabase
- Валидация обработки ошибок и edge cases

## 📚 Документация

- [ZenMoney API Documentation](https://github.com/zenmoney/ZenPlugins/wiki/ZenMoney-API)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Supabase Documentation](https://supabase.com/docs)
- [Node.js Express Documentation](https://expressjs.com/)

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature ветку
3. Внесите изменения
4. Создайте Pull Request

## 📄 Лицензия

MIT License

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте логи приложения
2. Убедитесь в корректности API ключей
3. Проверьте статус внешних сервисов
4. Создайте issue в репозитории

---

**Статус проекта**: Активная разработка  
**Версия**: 1.0.0  
**Последнее обновление**: 2024
