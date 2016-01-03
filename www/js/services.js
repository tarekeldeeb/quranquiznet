/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.services', [])

.factory('DBA', function($cordovaSQLite, $q, $timeout, $ionicPlatform) {
  var self = this;

  // Synchronous query
  self.squery = function (query, parameters) {
	  
    parameters = parameters || [];
    var q = $q.defer();
	var isWaiting = true;
	var res = {};
	
	$timeout(function(){
      $cordovaSQLite.execute(db, query, parameters)
        .then(function (result) {
		  console.log(Date.now() + ': got result!')
          q.resolve(result);
		  res = result;
		  isWaiting = false;
        }, function (error) {
          console.warn('SQuery has an error');
          console.warn(error);
          q.reject(error);
		  isWaiting = false;
        });
	},0);
	console.log(Date.now()+': will wait!')
	while(isWaiting){}
    return res;
  }
  
  // Handle query's and potential errors
  self.query = function (query, parameters) {
    parameters = parameters || [];
    var q = $q.defer();

    $ionicPlatform.ready(function () {
      $cordovaSQLite.execute(db, query, parameters)
        .then(function (result) {
          q.resolve(result);
        }, function (error) {
          console.warn('Bad query: '+query);
          console.error(error);
          q.reject(error);
        });
    });
    return q.promise;
  }
  
  // Proces a result set
  self.getStringSet = function(result) {
    var output = [];
    for (var i = 0; i < result.rows.length; i++) {
      output.push(result.rows.item(i).txtsym);
    }
	//console.log('Set='+output);
    return output;
  }

  self.getIDSet = function(result) {
    var output = [];
    for (var i = 0; i < result.rows.length; i++) {
      output.push(result.rows.item(i)._id);
    }
	//console.log('Set='+output);
    return output;
  }
  
  // Check Index of column: txt
  self.ensureIndexExists = function() {
	//TODO: check index and create it if required!
  }
 
  return self;
})


