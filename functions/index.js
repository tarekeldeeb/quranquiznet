// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
var functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database. 
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

/*Just for local debugging ..
exports.helloWorld = functions.https.onRequest((request, response) => {
  dailyQuiz();	
  response.send("Hello from Firebase debugging!");  	
});*/

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
	dailyQuiz();
	return 0;
  });
exports.weekly_job =
  functions.pubsub.topic('weekly-tick').onPublish((event) => {
    console.log(":::: WeeklyJobs ::::");
	removeAnonymous();
	return 0;
  });
function dailyQuiz(){
	var yesterday = Array();
	admin.database().ref("daily/head_submit").orderByChild("score").limitToLast(5).once("value")
	.then(function(top5) {
		//Get Top-5 of Today's Quiz
		top5.forEach(function(t){
			yesterday.push(t.val());
		});
		yesterday.reverse();
		//Store them in Yesterday
		if(yesterday.length>0){
		  admin.database().ref("daily/reports/yday").set(yesterday);
		
		  //Merge with all best
		  admin.database().ref("daily/reports/all").once("value")
		  .then(function(old){
			var arr_old = old.val(); 
			var oldPlusYesterday = arr_old.concat(yesterday);
			oldPlusYesterday.sort(function(a,b) {
			  return (a.score > b.score) ? -1 : ((b.score > a.score) ? 1 : 0);
			}); 
			admin.database().ref("daily/reports/all").set(oldPlusYesterday.slice(0,10));
		  });
		}
	
		
		var newDaily = {daily_random: Math.floor(Math.random() * 80000),
						start_time: new Date().getTime(),
						submit_to_ref: "head_submit",
						yesterday: "reports/yday"};
		//Set new head
		admin.database().ref("daily/head").set(newDaily);
		//Clear submissions
		admin.database().ref("daily/head_submit").remove();		
	})
	.then(function(){

	});
}
function removeAnonymous(){
  admin.database().ref("users").orderByChild("isAnonymous")
  .equalTo(true).once("value").then(function(snapshot) {
	if(!snapshot.hasChildren()){
	  console.log("No Anonymous users to clean ..");
	  return;
	}
    snapshot.forEach(function(u) {
	  u.ref.remove()
	    .then(function() {
			removeUsersWithLocalID(u.val().uid);
			//console.log("Removed Anonymous: "+u.val().uid)
			})
		.catch(function(error) {console.log("Remove failed: " + error.message)});
        // Returning true means that we will only loop through the forEach() one time
        //return true;
    });
  });
}
  

function removeUsersWithLocalID(anonymousUsers){
	// Use a pool so that we delete maximum `MAX_CONCURRENT` users in parallel.
	const promisePool = new PromisePool(() => {
	  if (anonymousUsers.length > 0) {
		const userToDelete = anonymousUsers.pop();

		// Delete the inactive user.
		return admin.auth().deleteUser(userToDelete).then(() => {
		  console.log('Deleted anonymous user account: ', userToDelete);
		}).catch(error => {
		  console.error('Deletion of anonymous user account: ', userToDelete, ' failed: ', error);
		});
	  }
	}, MAX_CONCURRENT);

	promisePool.start().then(() => {
	  console.log('User cleanup finished');
	});
}
