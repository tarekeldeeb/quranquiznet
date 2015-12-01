angular.module('starter.profile',[])
.factory('Profile', function(Utils) {
  var self = this;
  
  this.uid = 0;
  this.lastSeed = 0;
  this.level = 1;
  this.specialEnabled = false;
  this.specialScore = 0;
  this.scores = [{date:0,score:0}];
  this.parts = [];
  
  this.load = function() {
	if (Utils.load('prf_uid',-1) == -1){
		// Create Default Profile
		this.parts.push({	start:1,
							length:(Utils.sura_idx[0]),
							numCorrect:0,
							numQuestions:0,
							avgLevel:1.0,
							checked:true
							});

		for (var i = 1; i < 45; i++) 
			this.parts.push({	start:(Utils.sura_idx[i-1]),
								length:(Utils.sura_idx[i] - Utils.sura_idx[i-1]),
								numCorrect:0,
								numQuestions:0,
								avgLevel:1.0,
								checked:false
								});
		for (var i = 0; i < 5; i++) 
			this.parts.push({	start:(Utils.last5_juz_idx[i]),
								length:(Utils.last5_juz_idx[i+1] - Utils.last5_juz_idx[i]),
								numCorrect:0,
								numQuestions:0,
								avgLevel:1.0,
								checked:false
								});

		this.parts[49].checked = true;		//Juz2 3amma!				
		this.saveProfile();
		return false;
	} else {
		this.uid 				= Utils.load('prf_uid',0);
		this.lastSeed 			= Utils.load('prf_lastSeed',0);
		this.level 				= Utils.load('prf_level',-1);
		this.specialEnabled 	= Utils.load('prf_specialEnabled',false);
		this.specialScore 		= Utils.load('prf_specialScore',0);
		this.scores 			= Utils.loadObject('prf_scores');
		this.parts 				= Utils.loadObject('prf_parts');		
		return true;
	}
  }
  
  this.saveProfile = function(){
	Utils.save('prf_uid',this.uid);
	Utils.save('prf_lastSeed',this.lastSeed);
	Utils.save('prf_level',this.level);
	Utils.save('prf_specialEnabled',this.specialEnabled);
	Utils.save('prf_specialScore',this.specialScore);
	Utils.saveObject('prf_scores',this.scores);
	Utils.saveObject('prf_parts',this.parts);	
  }
  
  return self;
})
