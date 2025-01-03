/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('quizCtrl', function ($scope, $rootScope, $state, $stateParams, 
                                             $ionicLoading, $ionicScrollDelegate, Q, $q, 
                                             $ionicPopup, $ionicModal, $timeout, $sce,
                                             $ionicPlatform, DBA, Utils, Profile, Questionnaire, 
                                             FB, $firebase) {
  var shuffle, qquestion;
  var scrollLock = false;
  var dailyQuizScore = 0;
  var dailyQuizTime = 0;
  var cardCounter = 0;
  var cardsTemp = [];
  $scope.round = 0;
  $scope.showingBackCard = false;
  $scope.showingModal = false;
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
    $scope.modal = modal;
  });
  $scope.openModal = function (url) {
    $scope.imageSrc = url;
    $scope.showingModal = true;
    $scope.modal.show();
  };
  $scope.closeModal = function () {
    $scope.showingModal = false;
    $scope.modal.hide();
  };
  $ionicPlatform.registerBackButtonAction(function () {
    if (  $scope.showingModal ) {
      $scope.closeModal();
    }
  }, 100);
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
          qo: Questionnaire.qo,
          answer: $scope.answer,
          answer_sura: $scope.answer_sura,
          answer_sura_info: $scope.answer_sura_info,
          answer_aya: $scope.answer_aya,
          answer_pageURL: $scope.answer_pageURL
        };
        $scope.questionCards.push(card);
        $scope.$broadcast('scroll.infiniteScrollComplete');
        if($scope.dailyQuizRunning) $scope.selectTimer(12);
        if (!scrollLock) setTimeout(function () {
          $ionicScrollDelegate.scrollBottom(true);
        }, 200);
        /*
        setTimeout(function () {
            html2canvas(document.querySelector('#flip-container-'+(cardCounter-1))).then(function(canvas) {
            var a = document.createElement('a');
            // toDataURL defaults to png, so we need to request a jpeg, then convert for file download.
            a.href = canvas.toDataURL("image/jpeg").replace("image/jpeg", "image/octet-stream");
            a.download = 'card-'+(cardCounter-1)+'.jpg';
            a.click(); //Download a new image file..
          });
        }, 100)*/
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
              text: 'لا',
              onTap: function (e) {
                return false;
              }
            },
            {
              text: '<b>نعم</b>',
              type: 'button-positive',
              onTap: function (e) {
                return true;
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
        //  qquestion.scrollLeft = 0
        scrollAnim_start = qquestion.scrollLeft;
        if(scrollAnim_start){
          scrollAnim_change = 0 - scrollAnim_start; // Scrolling to 0
          scrollAnim_currentTime = 0;
          animateScroll();
        }
      }, 10);


      if($scope.dailyQuizRunning) $scope.selectTimer(5);
      //setTimeout(function() {qquestion.animate({scrollLeft :0},800);},10);	
    }
  }
  var scrollAnim_change, scrollAnim_currentTime, scrollAnim_increment;
  var scrollAnim_duration = 700;
  scrollAnim_increment = 5;

  var animateScroll = function(){        
    scrollAnim_currentTime += scrollAnim_increment;
    var val = Utils.easeInOutQuad(scrollAnim_currentTime, scrollAnim_start, scrollAnim_change, scrollAnim_duration);
    qquestion.scrollLeft = val;
    if(scrollAnim_currentTime < scrollAnim_duration) {
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
    //FOR DEBUG ONLY
    /*var newCard = {
      isFreeContent:true,
      freeConentHasTitle:true,
      freeConentTitle:'انظر لجمال خلق الله ',
      freeConentBody:$sce.trustAsHtml('<img src="https://i.pinimg.com/564x/a8/14/a3/a814a3ac99b9905161ce28d47907ac7d.jpg">\
      <h2>ما هو "لوريم إيبسوم" ؟</h2>\
<p>لوريم إيبسوم(Lorem Ipsum) هو ببساطة نص شكلي (بمعنى أن الغاية هي الشكل وليس المحتوى) ويُستخدم في صناعات المطابع ودور النشر. كان لوريم إيبسوم ولايزال المعيار للنص الشكلي منذ القرن الخامس عشر عندما قامت مطبعة مجهولة برص مجموعة من الأحرف بشكل عشوائي أخذتها من نص، لتكوّن كتيّب بمثابة دليل أو مرجع شكلي لهذه الأحرف. خمسة قرون من الزمن لم تقضي على هذا النص، بل انه حتى صار مستخدماً وبشكله الأصلي في الطباعة والتنضيد الإلكتروني. انتشر بشكل كبير في ستينيّات هذا القرن مع إصدار رقائق "ليتراسيت" (Letraset) البلاستيكية تحوي مقاطع من هذا النص، وعاد لينتشر مرة أخرى مؤخراَ مع ظهور برامج النشر الإلكتروني مثل "ألدوس بايج مايكر" (Aldus PageMaker) والتي حوت أيضاً على نسخ من نص لوريم إيبسوم.\
      </p>\
      ')
    }
    $scope.questionCards.push(newCard); */
    //FB.getDailyQuiz();
    //$scope.dailyQuizSubmittedReport();
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
