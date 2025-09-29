/**
 * Функция экранирования Markdown символов для Telegram
 */
function escapeMarkdown(text) {
  if (!text) return '';
  
  // Экранируем специальные символы Markdown
  return text.toString()
    .replace(/\*/g, '\\*')      // *
    .replace(/_/g, '\\_')      // _
    .replace(/\[/g, '\\[')     // [
    .replace(/\]/g, '\\]')     // ]
    .replace(/\(/g, '\\(')     // (
    .replace(/\)/g, '\\)')     // )
    .replace(/~/g, '\\~')      // ~
    .replace(/`/g, '\\`')      // `
    .replace(/>/g, '\\>')      // >
    .replace(/#/g, '\\#')     // #
    .replace(/\+/g, '\\+')     // +
    .replace(/-/g, '\\-')      // -
    .replace(/=/g, '\\=')      // =
    .replace(/\|/g, '\\|')     // |
    .replace(/\{/g, '\\{')     // {
    .replace(/\}/g, '\\}')     // }
    .replace(/\./g, '\\.')     // .
    .replace(/!/g, '\\!');     // !
}

/**
 * Функция экранирования Markdown символов для команд (не экранирует дефисы в командах)
 */
function escapeMarkdownForCommands(text) {
  if (!text) return '';
  
  // Сначала защищаем команды от экранирования дефисов
  const commandPattern = /(\/[a-zA-Z_]+-[a-zA-Z_]+)/g;
  const commands = text.match(commandPattern) || [];
  
  let result = text;
  
  // Временно заменяем команды на плейсхолдеры
  commands.forEach((command, index) => {
    result = result.replace(command, `__COMMAND_${index}__`);
  });
  
  // Экранируем все остальные символы, кроме дефисов
  result = result.toString()
    .replace(/\*/g, '\\*')      // *
    .replace(/_/g, '\\_')      // _
    .replace(/\[/g, '\\[')     // [
    .replace(/\]/g, '\\]')     // ]
    .replace(/\(/g, '\\(')     // (
    .replace(/\)/g, '\\)')     // )
    .replace(/~/g, '\\~')      // ~
    .replace(/`/g, '\\`')      // `
    .replace(/>/g, '\\>')      // >
    .replace(/#/g, '\\#')     // #
    .replace(/\+/g, '\\+')     // +
    .replace(/=/g, '\\=')      // =
    .replace(/\|/g, '\\|')     // |
    .replace(/\{/g, '\\{')     // {
    .replace(/\}/g, '\\}')     // }
    .replace(/\./g, '\\.')     // .
    .replace(/!/g, '\\!');     // !
  
  // Возвращаем команды на место
  commands.forEach((command, index) => {
    result = result.replace(`__COMMAND_${index}__`, command);
  });
  
  return result;
}

/**
 * Функция для форматирования деталей счета
 */
function formatAccountDetails(account, index, total) {
  let text = `💳 Счет ${index} из ${total}\n\n`;
  
  // Добавляем все поля счета в формате ".. ИмяПараметра: ЗначениеПараметра"
  const fields = [
    'id', 'user', 'instrument', 'type', 'role', 'private', 'savings', 
    'title', 'inBalance', 'creditLimit', 'startBalance', 'balance', 
    'company', 'archive', 'enableCorrection', 'balanceCorrectionType', 
    'startDate', 'capitalization', 'percent', 'changed', 'syncID', 
    'enableSMS', 'endDateOffset', 'endDateOffsetInterval', 'payoffStep', 'payoffInterval'
  ];
  
  fields.forEach(field => {
    const value = account[field];
    if (value !== undefined && value !== null) {
      let displayValue = value;
      
      // Специальная обработка для некоторых полей
      if (field === 'changed' && typeof value === 'number') {
        displayValue = new Date(value * 1000).toLocaleString('ru-RU');
      } else if (field === 'balance' || field === 'startBalance' || field === 'creditLimit') {
        // Форматируем денежные суммы
        displayValue = `${value} (${(value / 100).toFixed(2)})`;
      } else if (typeof value === 'boolean') {
        displayValue = value ? 'да' : 'нет';
      } else if (typeof value === 'object') {
        displayValue = JSON.stringify(value);
      }
      
      text += `.. ${field}: ${displayValue}\n`;
    }
  });
  
  return text;
}

module.exports = {
  escapeMarkdown,
  escapeMarkdownForCommands,
  formatAccountDetails
};
