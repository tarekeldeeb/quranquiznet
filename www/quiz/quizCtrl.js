/****
 * Copyright (C) 2011-2016 Quran Quiz Net
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('quizCtrl', function ($scope, $rootScope, $state, $stateParams,
                                             $ionicLoading, $ionicScrollDelegate, IDB, $q,
                                             $ionicPopup, $ionicModal, $timeout, $sce,
                                             $ionicPlatform, Utils, Profile, Questionnaire,
                                             FB, $firebase) {
  var shuffle, qquestion;
  var scrollLock = false;
  var dailyQuizScore = 0;
  var dailyQuizTime = 0;
  var cardCounter = 0;
  var cardsTemp = [];
  $scope.round = 0;
  $scope.showingBackCard = false;
  $scope.showingImageModal = false;
  $scope.showingShareModal = false;
  $scope.busy = true;
  $scope.imageSrc = 'http://images.qurancomplex.gov.sa/publications/04_standard1/750/jpg_90/0011.jpg';
  $scope.questionCards = [];
  $scope.dailyQuizRunning = false;
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
    $scope.imageModal = modal;
  });
  $scope.openImageModal = function (url) {
    $scope.imageSrc = url;
    $scope.showingImageModal = true;
    $scope.imageModal.show();
  };
  $scope.closeImageModal = function () {
    $scope.showingImageModal = false;
    $scope.imageModal.hide();
  };
  $scope.openShareModal = function () {
    $scope.showingShareModal = true;
     $scope.shareModal = $ionicPopup.show({
        templateUrl: 'share-modal.html',
        title: 'نافس أصدقاءك عبر احد الخيارات',
        scope: $scope,
        buttons: [
          {
            text: 'حسنا',
            type: 'button-positive',
            onTap: function(e) {
              $scope.showingShareModal = false;
              Utils.log("Done sharing!");
            }
          }
        ]
      });
  };
  $scope.closeShareModal = function () {
    $scope.showingShareModal = false;
    $scope.shareModal.close();
  };
  $scope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams){
    if( $scope.showingImageModal){
      $scope.closeImageModal();
      event.preventDefault();
    }
    if($scope.showingShareModal){
      $scope.closeShareModal();
      event.preventDefault();
    }
  });
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
    $scope.imageModal.remove();
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
    if($scope.dailyQuizRunning) dailyQuizScore += 1;
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


  $scope.nextQ = async function (start) {
    $scope.busy = true;
    if (!$scope.showingBackCard) $scope.busyShow();
    if($scope.dailyQuizRunning && !Questionnaire.hasNextDailyQ()){
      await endDailyQuiz();
    }
    var makeQ = ($scope.dailyQuizRunning)?Questionnaire.createNextDailyQ:Questionnaire.createNextQ;
    makeQ(parseInt(start))
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
		  index: $scope.questionCards.length,
          qo: Utils.deepCopy(Questionnaire.qo),
          answer: $scope.answer,
          answer_sura: $scope.answer_sura,
          answer_sura_info: $scope.answer_sura_info,
          answer_aya: $scope.answer_aya,
          answer_pageURL: $scope.answer_pageURL,
		  social: {
			  url: "https://quranquiz.net/#/ahlan/"+Questionnaire.qo.startIdx,
			  text: "😀نافسني في اختبار القرآن",
		  }
        };
        $scope.questionCards.push(card);
        $scope.$broadcast('scroll.infiniteScrollComplete');
        if($scope.dailyQuizRunning) $scope.selectTimer(12);
        if (!scrollLock) setTimeout(function () {
          $ionicScrollDelegate.scrollBottom(true);
        }, 200);

        setTimeout(function () {
            // v1.x Syntax
            html2canvas(document.querySelector('#flip-container-'+(cardCounter-1)), { height: 380}).then(function(canvas) {
            var a = document.createElement('a');
            // toDataURL defaults to png, so we need to request a jpeg, then convert for file download.
            a.href = canvas.toDataURL("image/jpeg").replace("image/jpeg", "image/octet-stream");
            a.download = 'card-'+(cardCounter-1)+'.jpg';
            //a.click(); //Download a new image file..
			document.querySelector('#backcard-'+(cardCounter-1)).appendChild(a);
            });
        }, 250)
      });
    if (!$scope.dailyQuizRunning &&
       (cardCounter++ - Utils.DAILYQUIZ_CHECKAFTER) % Utils.DAILYQUIZ_CHECKEVERY == 0 ) {
      Utils.log("Checking QQNet ..");
      FB.getDailyQuiz().then(function (head) {
        //TODO: Check head date .. is Quiz Valid for today?
        $ionicPopup.confirm({
          title: 'اختبار اليوم جاهز، هل تريد البدء الان؟<br />',
          subTitle: 'الاختبار يتكون من 10 أسئلة في نطاق حفظك وعليك الاجابة بشكل صحيح وسريع',
          scope: $scope,
          buttons: [{
              text: '<b>نعم</b>',
              type: 'button-positive',
              onTap: function (e) {
                return true;
              }
            },
            {
              text: 'لا',
              onTap: function (e) {
                return false;
              }
            }
          ]
        }).then(function (res) {
          if (res) {
            $scope.$broadcast('daily-started', head);
            //$state.go('q.daily', { dailyRandom: head.daily_random });
          } else {
            Utils.log('Daily Quiz Rejected!');
          }
        });
      });
    }

  }

  $scope.getAnswer = function () {
    $scope.answer = Questionnaire.qo.txt.answer + ' ...';
    var sura = Utils.getSuraIdx(Questionnaire.qo.startIdx);
    $scope.answer_sura = Utils.sura_name[sura];
    $scope.answer_sura_info = Utils.getSuraTanzilFromWordIdx(Questionnaire.qo.startIdx) +
      ' اياتها ' + Utils.sura_ayas[Utils.getSuraIdx(Questionnaire.qo.startIdx)];
    return IDB.ayaNumberOf(Questionnaire.qo.startIdx) //TODO: Remove dependency on IDB
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
        // qquestion.scrollLeft = 0 (most right) --> - BIG_NUM (left)
        scrollAnim_start = qquestion.scrollLeft;
        scrollAnim_change = (qquestion.offsetWidth - qquestion.scrollWidth) - scrollAnim_start;
        scrollAnim_currentTime = 0;
        animateScroll();
      }, 10);


      if($scope.dailyQuizRunning) $scope.selectTimer(5);
      //setTimeout(function() {qquestion.animate({scrollLeft :0},800);},10);
    }
  }
  var scrollAnim_change, scrollAnim_currentTime, scrollAnim_increment;
  var scrollAnim_duration = 700;
  scrollAnim_increment = 20;

  var animateScroll = function(){
    scrollAnim_currentTime += scrollAnim_increment;
    var val = Utils.easeInOutQuad(scrollAnim_currentTime, scrollAnim_start, scrollAnim_change, scrollAnim_duration);
    qquestion.scrollLeft = val;
    if(val && scrollAnim_currentTime < scrollAnim_duration) {
        setTimeout(animateScroll, scrollAnim_increment);
    }
  };

  $scope.flip = function () {
    $scope.showingBackCard = true;
    angular.element(document.getElementById('flip-container-' + ($scope.questionCards.length - 1))).toggleClass('flip')
  }
  $scope.scrollDown = function () {
    scrollLock = false;
    $ionicScrollDelegate.scrollBottom(true);
    if($scope.dailyQuizRunning) $scope.selectTimer(12);
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

  $scope.$on('daily-started', async function (event, head) {
    cardsTemp = $scope.questionCards;
    $scope.questionCards = [];
    $scope.dailyQuizRunning = true;
    dailyQuizScore = 0;
    dailyQuizTime = 0;
    Questionnaire.initDailyQuiz(head);
    $scope.nextQ();
  });
  async function endDailyQuiz(){
    $scope.stopTimer();
    $scope.dailyQuizRunning = false;
    $scope.dailyScore = Profile.getDailyQuizScore(dailyQuizScore,dailyQuizTime/1000);
    var report={score: $scope.dailyScore,
                name: (Profile.social.isAnonymous)?"مجهول/ة":Profile.social.displayName.split(' ')[0],
                country:$rootScope.Loc.country,
                city:$rootScope.Loc.city,
                uid:Profile.uid
                };
    Utils.log("Sending Daily Report: "+JSON.stringify(report));
    FB.submitResult(report);
    cardsTemp.pop(); // Remove the unanswered Card.
    $scope.questionCards = cardsTemp;
    await $scope.dailyQuizSubmittedReport();
  }
  // Timer
  var mytimeout = null; // the current timeoutID
  // actual timer method, counts down every second, stops on zero
  $scope.onTimeout = function () {
    if ($scope.timer === 0) {
      $scope.$broadcast('timer-stopped', 0);
      $timeout.cancel(mytimeout);
      return;
    }
    $scope.timer--;
    mytimeout = $timeout($scope.onTimeout, 1000);
  };

  $scope.startTimer = function () {
    mytimeout = $timeout($scope.onTimeout, 0);
  };

  // stops and resets the current timer
  $scope.stopTimer = function () {
    $scope.timer = $scope.timeForTimer;
    $timeout.cancel(mytimeout);
  };
  // pauses the timer
  $scope.pauseTimer = function () {
    $timeout.cancel(mytimeout);
  };

  // triggered, when the timer stops
  $scope.$on('timer-stopped', function (event, remaining) {
    $scope.skipQ();
  });
  $scope.selectTimer = function (val) {
    $scope.stopTimer();
    $scope.timeForTimer = val;
    $scope.timer = val;
    $scope.startTimer();
  };

  // This function helps to display the time in a correct way in the center of the timer
  $scope.humanizeDurationTimer = function (input, units) {
    // units is a string with possible values of y, M, w, d, h, m, s, ms
    if (input == 0) {
      return 0;
    } else {
      var duration = moment().startOf('day').add(input, units);
      var format = "";
      if (duration.hour() > 0) {
        format += "H[h] ";
      }
      if (duration.minute() > 0) {
        format += "m[m] ";
      }
      if (duration.second() > 0) {
        format += "s[s] ";
      }
      return duration.format(format);
    }
  }

  function setBackCardStyle(state) {
    var card = document.getElementById('backcard-' + ($scope.questionCards.length - 1));
    if (state) {
      card.style.boxShadow = "0px 0px 15px #090";
    } else {
      card.style.boxShadow = "0px 0px 15px #F00";
    }
  }
  $scope.shareCard = function(card){
    Utils.log("Sharing: "+JSON.stringify(card));
    $scope.socialshare_text  = card.social.text;
    $scope.socialshare_url   = card.social.url;
    $scope.socialshare_media = document.getElementById('backcard-' + card.index).lastChild.href;
    $scope.openShareModal();
  }
  $scope.dailyQuizSubmittedReport = function () {
    return $ionicPopup.show({
      title: 'تظهر النتيجة الكلية غدا إن شاء الله',
      templateUrl: 'popup-template-submit.html',
      scope: $scope,
      buttons: [{
          text: 'حسنا',
          type: 'button',
          onTap: function (e) {
            return false;
          }
        },
        {
          text: 'نتيجة الامس',
          type: 'button icon-right ion-podium button-positive',
          onTap: function (e) {
            return true;
          }
        },
      ]
    }).then(function (res) {
      if (res) {
        FB.getYesterdayReport().then(function(yday){
          $scope.topList = yday.val();
          return $ionicPopup.show({
            title: 'فليتنافس المتنافسون',
            templateUrl: 'popup-template-top-list.html',
            cssClass: 'topList-popup',
            scope: $scope,
            buttons: [{
              text: 'حسنا',
              type: 'button',
              onTap: function (e) {
                return false;
              }
            },
            {
              text: 'قائمة الأبطال',
              type: 'button icon-right ion-podium button-positive',
              onTap: function (e) {
                return true;
              }
            },
          ]
          }).then(function (res){
            if(res){
              FB.getAllTopReport().then(function(allTop){
                $scope.topList = allTop.val();
                return $ionicPopup.show({
                  title: 'قائمة أبطال إختبار القرآن',
                  templateUrl: 'popup-template-top-list.html',
                  cssClass: 'topList-popup',
                  scope: $scope,
                  buttons: [{
                    text: 'حسنا',
                    type: 'button',
                    onTap: function (e) {
                      return false;
                    }
                  }]
                });
              });
            }
          });
        });
      }
    });
  };
  $scope.reportQuestion = function (card) {
    $scope.report = {}
    $ionicPopup.show({
      templateUrl: 'popup-template-report.html',
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
        messagesRef.push({
          q: Utils.deepCopy(card),
          msg: res
        }).then(function () { //DeepCopy to remove $$hashkey attributes
        }.bind(this)).catch(function (error) {
          console.error('Error reporting error to Firebase Database', error);
        });
      } else {
        Utils.log('Reporting cancelled!');
      }
    });
  };
  $scope.getCountryFlagClass = function(code){
    return "flag flag-"+code.toLowerCase();
  }
  $scope.nextQ($stateParams.customStart);
  $scope.updateScore();
})
