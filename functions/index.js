// Cloud Functions for Firebase SDK (2nd gen).
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');

// The Firebase Admin SDK to access the Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp();

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
      // Clear submissions
      await admin.database().ref('daily/head_submit').remove();
    });
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
