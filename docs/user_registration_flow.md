# Процедура регистрации нового пользователя

## Сценарий регистрации

### 1. Команда /start
- Пользователь пишет боту `/start`
- Бот проверяет имя этого пользователя в таблице `users`
- Если пользователя нет или он неактивен, то игнорирует его сообщение
- Если пользователь есть и он активен, то запускает процесс добавления/обновления пользователя

### 2. Запрос токена ZenMoney
- Бот запрашивает токен для зен-мани:
```
🔑 Для работы с ботом необходим токен ZenMoney API.

Отправьте ваш токен ZenMoney для настройки бота.
```

### 3. Валидация токена
- Пользователь отправляет ключ
- Бот проверяет:
  - что сообщение - это ключ
  - что с помощью ключа можно подключиться к зен-мани
  - если ключ рабочий, то связывает его с пользователем
  - если ключ не рабочий, то запрашивает рабочий ключ

### 4. Настройка (если токен валиден)
- Если у пользователя есть рабочий ключ, то бот пишет сообщение о необходимости настройки и добавляет инлайн кнопки:
  - загрузить статьи (теги)
  - загрузить счета
  - перейти дальше

### 5. Загрузка статей (тегов)
- Пользователь нажимает кнопку "загрузить статьи"
- Бот загружает статьи и связывает их с пользователем
- Пишет количество загруженных объектов

### 6. Загрузка счетов
- Пользователь нажимает кнопку "загрузить счета"
- Бот загружает счета и связывает их с пользователем
- Пишет количество загруженных объектов

### 7. Завершение настройки
- Пользователь нажимает кнопку "перейти дальше"
- Бот пишет какое кол-во счетов и статей загружено
- Предлагает создать первую запись текстом, а потом голосом

## Технические детали

### Структура базы данных
```sql
-- Таблица пользователей
users (
  id, telegram_id, username, first_name, last_name,
  zenmoney_token, is_active, is_admin,
  created_at, last_activity, updated_at
)

-- Пользовательские настройки
user_settings (
  user_id, parameter_name, parameter_value
)

-- Счета с привязкой к пользователю
zm_accounts (
  id, user_id, title, balance, type, ...
)

-- Теги с привязкой к пользователю  
zm_tags (
  id, user_id, title, parent_id, ...
)
```

### Функции для реализации
```javascript
// Проверка авторизации пользователя
async function isUserAuthorized(telegramId, username)

// Создание/обновление пользователя
async function createOrUpdateUser(userData)

// Валидация токена ZenMoney
async function validateZenMoneyToken(token)

// Загрузка тегов для пользователя
async function loadUserTags(userId, token)

// Загрузка счетов для пользователя
async function loadUserAccounts(userId, token)
```

### Состояния пользователя
- `pending_token` - ожидает токен
- `token_validated` - токен проверен, нужна настройка
- `setup_complete` - настройка завершена
- `active` - готов к работе

### Безопасность
- RLS политики для изоляции данных
- Валидация токенов перед сохранением
- Логирование действий пользователей
- Обработка ошибок API

## Примеры сообщений

### Запрос токена
```
🔑 Для работы с ботом необходим токен ZenMoney API.

Отправьте ваш токен ZenMoney для настройки бота.
```

### Токен недействителен
```
❌ Токен недействителен или не работает.

Проверьте правильность токена и попробуйте еще раз.
```

### Токен сохранен
```
✅ Токен успешно сохранен!

Для завершения настройки выполните следующие действия:

📋 Загрузить статьи (теги) - синхронизация категорий
💳 Загрузить счета - синхронизация счетов
➡️ Перейти дальше - пропустить настройку
```

### Статьи загружены
```
📋 Статьи загружены успешно!

Загружено статей: 15
- Продукты питания
- Транспорт
- Развлечения
- ...
```

### Счета загружены
```
💳 Счета загружены успешно!

Загружено счетов: 3
- Основная карта (45 230 ₽)
- Наличные (2 500 ₽)
- Сберегательный счет (150 000 ₽)
```

### Настройка завершена
```
🎉 Настройка завершена!

📊 Статистика:
- Статей загружено: 15
- Счетов загружено: 3

💡 Теперь вы можете:
- Отправлять текстовые сообщения для создания транзакций
- Использовать голосовые сообщения
- Бот автоматически определит категорию и счет

Попробуйте отправить: "Потратил 500 рублей на продукты в магазине"
```

### Создание первой записи
```
🚀 Создайте первую запись!

Напишите сообщение о вашей транзакции, например:
"Потратил 500 рублей на продукты"

Или отправьте голосовое сообщение с описанием траты.
```

## Инлайн кнопки

### Кнопки настройки
```javascript
const setupKeyboard = [
  [
    { text: '📋 Загрузить статьи', callback_data: 'load_tags' },
    { text: '💳 Загрузить счета', callback_data: 'load_accounts' }
  ],
  [
    { text: '➡️ Перейти дальше', callback_data: 'skip_setup' }
  ]
];
```

## Обработка callback'ов

### Загрузка тегов
```javascript
if (callbackData === 'load_tags') {
  await handleLoadTags(chatId, userId, messageId);
}
```

