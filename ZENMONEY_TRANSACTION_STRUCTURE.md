# Структура транзакции для ZenMoney API

## Обзор

Для успешного создания транзакции в ZenMoney через API `/v8/diff` необходимо отправить объект транзакции с определенной структурой. Все поля являются обязательными, даже если их значение `null`.

## Полная структура транзакции

```json
{
  "id": "uuid-v4-format",
  "user": 1695996,
  "date": "2025-09-27",
  "amount": 10000000,
  "account": "3653215f-a4d0-4859-802f-c8068b8317a0",
  "incomeAccount": "3653215f-a4d0-4859-802f-c8068b8317a0",
  "outcomeAccount": "3653215f-a4d0-4859-802f-c8068b8317a0",
  "incomeInstrument": 10548,
  "outcomeInstrument": 10548,
  "income": 0,
  "outcome": 10000000,
  "category": "88fcb329-8f73-4ad2-83a1-04790ed55b1a",
  "tag": ["88fcb329-8f73-4ad2-83a1-04790ed55b1a"],
  "merchant": null,
  "payee": null,
  "reminderMarker": null,
  "incomeBankID": null,
  "outcomeBankID": null,
  "opIncome": null,
  "opOutcome": null,
  "opIncomeInstrument": null,
  "opOutcomeInstrument": null,
  "latitude": null,
  "longitude": null,
  "deleted": false,
  "comment": "такси 100 000 карта",
  "created": 1758995735,
  "changed": 1758995735
}
```

## Описание полей

### Основные поля

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `id` | string | Уникальный ID транзакции в формате UUID v4 | `"8e351fab-4678-4cc7-8e41-9dc9be5f021b"` |
| `user` | number | ID пользователя в ZenMoney | `1695996` |
| `date` | string | Дата транзакции в формате YYYY-MM-DD | `"2025-09-27"` |
| `amount` | number | Общая сумма транзакции в копейках | `10000000` (100,000 сумов) |
| `account` | string | ID основного счета | `"3653215f-a4d0-4859-802f-c8068b8317a0"` |

### Счета и валюты

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `incomeAccount` | string | ID счета дохода | `"3653215f-a4d0-4859-802f-c8068b8317a0"` |
| `outcomeAccount` | string | ID счета расхода | `"3653215f-a4d0-4859-802f-c8068b8317a0"` |
| `incomeInstrument` | number | ID валюты дохода | `10548` (узбекский сум) |
| `outcomeInstrument` | number | ID валюты расхода | `10548` (узбекский сум) |

### Суммы

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `income` | number | Сумма дохода в копейках (для расходов = 0) | `0` |
| `outcome` | number | Сумма расхода в копейках | `10000000` |

### Категории и теги

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `category` | string | ID категории/тега | `"88fcb329-8f73-4ad2-83a1-04790ed55b1a"` |
| `tag` | array | Массив ID тегов | `["88fcb329-8f73-4ad2-83a1-04790ed55b1a"]` |

### Дополнительные поля (всегда null для обычных транзакций)

| Поле | Тип | Описание | Значение |
|------|-----|----------|----------|
| `merchant` | string\|null | ID мерчанта | `null` |
| `payee` | string\|null | ID получателя | `null` |
| `reminderMarker` | string\|null | ID напоминания | `null` |
| `incomeBankID` | string\|null | ID банка дохода | `null` |
| `outcomeBankID` | string\|null | ID банка расхода | `null` |
| `opIncome` | string\|null | ID операции дохода | `null` |
| `opOutcome` | string\|null | ID операции расхода | `null` |
| `opIncomeInstrument` | string\|null | ID валюты операции дохода | `null` |
| `opOutcomeInstrument` | string\|null | ID валюты операции расхода | `null` |
| `latitude` | number\|null | Широта | `null` |
| `longitude` | number\|null | Долгота | `null` |

### Служебные поля

| Поле | Тип | Описание | Пример |
|------|-----|----------|--------|
| `deleted` | boolean | Флаг удаления | `false` |
| `comment` | string | Комментарий к транзакции | `"такси 100 000 карта"` |
| `created` | number | Unix timestamp создания | `1758995735` |
| `changed` | number | Unix timestamp изменения | `1758995735` |

## Формат запроса

Транзакция отправляется в массиве под ключом `transaction`:

```json
{
  "currentClientTimestamp": 1758995735,
  "serverTimestamp": 0,
  "transaction": [
    {
      // ... структура транзакции ...
    }
  ]
}
```

## Важные замечания

### 1. Обязательные поля
Все поля в структуре являются обязательными. Если поле не нужно, используйте `null` или соответствующее значение по умолчанию.

### 2. Формат ID
- **ID транзакции**: должен быть в формате UUID v4
- **ID пользователя**: числовой ID из ZenMoney
- **ID счетов/тегов**: UUID строки из базы данных ZenMoney

### 3. Суммы
- Все суммы указываются в **копейках** (минимальных единицах валюты)
- Для расходов: `income = 0`, `outcome = сумма`
- Для доходов: `income = сумма`, `outcome = 0`

### 4. Валюты
- ID валюты получается из поля `instrument` счета
- Для узбекского сума: `10548`
- Для российского рубля: `2`
- Для доллара США: `1`

### 5. Теги
- Поле `tag` должно быть **массивом**, даже если содержит один элемент
- Поле `category` - строка с ID тега

## Примеры для разных типов транзакций

### Расход (как в нашем примере)
```json
{
  "income": 0,
  "outcome": 10000000,
  "incomeAccount": "account_id",
  "outcomeAccount": "account_id"
}
```

### Доход
```json
{
  "income": 10000000,
  "outcome": 0,
  "incomeAccount": "account_id",
  "outcomeAccount": "account_id"
}
```

### Перевод между счетами
```json
{
  "income": 10000000,
  "outcome": 10000000,
  "incomeAccount": "destination_account_id",
  "outcomeAccount": "source_account_id"
}
```

## Получение данных для заполнения

### Счета
```javascript
const accounts = await supabaseClient.getAllAccounts();
// accounts.data содержит массив счетов с полями:
// - id: UUID счета
// - title: название счета
// - instrument: ID валюты
```

### Теги/Категории
```javascript
const tags = await supabaseClient.getAllTagsWithParents();
// tags.data содержит массив тегов с полями:
// - id: UUID тега
// - title: название тега
```

### Пользователь
```javascript
// ID пользователя получается из ответа ZenMoney API
const userResponse = await zenMoneyAPI.getUserInfo();
const userId = userResponse.data.user[Object.keys(userResponse.data.user)[0]].id;
```

## Ошибки и их решения

### "No value for property X provided"
- **Причина**: Отсутствует обязательное поле
- **Решение**: Добавить поле со значением `null` или соответствующим значением

### "Wrong format of transaction. It should be an array"
- **Причина**: Транзакция не в массиве
- **Решение**: Обернуть транзакцию в массив: `transaction: [transactionData]`

### "Invalid property X. Wrong type"
- **Причина**: Неправильный тип поля
- **Решение**: Проверить тип поля (например, `tag` должен быть массивом)

### "Wrong user of object"
- **Причина**: Неправильный ID пользователя
- **Решение**: Получить правильный ID пользователя из ZenMoney API

## Заключение

Эта структура была получена путем итеративного тестирования с ZenMoney API. Все поля являются обязательными и должны присутствовать в запросе, даже если их значение `null`. Структура работает для создания обычных расходных транзакций и может быть адаптирована для других типов операций.