.factory('Q', function($cordovaSQLite, DBA, Utils) {
  var self = this;

  self.txt = function(idx, len, params) {
	var llen = len || 1;
    var parameters = [(idx-1), (idx+llen)];
	//TODO: Missing boundary checks, not yet ported!
    return DBA.query("select txtsym from q where _id > (?) and _id < (?)",parameters).then(function(result){
        return DBA.getStringSet(result);
      });				
  }

  self.txts = function(ids) {
    return DBA.query("select txtsym from q where _id in( "+ids+" )",[]).then(function(result){
        return DBA.getStringSet(result);
      });				
  }
  
  self.sim1idx = function(idx){
	return DBA.query("select _id from q where txt=(select txt from q where _id="+ idx + ") and _id !=" + idx,[])
	.then(function(result){
        return DBA.getIDSet(result);
      });	
  }

  self.sim2idx = function(idx){
	return DBA.query("select q1._id from q q1 join q q2 where q1._id+1=q2._id "
									+ "and q1._id in (select _id from q where txt=(select txt from q where _id="
									+ idx
									+ ") and _id !="
									+ idx
									+ ") "
									+ "and q2._id in (select _id from q where txt=(select txt from q where _id="
									+ (idx + 1) + ") and _id !=" + (idx + 1)
									+ ")",[])
	.then(function(result){
        return DBA.getIDSet(result);
      });	
  }  
  
  self.sim3idx = function(idx){
	return DBA.query("select q1._id from q q1 join q q2 join q q3 where q1._id+1=q2._id and q1._id+2=q3._id "
									+ "and q1._id in (select _id from q where txt=(select txt from q where _id="
									+ (idx)
									+ ") and _id !="
									+ (idx)
									+ ")"
									+ "and q2._id in (select _id from q where txt=(select txt from q where _id="
									+ (idx + 1)
									+ ") and _id !="
									+ (idx + 1)
									+ ")"
									+ "and q3._id in (select _id from q where txt=(select txt from q where _id="
									+ (idx + 2)
									+ ") and _id !="
									+ (idx + 2)
									+ ")",[])
	.then(function(result){
        return DBA.getIDSet(result);
      });	
  }  

  self.sim2cnt = function(idx){
	return DBA.query("select sim2 from q where _id="+ idx,[])
	.then(function(result){
        return result.rows.item(0).sim2;
      });	
  }

  self.sim3cnt = function(idx){
	return DBA.query("select sim3 from q where _id="+ idx,[])
	.then(function(result){
        return result.rows.item(0).sim3;
      });	
  }

  self.uniqueSim1Not2Plus1 = function(idx){
	return DBA.query("select _id from q where _id in (select _id+1 from q where "
									+ "_id in (select _id from q where txt=(select txt from q where _id="
									+ idx
									+ ") and _id !="
									+ idx
									+ ")"
									+ "and _id not in (select q1._id from q q1 join q q2 where q1._id+1=q2._id "
									+ "and q1._id in (select _id from q where txt=(select txt from q where _id="
									+ idx
									+ ") and _id !="
									+ idx
									+ ") "
									+ "and q2._id in (select _id from q where txt=(select txt from q where _id="
									+ (idx + 1) + ") and _id !=" + (idx + 1)
									+ ")) " + ") group by txt",[])
	.then(function(result){
        return DBA.getIDSet(result);
      });	
  }
  
  self.randomUnique4NotMatching = function(idx){
	//TODO: random() not supported in WebSQL, returned not really random!
	var randomStart = Math.ceil((Math.random()*(Utils.QuranWords-201))+1);
	return DBA.query("CREATE TEMP TABLE IF NOT EXISTS xy as select _id,txt from q where _id>? limit 200",[randomStart])
	.then(function(){
		return DBA.query("CREATE INDEX IF NOT EXISTS xy_txt_index ON xy (txt);",[])
			
    })
	.then(function(){
		return DBA.query("select q1._id from xy q1 inner join xy q2 on q2.txt = q1.txt "+
			"group by q1._id,q1.txt having q1._id = min(q2._id) "+
			"and q1.txt !=(select txt from q where _id="+idx+") limit 4",[])	
	})
	.then(function(result){
		return {i:idx, set:DBA.getIDSet(result)};
	});
  }
  
  self.ayaNumberOf = function(idx){
	return DBA.query("select aya from q where _id >=" + idx +" and aya IS NOT NULL LIMIT 1",[])
	.then(function(result){
        return result.rows.item(0).aya;
      });
  }

  self.ayaCountOfSuraAt = function(idx){
	return self.ayaNumberOf((Utils.sura_idx[Utils.getSuraIdx(idx)] -1));
  }
  
  self.ayaEndsAfter = function(idx){
	return DBA.query("select _id from q where _id >=" + idx +" and aya IS NOT NULL LIMIT 1",[])
	.then(function(result){
        return (result.rows.item(0)._id - idx);
      });
  }

  self.isAyaStart = function(idx){
  	return self.ayaEndsAfter(idx-1)
	.then(function(result){
        return (result===0);
      });
  }  
  
  
  return self;
})

/**
* All below services are for demo purposes!
* You may ignore for now.
*/

.factory('Chats', function() {
  // Might use a resource here that returns a JSON array

  // Some fake testing data
  var chats = [{
    id: 0,
    name: 'Ben Sparrow',
    lastText: 'You on your way?',
    face: 'img/ben.png'
  }, {
    id: 1,
    name: 'Max Lynx',
    lastText: 'Hey, it\'s me',
    face: 'img/max.png'
  }, {
    id: 2,
    name: 'Adam Bradleyson',
    lastText: 'I should buy a boat',
    face: 'img/adam.jpg'
  }, {
    id: 3,
    name: 'Perry Governor',
    lastText: 'Look at my mukluks!',
    face: 'img/perry.png'
  }, {
    id: 4,
    name: 'Mike Harrington',
    lastText: 'This is wicked good ice cream.',
    face: 'img/mike.png'
  }];

  return {
    all: function() {
      return chats;
    },
    remove: function(chat) {
      chats.splice(chats.indexOf(chat), 1);
    },
    get: function(chatId) {
      for (var i = 0; i < chats.length; i++) {
        if (chats[i].id === parseInt(chatId)) {
          return chats[i];
        }
      }
      return null;
    }
  };
})
