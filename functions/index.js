// Cloud Functions for Firebase SDK (2nd gen).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueCreated } = require('firebase-functions/v2/database');
const logger = require('firebase-functions/logger');
const { sendPush, isCategoryEnabled, sendPushBulk } = require('./push.js');
const { getNotificationText } = require('./i18n.js');
const { streaksched } = require('./streak.js');
exports.streaksched = streaksched;

// The Firebase Admin SDK to access the Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

exports.onpvpinvite = onValueCreated('/pvp/invites/{uid}/{fromUid}', async (event) => {
  try {
    const { uid, fromUid } = event.params;
    const invite = event.data.val();
    if (!invite) return;

    const enabled = await isCategoryEnabled(uid, 'invites');
    if (!enabled) return;

    const tokenSnap = await admin.database().ref(`pushTokens/${uid}`).once('value');
    const tokenVal = tokenSnap.val() || {};
    const lang = tokenVal.lang || tokenVal.locale || 'ar';

    const challengerName = invite.fromName || (lang === 'ar' ? 'أحد الأصدقاء' : 'A friend');
    const title = getNotificationText(lang, 'notifications.pvpInvite.title');
    const body = getNotificationText(lang, 'notifications.pvpInvite.body', { name: challengerName });

    await sendPush(uid, title, body, { type: 'pvp_invite', fromUid });
  } catch (err) {
    logger.error(`Error sending PvP invite push to user ${event.params?.uid}:`, err);
  }
});

exports.onfriendrequest = onValueCreated('/friendRequests/{uid}/{fromUid}', async (event) => {
  try {
    const { uid, fromUid } = event.params;
    const req = event.data.val();
    if (!req) return;

    const enabled = await isCategoryEnabled(uid, 'friendRequests');
    if (!enabled) return;

    const tokenSnap = await admin.database().ref(`pushTokens/${uid}`).once('value');
    const tokenVal = tokenSnap.val() || {};
    const lang = tokenVal.lang || tokenVal.locale || 'ar';

    const senderName = req.fromName || (lang === 'ar' ? 'أحد الحفّاظ' : 'A user');
    const title = getNotificationText(lang, 'notifications.friendRequest.title');
    const body = getNotificationText(lang, 'notifications.friendRequest.body', { name: senderName });

    await sendPush(uid, title, body, { type: 'friend_request' });
  } catch (err) {
    logger.error(`Error sending friend request push to user ${event.params?.uid}:`, err);
  }
});

const promisePool = require('es6-promise-pool');
const PromisePool = promisePool.PromisePool;
// Maximum concurrent account deletions.
const MAX_CONCURRENT = 3;

// NOTE: 2nd gen (Cloud Run) function names must be lowercase with no
// dashes or underscores (a dash is treated as a group separator, and
// uppercase letters fail to deploy), so these are flat lowercase names.
exports.dailysched = onSchedule('every 24 hours', async () => {
  logger.log(':: DailyJobs ::');
  await dailyQuiz();
});

exports.weeklysched = onSchedule('every 168 hours', async () => {
  logger.log(':::: WeeklyJobs ::::');
  await removeAnonymous();
  await purgePvp();
});

