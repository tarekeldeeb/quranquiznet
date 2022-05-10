/****
 * Copyright (C) 2011-2016 Quran Quiz Net
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('oneCtrl', function ($scope, $rootScope, $state, $stateParams,
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
    $scope.busyShow();
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
        setTimeout(function () {
          Profile.saveAll();
        }, 100); //Note: Remove to debug the lastly saved question
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
  $scope.getCountryFlagClass = function(code){
    return "flag flag-"+code.toLowerCase();
  }
  $scope.nextQ($stateParams.customStart);
  $scope.updateScore();
})
