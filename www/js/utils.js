angular.module('starter.utils',[])
.factory('Utils', function($q, $ionicPlatform) {
  var self = this;
  
  // Check Index of column: txt
  self.ensureIndexExists = function() {
	//TODO: check index and create it if required!
  }
  
	this.QQDebug = 0;
	this.QuranWords = 77878; 
	this.Juz2AvgWords = (this.QuranWords/30);
	this.DAILYQUIZ_PARTS_COUNT = 49;
	this.DAILYQUIZ_QPERPART_COUNT = 10;
	this.blFixQ = true;
	
	// Question Count after which the score starts to saturate per Juz2
	this.Juz2SaturationQCount = 10; 
	
	this.sura_idx = [
		30, 	6150,  9635, 13386, 16194, 19248, 22572, 23809, 26307, 28144, 
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
	this.sura_name = [ "الفاتحة", "البقرة", "آل عمران",
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
			"الفلق", "الناس" ];

	this.last5_juz_name = [ "الأحقاف", "الذاريات",
			"قد سمع", "تبارك", "عم" ];
			
	// Here the indexes point to "start-1" to "end" of each Juz'
	this.last5_juz_idx = [ this.sura_idx[44], this.sura_idx[49],
			this.sura_idx[56], this.sura_idx[65], this.sura_idx[76], this.QuranWords ];
	this.QQ_MD5_KEY = ""; // Edited only upon release!

	/** 
	 * Each Study Part Weight in relative to an average Juz2. 
	 * Fatiha is 1%, while Juz2 Amma is 95% of an average Juz2 length
	 */
	this.PartWeight100 = [ 1, 236, 134, 145, 108, 118, 128, 48,
			96, 71, 74, 69, 33, 32, 25, 71, 60, 61, 37, 52, 45, 49, 41, 51, 35, 51,
			44, 55, 38, 32, 21, 14, 50, 34, 30, 28, 33, 28, 45, 47, 31, 33, 32, 13, 
			19, 96, 104, 102, 104, 95 ];
	
	/**
	 * If study parts contain suras count more than this threshold, then 
	 * the user profile is eligible for more special questions.
	 */
	this.SurasSpecialQuestionEligibilityThreshold = 7;
	
	this.findIdx = function(scrambled, i) {
		for (var j = 0; j < scrambled.length; j++)
			if (scrambled[j] == i)
				return j;
		return -1;
	}

	this.ListPlus = function(diffList, i) {
		var plus = diffList;
		for (var j = 0; j < plus.length; j++)
			plus[j] = plus[j] + i;
		return plus;
	}
	/*
	public static String md5(String s) {
		MessageDigest digest = null;
		try {
			digest = MessageDigest.getInstance("MD5");
		} catch (NoSuchAlgorithmException e) {
			// e.printStackTrace();
			return s; // Same string better than an empty/null one :)
		}
		digest.update(s.getBytes(), 0, s.length());
		String hash = new BigInteger(1, digest.digest()).toString(16);
		return hash;
	}

	public static int[] randperm(int n) {
		// return a random permutation of size n
		// that is an array containing a random permutation of values 0, 1, ...,
		// n-1
		Random randg = new Random();
		int[] perm = new int[n];
		for (int i = 0; i < n; i++) {
			perm[i] = i;
		}
		for (int i = 0; i < n - 1; i++) {
			int j = randg.nextInt(n - i) + i;
			// sawp perm[i] and perm[j]
			int temp = perm[i];
			perm[i] = perm[j];
			perm[j] = temp;
		}
		return perm;
	}
	
	public static double sCurve(double ratio, double max){
		double y[]={0.001, 0.11, 0.87, 0.98};
		double yp;

	    if (ratio<0.3*max)
	            yp = y[0] + (y[1]-y[0])/(0.3*max-0)*(ratio-0);
	    else if (ratio<0.7*max)
	            yp = y[1] + (y[2]-y[1])/(0.7*max-0.3*max)*(ratio-0.3*max);
	    else if (ratio<max)
	            yp = y[2] + (y[3]-y[2])/(max-0.7*max)*(ratio-0.7*max);
	    else  //(ratio>=max)
	            yp = y[3] + 0.005*(ratio-max);

		return yp;
	}
	
	public static int modQWords(int idx){
		return idx%QuranWords;
	}

	public static void disableFixQ(){
		blFixQ = false;
	}
	public static void enableFixQ(){
		blFixQ = true;
	}
	
	
	 // Removes tashkeel from Quran text
	 // @param text: Quran text with tashkeel
	 // @return same text with no tashkeel
	 //
	public static String fixQ(String text){
		if (blFixQ)
			return text.replaceAll("[\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u06E6]", "");
		else
			return text;
	}

	public static String getSuraNameFromWordIdx(int wordIdx) {
		return sura_name[getSuraIdx(wordIdx)];
	}

	public static String getSuraNameFromIdx(int suraIdx) {
		return sura_name[suraIdx];
	}
	
	public static int getPartNumberFromWordIdx(int wordIdx){
		if(wordIdx <= last5_juz_idx[0])
			return getSuraIdx(wordIdx);
		else{
			for(int i=0;i<5;i++)
				if(wordIdx<last5_juz_idx[i+1])
					return 45+i;
			return 49;
		}
	}
	
	public static int getSuraIdx(int wordIdx) {
		// TODO: Make a binary search, faster!
		for (int i = 0; i < 113; i++)
			if (wordIdx < sura_idx[i]) {
				return i;
			}
		return 113;
	}
	

	public static void tvSetBackgroundFromDrawable(TextView tv, int id){
		if(android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.JELLY_BEAN){
			tv.setBackground(QQApp.getContext().getResources().getDrawable(id));	
		}else{
			tv.setBackgroundDrawable(QQApp.getContext().getResources().getDrawable(id));
		}
	}
	
	public enum QQTextFormat { 
		AYAMARKS_NONE, AYAMARKS_FULL, AYAMARKS_BRACKETS_ONLY, AYAMARKS_BRACKETS_START;
	};
	
	public static String formattedAyaMark(int ayaNum, QQTextFormat fmt){
		switch(fmt){
			case AYAMARKS_BRACKETS_ONLY:
				return "\u06DD";
			case AYAMARKS_BRACKETS_START:
				return "\u06DD";
			case AYAMARKS_FULL:
				return "(" + ayaNum + ")";
			default:
				return "";
		}
	}
	
	public static int getRandomLevel(){
		float r = new Random().nextFloat();
		if(r>0.5) return 2;
		else	return 1;
	}
	
	// Write the object to a Base64 string. 
    public static String toString64( Serializable o ) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ObjectOutputStream oos = new ObjectOutputStream(baos);
        oos.writeObject(o);
        oos.close();
        return new String( Base64.encode( baos.toByteArray(), Base64.DEFAULT ) );
    }
    
	// Read the object from a Base64 string. 
    public static Object fromString64( String s ) throws IOException, ClassNotFoundException {
		byte [] data = Base64.decode(s, Base64.DEFAULT);
		Object o = null;
		//try{
			ObjectInputStream ois = new ObjectInputStream(new ByteArrayInputStream(data));
			o  = ois.readObject();
			ois.close();
		//} catch(EOFException e){
			//That's normal, I do not have EOF
		//}
		return o;
	}
	
 */
  return self;
})
