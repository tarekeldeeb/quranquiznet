/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.controllers', [])

.controller('DashCtrl', function($scope, $ionicLoading, Q, $q, DBA, Utils, Profile, Questionnaire) {
	/*
	$ionicLoading.show({
		template: 'جاري الاعداد ..'
	});
	$scope.ionicLoadinghide = function(){
		$ionicLoading.hide();
	}
	*/
	
	Questionnaire.createNextQ();
	
	//Sim1cnt
	//var idx = 3;
	//Utils.log(JSON.stringify(DBA.squery("select _id from q where txt=(select txt from q where _id="+ idx + ") and _id !=" + idx,[])));
	
	/*
	var idx1 = 0;
	var idx2 = 0;
	var idx3 = 0;
	var txt ='';
	Utils.promiseWhile(
		function () { 
			console.log("L1: "+idx1);
			return idx1 <= 11;
		},
		function () {
		idx1++;
		return Q.txt(idx1,1)
				.then(function(t){txt += (' '+t);});
	})
	.then(function () {
		console.log("done1");
		txt ='';
		return Utils.promiseWhile(
			function () { 
				console.log("L2: "+idx2);
				return idx2 <= 11;
			},
			function () {
			idx2++;
			return Q.txt(idx2,1)
					.then(function(t){txt += (' '+t);});
		})
	})	
	.then(function () {
		console.log("done2");
		txt ='';
		return Utils.promiseWhile(
			function () { 
				console.log("L3: "+idx3);
				return idx3 <= 11;
			},
			function () {
			idx3++;
			return Q.txt(idx3,1)
					.then(function(t){txt += (' '+t);});
		})
	})
	.then(function(){
		console.log("done3");
	});
	*/
	var ii = 100;
	$scope.question = ' بسم الله الرحمن';
	$scope.options = ['الرحمن', 'الرحيم', 'الملك', 'القدوس', 'السلام'];
	$scope.selectOption = function(sel) {
		$scope.question = $scope.question + ' ' + $scope.options[sel];
		Q.txt(ii,5).then(function(op){
			$scope.options = op;
			//Profile.parts[ii%50].numQuestions = Profile.parts[ii%50].numQuestions+ 1;
			//Profile.saveAll();
			//console.log(JSON.stringify($scope.options));
		});
		ii = ii+5;
		//if(ii%10 == 0) $scope.flip();
		
		//console.log(Utils.modQWords(90999));
		//Q.ayaCountOfSuraAt(90).then(function(op){
		//	console.log(op);
		//});
	};
	$scope.flip = function(){
		angular.element(document.getElementById('flip-container')).toggle("flip") 
		console.log('Flipped:' + JSON.stringify());
	}
})

/**
* All below services are for demo purposes!
* You may ignore for now.
*/

.controller('ChatsCtrl', function($scope, Chats) {
  // With the new view caching in Ionic, Controllers are only called
  // when they are recreated or on app start, instead of every page change.
  // To listen for when this page is active (for example, to refresh data),
  // listen for the $ionicView.enter event:
  //
  //$scope.$on('$ionicView.enter', function(e) {
  //});

  $scope.chats = Chats.all();
  $scope.remove = function(chat) {
    Chats.remove(chat);
  };
})

.controller('ChatDetailCtrl', function($scope, $stateParams, Chats) {
  $scope.chat = Chats.get($stateParams.chatId);
})

.controller('AccountCtrl', function($scope, Profile) {
  $scope.profile = Profile;
  $scope.saveSettings = function(){
	//TODO: Validate selected quantity!
	Profile.saveParts();
}
  $scope.toggleParts = function(){
    var tog = ($scope.profile.parts[1].checked === false);
	for(var i=1;i<$scope.profile.parts.length;i++){
		$scope.profile.parts[i].checked = tog; 
	}
	$scope.saveSettings();
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
