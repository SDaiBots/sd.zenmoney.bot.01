# Анализ структуры тегов (статей) ZenMoney

## 📋 Обзор

На основе анализа API ZenMoney и реальных данных из `zenmoney_response.json` и `zenmoney_dictionaries.json` была изучена структура тегов (статей) и подготовлена схема для загрузки в Supabase.

## 🔍 Структура данных тегов

### Основные поля из API ZenMoney

| Поле | Тип | Описание | Пример |
|------|-----|----------|---------|
| `id` | UUID | Уникальный идентификатор тега | `"08a38928-caa9-449e-b108-be0410a7935d"` |
| `user` | Integer | ID пользователя ZenMoney | `1695996` |
| `title` | String | Название тега/статьи | `"Видео игры"` |
| `parent` | UUID | ID родительского тега (для иерархии) | `"a1bcf4a5-9244-4196-a2a1-d036492d8047"` |
| `color` | Integer | Цвет тега в числовом формате | `4287730330` |
| `icon` | String | Иконка тега | `"2007_controller"` |
| `picture` | String/null | Изображение тега | `null` |
| `staticId` | String/null | Статический ID тега | `"2006"` или `null` |
| `changed` | Timestamp | Время последнего изменения | `1743819611` |

### Булевые флаги

| Поле | Тип | Описание | Значение по умолчанию |
|------|-----|----------|----------------------|
| `budgetIncome` | Boolean | Учитывать в бюджете доходов | `false` |
| `budgetOutcome` | Boolean | Учитывать в бюджете расходов | `false` |
| `required` | Boolean | Обязательный тег (нельзя удалить) | `false` |
| `archive` | Boolean | Архивный статус | `false` |
| `showIncome` | Boolean | Показывать в доходах | `false` |
| `showOutcome` | Boolean | Показывать в расходах | `true` |

## 📊 Статистика данных

- **Общее количество тегов**: 91
- **Теги с родительскими элементами**: ~70% (иерархическая структура)
- **Архивные теги**: ~5%
- **Теги с иконками**: ~80%
- **Теги с изображениями**: ~2%

## 🗄️ Схема Supabase

### Таблица `zm_tags`

