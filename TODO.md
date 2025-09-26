# TODO: Развертывание тестового Telegram бота на Pella

## 📋 Список действий для развертывания

### 1. Создание Telegram бота
- [x] Написать @BotFather в Telegram
- [x] Выполнить команду `/newbot`
- [x] Ввести имя бота (например: "Test ZenMoney Bot")
- [x] Ввести username бота (например: "test_zenmoney_bot")
- [x] **Скопировать токен бота** (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### 2. Подготовка к развертыванию
- [x] Убедиться, что все файлы созданы:
  - [x] `package.json`
  - [x] `index.js`
  - [x] `Dockerfile`
  - [x] `.dockerignore`
  - [x] `env.example`
- [x] Проверить, что `node_modules` не включен в репозиторий

### 3. Загрузка на Pella
- [x] Зайти на [Pella.app](https://pella.app)
- [x] Создать новый проект
- [x] Выбрать "Code Source" → "File Upload"
- [x] **ВАЖНО**: Убедиться, что `node_modules` НЕ включен в архив
- [x] Загрузить файлы как .zip архив
- [x] Нажать "Continue"

### 4. Настройка переменных окружения в Pella
- [x] В настройках проекта найти раздел "Environment Variables"
- [x] Добавить переменную:
  - **Name**: `TELEGRAM_BOT_TOKEN`
  - **Value**: токен бота от BotFather
- [ ] Добавить переменную (опционально):
  - **Name**: `PORT`
  - **Value**: `3000`

### 5. Развертывание приложения
- [x] Запустить развертывание в Pella
- [x] Дождаться успешного завершения
- [ ] **Скопировать URL приложения** (формат: `https://your-app-name.pella.app`)

### 6. Настройка Telegram Webhook
- [ ] Открыть терминал/командную строку
- [ ] Выполнить команду (заменить `<YOUR_BOT_TOKEN>` и `<YOUR_APP_URL>`):
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://<YOUR_APP_URL>/webhook"}'
```

### 7. Проверка работы webhook
- [ ] Выполнить команду для проверки:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```
- [ ] Убедиться, что webhook установлен корректно

### 8. Тестирование бота
- [ ] Найти бота в Telegram по username
- [ ] Отправить команду `/start`
- [ ] Проверить приветственное сообщение
- [ ] Отправить тестовое сообщение
- [ ] Убедиться, что бот отвечает в формате:
  ```
  📨 Сообщение #1
  👤 Пользователь: Ваше Имя
  💬 Текст: ваше сообщение
  ```

### 9. Мониторинг и логи
- [ ] Проверить логи приложения в Pella
- [ ] Убедиться, что нет ошибок
- [ ] Проверить endpoint `/bot-info` в браузере

## 🔧 Полезные команды

### Проверка статуса webhook:
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### Удаление webhook (если нужно):
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/deleteWebhook"
```

### Проверка работы приложения:
```bash
curl "https://your-app-name.pella.app/"
curl "https://your-app-name.pella.app/bot-info"
```

## ⚠️ Важные моменты

1. **Токен бота** - храните в секрете, не публикуйте в коде
2. **node_modules** - НЕ включайте в архив для Pella
3. **Webhook URL** - должен быть HTTPS (Pella предоставляет автоматически)
4. **Порт** - приложение слушает порт 3000 (настраивается через переменную PORT)

## 🆘 Если что-то не работает

1. Проверьте логи в Pella
2. Убедитесь, что токен бота правильный
3. Проверьте, что webhook установлен корректно
4. Убедитесь, что приложение запущено и доступно

---

**Статус**: Готово к развертыванию ✅  
**Последнее обновление**: $(date)
