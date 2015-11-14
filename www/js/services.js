angular.module('starter.services', [])


.factory('DBA', function($cordovaSQLite, $q, $ionicPlatform) {
  var self = this;

  // Handle query's and potential errors
  self.query = function (query, parameters) {
    parameters = parameters || [];
    var q = $q.defer();

    $ionicPlatform.ready(function () {
      $cordovaSQLite.execute(db, query, parameters)
        .then(function (result) {
          q.resolve(result);
        }, function (error) {
          console.warn('Query has an error');
          console.warn(error);
          q.reject(error);
        });
    });
    return q.promise;
  }

	// Proces a result set
  self.getSet = function(result) {
    var output = [];
    for (var i = 0; i < result.rows.length; i++) {
      output.push(result.rows.item(i).txtsym);
    }
	console.log(output);
    return output;
  }

  // Proces a single result
  self.getSingle = function(result) {
    var output = null;
    output = angular.copy(result.rows.item(0));
    return output;
  }
  
  // Check Index of column: txt
  self.ensureIndexExists = function() {
	//TODO: check index and create it if required!
  }
 
  return self;
})


.factory('Q', function($cordovaSQLite, DBA) {
  var self = this;

  self.all = function() {
    return DBA.query("SELECT id, name FROM team")
      .then(function(result){
        return DBA.getSet(result);
      });
  }

  self.get = function(memberId) {
    var parameters = [memberId];
    return DBA.query("SELECT id, name FROM team WHERE id = (?)", parameters)
      .then(function(result) {
        return DBA.getSingle(result);
      });
  }

  self.update = function(origMember, editMember) {
    var parameters = [editMember.id, editMember.name, origMember.id];
    return DBA.query("UPDATE team SET id = (?), name = (?) WHERE id = (?)", parameters);
  }

  //TODO: Implement all public fields from: QQDataBaseHelper.java

  self.txt = function(idx, len) {
    var parameters = [(idx-1), (idx+len)];
	//TODO: Missing boundary checks, not yet ported!
    return DBA.query("select txtsym from q where _id > (?) and _id < (?)",parameters).then(function(result){
        return DBA.getSet(result);
      });				
  }

  self.txt = function(idx) {
    var parameters = [idx];
    return DBA.query("select txtsym from q where _id = (?)",parameters).then(function(result){
        return DBA.getSingle(result);
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
