/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.controllers', [])
.controller('ahlanCtrl', function($scope, Utils) {
	Utils.log('Ahlan to Quran Quiz Net!');
})
.controller('quizCtrl', function($scope, $stateParams, $ionicLoading, $ionicScrollDelegate, Q, $q, $ionicPopup, $ionicModal, DBA, Utils, Profile, Questionnaire, PersonService) {
	var shuffle, qquestion;
	var scrollLock = false;
	$scope.round = 0;
	$scope.showingBackCard = false;
	$scope.busy = true;
	$scope.imageSrc = 'http://images.qurancomplex.gov.sa/publications/04_standard1/750/jpg_90/0011.jpg';
	$scope.questionCards = [];
	$scope.loadMore = function(start){
			$scope.$broadcast('scroll.infiniteScrollComplete');
	}
	$scope.busyShow = function(){ $ionicLoading.show({template: '<ion-spinner></ion-spinner>'}); }
	$scope.busyHide = function(){ $ionicLoading.hide(); }
	$ionicModal.fromTemplateUrl('image-modal.html', {
						scope: $scope,      animation: 'slide-in-up'
					}).then(function(modal) {
						$scope.modal = modal;
					});
	$scope.openModal = function() {	$scope.modal.show();};
	$scope.closeModal = function() {$scope.modal.hide();};
	$scope.$on('$destroy', function() {	$scope.modal.remove();});
			
 	function IncorrectQuestionHandler(){
		setBackCardStyle(false);
		$scope.flip(); scrollLock = true;
		Profile.addIncorrect(Questionnaire.qo);
		$scope.nextQ();
		$scope.updateScore();
	}		
 	function CorrectQuestionHandler(){
		setBackCardStyle(true);
		$scope.flip();
		Profile.addCorrect(Questionnaire.qo);
		$scope.busyShow();
		$scope.nextQ();
		$scope.updateScore();
	}		
	$scope.updateScore = function(){
		if ($scope.score == null){
			$scope.score = Profile.getScore();
		} else {
			animateScore(Profile.getScore());
		}
		$scope.score_up 	= Questionnaire.getUpScore();
		$scope.score_down 	= Questionnaire.getDownScore();
	}
		

	$scope.nextQ = function(start){
		$scope.busy = true;
	 	if(!$scope.showingBackCard) $scope.busyShow();
		Questionnaire.createNextQ(parseInt(start))
		.then(function(){
			$scope.round = 0;
			shuffle = Utils.randperm(5);
			$scope.question = Questionnaire.qo.txt.question;
			$scope.options = Utils.shuffle(Questionnaire.qo.txt.op[$scope.round], shuffle);
      $scope.instructions = Questionnaire.qo.qType.txt;
			$scope.busy = false;
			$scope.busyHide();
			setTimeout(function() {Profile.saveAll();},100); //Note: Remove to debug the lastly saved question
			return $scope.getAnswer();
		})
		.then(function(){
			var card = {qo: Questionnaire.qo,
									answer:$scope.answer, 
									answer_sura:$scope.answer_sura, 
									answer_sura_info:$scope.answer_sura_info, 
									answer_aya:$scope.answer_aya };
			$scope.questionCards.push(card);
			$scope.$broadcast('scroll.infiniteScrollComplete');
			if(!scrollLock) $ionicScrollDelegate.scrollBottom(true);
		});
	}


	$scope.getAnswer = function(){
		$scope.answer       = Questionnaire.qo.txt.answer + ' ...';
		$scope.answer_sura  = Utils.getSuraNameFromWordIdx(Questionnaire.qo.startIdx);
    $scope.answer_sura_info = Utils.getSuraTanzilFromWordIdx(Questionnaire.qo.startIdx)+
                                    ' اياتها ' + Utils.sura_ayas[Utils.getSuraIdx(Questionnaire.qo.startIdx)];
		return Q.ayaNumberOf(Questionnaire.qo.startIdx).then(function(res){$scope.answer_aya  = res;});
	}
	$scope.skipQ = function(){
		setBackCardStyle(false);
		$scope.flip(); scrollLock = true;
		Profile.addIncorrect(Questionnaire.qo);
		$scope.nextQ();
		$scope.updateScore();
	}
	$scope.makeSequence = function(n){return Utils.makeSequence(n);}
	$scope.selectOption = function(sel) {	
		if (shuffle[sel] != 0){ 								// Bad Choice
			IncorrectQuestionHandler();
			return;
		}else if( ++$scope.round == Questionnaire.qo.rounds){ 	// Correct Finish
			CorrectQuestionHandler();
			return;			
		} else {												// Proceed with rounds
			$scope.question = Questionnaire.qo.txt.answer.split(" ")
										.splice(0,	Questionnaire.qo.qLen+
												Questionnaire.qo.oLen*$scope.round).join(" ");
			shuffle = Utils.randperm(5);
			$scope.options = Utils.shuffle(Questionnaire.qo.txt.op[$scope.round], shuffle);
			qquestion = document.getElementById('qquestion-'+($scope.questionCards.length-1));
			setTimeout(function() {qquestion.scrollLeft = 0},10);
			//setTimeout(function() {qquestion.animate({scrollLeft :0},800);},10);	
		}
	}
	
	$scope.flip = function(){
		$scope.showingBackCard = true;
		angular.element(document.getElementById('flip-container-'+($scope.questionCards.length-1))).toggleClass('flip')
	}
	$scope.answerOK = function(){
				scrollLock = false;
		    $ionicScrollDelegate.scrollBottom(true);
/*
		$scope.flip();
		$scope.showingBackCard = false;
		if($scope.busy)  $scope.busyShow();
*/		
	}
	function animateScore(count){
	  var stepsCount = Math.abs(count - parseInt($scope.score)) ,
		  step = (count > parseInt($scope.score))?1:-1,
		  run_count = 0;
	  
	  var int = setInterval(function() {
		if(run_count++ < stepsCount){
		  $scope.score += step;
		} else {
		  clearInterval(int);
		}
	  }, 50);
	}
	function setBackCardStyle(state){
		var card = document.getElementById('backcard-'+($scope.questionCards.length-1));
		if(state){
			card.style.boxShadow = "0px 0px 15px #090";
		}	else {
			card.style.boxShadow = "0px 0px 15px #F00";
		}
	}
	$scope.reportQuestion = function(card) {
     var confirmPopup = $ionicPopup.confirm({
       title: 'الابلاغ عن خطأ',
       template: 'هل تريد الابلاغ عن خطأ في السؤال؟'
     });
     confirmPopup.then(function(res) {
       if(res) {
         Utils.log('Reporting question:'+JSON.stringify(card));
				 //TODO: Implement
       } else {
         Utils.log('Report cancelled');
       }
     });
   };
	$scope.nextQ($stateParams.customStart);
	$scope.updateScore();
})

