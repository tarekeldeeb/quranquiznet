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

        // Merge with all best
        var old = await admin.database().ref('daily/reports/all').once('value');
        var arr_old = old.val() || [];
        var oldPlusYesterday = arr_old.concat(yesterday);
        oldPlusYesterday.sort(function (a, b) {
          return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0);
        });
        await admin.database().ref('daily/reports/all').set(oldPlusYesterday.slice(0, 10));
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
