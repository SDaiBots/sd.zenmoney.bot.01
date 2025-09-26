# Анализ структуры счетов ZenMoney для Supabase

## 📊 Обзор

На основе анализа JSON ответа от ZenMoney API изучена структура счетов и подготовлена схема для загрузки в Supabase.

## 🔍 Анализ данных

### Статистика счетов
- **Всего счетов**: 40
- **Типы счетов**:
  - `debt` (долги): 1 счет
  - `checking` (расчетные): 11 счетов  
  - `ccard` (кредитные карты): 11 счетов
  - `cash` (наличные): 10 счетов
  - `deposit` (депозиты): 7 счетов

### Структура полей

| Поле | Тип в JSON | Тип в Supabase | Описание | Обязательное |
|------|------------|----------------|----------|--------------|
| `id` | string (UUID) | UUID | Уникальный идентификатор счета | ✅ |
| `user` | integer | INTEGER | ID пользователя в ZenMoney | ✅ |
| `instrument` | integer | INTEGER | ID валюты | ✅ |
| `type` | string | VARCHAR(20) | Тип счета | ✅ |
| `title` | string | VARCHAR(255) | Название счета | ✅ |
| `balance` | number | DECIMAL(15,2) | Текущий баланс | ✅ |
| `startBalance` | number | DECIMAL(15,2) | Начальный баланс | ✅ |
| `creditLimit` | integer | DECIMAL(15,2) | Кредитный лимит | ✅ |
| `inBalance` | boolean | BOOLEAN | Учитывать в общем балансе | ✅ |
| `private` | boolean | BOOLEAN | Приватный счет | ✅ |
| `savings` | boolean | BOOLEAN | Сберегательный счет | ✅ |
| `archive` | boolean | BOOLEAN | Архивный счет | ✅ |
| `enableCorrection` | boolean | BOOLEAN | Разрешена коррекция баланса | ✅ |
| `enableSMS` | boolean | BOOLEAN | SMS уведомления | ✅ |
| `balanceCorrectionType` | string | VARCHAR(20) | Тип коррекции баланса | ❌ |
| `company` | integer/null | INTEGER | ID компании | ❌ |
| `role` | string/null | VARCHAR(50) | Роль счета | ❌ |
| `syncID` | string/list/null | TEXT | ID для синхронизации | ❌ |
| `changed` | integer | BIGINT | Timestamp последнего изменения | ✅ |

### Поля для депозитов
| Поле | Тип в JSON | Тип в Supabase | Описание |
|------|------------|----------------|----------|
| `capitalization` | boolean/null | BOOLEAN | Капитализация процентов |
| `percent` | number/null | DECIMAL(5,2) | Процентная ставка |
| `startDate` | string/null | DATE | Дата начала депозита |
| `endDateOffset` | integer/null | INTEGER | Смещение даты окончания |
| `endDateOffsetInterval` | string/null | VARCHAR(20) | Интервал смещения |

### Поля для кредитов
| Поле | Тип в JSON | Тип в Supabase | Описание |
|------|------------|----------------|----------|
| `payoffStep` | number/null | DECIMAL(15,2) | Шаг погашения |
| `payoffInterval` | string/null | VARCHAR(20) | Интервал погашения |

## 🗄️ Схема таблицы Supabase

### Основная таблица `accounts`