.controller('google', function ($rootScope, $scope, googleLogin, Utils, Profile) {
	$rootScope.social = Profile.social;
	$scope.login = function () {
		var promise = googleLogin.startLogin();
		promise.then(function (data) {
			$rootScope.social.type = 'google';
			$rootScope.social.data = data;
			Profile.saveSocial($rootScope.social);
			//Utils.log(JSON.stringify(data));
		}, function (data) {
			Utils.log(JSON.stringify(data));
		});
	}
	$scope.logout = function () {
			/** Just delete the token and data locally */
			$rootScope.social.type = {};
			$rootScope.social.data = {};
			Profile.saveSocial($rootScope.social);
	}
	//TODO: Get real numbers
	$scope.pcnt_total_study = Profile.getPercentTotalStudy();
	$scope.pcnt_total_ratio = Profile.getPercentTotalRatio();
	$scope.pcnt_total_special = Profile.getPercentTotalSpecialRatio();
	$scope.pcnt_total_rank = '50%';
	setTimeout(function() {
		var bars = document.querySelectorAll('.horizontal .progress_fill span');
		for(var i=0;i<bars.length;i++){
			var perc = bars[i].innerHTML;
			bars[i].parentNode.style.width = perc;
		}		
	},100);

	
})

.controller('settingsCtrl', function($scope, Profile) {
  $scope.profile = Profile;
  $scope.saveSettings = function(){
	Profile.saveSettings();
  }
})

.controller('StudyCtrl', function($scope, Profile, Utils) {
  $scope.profile = Profile;
  $scope.saveParts = function(){
	//TODO: Validate selected quantity!
	Profile.saveParts();
}
  $scope.toggleParts = function(){
    var tog = ($scope.profile.parts[1].checked === false);
	for(var i=1;i<$scope.profile.parts.length;i++){
		$scope.profile.parts[i].checked = tog; 
	}
	$scope.saveParts();
  };
  $scope.heartParts = function(){
    for(var i=1;i<$scope.profile.parts.length;i++){
		$scope.profile.parts[i].checked = 
			($scope.profile.getCorrectRatioRange(i) ==  $scope.profile.correctRatioRange.HIGH) ||
			($scope.profile.getCorrectRatioRange(i) ==  $scope.profile.correctRatioRange.MID);
	}
	$scope.saveParts();
  };
  $scope.flagParts = function(){
    for(var i=1;i<$scope.profile.parts.length;i++){
		$scope.profile.parts[i].checked = 
			($scope.profile.getCorrectRatioRange(i) ==  $scope.profile.correctRatioRange.LOW);
	}
	$scope.saveParts();
  };
  $scope.getIcon = function(i){
	var ico = 'ion-help-circled stable';
	var ratio = $scope.profile.getCorrectRatioRange(i);
	if(ratio == $scope.profile.correctRatioRange.HIGH)
		ico = 'ion-heart balanced';
	else if(ratio == $scope.profile.correctRatioRange.MID)
		ico = 'ion-heart-broken energized';
	else if(ratio == $scope.profile.correctRatioRange.LOW)
		ico = 'ion-flag assertive';
	
	return ('icon '+ico);
  }
});
