/****
 * Copyright (C) 2011-2016 Quran Quiz Net 
 * Tarek Eldeeb <tarekeldeeb@gmail.com>
 * License: see LICENSE.txt
 ****/
controllers.controller('quizCtrl', function ($scope, $rootScope, $stateParams, $ionicLoading, $ionicScrollDelegate, Q, $q, $ionicPopup, $ionicModal, DBA, Utils, Profile, Questionnaire, $firebase) {
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
  