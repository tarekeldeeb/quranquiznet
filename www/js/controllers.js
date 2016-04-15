/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.controllers', [])
.controller('ahlanCtrl', function($scope, Utils) {
	Utils.log('Ahlan to Quran Quiz Net!');
})
.controller('quizCtrl', function($scope, $stateParams, $ionicLoading, Q, $q, $ionicPopup, DBA, Utils, Profile, Questionnaire) {
	var shuffle;
	$scope.round = 0;
	var qquestion = document.getElementById('qquestion');
	$scope.busyShow = function(){ $ionicLoading.show({template: '<ion-spinner></ion-spinner>'}); }
	$scope.busyHide = function(){ $ionicLoading.hide(); }
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
		$scope.busyShow();
		Questionnaire.createNextQ(parseInt(start))
		.then(function(){
			$scope.round = 0;
			shuffle = Utils.randperm(5);
			$scope.question = Questionnaire.qo.txt.question;
			$scope.options = Utils.shuffle(Questionnaire.qo.txt.op[$scope.round], shuffle);
            $scope.instructions = Questionnaire.qo.qType.txt;
			$scope.busyHide();
			setTimeout(function() {Profile.saveAll();},100); //Note: Remove to debug the lastly saved question
		});
	}
	$scope.getAnswer = function(){
		$scope.answer       = Questionnaire.qo.txt.answer + ' ...';
		$scope.answer_sura  = Utils.getSuraNameFromWordIdx(Questionnaire.qo.startIdx);
        $scope.answer_sura_info = Utils.getSuraTanzilFromWordIdx(Questionnaire.qo.startIdx)+
                                    ' اياتها ' + Utils.sura_ayas[Utils.getSuraIdx(Questionnaire.qo.startIdx)];
		Q.ayaNumberOf(Questionnaire.qo.startIdx).then(function(res){$scope.answer_aya  = res;});
	}
	$scope.skipQ = function(){
		Profile.addIncorrect(Questionnaire.qo);
		$scope.nextQ();
		$scope.updateScore();
	}
	$scope.makeSequence = function(n){return Utils.makeSequence(n);}
	$scope.selectOption = function(sel) {	
		if (shuffle[sel] != 0){ 								// Bad Choice
			$scope.getAnswer();
			$scope.flip();
			Profile.addIncorrect(Questionnaire.qo);
			$scope.nextQ();
			$scope.updateScore();
			return;
		}else if( ++$scope.round == Questionnaire.qo.rounds){ 	// Correct Finish
			Profile.addCorrect(Questionnaire.qo);
			$scope.nextQ();
			$scope.updateScore();
			return;			
		} else {												// Proceed with rounds
			$scope.question = $scope.question + ' ' + $scope.options[sel];
			shuffle = Utils.randperm(5);
			$scope.options = Utils.shuffle(Questionnaire.qo.txt.op[$scope.round], shuffle);
			setTimeout(function() {qquestion.scrollLeft = 0},10);
			//setTimeout(function() {qquestion.animate({scrollLeft :0},800);},10);	
		}
	}
	$scope.flip = function(){
		angular.element(document.getElementById('flip-container')).toggleClass('flip')
	}

	function animateScore(count)
	{
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
	$scope.reportQuestion = function() {
     var confirmPopup = $ionicPopup.confirm({
       title: 'الابلاغ عن خطأ',
       template: 'هل تريد الابلاغ عن خطأ في السؤال؟'
     });
     confirmPopup.then(function(res) {
       if(res) {
         console.log('Reporting question:');
       } else {
         console.log('You are not sure');
       }
     });
   };
	$scope.nextQ($stateParams.customStart);
	$scope.updateScore();
})

/**
* All below services are for demo purposes!
* You may ignore for now.
*/
.controller('google', function ($scope, googleLogin, Utils) {
	$scope.google_data = {};
	$scope.login = function () {
		var promise = googleLogin.startLogin();
		promise.then(function (data) {
			Utils.save('google_data', JSON.stringify(data));
			$scope.google_data = data;
			Utils.log(JSON.stringify(data));
		}, function (data) {
			$scope.google_data = data;
		});
	}
})

.controller('settingsCtrl', function($scope, Profile) {
  $scope.profile = Profile;
  $scope.saveSettings = function(){
	Profile.saveSettings();
  }
})

.controller('StudyCtrl', function($scope, Profile) {
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
  
  $scope.getIcon = function(part){
	var ico = 'ion-help-circled stable';
	if(part.numQuestions > 0){
		if((part.numCorrect/part.numQuestions)>=0.8)
			ico = 'ion-heart balanced';
		else if((part.numCorrect/part.numQuestions)>=0.5)
			ico = 'ion-heart-broken energized';
		else 	
			ico = 'ion-flag assertive';
	}
	return ('icon '+ico);
  }
});