function dailyQuiz() {
  return admin.database().ref('daily/head_submit').orderByChild('score').limitToLast(5).once('value')
    .then(async function (top5) {
      // Get Top-5 of Today's Quiz
      var yesterday = [];
      top5.forEach(function (t) {
        yesterday.push(t.val());
      });
      yesterday.reverse();
      // Store them in Yesterday
      if (yesterday.length > 0) {
        await admin.database().ref('daily/reports/yday').set(yesterday);

        // Merge into this calendar month's leaderboard. Resets automatically
        // on the first run of a new month: the stored month key won't match,
        // so the old accumulated entries are dropped instead of carried over.
        var monthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        var storedMonth = await admin.database().ref('daily/reports/month_key').once('value');
        var arr_old = [];
        if (storedMonth.val() === monthKey) {
          var old = await admin.database().ref('daily/reports/month').once('value');
          arr_old = old.val() || [];
        }
        var oldPlusYesterday = arr_old.concat(yesterday);
        oldPlusYesterday.sort(function (a, b) {
          return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0);
        });
        await admin.database().ref('daily/reports/month').set(oldPlusYesterday.slice(0, 10));
        await admin.database().ref('daily/reports/month_key').set(monthKey);
      }

      var newDaily = {
        daily_random: Math.floor(Math.random() * 80000),
        start_time: new Date().getTime(),
        submit_to_ref: 'head_submit',
        yesterday: 'reports/yday'
      };
      // Set new head
      await admin.database().ref('daily/head').set(newDaily);

      // Fetch push tokens snapshot — reused for dailyReady and friendBeatScore pushes
      let tokens = null;
      try {
        const tokensSnap = await admin.database().ref('pushTokens').once('value');
        tokens = tokensSnap.val();
      } catch (err) {
        logger.error('Error fetching push tokens for daily quiz:', err);
      }

      // Send push notifications for new daily quiz
      try {
        if (tokens) {
          const messages = [];
          for (const uid of Object.keys(tokens)) {
            const tokenData = tokens[uid];
            const token = typeof tokenData === 'string' ? tokenData : tokenData?.token;
            if (!token) continue;

            const enabled = await isCategoryEnabled(uid, 'dailyReady');
            if (!enabled) continue;

            const lang = (tokenData && (tokenData.lang || tokenData.locale)) || 'ar';
            const title = getNotificationText(lang, 'notifications.dailyReady.title');
            const body = getNotificationText(lang, 'notifications.dailyReady.body');

            messages.push({
              to: token,
              title,
              body,
              data: { type: 'daily_ready' },
            });
          }
          if (messages.length > 0) {
            await sendPushBulk(messages);
          }
        }
      } catch (err) {
        logger.error('Error sending daily quiz push notifications:', err);
      }

      // Send push notifications for friends outscoring today
      try {
        if (tokens) {
          const fullSubmitsSnap = await admin.database().ref('daily/head_submit').once('value');
          const fullSubmits = fullSubmitsSnap.val();
          if (fullSubmits) {
            const userScores = buildUserScores(fullSubmits);
            const friendMessages = [];
            for (const uid of Object.keys(userScores)) {
              const tokenData = tokens[uid];
              const token = typeof tokenData === 'string' ? tokenData : tokenData?.token;
              if (!token) continue;

              const enabled = await isCategoryEnabled(uid, 'friendActivity');
              if (!enabled) continue;

              const friendsSnap = await admin.database().ref(`friends/${uid}`).once('value');
              const friendsVal = friendsSnap.val();
              if (!friendsVal) continue;

              const userObj = userScores[uid];
              const topFriend = findHighestScoringOutscoringFriend(uid, userObj.score, friendsVal, userScores);
              if (!topFriend) continue;

              const lang = (tokenData && (tokenData.lang || tokenData.locale)) || 'ar';
              const friendName = (topFriend.name && topFriend.name.trim()) || (lang === 'ar' ? 'أحد الأصدقاء' : 'A friend');
              const title = getNotificationText(lang, 'notifications.friendBeatScore.title');
              const body = getNotificationText(lang, 'notifications.friendBeatScore.body', { name: friendName });

              friendMessages.push({
                to: token,
                title,
                body,
                data: { type: 'friend_beat_score' },
              });
            }
            if (friendMessages.length > 0) {
              await sendPushBulk(friendMessages);
            }
          }
        }
      } catch (err) {
        logger.error('Error sending friend beat score push notifications:', err);
      }

      // Clear submissions
      await admin.database().ref('daily/head_submit').remove();
    });
}

