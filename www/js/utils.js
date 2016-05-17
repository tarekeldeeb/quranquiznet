/****
* Copyright (C) 2011-2016 Quran Quiz Net 
* Tarek Eldeeb <tarekeldeeb@gmail.com>
* License: see LICENSE.txt
****/

angular.module('starter.utils', ['angular-md5'])
    .factory('Utils', function ($window, $q, $ionicPlatform, md5) {
        var self = this;

        this.Debug = 1;
        this.QuranWords = 77878;
        this.Juz2AvgWords = (this.QuranWords / 30);
        this.DAILYQUIZ_PARTS_COUNT = 49;
        this.DAILYQUIZ_QPERPART_COUNT = 10;
        this.blFixQ = true;
	    this.answerLength = 24;
        
        // Question Count after which the score starts to saturate per Juz2
        this.Juz2SaturationQCount = 10;

        this.sura_idx = [
            30,    6150,  9635,  13386, 16194, 19248, 22572, 23809, 26307, 28144,
            30065, 31846, 32703, 33537, 34196, 36044, 37604, 39187, 40152, 41491,
            42664, 43942, 44996, 46316, 47213, 48535, 49690, 51124, 52104, 52925,
            53475, 53851, 55142, 56029, 56808, 57537, 58402, 59139, 60315, 61538,
            62336, 63200, 64034, 64384, 64876, 65523, 66066, 66630, 66981, 67358,
            67722, 68038, 68402, 68748, 69103, 69486, 70064, 70540, 70989, 71341,
            71566, 71745, 71929, 72174, 72465, 72718, 73055, 73359, 73621, 73842,
            74072, 74361, 74564, 74823, 74991, 75238, 75423, 75600, 75783, 75920,
            76028, 76112, 76285, 76396, 76509, 76574, 76650, 76746, 76887, 76973,
            77031, 77106, 77150, 77181, 77219, 77295, 77329, 77427, 77467, 77511,
            77551, 77583, 77601, 77638, 77665, 77686, 77715, 77729, 77759, 77782,
            77809, 77828, 77855, 77878];
        this.sura_name = ["الفاتحة", "البقرة", "آل عمران",
            "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة",
            "يونس", "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل",
            "الإسراء", "الكهف", "مريم", "طه", "الأنبياء", "الحج", "المؤمنون",
            "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت",
            "الروم", "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس",
            "الصافات", "ص", "الزمر", "غافر", "فصلت", "الشورى", "الزخرف",
            "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
            "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة",
            "الحديد", "المجادلة", "الحشر", "الممتحنة", "الصف", "الجمعة",
            "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم",
            "الحاقة", "المعارج", "نوح", "الجن", "المزمل", "المدثر", "القيامة",
            "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس", "التكوير",
            "الانفطار", "المطففين", "الانشقاق", "البروج", "الطارق", "الأعلى",
            "الغاشية", "الفجر", "البلد", "الشمس", "الليل", "الضحى", "الشرح",
            "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
            "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش",
            "الماعون", "الكوثر", "الكافرون", "النصر", "المسد", "الإخلاص",
            "الفلق", "الناس"];
        this.sura_ayas = [
            7,      286,    200,    176,    120,    165,    206,    75,     129,    109,
            123,    111,    43,     52,     99,     128,    111,    110,    98,     135,
            112,    78,     118,    64,     77,     227,    93,     88,     69,     60,
            34,     30,     73,     54,     45,     83,     182,    88,     75,     85,
            54,     53,     89,     59,     37,     35,     38,     29,     18,     45, 
            60,     49,     62,     55,     78,     96,     29,     22,     24,     13,
            14,     11,     11,     18,     12,     12,     30,     52,     52,     44, 
            28,     28,     20,     56,     40,     31,     50,     40,     46,     42, 
            29,     19,     36,     25,     22,     17,     19,     26,     30,     20, 
            15,     21,     11,     8,      8,      19,     5,      8,      8,      11,
            11,     8,      3,      9,      5,      4,      7,      3,      6,      3, 
            5,      4,      5,      6];
        this.sura_makki = [
            1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 
            1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 
            1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0, 
            0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1, 
            1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1 ];    
        this.last5_juz_name = ["الأحقاف", "الذاريات", "قد سمع", "تبارك", "عم"];
			
        // Here the indexes point to "start-1" to "end" of each Juz'
        this.last5_juz_idx = [this.sura_idx[44], this.sura_idx[49],
            this.sura_idx[56], this.sura_idx[65], this.sura_idx[76], this.QuranWords];
        this.QQ_MD5_KEY = ""; // Edited only upon release!

        /** 
         * Each Study Part Weight in relative to an average Juz2. 
         * Fatiha is 1%, while Juz2 Amma is 95% of an average Juz2 length
         */
        this.PartWeight100 = [1, 236, 134, 145, 108, 118, 128, 48,
            96, 71, 74, 69, 33, 32, 25, 71, 60, 61, 37, 52, 45, 49, 41, 51, 35, 51,
            44, 55, 38, 32, 21, 14, 50, 34, 30, 28, 33, 28, 45, 47, 31, 33, 32, 13,
            19, 96, 104, 102, 104, 95];
	
        /**
         * If study parts contain suras count more than this threshold, then 
         * the user profile is eligible for more special questions.
         */
        this.SurasSpecialQuestionEligibilityThreshold = 7;

        this.TextFormatEnum = {
            AYAMARKS_NONE: 1,
            AYAMARKS_FULL: 2,
            AYAMARKS_BRACKETS_ONLY: 3,
            AYAMARKS_BRACKETS_START: 4
        };

        this.findIdx = function (scrambled, i) {
            for (var j = 0; j < scrambled.length; j++)
                if (scrambled[j] == i)
                    return j;
            return -1;
        }

        this.ListPlus = function (diffList, i) {
            var plus = diffList;
            for (var j = 0; j < plus.length; j++)
                plus[j] = plus[j] + i;
            return plus;
        }

        this.md5 = function (s) {
            return md5.createHash(s || '');
        }
		
		this.getTime = function(){
			return (new Date()).getTime();
		}
		this.isOlderThan1day = function(time) {
			return (this.getTime()-time > 86400000 ); // 24*60*60*1000
		}

        this.randperm = function (n) {
            // return a random permutation of size n
            // that is an array containing a random permutation of values 0, 1, ...,
            // n-1
            var o = Array.apply(0, Array(n)).map(function (_, b) { return b; });// [0,1,..,n-1]
            for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x); //Shuffle
            return o;
        }

        this.shuffle = function (arr, randperm) {
            (arr.length == randperm.length) || console.error("Bad Shuufle")
            var o = new Array(arr.length);
            for (var i = 0; i < arr.length; i++) {
                o[i] = arr[randperm[i]];
            }
            return o;
        }

        this.sCurve = function (ratio, max) {
            var y = [0.001, 0.11, 0.87, 0.98];
            var yp;

            if (ratio < 0.3 * max)
                yp = y[0] + (y[1] - y[0]) / (0.3 * max - 0) * (ratio - 0);
            else if (ratio < 0.7 * max)
                yp = y[1] + (y[2] - y[1]) / (0.7 * max - 0.3 * max) * (ratio - 0.3 * max);
            else if (ratio < max)
                yp = y[2] + (y[3] - y[2]) / (max - 0.7 * max) * (ratio - 0.7 * max);
            else  //(ratio>=max)
                yp = y[3] + 0.005 * (ratio - max);

            return yp;
        }

        this.modQWords = function (idx) {
            return idx % this.QuranWords;
        }

        this.disableFixQ = function () {
            this.blFixQ = false;
        }
        this.enableFixQ = function () {
            this.blFixQ = true;
        }
	
        // Removes tashkeel from Quran text
        // @param text: Quran text with tashkeel
        // @return same text with no tashkeel
        //
        this.fixQ = function (text) {
            //if (blFixQ)
            //	return text.replaceAll("[\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u06E6]", "");
            //else
            console.log("Using deprecated function: fixQ()");
            return text;
        }

        this.getSuraTanzilFromWordIdx = function(wordIdx){
            return (this.sura_makki[this.getSuraIdx(wordIdx)]==1)?"مكية":"مدنية";
        }
        this.getSuraNameFromWordIdx = function (wordIdx) {
            return this.sura_name[this.getSuraIdx(wordIdx)];
        }

        this.getSuraNameFromIdx = function (suraIdx) {
            return this.sura_name[suraIdx];
        }

        this.getPartNumberFromWordIdx = function (wordIdx) {
            if (wordIdx <= this.last5_juz_idx[0])
                return this.getSuraIdx(wordIdx);
            else {
                for (var i = 0; i < 5; i++)
                    if (wordIdx < this.last5_juz_idx[i + 1])
                        return 45 + i;
                return 49;
            }
        }

        this.getSuraIdx = function (wordIdx) {
            // TODO: Make a binary search, faster!
            for (var i = 0; i < 113; i++)
                if (wordIdx < this.sura_idx[i]) {
                    return i;
                }
            return 113;
        }

        this.formattedAyaMark = function (ayaNum, fmt) {
            switch (fmt) {
                case this.TextFormatEnum.AYAMARKS_BRACKETS_ONLY:
                    return "\u06DD";
                case this.TextFormatEnum.AYAMARKS_FULL:
                    return "\u00A0\uFD3F" + ayaNum + "\uFD3E";
                default:
                    return "\u00A0"+ayaNum;
            }
        }

        this.getRandomLevel = function () {
            if (Math.random() > 0.5) return 2;
            else return 1;
        }
	
        // Write the object to a Base64 string. 
        this.toString64 = function (o) {
            return btoa(o);
        }
    
        // Read the object from a Base64 string. 
        this.fromString64 = function (s) {
            return atob(s);
        }

        this.save = function (key, value) {
            $window.localStorage[key] = value;
        }

        this.load = function (key, defaultValue) {
            return $window.localStorage[key] || defaultValue;
        }

        this.saveObject = function (key, value) {
            $window.localStorage[key] = JSON.stringify(value);
        }

        this.loadObject = function (key) {
            return JSON.parse($window.localStorage[key] || '{}');
        }

        this.log = function (a) {
            if (this.Debug > 0) {
                console.log(a);
            }
        }

        this.modQWords = function (n) {
            return (n > this.QuranWords) ? (n - this.QuranWords) : n;
        }
		
		this.makeSequence = function(n){
			return new Array(n);
		}
        /**
         * Use it to reduce an array,
         * like [1,2,5].reduce(Utils.add,0) >> Gives 8
         */
        this.add = function(a, b) {return a + b;}
        this.countedScore = function(input) {return  (input.length>3)?input[1]+input[2]+input[3]:0;}
        /**
        * Format string
        * @param {string} str to format
        * @param {array} args to replace
        */
        this.String = function (str, args) {
            var regex = new RegExp("{-?[0-9]+}", "g");

            return str.replace(regex, function (item) {
                var intVal = parseInt(item.substring(1, item.length - 1));
                var replace;
                if (intVal >= 0) {
                    replace = args[intVal];
                } else if (intVal === -1) {
                    replace = "{";
                } else if (intVal === -2) {
                    replace = "}";
                } else {
                    replace = "";
                }
                return replace;
            });
        }
	
	
        // `condition` is a function that returns a boolean
        // `body` is a function that returns a promise
        // returns a promise for the completion of the loop
        this.promiseWhile = function (condition, body) {
            var done = $q.defer();
            function loop() {
                // When the result of calling `condition` is no longer true, we are
                // done.
                if (!condition()) return done.resolve();
                // Use `when`, in case `body` does not return a promise.
                // When it completes loop again otherwise, if it fails, reject the
                // done promise
                $q.when(body(), loop, done.reject);
            }
            // Start running the loop in the next tick so that this function is
            // completely async. It would be unexpected if `body` was called
            // synchronously the first time.
            setTimeout(loop, 1); //$q.nextTick(loop);
            // The promise
            return done.promise;
	
            /***** Usage *****/
            //var index = 1;
            //promiseWhile(function () { return index <= 11; }, function () {
            //	console.log(index);
            //	index++;
            //	return $q.delay(500); // arbitrary async
            //}).then(function () {
            //	console.log("done");
            //});
        }

        return self;
    })
	
	.filter('checkmark', function() {
		return function(input) {
			return input ? '\u2713' : '\u2718';
		};
	})              
    .filter('removeAyaNum', function() {
		return function(input) {
			if(!input) return input; //return null if passed!
            return input.replace(/\uFD3F[0-9]+\uFD3E/g, '\u06DD');
		};
	})
    .filter('countedScore', function() {
		return function(input) {
			return  (input.length>3)?input[1]+input[2]+input[3]:0;
		};
	});
