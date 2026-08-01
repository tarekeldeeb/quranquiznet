const notificationLocales = require('./notificationLocales.js');

function loadLocale(lang) {
  const code = (lang || 'ar').toLowerCase().split('-')[0];
  return notificationLocales[code] || notificationLocales['ar'];
}

function getNotificationText(lang, key, params = {}) {
  const data = loadLocale(lang);
  const arData = notificationLocales['ar'];

  const cleanKey = key.startsWith('notifications.') ? key.slice('notifications.'.length) : key;
  const keys = cleanKey.split('.');

  let val = data;
  let arVal = arData;
  for (const k of keys) {
    val = val ? val[k] : undefined;
    arVal = arVal ? arVal[k] : undefined;
  }
  let str = typeof val === 'string' ? val : (typeof arVal === 'string' ? arVal : '');
  for (const [pKey, pVal] of Object.entries(params)) {
    str = str.replace(new RegExp(`{{\\s*${pKey}\\s*}}`, 'g'), String(pVal));
  }
  return str;
}

module.exports = { loadLocale, getNotificationText };
