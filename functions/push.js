const { Expo } = require('expo-server-sdk');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const expo = new Expo();

async function sendPush(uid, title, body, data) {
  try {
    const snap = await admin.database().ref(`pushTokens/${uid}`).once('value');
    const val = snap.val();
    const token = val && val.token;

    if (!token || !Expo.isExpoPushToken(token)) {
      logger.log(`No valid push token for user ${uid}`);
      return;
    }

    await expo.sendPushNotificationsAsync([
      { to: token, title, body, data },
    ]);
  } catch (err) {
    logger.error(`Error sending push to user ${uid}:`, err);
  }
}

async function sendPushBulk(messages) {
  try {
    if (!Array.isArray(messages) || messages.length === 0) return;

    const validMessages = messages.filter(
      (msg) => msg && msg.to && Expo.isExpoPushToken(msg.to)
    );

    if (validMessages.length === 0) return;

    const chunks = expo.chunkPushNotifications(validMessages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        logger.error('Error sending push notification chunk:', err);
      }
    }
  } catch (err) {
    logger.error('Error in sendPushBulk:', err);
  }
}

async function isCategoryEnabled(uid, category) {
  try {
    const snap = await admin.database().ref(`notifPrefs/${uid}/${category}`).once('value');
    const val = snap.val();
    return val !== false;
  } catch (err) {
    logger.error(`Error checking notification preference for ${uid}/${category}:`, err);
    return true;
  }
}

exports.sendPush = sendPush;
exports.sendPushBulk = sendPushBulk;
exports.isCategoryEnabled = isCategoryEnabled;