function buildUserScores(headSubmitVal) {
  const userScores = {};
  if (!headSubmitVal) return userScores;
  for (const entry of Object.values(headSubmitVal)) {
    if (!entry || !entry.uid || typeof entry.score !== 'number') continue;
    const { uid, score, name } = entry;
    if (!userScores[uid] || score > userScores[uid].score) {
      userScores[uid] = { score, name: name || '' };
    }
  }
  return userScores;
}

function findHighestScoringOutscoringFriend(userUid, userScore, friendsMap, userScores) {
  if (!friendsMap) return null;
  let topFriend = null;
  let topScore = -1;
  for (const friendUid of Object.keys(friendsMap)) {
    if (friendUid === userUid) continue;
    const friendData = userScores[friendUid];
    if (friendData && friendData.score > userScore) {
      if (friendData.score > topScore) {
        topScore = friendData.score;
        topFriend = friendData;
      }
    }
  }
  return topFriend;
}

// ── PvP hygiene ─────────────────────────────────────────────────────────────
// Matches: clients never delete match docs, and a lost matchmaking claim race
// leaves an orphaned one (the claimer must create the doc before the claim can
// fail) — purge anything older than 7 days.
// Queue: onDisconnect() normally removes a searcher's entry, but a crashed
// client can leak one forever (searchers already ignore entries older than 60s).
const PVP_MATCH_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const PVP_QUEUE_MAX_AGE_MS = 24 * 3600 * 1000;

async function purgePvp() {
  const db = admin.database();
  const now = Date.now();

  // endAt also matches docs with no createdAt at all (null sorts first) —
  // exactly the malformed leftovers a purge should sweep.
  const staleMatches = await db.ref('pvp/matches')
    .orderByChild('meta/createdAt')
    .endAt(now - PVP_MATCH_MAX_AGE_MS)
    .once('value');
  const matchDeletes = {};
  staleMatches.forEach(function (m) { matchDeletes[m.key] = null; });
  if (Object.keys(matchDeletes).length > 0) {
    await db.ref('pvp/matches').update(matchDeletes);
  }

  const staleQueue = await db.ref('pvp/queue')
    .orderByChild('ts')
    .endAt(now - PVP_QUEUE_MAX_AGE_MS)
    .once('value');
  const queueDeletes = {};
  staleQueue.forEach(function (q) { queueDeletes[q.key] = null; });
  if (Object.keys(queueDeletes).length > 0) {
    await db.ref('pvp/queue').update(queueDeletes);
  }

  logger.log('PvP purge: removed ' + Object.keys(matchDeletes).length + ' matches, '
    + Object.keys(queueDeletes).length + ' queue entries');
}

function removeAnonymous() {
  return admin.database().ref('users').orderByChild('isAnonymous')
    .equalTo(true).once('value').then(function (snapshot) {
      if (!snapshot.hasChildren()) {
        logger.log('No Anonymous users to clean ..');
        return;
      }
      snapshot.forEach(function (u) {
        u.ref.remove()
          .then(function () {
            removeUsersWithLocalID(u.val().uid);
            // console.log("Removed Anonymous: "+u.val().uid)
          })
          .catch(function (error) { logger.log('Remove failed: ' + error.message); });
      });
    });
}

function removeUsersWithLocalID(anonymousUsers) {
  // Use a pool so that we delete maximum `MAX_CONCURRENT` users in parallel.
  const pool = new PromisePool(() => {
    if (anonymousUsers.length > 0) {
      const userToDelete = anonymousUsers.pop();

      // Delete the inactive user.
      return admin.auth().deleteUser(userToDelete).then(() => {
        logger.log('Deleted anonymous user account: ', userToDelete);
      }).catch(error => {
        logger.error('Deletion of anonymous user account: ', userToDelete, ' failed: ', error);
      });
    }
  }, MAX_CONCURRENT);

  return pool.start().then(() => {
    logger.log('User cleanup finished');
  });
}
