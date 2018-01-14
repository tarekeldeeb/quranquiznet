// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

const rp = require('request-promise');
const promisePool = require('es6-promise-pool');
const PromisePool = promisePool.PromisePool;
// Maximum concurrent account deletions.
const MAX_CONCURRENT = 3;

exports.hourly_job =
  functions.pubsub.topic('hourly-tick').onPublish((event) => {
    console.log(": HourlyJobs :");
	return 0;
  });
exports.daily_job =
  functions.pubsub.topic('daily-tick').onPublish((event) => {
    console.log(":: DailyJobs ::");
	return 0;
  });
exports.weekly_job =
  functions.pubsub.topic('weekly-tick').onPublish((event) => {
    console.log(":::: WeeklyJobs ::::");
	removeUsersWithLocalID(["0ODDevVQWBYhkF8o9H7LoUmXB5e2","1C6iUCDNP3O8IUCJQjFEekjGC8s2"]);
	return 0;
  });

function removeUsersWithLocalID(anonymousUsers){
	// Use a pool so that we delete maximum `MAX_CONCURRENT` users in parallel.
	const promisePool = new PromisePool(() => {
	  if (anonymousUsers.length > 0) {
		const userToDelete = anonymousUsers.pop();

		// Delete the inactive user.
		return admin.auth().deleteUser(userToDelete).then(() => {
		  console.log('Deleted anonymous user account', userToDelete);
		}).catch(error => {
		  console.error('Deletion of anonymous user account', userToDelete, 'failed:', error);
		});
	  }
	}, MAX_CONCURRENT);

	promisePool.start().then(() => {
	  console.log('User cleanup finished');
	});
}

/**
 * Returns the list of all users with their ID and lastLogin timestamp.
 *
function getUsers(userIds = [], nextPageToken, accessToken) {
  return getAccessToken(accessToken).then(accessToken => {
    const options = {
      method: 'POST',
      uri: 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/downloadAccount?fields=users/localId,users/lastLoginAt,nextPageToken&access_token=' + accessToken,
      body: {
        nextPageToken: nextPageToken,
        maxResults: 1000
      },
      json: true
    };

    return rp(options).then(resp => {
      if (!resp.users) {
        return userIds;
      }
      if (resp.nextPageToken) {
        return getUsers(userIds.concat(resp.users), resp.nextPageToken, accessToken);
      }
      return userIds.concat(resp.users);
    });
  });
}*/

/**
 * Returns an access token using the Google Cloud metadata server.
 *
function getAccessToken(accessToken) {
  // If we have an accessToken in cache to re-use we pass it directly.
  if (accessToken) {
    return Promise.resolve(accessToken);
  }

  const options = {
    uri: 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
    headers: {'Metadata-Flavor': 'Google'},
    json: true
  };

  return rp(options).then(resp => resp.access_token);
}*/