const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { sendPush, isCategoryEnabled } = require('./push.js');

function getLocalDateAndHour(tz) {
  const now = new Date();
  const hourStr = now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
  const hour = Number(hourStr);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year').value;
  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  const localDate = `${year}-${month}-${day}`;

  return { hour, localDate };
}

exports.streaksched = onSchedule('every 1 hours', async () => {
  logger.log(':: StreakSweep ::');
  const tokensSnap = await admin.database().ref('pushTokens').once('value');
  if (!tokensSnap.exists()) return;

  const tokens = tokensSnap.val();
  if (!tokens) return;

  for (const uid of Object.keys(tokens)) {
    try {
      const tokenData = tokens[uid];
      if (!tokenData || !tokenData.tz) continue;

      const { hour, localDate } = getLocalDateAndHour(tokenData.tz);
      if (hour !== 19) continue;
      if (tokenData.lastStreakAlertDate === localDate) continue;

      const enabled = await isCategoryEnabled(uid, 'streakAlerts');
      if (!enabled) continue;

      const userSnap = await admin.database().ref(`users/${uid}`).once('value');
      const userData = userSnap.val();
      if (!userData) continue;

      const streak = userData.streak || 0;
      const lastPlayDate = userData.lastPlayDate || '';
      if (!streak || lastPlayDate === localDate) continue;

      const freezeTokens = (userData.pvp && userData.pvp.streakFreezeTokens) || 0;

      let title, body;
      if (freezeTokens > 0) {
        title = '🔥 حافظ على سلسلتك';
        body = `سلسلتك ${streak} يوم في خطر الليلة! لديك تجميد متاح لحفظ سلسلتك. افتح التطبيق لاستخدامه.`;
      } else {
        title = '🔥 لا تفقد سلسلتك';
        body = `سلسلتك ${streak} يوم في خطر الليلة! العب اختباراً الآن للحفاظ عليها.`;
      }

      await sendPush(uid, title, body, { type: 'streak_reminder' });
      await admin.database().ref(`pushTokens/${uid}/lastStreakAlertDate`).set(localDate);
    } catch (err) {
      logger.error(`Streak sweep error for user ${uid}:`, err);
    }
  }
});
