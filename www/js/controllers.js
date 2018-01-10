/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/

angular.module('starter.controllers', ['firebase'])
  .controller('ahlanCtrl', function ($scope, Utils) {
    Utils.log('Ahlan to Quran Quiz Net!');
  })

  .controller('quizCtrl', function ($scope, $rootScope, $stateParams, $ionicLoading, $ionicScrollDelegate, Q, $q, $ionicPopup, $ionicModal, DBA, Utils, Profile, Questionnaire, $firebase) {
    var shuffle, qquestion;
    var scrollLock = false;
    $scope.round = 0;
    $scope.showingBackCard = false;
    $scope.busy = true;
    $scope.imageSrc = 'http://images.qurancomplex.gov.sa/publications/04_standard1/750/jpg_90/0011.jpg';
    $scope.questionCards = [];
    $scope.loadMore = function (start) {
      $scope.$broadcast('scroll.infiniteScrollComplete');
    }
    $scope.busyShow = function () {
      $ionicLoading.show({
        template: '<ion-spinner></ion-spinner>'
      });
    }
    $scope.busyHide = function () {
      $ionicLoading.hide();
    }
    $ionicModal.fromTemplateUrl('image-modal.html', {
      scope: $scope,
      animation: 'slide-in-up'
    }).then(function (modal) {
      $scope.modal = modal;
    });
    $scope.openModal = function (url) {
      $scope.imageSrc = url;
      $scope.modal.show();
    };
    $scope.closeModal = function () {
      $scope.modal.hide();
    };
    $scope.qPagePrevious = function () {
      var p = Utils.getPageNumberFromPageURL($scope.imageSrc);
      p--;
      p = ((603 + p) % 604) + 1;
      $scope.imageSrc = Utils.getPageURLFromPageNumber(p);
    };
    $scope.qPageNext = function () {
      var p = Utils.getPageNumberFromPageURL($scope.imageSrc);
      p++;
      p = ((603 + p) % 604) + 1;
      $scope.imageSrc = Utils.getPageURLFromPageNumber(p);
    };
    $scope.$on('$destroy', function () {
      $scope.modal.remove();
    });

    function IncorrectQuestionHandler() {
      setBackCardStyle(false);
      $scope.flip();
      scrollLock = true;
      Profile.addIncorrect(Questionnaire.qo);
      $scope.nextQ();
      $scope.updateScore();
    }

    function CorrectQuestionHandler() {
      setBackCardStyle(true);
      $scope.flip();
      Profile.addCorrect(Questionnaire.qo);
      $scope.busyShow();
      $scope.nextQ();
      $scope.updateScore();
    }
    $scope.updateScore = function () {
      if ($scope.score == null) {
        $scope.score = Profile.getScore();
      } else {
        animateScore(Profile.getScore());
      }
      $scope.score_up = Questionnaire.getUpScore();
      $scope.score_down = Questionnaire.getDownScore();
    }


    $scope.nextQ = function (start) {
      $scope.busy = true;
      if (!$scope.showingBackCard) $scope.busyShow();
      Questionnaire.createNextQ(parseInt(start))
        .then(function () {
          $scope.round = 0;
          shuffle = Utils.randperm(5);
          $scope.question = Questionnaire.qo.txt.question;
          $scope.options = Utils.shuffle(Questionnaire.qo.txt.op[$scope.round], shuffle);
          $scope.instructions = Questionnaire.qo.qType.txt;
          $scope.busy = false;
          $scope.busyHide();
          setTimeout(function () {
            Profile.saveAll();
          }, 100); //Note: Remove to debug the lastly saved question
          return $scope.getAnswer();
        })
        .then(function () {
          var card = {
            qo: Questionnaire.qo,
            answer: $scope.answer,
            answer_sura: $scope.answer_sura,
            answer_sura_info: $scope.answer_sura_info,
            answer_aya: $scope.answer_aya,
            answer_pageURL: $scope.answer_pageURL
          };
          $scope.questionCards.push(card);
          $scope.$broadcast('scroll.infiniteScrollComplete');
          if (!scrollLock) setTimeout(function () {$ionicScrollDelegate.scrollBottom(true);}, 200);
        });
    }


    $scope.getAnswer = function () {
      $scope.answer = Questionnaire.qo.txt.answer + ' ...';
      var sura = Utils.getSuraIdx(Questionnaire.qo.startIdx);
      $scope.answer_sura = Utils.sura_name[sura];
      $scope.answer_sura_info = Utils.getSuraTanzilFromWordIdx(Questionnaire.qo.startIdx) +
        ' اياتها ' + Utils.sura_ayas[Utils.getSuraIdx(Questionnaire.qo.startIdx)];
      return Q.ayaNumberOf(Questionnaire.qo.startIdx)
        .then(function (res) {
          $scope.answer_aya = res;
          $scope.answer_pageURL = Utils.getPageURLFromSuraAyah(sura, res);
        });
    }
    $scope.skipQ = function () {
      setBackCardStyle(false);
      $scope.flip();
      scrollLock = true;
      Profile.addIncorrect(Questionnaire.qo);
      $scope.nextQ();
      $scope.updateScore();
    }
    $scope.makeSequence = function (n) {
      return Utils.makeSequence(n);
    }
    $scope.selectOption = function (sel) {
      if (shuffle[sel] != 0) { // Bad Choice
        IncorrectQuestionHandler();
        return;
      } else if (++$scope.round == Questionnaire.qo.rounds) { // Correct Finish
        CorrectQuestionHandler();
        return;
      } else { // Proceed with rounds
        $scope.question = Questionnaire.qo.txt.answer.split(" ")
          .splice(0, Questionnaire.qo.qLen +
            Questionnaire.qo.oLen * $scope.round).join(" ");
        shuffle = Utils.randperm(5);
        $scope.options = Utils.shuffle(Questionnaire.qo.txt.op[$scope.round], shuffle);
        qquestion = document.getElementById('qquestion-' + ($scope.questionCards.length - 1));
        setTimeout(function () {
          qquestion.scrollLeft = 0
        }, 10);
        //setTimeout(function() {qquestion.animate({scrollLeft :0},800);},10);	
      }
    }

    $scope.flip = function () {
      $scope.showingBackCard = true;
      angular.element(document.getElementById('flip-container-' + ($scope.questionCards.length - 1))).toggleClass('flip')
    }
    $scope.answerOK = function () {
      scrollLock = false;
      $ionicScrollDelegate.scrollBottom(true);
      /*
      		$scope.flip();
      		$scope.showingBackCard = false;
      		if($scope.busy)  $scope.busyShow();
      */
    }

    function animateScore(count) {
      var stepsCount = Math.abs(count - parseInt($scope.score)),
        step = (count > parseInt($scope.score)) ? 1 : -1,
        run_count = 0;

      var int = setInterval(function () {
        if (run_count++ < stepsCount) {
          $scope.score += step;
        } else {
          clearInterval(int);
        }
      }, 50);
    }

    function setBackCardStyle(state) {
      var card = document.getElementById('backcard-' + ($scope.questionCards.length - 1));
      if (state) {
        card.style.boxShadow = "0px 0px 15px #090";
      } else {
        card.style.boxShadow = "0px 0px 15px #F00";
      }
    }
    $scope.reportQuestion = function (card) {
      $scope.report = {}
      $ionicPopup.show({
        templateUrl: 'popup-template.html',
        title: 'الابلاغ عن خطأ',
        subTitle: 'هل تريد الابلاغ عن خطأ في السؤال؟',
        scope: $scope,
        buttons: [{
            text: 'لا',
            onTap: function (e) {
              return false;
            }
          },
          {
            text: '<b>نعم</b>',
            type: 'button-positive',
            onTap: function (e) {
              return $scope.report.msg || true;
            }
          },
        ]
      }).then(function (res) {
        if (res) {
          Utils.log('Reporting question:' + JSON.stringify(card));
          var messagesRef = $rootScope.database.ref('/reports/');
            messagesRef.push({q:Utils.deepCopy(card),msg:res}).then(function () { //DeepCopy to remove $$hashkey attributes
            }.bind(this)).catch(function (error) {
              console.error('Error reporting error to Firebase Database', error);
            });
        } else {
          Utils.log('Reporting cancelled!');
        }
      });

    };
    $scope.nextQ($stateParams.customStart);
    $scope.updateScore();
  })

  .controller('settingsCtrl', function ($scope, Profile) {
    $scope.profile = Profile;
    $scope.saveSettings = function () {
      Profile.saveSettings();
    }
  })

  .controller('daily', function ($scope, $stateParams, Questionnaire, Utils) {
    $scope.dailyStart = function () {
      Questionnaire.getDailyQuiz(parseInt($stateParams.dailyRandom));
    }
  })

  .controller('firebasecontrol', function ($rootScope, $scope, $firebase, Utils, Profile, RLocation) {
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
          } else {
            Utils.log("Unknown Facebook OAuth error? " + e);
          }
        })
        .catch(function (error) {
          if (error.code === 'auth/account-exists-with-different-credential') {
            // User's Gmail already exists.
            // The pending Facebook credential.
            var pendingCred = error.credential;
            var provider = new firebase.auth.GoogleAuthProvider();
            $rootScope.auth.signInWithPopup(provider).then(function (result) {
              // Link to Facebook credential.
              result.user.link(pendingCred).then(function () {
                // Facebook account successfully linked to the existing Firebase Gmail user.
                Utils.log("Linked Facebook account to existing Google account.")
                //goToApp();
              });
            });
          }
        });
    };
    $scope.signOut = function () {
      $rootScope.auth.signOut();
    };

    this.onAuthStateChanged = function (user) {
      $scope.user = Utils.deepCopy(user);
      if (user) { // User is signed in!
        if(user.isAnonymous){
          $scope.user.photoURL="img/anon.png";
          $scope.user.displayName="مجهول(ة)";
          $scope.user.email="شارك أهل القران، لن تفقد درجاتك الحالية.";
        }

        ///*
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
        }//*/

        $rootScope.social = user;
        Profile.uid = user.uid;
        Profile.saveSocial($rootScope.social);

        if(!user.isAnonymous){ //Sync Profile
          var messagesRef = $rootScope.database.ref('/users/' + Profile.uid);
          messagesRef.on('value', function (snapshot) {
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
        Profile.saveSocial($rootScope.social);
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
    //TODO: Get real numbers
    $scope.pcnt_total_study = Profile.getPercentTotalStudy();
    $scope.pcnt_total_ratio = Profile.getPercentTotalRatio();
    $scope.pcnt_total_special = Profile.getPercentTotalSpecialRatio();
    $scope.pcnt_total_rank = '0%';
    RLocation.getCity();
  })

  .controller('StudyCtrl', function ($scope, Profile, Utils) {
    $scope.profile = Profile;
    $scope.saveParts = function () {
      //TODO: Validate selected quantity!
      Profile.saveParts();
    }
    $scope.toggleParts = function () {
      var tog = ($scope.profile.parts[1].checked === false);
      for (var i = 1; i < $scope.profile.parts.length; i++) {
        $scope.profile.parts[i].checked = tog;
      }
      $scope.saveParts();
    };
    $scope.heartParts = function () {
      for (var i = 1; i < $scope.profile.parts.length; i++) {
        $scope.profile.parts[i].checked =
          ($scope.profile.getCorrectRatioRange(i) == $scope.profile.correctRatioRange.HIGH) ||
          ($scope.profile.getCorrectRatioRange(i) == $scope.profile.correctRatioRange.MID);
      }
      $scope.saveParts();
    };
    $scope.flagParts = function () {
      for (var i = 1; i < $scope.profile.parts.length; i++) {
        $scope.profile.parts[i].checked =
          ($scope.profile.getCorrectRatioRange(i) == $scope.profile.correctRatioRange.LOW);
      }
      $scope.saveParts();
    };
    $scope.getIcon = function (i) {
      var ico = 'ion-help-circled stable';
      var ratio = $scope.profile.getCorrectRatioRange(i);
      if (ratio == $scope.profile.correctRatioRange.HIGH)
        ico = 'ion-heart balanced';
      else if (ratio == $scope.profile.correctRatioRange.MID)
        ico = 'ion-heart-broken energized';
      else if (ratio == $scope.profile.correctRatioRange.LOW)
        ico = 'ion-flag assertive';

      return ('icon ' + ico);
    }
  });