```sql
CREATE TABLE accounts (
    -- Основные поля
    id UUID PRIMARY KEY,
    user_id INTEGER NOT NULL,
    instrument_id INTEGER NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    
    -- Финансовые данные
    balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    start_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    credit_limit DECIMAL(15,2) NOT NULL DEFAULT 0,
    
    -- Настройки счета
    in_balance BOOLEAN NOT NULL DEFAULT true,
    private BOOLEAN NOT NULL DEFAULT false,
    savings BOOLEAN NOT NULL DEFAULT false,
    archive BOOLEAN NOT NULL DEFAULT false,
    enable_correction BOOLEAN NOT NULL DEFAULT true,
    enable_sms BOOLEAN NOT NULL DEFAULT false,
    
    -- Коррекция баланса
    balance_correction_type VARCHAR(20),
    
    -- Депозитные параметры
    capitalization BOOLEAN,
    percent DECIMAL(5,2),
    start_date DATE,
    end_date_offset INTEGER,
    end_date_offset_interval VARCHAR(20),
    
    -- Параметры погашения
    payoff_step DECIMAL(15,2),
    payoff_interval VARCHAR(20),
    
    -- Связи
    company_id INTEGER,
    role VARCHAR(50),
    
    -- Синхронизация
    sync_id TEXT,
    changed BIGINT NOT NULL,
    
    -- Метаданные
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Индексы

```sql
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_type ON accounts(type);
CREATE INDEX idx_accounts_instrument_id ON accounts(instrument_id);
CREATE INDEX idx_accounts_archive ON accounts(archive);
CREATE INDEX idx_accounts_changed ON accounts(changed);
```

## 🔄 Маппинг данных

### Преобразование полей при загрузке

```javascript
const mapZenMoneyAccount = (zenAccount) => ({
    id: zenAccount.id,
    user_id: zenAccount.user,
    instrument_id: zenAccount.instrument,
    type: zenAccount.type,
    title: zenAccount.title,
    balance: zenAccount.balance,
    start_balance: zenAccount.startBalance,
    credit_limit: zenAccount.creditLimit,
    in_balance: zenAccount.inBalance,
    private: zenAccount.private,
    savings: zenAccount.savings,
    archive: zenAccount.archive,
    enable_correction: zenAccount.enableCorrection,
    enable_sms: zenAccount.enableSMS,
    balance_correction_type: zenAccount.balanceCorrectionType,
    capitalization: zenAccount.capitalization,
    percent: zenAccount.percent,
    start_date: zenAccount.startDate,
    end_date_offset: zenAccount.endDateOffset,
    end_date_offset_interval: zenAccount.endDateOffsetInterval,
    payoff_step: zenAccount.payoffStep,
    payoff_interval: zenAccount.payoffInterval,
    company_id: zenAccount.company,
    role: zenAccount.role,
    sync_id: Array.isArray(zenAccount.syncID) ? zenAccount.syncID.join(',') : zenAccount.syncID,
    changed: zenAccount.changed
});
```

## 📋 Типы счетов

### 1. `debt` - Долги
- Счета для учета долгов
- Могут иметь отрицательный баланс
- Пример: "Долги"

### 2. `checking` - Расчетные счета
- Банковские расчетные счета
- Основные счета для операций
- Пример: "BA TNB RUB 99 XX Premium"

### 3. `ccard` - Кредитные карты
- Кредитные карты
- Могут иметь кредитный лимит
- Пример: "DC HMR UZS 01"

### 4. `cash` - Наличные
- Наличные деньги
- Физические деньги
- Пример: "CS SFE RUB 01"

### 5. `deposit` - Депозиты
- Банковские депозиты
- Могут иметь процентную ставку
- Пример: "SV TBN RUB 03 Short 378 23%"

## ⚠️ Особенности

### Null значения
- Многие поля могут быть `null` в JSON
- В Supabase используем `NULL` для необязательных полей
- Для булевых полей с `null` используем `NULL` (не `false`)

### Типы данных
- `balance` и `startBalance` могут быть `int` или `float` в JSON
- В Supabase используем `DECIMAL(15,2)` для точности
- `syncID` может быть массивом - преобразуем в строку

### Синхронизация
- Поле `changed` содержит Unix timestamp
- Используется для инкрементальной синхронизации
- Индексируем для быстрого поиска изменений

## 🚀 Рекомендации по использованию

1. **Создание таблицы**: Используйте `supabase_accounts_schema.sql`
2. **Загрузка данных**: Применяйте маппинг `mapZenMoneyAccount`
3. **Синхронизация**: Используйте поле `changed` для инкрементальных обновлений
4. **Индексы**: Все индексы созданы для оптимизации запросов
5. **Триггеры**: Автоматическое обновление `updated_at` при изменениях

## 📁 Файлы

- `supabase_accounts_schema.sql` - SQL схема для создания таблицы
- `zenmoney_accounts_analysis.md` - Данный анализ
- `zenmoney_response.json` - Исходные данные для анализа