### Загрузка счетов
```javascript
if (callbackData === 'load_accounts') {
  await handleLoadAccounts(chatId, userId, messageId);
}
```

### Пропуск настройки
```javascript
if (callbackData === 'skip_setup') {
  await handleSkipSetup(chatId, userId, messageId);
}
```

## Валидация токена ZenMoney

### Тестовый запрос
```javascript
async function validateZenMoneyToken(token) {
  try {
    const response = await axios.post('https://api.zenmoney.ru/v8/diff', {
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp: 0
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    return { valid: true, data: response.data };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}
```

## Загрузка данных из ZenMoney

### Загрузка тегов
```javascript
async function loadUserTags(userId, token) {
  try {
    const response = await axios.post('https://api.zenmoney.ru/v8/diff', {
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp: 0
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const tags = response.data.tag || {};
    const tagCount = Object.keys(tags).length;
    
    // Сохраняем теги в zm_tags с user_id
    for (const [tagId, tagData] of Object.entries(tags)) {
      await supabaseClient.insertTag({
        id: tagId,
        user_id: userId,
        title: tagData.title,
        parent_id: tagData.parent,
        // ... другие поля
      });
    }
    
    return { success: true, count: tagCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### Загрузка счетов
```javascript
async function loadUserAccounts(userId, token) {
  try {
    const response = await axios.post('https://api.zenmoney.ru/v8/diff', {
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp: 0
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const accounts = response.data.account || {};
    const accountCount = Object.keys(accounts).length;
    
    // Сохраняем счета в zm_accounts с user_id
    for (const [accountId, accountData] of Object.entries(accounts)) {
      await supabaseClient.insertAccount({
        id: accountId,
        user_id: userId,
        title: accountData.title,
        balance: accountData.balance,
        type: accountData.type,
        // ... другие поля
      });
    }
    
    return { success: true, count: accountCount };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

## Логирование

### Сохранение действий пользователя
```javascript
async function logUserAction(userId, action, details) {
  try {
    await supabaseClient.insertUserMessage({
      user_id: userId,
      message_type: 'system',
      original_text: `Action: ${action}, Details: ${JSON.stringify(details)}`,
      message_size: 0
    });
  } catch (error) {
    console.error('Ошибка при логировании действия:', error.message);
  }
}
```

## Обработка ошибок

### Ошибка валидации токена
```javascript
if (!tokenValidation.valid) {
  await bot.sendMessage(chatId, `❌ Ошибка при проверке токена: ${tokenValidation.error}`, {
    reply_to_message_id: messageId
  });
  return;
}
```

### Ошибка загрузки данных
```javascript
if (!loadResult.success) {
  await bot.sendMessage(chatId, `❌ Ошибка при загрузке: ${loadResult.error}`, {
    reply_to_message_id: messageId
  });
  return;
}
```

## Интеграция с существующим кодом

### Обновление handleStartCommand
```javascript
async function handleStartCommand(chatId, user, messageId) {
  // Проверяем авторизацию
  const authResult = await isUserAuthorized(user.id, user.username);
  
  if (!authResult.authorized) {
    console.log(`🚫 Пользователь не авторизован: ${user.id}`);
    return;
  }
  
  const currentUser = authResult.user;
  
  // Проверяем наличие токена
  if (!currentUser.zenmoney_token) {
    await requestZenMoneyToken(chatId, currentUser, messageId);
    return;
  }
  
  // Проверяем статус настройки
  if (currentUser.setup_status === 'pending') {
    await showSetupOptions(chatId, currentUser, messageId);
    return;
  }
  
  // Показываем приветствие
  await showWelcomeMessage(chatId, currentUser, messageId);
}
```

### Обработка текстовых сообщений
```javascript
async function handleTextMessage(chatId, text, user, messageId) {
  const authResult = await isUserAuthorized(user.id, user.username);
  
  if (!authResult.authorized) {
    return;
  }
  
  const currentUser = authResult.user;
  
  // Проверяем, ожидается ли токен
  if (currentUser.setup_status === 'pending_token') {
    await handleTokenInput(chatId, text, currentUser, messageId);
    return;
  }
  
  // Обычная обработка транзакции
  await handleTransactionWithAI(chatId, text, user, messageId, currentUser);
}
```

## Тестирование

### Тест валидации токена
```javascript
describe('Token Validation', () => {
  test('should validate correct token', async () => {
    const result = await validateZenMoneyToken('valid_token');
    expect(result.valid).toBe(true);
  });
  
  test('should reject invalid token', async () => {
    const result = await validateZenMoneyToken('invalid_token');
    expect(result.valid).toBe(false);
  });
});
```

### Тест загрузки данных
```javascript
describe('Data Loading', () => {
  test('should load user tags', async () => {
    const result = await loadUserTags(1, 'valid_token');
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });
  
  test('should load user accounts', async () => {
    const result = await loadUserAccounts(1, 'valid_token');
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThan(0);
  });
});
```

## Мониторинг

### Метрики регистрации
- Количество новых пользователей в день
- Процент успешных регистраций
- Время завершения настройки
- Количество ошибок валидации токенов

### Алерты
- Высокий процент ошибок валидации
- Медленная загрузка данных из ZenMoney
- Проблемы с сохранением в базу данных