```sql
CREATE TABLE zm_tags (
    -- Основные поля
    id UUID PRIMARY KEY,                    -- Уникальный идентификатор тега
    user_id INTEGER NOT NULL,               -- ID пользователя ZenMoney
    title TEXT NOT NULL,                    -- Название тега/статьи
    parent_id UUID REFERENCES zm_tags(id), -- ID родительского тега
    
    -- Визуальные настройки
    color INTEGER,                          -- Цвет тега (числовое представление)
    icon TEXT,                              -- Иконка тега
    picture TEXT,                           -- Изображение тега
    
    -- Настройки отображения
    show_income BOOLEAN DEFAULT false,      -- Показывать в доходах
    show_outcome BOOLEAN DEFAULT true,      -- Показывать в расходах
    budget_income BOOLEAN DEFAULT false,    -- Учитывать в бюджете доходов
    budget_outcome BOOLEAN DEFAULT false,   -- Учитывать в бюджете расходов
    
    -- Статус и системные поля
    required BOOLEAN DEFAULT false,         -- Обязательный тег
    archive BOOLEAN DEFAULT false,          -- Архивный статус
    static_id TEXT,                         -- Статический ID
    
    -- Временные метки
    changed TIMESTAMP WITH TIME ZONE,       -- Время последнего изменения
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Индексы для оптимизации

```sql
-- Основные индексы
CREATE INDEX idx_zm_tags_user_id ON zm_tags(user_id);
CREATE INDEX idx_zm_tags_parent_id ON zm_tags(parent_id);
CREATE INDEX idx_zm_tags_title ON zm_tags(title);
CREATE INDEX idx_zm_tags_archive ON zm_tags(archive);
CREATE INDEX idx_zm_tags_changed ON zm_tags(changed);
```

### Представления (Views)

#### 1. `active_zm_tags`
Активные (не архивные) теги для основного использования.

#### 2. `zm_tags_with_parent`
Теги с информацией о родительском элементе для отображения иерархии.

### Функции

#### 1. `get_child_tags(parent_tag_id UUID)`
Рекурсивная функция для получения всех дочерних тегов с указанием уровня вложенности.

#### 2. `get_parent_tags(child_tag_id UUID)`
Рекурсивная функция для получения всех родительских тегов с указанием уровня вложенности.

## 🔄 Процесс загрузки данных

### 1. Подготовка данных

```javascript
// Пример преобразования данных из ZenMoney API
const transformTag = (zenmoneyTag) => ({
    id: zenmoneyTag.id,
    user_id: zenmoneyTag.user,
    title: zenmoneyTag.title,
    parent_id: zenmoneyTag.parent || null,
    color: zenmoneyTag.color,
    icon: zenmoneyTag.icon,
    picture: zenmoneyTag.picture,
    show_income: zenmoneyTag.showIncome,
    show_outcome: zenmoneyTag.showOutcome,
    budget_income: zenmoneyTag.budgetIncome,
    budget_outcome: zenmoneyTag.budgetOutcome,
    required: zenmoneyTag.required,
    archive: zenmoneyTag.archive,
    static_id: zenmoneyTag.staticId,
    changed: new Date(zenmoneyTag.changed * 1000).toISOString()
});
```

### 2. Загрузка в Supabase

```javascript
// Пример загрузки тегов в Supabase
const loadTagsToSupabase = async (tags) => {
    const { data, error } = await supabase
        .from('zm_tags')
        .upsert(tags, { 
            onConflict: 'id',
            ignoreDuplicates: false 
        });
    
    if (error) {
        console.error('Ошибка загрузки тегов:', error);
        throw error;
    }
    
    return data;
};
```

## 📈 Рекомендации по использованию

### 1. Синхронизация данных
- Использовать поле `changed` для инкрементальной синхронизации
- Реализовать механизм обработки конфликтов при обновлении
- Учитывать временные зоны при работе с метками времени

### 2. Производительность
- Использовать представления для часто запрашиваемых данных
- Кэшировать иерархические структуры
- Оптимизировать запросы с использованием индексов

### 3. Валидация данных
- Проверять корректность UUID
- Валидировать цветовые значения (0-4294967295)
- Обрабатывать null значения для опциональных полей

### 4. Безопасность
- Использовать RLS (Row Level Security) для ограничения доступа
- Валидировать входные данные перед загрузкой
- Логировать операции с данными

## 🔧 Дополнительные возможности

### 1. Полнотекстовый поиск
```sql
-- Создание индекса для полнотекстового поиска
CREATE INDEX idx_zm_tags_title_search 
ON zm_tags USING gin(to_tsvector('russian', title));
```

### 2. Агрегация по цветам
```sql
-- Группировка тегов по цветам
SELECT color, COUNT(*) as tag_count
FROM zm_tags
WHERE archive = false
GROUP BY color
ORDER BY tag_count DESC;
```

### 3. Статистика иерархии
```sql
-- Анализ глубины иерархии тегов
WITH RECURSIVE tag_depth AS (
    SELECT id, title, 0 as depth
    FROM zm_tags
    WHERE parent_id IS NULL
    
    UNION ALL
    
    SELECT t.id, t.title, td.depth + 1
    FROM zm_tags t
    JOIN tag_depth td ON t.parent_id = td.id
)
SELECT depth, COUNT(*) as count
FROM tag_depth
GROUP BY depth
ORDER BY depth;
```

## 📝 Заключение

Созданная схема обеспечивает:
- ✅ Полную совместимость с API ZenMoney
- ✅ Поддержку иерархической структуры тегов
- ✅ Оптимизированные запросы через индексы
- ✅ Гибкость для будущих расширений
- ✅ Автоматическое управление временными метками

Схема готова к использованию и может быть развернута в Supabase для хранения и управления тегами из ZenMoney.
