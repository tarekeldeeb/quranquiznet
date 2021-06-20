/****
* Copyright (C) 2011-2016 Quran Quiz Net
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('quranquiznet.services', [])

  .factory('IDB', function(Utils){
    var self = this;
    var jsstoreCon = new JsStore.Connection(new Worker("js/jsstore.worker.js"));

    /**
     * A flag to mark if Indexed DB is ready (Opened, or Created)
     */
    self.isDbReady = false;

    /**
     * Utility function to convert JSON row to JsStore Row Object
     */
    function oq(l) {
      return {_id:l[0], txt:l[1], txtsym:l[2], sim1:l[3], sim2:l[4], sim3:l[5], aya:l[6]}
    }

    /**
     * DB Schema
     */
    function getDbSchema() {
      var table_q = {
        name: 'q',
        columns: {
          _id:    { primaryKey: true, autoIncrement: true },
          txt:    { notNull: true, dataType: 'string' },
          txtsym: { notNull: true, dataType: 'string', enableSearch: false },
          sim1:   { notNull: true, dataType: 'number', default: 1 },
          sim2:   { notNull: true, dataType: 'number', default: 0 },
          sim3:   { notNull: true, dataType: 'number', default: 0 },
          aya:    { dataType: 'number', default: null }
        }
      };
      var db = { name: 'QuranIDB', tables: [ table_q ] }; //TODO: Add more tables
      return db;
    }

    /**
     * Init DB must be called before any other DB operation.
     * This function sets the above ready flag.
     */
    self.initDb = async function() {
      var isDbCreated = await jsstoreCon.initDb(getDbSchema());
      if (isDbCreated) {
          Utils.log('IDb created');
          $.getJSON('q.json', function(json){
            rows = json.objects[0].rows;
            Utils.log("  > Loaded q.json:");
            rows_fixed = []
            rows.forEach( function(w){ rows_fixed.push(oq(w)); });
            jsstoreCon.insert({into: 'q', values: rows_fixed })
              .then(function(){isDbReady = true; });
          });
      }
      else {
          isDbReady = true;
          Utils.log('IDb opened');
      }
    }

    self.txt = async function(start, len, params) {
      var limit = len || 1;
      var insertAyaMark = (params.indexOf("ayaMark") > -1);
      if((start + limit)>Utils.QuranWords){ // Two ranges are needed
         var results = await jsstoreCon.union([
         {
          from: "q",
          where: {
              _id: { '>': start -1 },
            },
        },
        {
          from: "q",
          where: {
              _id: { '<': Utils.modQWords(start + limit) },
            },
        }
        ]);
      }
      else {
        var results = await jsstoreCon.select({
          from: "q",
          limit: limit,
          where: {
              _id: { '>': start -1 },
            },
        });
      }
      var noSym = (params.indexOf("noSym") > -1);
      var query_result = results.map(x => {
        if(noSym) return x.txt;
        if(insertAyaMark && x.aya!=null){
           return x.txtsym+Utils.formattedAyaMark(x.aya, Utils.TextFormatEnum.AYAMARKS_FULL);
        }
        return x.txtsym;
      });
      if((start + limit)>Utils.QuranWords){
        Utils.arrayRotate(query_result, limit-(Utils.QuranWords-start+1));
      }
      return query_result;
    }

    self.txts = async function (ids) {
      /* Returned text must be ordered with redundancies*/
      var results = await jsstoreCon.select({
        from: "q",
        where: {
            _id: {
                in: ids
            }
        }
      });
      var query_result = results.map(x => x.txtsym );
      return query_result;
    }

    self.sim2cnt = async function (idx) {
      var results = await jsstoreCon.select({
        from: "q",
        where: {
            _id: idx
        }
      });
      var query_result = results[0].sim2 ;
      return query_result;
    }

    self.sim3cnt = async function (idx) {
      var results = await jsstoreCon.select({
        from: "q",
        where: {
            _id: idx
        }
      });
      var query_result = results[0].sim3 ;
      return query_result;
    }

    self.sim2idx = async function (idx) {
      var txt =  await self.txt(idx,2,"noSym");
      Utils.log("Query for: " + txt);

      var results1 = await jsstoreCon.select({
        from: "q",
        where: {
            _id: { '!=': idx },
            txt: txt[0]
        }
      });
      var results2 = await jsstoreCon.select({
        from: "q",
        where: {
            _id: { '!=': idx +1 },
            txt: txt[1]
        }
      });
      return  results1.map(x=> x._id )
                      .filter(value => results2.map(x=> x._id -1).includes(value));

      /*
      var results = await jsstoreCon.select({
        from: "q",
        where: {
            "txt": txt
        },
        join: {
            with: "q",
            on: "q._id=q.joined_id+1",
            as:{
              "_id": "joined_id",
              "txt": "joined_txt"
            }, 
            //type:"inner",
            //where: {
            //    [column name]: some value
           // }
        }
      });
      Utils.log("Query result: " + results );
      var query_result = results.map(x => x._id );
      return query_result;
      */
    }


    return self;
  })

  .factory('DBA', function ($cordovaSQLite, $q, $timeout, $ionicPlatform) {
    var self = this;

    // Synchronous query
    self.squery = function (query, parameters) {

      parameters = parameters || [];
      var q = $q.defer();
      var isWaiting = true;
      var res = {};

      $timeout(function () {
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
      }, 0);
      console.log(Date.now() + ': will wait!')
      while (isWaiting) { }
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
            console.warn('Bad query: ' + query);
            console.error(error);
            q.reject(error);
          });
      });
      return q.promise;
    }

    // Proces a result set
    self.getStringSet = function (result) {
      var output = [];
      for (var i = 0; i < result.rows.length; i++) {
        output.push(result.rows.item(i).txtsym);
      }
      //console.log('Set='+output);
      return output;
    }

    self.getIDSet = function (result) {
      var output = [];
      for (var i = 0; i < result.rows.length; i++) {
        output.push(result.rows.item(i)._id);
      }
      //console.log('Set='+output);
      return output;
    }
    self.getAyaSet = function (result) {
      var output = [];
      for (var i = 0; i < result.rows.length; i++) {
        output.push(result.rows.item(i).aya);
      }
      return output;
    }
    // Check Index of column: txt
    self.ensureIndexExists = function () {
      //TODO: check index and create it if required!
    }

    return self;
  })

  .factory('Q', function ($cordovaSQLite, DBA, Utils) {
    var self = this;

    /**
     * Return a quran text, optionally formatted
     * supports:
     *  - Q.txt(wordIndex)
     *  - Q.txt(startIndex, Length)
     *  - Q.txt(startIndex, Length, Format)
     *
     * Format, comma separated string, currently supports:
     *  - ayaMark: Adds an aya mark within the text: Word_m{[NUM]} Word+m+1 ..
     */
    self.txt = function (idx, len, params) {
      var llen = len || 1;
      var insertAyaMark = (params.indexOf("ayaMark") > -1);
      var query,parameters;

      // Prepare query and parameters
      parameters = [(idx - 1), (idx + llen)];
      if (insertAyaMark) {
        query = "select txtsym,aya from q where _id > (?) and _id < (?)";
      }else{
        query = "select txtsym from q where _id > (?) and _id < (?)";
      }
      if(parameters[1]>Utils.QuranWords){ // Two ranges are needed
          query += " UNION ALL "+query;
          parameters = [(idx - 1), Utils.QuranWords+1, 0, Utils.modQWords(idx + llen)];
      }

      // Execute query and parse results
      return DBA.query(query, parameters).then(function (result) {
        if (insertAyaMark) {
            var txt = DBA.getStringSet(result);
            var aya = DBA.getAyaSet(result);
            for(var i=0;i<txt.length;i++){
              if(aya[i]!=null){
                txt[i] = txt[i]+Utils.formattedAyaMark(aya[i], Utils.TextFormatEnum.AYAMARKS_FULL);
              }
            }
            return txt;
        } else {
             return DBA.getStringSet(result);
        }
      });
    }

    self.txts = function (ids) {
      /* Returned text must be ordered with redundancies*/
      var queryCat = 'SELECT txtsym FROM q WHERE _id = ' + ids[0];
      for (var i = 1; i < ids.length; i++) { queryCat += ' UNION ALL SELECT txtsym FROM q WHERE _id = ' + ids[i]; }
      return DBA.query(queryCat, []).then(function (result) {
        if (result.rows.length != ids.length) {
          console.warn('Not all text returned! Requested IDs: ' + ids + ' Returned Text: ' + JSON.stringify(result.rows));
        }
        return DBA.getStringSet(result);
      });
    }

    self.sim2idx = function (idx) {
      return DBA.query("select q1._id from q q1 join q q2 where q1._id+1=q2._id "
        + "and q1._id in (select _id from q where txt=(select txt from q where _id="
        + idx
        + ") and _id !="
        + idx
        + ") "
        + "and q2._id in (select _id from q where txt=(select txt from q where _id="
        + (idx + 1) + ") and _id !=" + (idx + 1)
        + ")", [])
        .then(function (result) {
          return DBA.getIDSet(result);
        });
    }

    self.sim3idx = function (idx) {
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
        + ")", [])
        .then(function (result) {
          return DBA.getIDSet(result);
        });
    }

    self.sim2cnt = function (idx) {
      return DBA.query("select sim2 from q where _id=" + idx, [])
        .then(function (result) {
          if (result.rows.length < 1) console.error('Could not get sim2 for _id:' + idx); //TODO: Remove line
          return result.rows.item(0).sim2;
        });
    }

    self.sim3cnt = function (idx) {
      return DBA.query("select sim3 from q where _id=" + idx, [])
        .then(function (result) {
          if (result.rows.length < 1) console.error('Could not get sim3 for _id:' + idx); //TODO: Remove line
          return result.rows.item(0).sim3;
        });
    }

    self.uniqueSim1Not2Plus1 = function (idx) {
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
        + ")) " + ") group by txt", [])
        .then(function (result) {
          return DBA.getIDSet(result);
        });
    }

    self.randomUnique4NotMatching = function (idx) {
      var randomStart;
      return DBA.query("DROP TABLE IF EXISTS xy", [])
        .then(function () {
          randomStart = Math.ceil((Math.random() * (Utils.QuranWords - 201)) + 1);
          return DBA.query("CREATE TEMP TABLE IF NOT EXISTS xy as select DISTINCT txt,_id from q where _id>? " +
            "and txt !=(select txt from q where _id=" + idx + ") limit 20", [randomStart])
        })
        .then(function () {
          //random() not supported in WebSQL!
          var randomStartIdx = [1, 8, 13, 19].map(function (x) { return x + randomStart; });
          return DBA.query("SELECT _id FROM xy WHERE _id IN (" + randomStartIdx.toString() + ")", [])
        })
        .then(function (result) {
          return { i: idx, set: DBA.getIDSet(result) };
        });
    }

    self.ayaNumberOf = function (idx) {
      return DBA.query("select aya from q where _id >=" + idx + " and aya IS NOT NULL LIMIT 1", [])
        .then(function (result) {
          return result.rows.item(0).aya;
        });
    }

    /*Deprecated
    self.ayaCountOfSuraAt = function(idx){
    return self.ayaNumberOf((Utils.sura_idx[Utils.getSuraIdx(idx)] -1));
    }*/

    self.ayaEndsAfter = function (idx) {
      return DBA.query("select _id from q where _id >=" + idx + " and aya IS NOT NULL LIMIT 1", [])
        .then(function (result) {
          return (result.rows.item(0)._id - idx);
        });
    }

    self.isAyaStart = function (idx) {
      return self.ayaEndsAfter(idx - 1)
        .then(function (result) {
          return (result === 0);
        });
    }


    return self;
  })

  .factory('RLocation', function($rootScope, $http, Utils){
    self.getCity = function (){
      /* Could Try: https://geoip-db.com/json as well*/
      $http.get('https://ipinfo.io?token=c2dc00eae1ba76')
      .then(function(response) {
        $rootScope.Loc.country = response.data.country;
        $rootScope.Loc.city = response.data.city;
        //Utils.log(JSON.stringify($rootScope.Loc));
      });
    }
    return self;
  })

  .factory('FB', function($rootScope, $firebase, Utils){
    var head = '';
    self.getDailyQuiz = function(){
      var dailyRef = $rootScope.database.ref('/daily/head');
      return dailyRef.once('value').then(function (snapshot) {
        this.head = snapshot.val();
        Utils.log("DQ> Head: " + JSON.stringify(this.head));
        return head.daily_random;
      });
    }
    self.submitResult = function(score){
      var submitRef = $rootScope.database.ref('/daily/'+this.head.submit_to_ref);
      submitRef.push(score);
    }
    self.getYesterdayReport = function(){
      var yesterday = (this.head['yesterday']===undefined)?"/daily/reports/yesterday":"/daily/"+this.head.yesterday;
      var yref = $rootScope.database.ref(yesterday);
      return yref.once('value').then(function (snapshot) {
        Utils.log("Yesterday Report: " + JSON.stringify(snapshot));
        return snapshot;
      });
    }
    self.getAllTopReport = function(){
      var all = "/daily/reports/all";
      var allref = $rootScope.database.ref(all);
      return allref.once('value').then(function (snapshot) {
        Utils.log("All Top Report: " + JSON.stringify(snapshot));
        return snapshot;
      });
    }

    return self;
  })


