/****
 * Copyright (C) 2011-2016 Quran Quiz Net
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('firebasecontrol', function ($rootScope, $scope, $ionicPlatform, $state, $firebase, Utils, Profile, RLocation) {
  $ionicPlatform.ready(function() { // Controller is forced to wait for platform (Need: Profile, ..etc)
    $rootScope.social = Profile.social;
    $scope.signInAnonymous = function (){
      firebase.auth().signInAnonymously().catch(function(error) {
        // Handle Errors here.
        var errorCode = error.code;
        var errorMessage = error.message;
        Utils.log(errorCode+": "+errorMessage);
      });
    };
    $scope.signInGoogle = function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      $rootScope.auth.signInWithPopup(provider);
    };
    $scope.signInFacebook = function () {
      var provider = new firebase.auth.FacebookAuthProvider();
      $rootScope.auth.signInWithPopup(provider)
        .then(function (user) {
          //Utils.log(JSON.stringify(user));
        })
        .catch(function (e) {
          if (e.code == 'auth/popup-blocked') {
            $rootScope.auth.signInWithRedirect(provider);
            Utils.log("Redirecting for facebook Oauth ...");
          }
          else if (e.code == 'auth/account-exists-with-different-credential') {
            // User's Gmail already exists.
            // The pending Facebook credential.
            var pendingCred = e.credential;
            var provider = new firebase.auth.GoogleAuthProvider();
            $rootScope.auth.signInWithPopup(provider).then(function (result) {
              // Link to Facebook credential.
              result.user.link(pendingCred).then(function () {
                // Facebook account successfully linked to the existing Firebase Gmail user.
                Utils.log("Linked Facebook account to existing Google account.")
                //goToApp();
              });
            });
          } else {
            Utils.log("Unknown Facebook OAuth error? " + e);
          }
        });
    };
    $scope.signOut = function () {
      $rootScope.auth.signOut();
    };

    this.onAuthStateChanged = function (user) { //Fixme: called twice ..
      $scope.user = Utils.deepCopy(user);
      if (user) { // User is signed in!
        if($state.current.name == 'ahlan' && $state.params.customStart ){
          Utils.log("Going to quiz ..");
          $state.go('q.quiz', {"customStart":$state.params.customStart});
        } else if($state.current.name != 'q.profile'){
          $state.go('q.profile');
        }

        if(user.isAnonymous){
          $scope.user.photoURL="img/anon.png";
          $scope.user.displayName="مجهول(ة)";
          $scope.user.email="شارك أهل القران، لن تفقد درجاتك الحالية.";
        }

        /*
        if(Profile.uid != user.uid){ // Check if another profile is found
          Utils.log("Old UID: "+JSON.stringify(Profile.uid)+", new UID: "+JSON.stringify(user.uid));
          if(Profile.social.isAnonymous){
            //Found an anonymous old profile:
            //  Case#1 Both are anonymous .. keep the old one
            //  Case#2 The new is Auth, should also use his/her anon
            //Do nothing ..
          }
          else { //Someone else's profile .. reset it.
            Profile.reset();
          }
        }*/

        $rootScope.social = user;
        Profile.uid = user.uid;
        Profile.saveSocial($rootScope.social);

        if(!user.isAnonymous){ //Sync Profile
          var messagesRef = $rootScope.database.ref('/users/' + Profile.uid);
          messagesRef.once('value', function (snapshot) {
            var remoteProfile = snapshot.val();
            if (remoteProfile != null) Profile.syncTo(remoteProfile);
            messagesRef.set(Utils.deepCopy(Profile)).then(function () { //DeepCopy to remove $$hashkey attributes
              Utils.log("Pushed synced profile")
            }.bind(this)).catch(function (error) {
              console.error('Error profile syncing back to Firebase Database', error);
            });
          });
        }

      } else { // User is signed out!
        $rootScope.social = {};
        //Profile.saveSocial($rootScope.social);
        Profile.delete();
        if($state.current.name == 'q.profile') $state.go('ahlan');

      }
      $rootScope.$apply(); //Force UI update here ..
      $scope.$apply();
      this.redrawBars();
    };
    this.checkSetup = function () {
      if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
        window.alert('You have not configured and imported the Firebase SDK. ' +
          'Make sure you go through the codelab setup instructions and make ' +
          'sure you are running the codelab using `firebase serve`');
      }
    };
    this.redrawBars = function () {
      setTimeout(function () {
        var bars = document.querySelectorAll('.horizontal .progress_fill span');
        for (var i = 0; i < bars.length; i++) {
          var perc = bars[i].innerHTML;
          bars[i].parentNode.style.width = perc;
        }
      }, 100);
    }
    // Initiates Firebase auth and listen to auth state changes.
    $rootScope.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
    $scope.pcnt_total_study = Profile.getPercentTotalStudy();
    $scope.pcnt_total_ratio = Profile.getPercentTotalRatio();
    $scope.pcnt_total_special = '0%'; //FIXME: Profile.getPercentTotalSpecialRatio();
    $scope.pcnt_total_rank = '0%'; //TODO
    $scope.topGoodParts = Profile.getTopGoodParts();
    $scope.topBadParts  = Profile.getTopBadParts();
    RLocation.getCity();
  });
})
