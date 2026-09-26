import { useLanguage } from "./language-context";
import type { LanguageCode } from "./preferences";

/**
 * App-chrome (navigation labels, buttons, headings, empty states)
 * translated strings -- distinct from content-lib/i18n.ts, which
 * localizes the actual book/temple/chapter TEXT records carry. Content
 * language and UI language are the same single `language` preference
 * (LanguageProvider) -- this module just covers the surrounding frame
 * the content sits in, so picking Tamil/Kannada/Hindi translates the
 * whole app, not only the prose.
 *
 * Same three languages as content translation (ta/kn/hi), English
 * (`language === null`) as the untranslated base -- every key must have
 * all four so there's never a silent fallback to the wrong script.
 */
interface UiStringEntry {
  en: string;
  ta: string;
  kn: string;
  hi: string;
  te: string;
}

const UI_STRINGS = {
  tabHome: { en: "Home", ta: "முகப்பு", kn: "ಮುಖಪುಟ", hi: "होम", te: "హోమ్" },
  tabDivyaDesams: { en: "Divya Desams", ta: "திவ்ய தேசங்கள்", kn: "ದಿವ್ಯ ದೇಶಗಳು", hi: "दिव्य देशम", te: "దివ్య దేశాలు" },
  tabLibrary: { en: "Library", ta: "நூலகம்", kn: "ಗ್ರಂಥಾಲಯ", hi: "पुस्तकालय", te: "గ్రంథాలయం" },
  tabSearch: { en: "Search", ta: "தேடல்", kn: "ಹುಡುಕಾಟ", hi: "खोज", te: "శోధన" },
  tabSettings: { en: "Settings", ta: "அமைப்புகள்", kn: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು", hi: "सेटिंग्स", te: "సెట్టింగ్స్" },

  homeContinueSubtitle: {
    en: "Pick up right where you left off.",
    ta: "நீங்கள் நிறுத்திய இடத்திலிருந்து தொடரவும்.",
    kn: "ನೀವು ನಿಲ್ಲಿಸಿದ ಸ್ಥಳದಿಂದ ಮುಂದುವರಿಸಿ.",
    hi: "जहाँ आपने छोड़ा था वहीं से जारी रखें।",
    te: "మీరు ఎక్కడ ఆపారో అక్కడి నుంచే కొనసాగించండి.",
  },
  homeStartSubtitle: {
    en: "A reference for Divya Desams, the Library, and supporting Knowledge material.",
    ta: "திவ்ய தேசங்கள், நூலகம் மற்றும் துணை அறிவுத் தகவல்களுக்கான ஒரு களஞ்சியம்.",
    kn: "ದಿವ್ಯ ದೇಶಗಳು, ಗ್ರಂಥಾಲಯ ಮತ್ತು ಪೂರಕ ಜ್ಞಾನ ಸಾಮಗ್ರಿಗಳಿಗೆ ಒಂದು ಆಕರ.",
    hi: "दिव्य देशम, पुस्तकालय, और सहायक ज्ञान सामग्री के लिए एक संदर्भ।",
    te: "దివ్య దేశాలు, గ్రంథాలయం మరియు సంబంధిత ఆధ్యాత్మిక సమాచారానికి సమగ్ర వేదిక.",
  },
  homeContinueReadingLabel: {
    en: "Continue Reading",
    ta: "படிப்பைத் தொடரவும்",
    kn: "ಓದುವುದನ್ನು ಮುಂದುವರಿಸಿ",
    hi: "पढ़ना जारी रखें",
    te: "పఠనాన్ని కొనసాగించండి",
  },
  homeGetStartedLabel: { en: "Get Started", ta: "தொடங்குங்கள்", kn: "ಪ್ರಾರಂಭಿಸಿ", hi: "शुरू करें", te: "ప్రారంభించండి" },
  homeBookmarksLabel: { en: "Bookmarks", ta: "புக்மார்க்குகள்", kn: "ಬುಕ್‌ಮಾರ್ಕ್‌ಗಳು", hi: "बुकमार्क", te: "బుక్‌మార్క్‌లు" },
  /**
   * Warm, welcoming time-of-day greetings blending everyday greetings
   * with traditional Sanskrit-rooted salutations (Suprabhatham, Shubha Madhyahnam,
   * Shubha Sandhya, Shubha Ratri) for morning, afternoon, evening, and night.
   */
  homeGreetingMorning: {
    en: "Good morning • Suprabhatham",
    ta: "காலை வணக்கம் • சுப்ரபாதம்",
    kn: "ಶುಭೋದಯ • ಸುಪ್ರಭಾತ",
    hi: "शुभ प्रभात • सुप्रभात",
    te: "శుభోదయం • సుప్రభాతం",
  },
  homeGreetingAfternoon: {
    en: "Good afternoon • Shubha Madhyahnam",
    ta: "மதிய வணக்கம் • சுப மத்யான்னம்",
    kn: "ಶುಭ ಮಧ್ಯಾಹ್ನ",
    hi: "शुभ दोपहर • शुभ मध्याह्न",
    te: "శుభ మధ్యాహ్నం",
  },
  homeGreetingEvening: {
    en: "Good evening • Shubha Sandhya",
    ta: "மாலை வணக்கம் • சுப சந்தியா",
    kn: "ಶುಭ ಸಂಜೆ • ಶುಭ ಸಂಧ್ಯಾ",
    hi: "शुभ संध्या",
    te: "శుభ సాయంత్రం • శుభ సంధ్య",
  },
  homeGreetingNight: {
    en: "Good night • Shubha Ratri",
    ta: "இனிய இரவு • சுப ராத்திரி",
    kn: "ಶುಭ ರಾತ್ರಿ",
    hi: "शुभ रात्रि",
    te: "శుభ రాత్రి",
  },
  homeReaderNoun: { en: "Reader", ta: "வாசகரே", kn: "ಓದುಗರೇ", hi: "पाठक", te: "పాఠకులారా" },
  homeGreetingSubtitle: {
    en: "Your daily companion for scripture and pilgrimage.",
    ta: "வேதநூல்களுக்கும் திருத்தல யாத்திரைக்கும் உங்கள் தினசரித் துணை.",
    kn: "ಗ್ರಂಥಗಳಿಗೂ ತೀರ್ಥಯಾತ್ರೆಗೂ ನಿಮ್ಮ ದೈನಂದಿನ ಒಡನಾಡಿ.",
    hi: "शास्त्र और तीर्थयात्रा के लिए आपका दैनिक साथी।",
    te: "పవిత్ర గ్రంథాలు మరియు పుణ్యక్షేత్ర యాత్రలకు మీ నిత్య సహచరి.",
  },
  homeSpotlightLabel: {
    en: "Divya Desam Spotlight",
    ta: "திவ்ய தேச சிறப்புக் காட்சி",
    kn: "ದಿವ್ಯ ದೇಶ ವಿಶೇಷ ನೋಟ",
    hi: "दिव्य देशम स्पॉटलाइट",
    te: "దివ్య దేశ విశేష దర్శనం",
  },
  resumeButtonLabel: { en: "Resume", ta: "தொடரவும்", kn: "ಮುಂದುವರಿಸಿ", hi: "जारी रखें", te: "కొనసాగించండి" },
  homeSankalpamLabel: {
    en: "Sankalpam",
    ta: "சங்கல்பம்",
    kn: "ಸಂಕಲ್ಪ",
    hi: "संकल्प",
    te: "సంకల్పం",
  },
  homeCalendarLabel: {
    en: "Today's Panchangam",
    ta: "இன்றைய பஞ்சாங்கம்",
    kn: "ಇಂದಿನ ಪಂಚಾಂಗ",
    hi: "आज का पंचांग",
    te: "నేటి పంచాంగం",
  },
  /** Labels the Panchangam card's row naming the place the day's figures were computed for -- a Panchangam is location-specific, so "Tithi" alone is an incomplete statement without it. */
  homeCalendarLocationLabel: { en: "Location", ta: "இருப்பிடம்", kn: "ಸ್ಥಳ", hi: "स्थान", te: "స్థలం" },
  homeCalendarTithiLabel: { en: "Tithi", ta: "திதி", kn: "ತಿಥಿ", hi: "तिथि", te: "తిథి" },
  homeCalendarNakshatramLabel: { en: "Nakshatram", ta: "நட்சத்திரம்", kn: "ನಕ್ಷತ್ರ", hi: "नक्षत्र", te: "నక్షత్రం" },
  homeCalendarFestivalLabel: { en: "Festival", ta: "விழா", kn: "ಹಬ್ಬ", hi: "पर्व", te: "పండుగ / ఉత్సవం" },
  homeCalendarEkadashiLabel: {
    en: "Upcoming Ekadashi",
    ta: "வரவிருக்கும் ஏகாதசி",
    kn: "ಮುಂಬರುವ ಏಕಾದಶಿ",
    hi: "आगामी एकादशी",
    te: "రాబోయే ఏకాదశి",
  },
  homeCalendarBrowseTitle: {
    en: "Panchangam & Calendar",
    ta: "பஞ்சாங்கம் & காலண்டர்",
    kn: "ಪಂಚಾಂಗ & ಕ್ಯಾಲೆಂಡರ್",
    hi: "पंचांग और कैलेंडर",
    te: "పంచాంగం & క్యాలెండర్",
  },
  homeCalendarBrowseSubtitle: {
    en: "Browse daily tithi, nakshatram, sankalpam, and upcoming observances across dates.",
    ta: "பல்வேறு தேதிகளுக்கான திதி, நட்சத்திரம், சங்கல்பம் மற்றும் நிகழ்வுகளைக் காண்க.",
    kn: "ದಿನಾಂಕಗಳಾದ್ಯಂತ ದಿನನಿತ್ಯದ ತಿಥಿ, ನಕ್ಷತ್ರ, ಸಂಕಲ್ಪ ಮತ್ತು ಮುಂಬರುವ ಆಚರಣೆಗಳನ್ನು ವೀಕ್ಷಿಸಿ.",
    hi: "विभिन्न तिथियों के अनुसार दैनिक तिथि, नक्षत्र, संकल्प और आगामी पर्व देखें।",
    te: "వివిధ తేదీలలో తిథి, నక్షత్రం, సంకల్పం మరియు విశేష ఉత్సవాలను వీక్షించండి.",
  },
  calendarPreviousDay: { en: "Previous Day", ta: "முந்தைய நாள்", kn: "ಹಿಂದಿನ ದಿನ", hi: "पिछला दिन", te: "మునుపటి రోజు" },
  calendarNextDay: { en: "Next Day", ta: "அடுத்த நாள்", kn: "ಮುಂದಿನ ದಿನ", hi: "अगला दिन", te: "తదుపరి రోజు" },
  calendarTodayButton: { en: "Today", ta: "இன்று", kn: "ಇಂದು", hi: "आज", te: "నేడు" },
  calendarPastPassed: { en: "Past", ta: "முடிந்தது", kn: "ಕಳೆದ", hi: "व्यतीत", te: "గడచిన" },
  calendarUpcoming: { en: "Upcoming", ta: "வரவிருக்கும்", kn: "ಮುಂಬರುವ", hi: "आगामी", te: "రాబోయే" },
  /** Heading for the Sri Ranganatha Paduka journal's own Panchangam entry shown under the selected day (content-lib/paduka-panchangam.ts). */
  padukaPanchangamLabel: {
    en: "Sri Ranganatha Paduka Panchangam",
    ta: "ஸ்ரீ ரங்கநாத பாதுகா பஞ்சாங்கம்",
    kn: "ಶ್ರೀ ರಂಗನಾಥ ಪಾದುಕಾ ಪಂಚಾಂಗ",
    hi: "श्री रंगनाथ पादुका पंचांग",
    te: "శ్రీ రంగనాథ పాదుకా పంచాంగం",
  },
  /** Labels Ahobila's daily sankalpam inside the Sankalpam box on the days a Tarpana Sankalpam is shown beneath it. */
  sankalpamDailyLabel: { en: "Daily", ta: "தினசரி", kn: "ದೈನಂದಿನ", hi: "दैनिक", te: "రోజువారీ" },
  padukaTarpanamLabel: {
    en: "Tarpana Sankalpam",
    ta: "தர்ப்பண சங்கல்பம்",
    kn: "ತರ್ಪಣ ಸಂಕಲ್ಪ",
    hi: "तर्पण संकल्प",
    te: "తర్పణ సంకల్పం",
  },
  calendarLoading: {
    en: "Loading Panchangam...",
    ta: "பஞ்சாங்கம் ஏற்றப்படுகிறது...",
    kn: "ಪಂಚಾಂಗ ಲೋಡ್ ಆಗುತ್ತಿದೆ...",
    hi: "पंचांग लोड हो रहा है...",
    te: "పంచాంగం లోడ్ అవుతోంది...",
  },
  homeLocationUnavailable: {
    en: "Enable location access for today's Panchangam",
    ta: "இன்றைய பஞ்சாங்கத்திற்கு இருப்பிட அணுகலை இயக்கவும்",
    kn: "ಇಂದಿನ ಪಂಚಾಂಗಕ್ಕಾಗಿ ಸ್ಥಳ ಪ್ರವೇಶವನ್ನು ಸಕ್ರಿಯಗೊಳಿಸಿ",
    hi: "आज के पंचांग के लिए स्थान एक्सेस चालू करें",
    te: "నేటి పంచాంగం కొరకు లొకేషన్ అనుమతిని ప్రారంభించండి",
  },
  divyaDesamsCardSubtitle: {
    en: "The 108 sacred abodes of Vishnu venerated by the Alwars.",
    ta: "ஆழ்வார்களால் போற்றப்படும் விஷ்ணுவின் 108 திருத்தலங்கள்.",
    kn: "ಆಳ್ವಾರರಿಂದ ಪೂಜಿಸಲ್ಪಟ್ಟ ವಿಷ್ಣುವಿನ 108 ಪವಿತ್ರ ಕ್ಷೇತ್ರಗಳು.",
    hi: "आळ्वारों द्वारा पूजित विष्णु के 108 पवित्र धाम।",
    te: "ఆళ్వార్లచే మంగళాశాసనం చేయబడిన 108 శ్రీవైష్ణవ దివ్యదేశాలు.",
  },
  libraryCardSubtitle: {
    en: "Sacred texts and teachings, presented chapter by chapter.",
    ta: "புனித நூல்களும் போதனைகளும், அத்தியாயம் அத்தியாயமாக வழங்கப்படுகின்றன.",
    kn: "ಪವಿತ್ರ ಗ್ರಂಥಗಳು ಮತ್ತು ಬೋಧನೆಗಳು, ಅಧ್ಯಾಯ ಅಧ್ಯಾಯವಾಗಿ ನೀಡಲಾಗಿದೆ.",
    hi: "पवित्र ग्रंथ और शिक्षाएँ, अध्याय दर अध्याय प्रस्तुत।",
    te: "అధ్యాయాల వారీగా అందించబడిన పవిత్ర గ్రంథాలు మరియు బోధనలు.",
  },

  noBooksYet: {
    en: "No books are available yet.",
    ta: "இதுவரை புத்தகங்கள் எதுவும் இல்லை.",
    kn: "ಇನ್ನೂ ಯಾವುದೇ ಪುಸ್ತಕಗಳು ಲಭ್ಯವಿಲ್ಲ.",
    hi: "अभी तक कोई पुस्तक उपलब्ध नहीं है।",
    te: "ఇంకా ఏ పుస్తకాలు అందుబాటులో లేవు.",
  },
  noChaptersYet: {
    en: "No chapters are available yet.",
    ta: "இதுவரை அத்தியாயங்கள் எதுவும் இல்லை.",
    kn: "ಇನ್ನೂ ಯಾವುದೇ ಅಧ್ಯಾಯಗಳು ಲಭ್ಯವಿಲ್ಲ.",
    hi: "अभी तक कोई अध्याय उपलब्ध नहीं है।",
    te: "ఇంకా ఏ అధ్యాయాలు అందుబాటులో లేవు.",
  },
  noChapterContentYet: {
    en: "No content is available for this chapter yet.",
    ta: "இந்த அத்தியாயத்திற்கு இதுவரை உள்ளடக்கம் இல்லை.",
    kn: "ಈ ಅಧ್ಯಾಯಕ್ಕೆ ಇನ್ನೂ ವಿಷಯ ಲಭ್ಯವಿಲ್ಲ.",
    hi: "इस अध्याय के लिए अभी तक कोई सामग्री उपलब्ध नहीं है।",
    te: "ఈ అధ్యాయానికి ఇంకా పాఠ్యం అందుబాటులో లేదు.",
  },
  noRecordContentYet: {
    en: "No content is available yet.",
    ta: "இதுவரை உள்ளடக்கம் இல்லை.",
    kn: "ಇನ್ನೂ ವಿಷಯ ಲಭ್ಯವಿಲ್ಲ.",
    hi: "अभी तक कोई सामग्री उपलब्ध नहीं है।",
    te: "ఇంకా సమాచారం అందుబాటులో లేదు.",
  },

  notFoundTitle: { en: "Not found", ta: "கிடைக்கவில்லை", kn: "ಸಿಗಲಿಲ್ಲ", hi: "नहीं मिला", te: "కనిపించలేదు" },
  bookNotFound: {
    en: "This book could not be found.",
    ta: "இந்தப் புத்தகம் கிடைக்கவில்லை.",
    kn: "ಈ ಪುಸ್ತಕ ಸಿಗಲಿಲ್ಲ.",
    hi: "यह पुस्तक नहीं मिली।",
    te: "ఈ పుస్తకం లభించలేదు.",
  },
  chapterNotFound: {
    en: "This chapter could not be found.",
    ta: "இந்த அத்தியாயம் கிடைக்கவில்லை.",
    kn: "ಈ ಅಧ್ಯಾಯ ಸಿಗಲಿಲ್ಲ.",
    hi: "यह अध्याय नहीं मिला।",
    te: "ఈ అధ్యాయం లభించలేదు.",
  },
  divyaDesamNotFound: {
    en: "This Divya Desam could not be found.",
    ta: "இந்தத் திவ்ய தேசம் கிடைக்கவில்லை.",
    kn: "ಈ ದಿವ್ಯ ದೇಶ ಸಿಗಲಿಲ್ಲ.",
    hi: "यह दिव्य देशम नहीं मिला।",
    te: "ఈ దివ్యదేశం లభించలేదు.",
  },
  recordNotFound: {
    en: "This record could not be found.",
    ta: "இந்தப் பதிவு கிடைக்கவில்லை.",
    kn: "ಈ ದಾಖಲೆ ಸಿಗಲಿಲ್ಲ.",
    hi: "यह रिकॉर्ड नहीं मिला।",
    te: "ఈ వివరాలు లభించలేదు.",
  },

  bookmarkAdd: {
    en: "Bookmark this chapter",
    ta: "இந்த அத்தியாயத்தை புக்மார்க் செய்யவும்",
    kn: "ಈ ಅಧ್ಯಾಯವನ್ನು ಬುಕ್‌ಮಾರ್ಕ್ ಮಾಡಿ",
    hi: "इस अध्याय को बुकमार्क करें",
    te: "ఈ అధ్యాయాన్ని బుక్‌మార్క్ చేయండి",
  },
  bookmarkRemove: {
    en: "Remove bookmark",
    ta: "புக்மார்க்கை நீக்கு",
    kn: "ಬುಕ್‌ಮಾರ್ಕ್ ತೆಗೆದುಹಾಕಿ",
    hi: "बुकमार्क हटाएं",
    te: "బుక్‌మార్క్ తీసివేయండి",
  },
  pagerPrevious: { en: "Previous", ta: "முந்தையது", kn: "ಹಿಂದಿನದು", hi: "पिछला", te: "మునుపటిది" },
  pagerNext: { en: "Next", ta: "அடுத்தது", kn: "ಮುಂದಿನದು", hi: "अगला", te: "తరువాతిది" },
  tableOfContentsLabel: { en: "Contents", ta: "பொருளடக்கம்", kn: "ಪರಿವಿಡಿ", hi: "विषय-सूची", te: "విషయ సూచిక" },

  introCardSubtitle: {
    en: "Start here before exploring the temples below.",
    ta: "கீழே உள்ள கோயில்களை ஆராயும் முன் இங்கிருந்து தொடங்குங்கள்.",
    kn: "ಕೆಳಗಿನ ದೇವಾಲಯಗಳನ್ನು ಅನ್ವೇಷಿಸುವ ಮೊದಲು ಇಲ್ಲಿಂದ ಪ್ರಾರಂಭಿಸಿ.",
    hi: "नीचे दिए गए मंदिरों को देखने से पहले यहाँ से शुरू करें।",
    te: "క్రింది ఆలయాలను దర్శించే ముందు ఇక్కడి నుండి ప్రారంభించండి.",
  },
  geoClassificationEyebrow: {
    en: "GEOGRAPHICAL CLASSIFICATION",
    ta: "புவியியல் வகைப்பாடு",
    kn: "ಭೌಗೋಳಿಕ ವರ್ಗೀಕರಣ",
    hi: "भौगोलिक वर्गीकरण",
    te: "భౌగోళిక వర్గీకరణ",
  },
  allDivyaDesamsTab: { en: "All 108", ta: "அனைத்து 108", kn: "ಎಲ್ಲಾ 108", hi: "सभी 108", te: "మొత్తం 108" },
  divyaDesamCountNoun: { en: "Divya Desam", ta: "திவ்ய தேசம்", kn: "ದಿವ್ಯ ದೇಶ", hi: "दिव्य देशम", te: "దివ్య దేశం" },
  celestialDivyaDesamCountNoun: {
    en: "Celestial Divya Desam",
    ta: "விண்ணுலக திவ்ய தேசம்",
    kn: "ವಿಣ್ಣುಲಗ ದಿವ್ಯ ದೇಶ",
    hi: "विण्णुलग दिव्य देशम",
    te: "విణ్ణుళగ దివ్య దేశం",
  },
  templeInformationHeading: {
    en: "Temple Information",
    ta: "கோயில் தகவல்",
    kn: "ದೇವಾಲಯದ ಮಾಹಿತಿ",
    hi: "मंदिर की जानकारी",
    te: "ఆలయ సమాచారం",
  },
  fieldMoolavar: { en: "Moolavar", ta: "மூலவர்", kn: "ಮೂಲವರ್", hi: "मूलवर", te: "మూలవర్" },
  fieldThayaar: { en: "Thayaar", ta: "தாயார்", kn: "ತಾಯಾರ್", hi: "थायार", te: "తాయార్" },
  fieldVimanam: { en: "Vimanam", ta: "விமானம்", kn: "ವಿಮಾನ", hi: "विमानम", te: "విమానం" },
  fieldTheertham: { en: "Theertham", ta: "தீர்த்தம்", kn: "ತೀರ್ಥ", hi: "तीर्थ", te: "తీర్థం" },
  fieldTravelNote: { en: "How to reach", ta: "வழி", kn: "ತಲುಪುವುದು ಹೇಗೆ", hi: "कैसे पहुँचें", te: "చేరుకునే మార్గం" },
  shrineLocationSingular: {
    en: "Shrine Location",
    ta: "கோயில் இருப்பிடம்",
    kn: "ದೇವಾಲಯ ಸ್ಥಳ",
    hi: "मंदिर का स्थान",
    te: "సన్నిధి ప్రదేశం",
  },
  shrineLocationPlural: {
    en: "Shrine Locations",
    ta: "கோயில் இருப்பிடங்கள்",
    kn: "ದೇವಾಲಯ ಸ್ಥಳಗಳು",
    hi: "मंदिर के स्थान",
    te: "సన్నిధుల ప్రదేశాలు",
  },
  viewOnGoogleMaps: {
    en: "View on Google Maps",
    ta: "கூகிள் மேப்ஸில் காண்க",
    kn: "ಗೂಗಲ್ ಮ್ಯಾಪ್ಸ್‌ನಲ್ಲಿ ವೀಕ್ಷಿಸಿ",
    hi: "गूगल मैप्स पर देखें",
    te: "గూగుల్ మ్యాప్స్‌లో చూడండి",
  },
  sthalaPuranamHeading: { en: "Sthala Puranam", ta: "ஸ்தல புராணம்", kn: "ಸ್ಥಳ ಪುರಾಣ", hi: "स्थल पुराण", te: "స్థల పురాణం" },
  azhwarPasuramHeading: { en: "Azhwar Pasuram", ta: "ஆழ்வார் பாசுரம்", kn: "ಆಳ್ವಾರ್ ಪಾಸುರಂ", hi: "आळ्वार पासुरम", te: "ఆళ్వార్ పాశురం" },
  shrinesHeading: { en: "Shrines", ta: "சன்னதிகள்", kn: "ಗುಡಿಗಳು", hi: "उप-मंदिर", te: "సన్నిధులు" },
  specialNoteLabel: { en: "Special Note", ta: "சிறப்பு குறிப்பு", kn: "ವಿಶೇಷ ಸೂಚನೆ", hi: "विशेष टिप्पणी", te: "విశేష గమనిక" },
  pasuramResourcesHeading: {
    en: "Pasuram Resources",
    ta: "பாசுர வளங்கள்",
    kn: "ಪಾಸುರಂ ಸಂಪನ್ಮೂಲಗಳು",
    hi: "पासुरम संसाधन",
    te: "పాశుర వనరులు",
  },
  pasuramPdfSuffix: { en: "Pasuram (PDF)", ta: "பாசுரம் (PDF)", kn: "ಪಾಸುರಂ (PDF)", hi: "पासुरम (PDF)", te: "పాశురం (PDF)" },

  searchPlaceholder: {
    en: "Search Divya Desams, Library, Knowledge",
    ta: "திவ்ய தேசங்கள், நூலகம், அறிவுத் தகவல்களைத் தேடுங்கள்",
    kn: "ದಿವ್ಯ ದೇಶಗಳು, ಗ್ರಂಥಾಲಯ, ಜ್ಞಾನವನ್ನು ಹುಡುಕಿ",
    hi: "दिव्य देशम, पुस्तकालय, ज्ञान खोजें",
    te: "దివ్య దేశాలు, గ్రంథాలయం, జ్ఞానాన్ని శోధించండి",
  },
  searchHint: {
    en: "Searches Divya Desams, the Library, and Knowledge records",
    ta: "திவ்ய தேசங்கள், நூலகம் மற்றும் அறிவுப் பதிவுகளைத் தேடுகிறது",
    kn: "ದಿವ್ಯ ದೇಶಗಳು, ಗ್ರಂಥಾಲಯ ಮತ್ತು ಜ್ಞಾನ ದಾಖಲೆಗಳನ್ನು ಹುಡುಕುತ್ತದೆ",
    hi: "दिव्य देशम, पुस्तकालय, और ज्ञान अभिलेखों को खोजता है",
    te: "దివ్య దేశాలు, గ్రంథాలయం మరియు జ్ఞాన సంబంధిత సమాచారాన్ని శోధిస్తుంది",
  },
  filterDivyaDesam: { en: "Divya Desam", ta: "திவ்ய தேசம்", kn: "ದಿವ್ಯ ದೇಶ", hi: "दिव्य देशम", te: "దివ్య దేశం" },
  filterBook: { en: "Book", ta: "புத்தகம்", kn: "ಪುಸ್ತಕ", hi: "पुस्तक", te: "పుస్తకం" },
  filterChapter: { en: "Chapter", ta: "அத்தியாயம்", kn: "ಅಧ್ಯಾಯ", hi: "अध्याय", te: "అధ్యాయం" },
  filterKnowledge: { en: "Knowledge", ta: "அறிவு", kn: "ಜ್ಞಾನ", hi: "ज्ञान", te: "జ్ఞానం" },

  settingsConnectLabel: { en: "Connect", ta: "இணைப்பு", kn: "ಸಂಪರ್ಕಿಸಿ", hi: "जुड़ें", te: "కలవండి" },
  settingsLanguageLabel: { en: "Language", ta: "மொழி", kn: "ಭಾಷೆ", hi: "भाषा", te: "భాష" },
  settingsAppearanceLabel: { en: "Appearance", ta: "தோற்றம்", kn: "ನೋಟ", hi: "रूप", te: "స్వరూపం" },
  settingsTextSizeLabel: { en: "Text size", ta: "எழுத்து அளவு", kn: "ಅಕ್ಷರ ಗಾತ್ರ", hi: "अक्षर आकार", te: "అక్షర పరిమాణం" },
  themeSystem: { en: "System", ta: "சிஸ்டம்", kn: "ಸಿಸ್ಟಂ", hi: "सिस्टम", te: "సిస్టమ్" },
  themeLight: { en: "Light", ta: "லைட்", kn: "ಲೈಟ್", hi: "लाइट", te: "లైట్" },
  themeDark: { en: "Dark", ta: "டார்க்", kn: "ಡಾರ್ಕ್", hi: "डार्क", te: "డార్క్" },
  fontScaleSmall: { en: "Small", ta: "சிறியது", kn: "ಚಿಕ್ಕದು", hi: "छोटा", te: "చిన్నది" },
  fontScaleMedium: { en: "Medium", ta: "நடுத்தரம்", kn: "ಮಧ್ಯಮ", hi: "मध्यम", te: "మధ్యస్థం" },
  fontScaleLarge: { en: "Large", ta: "பெரியது", kn: "ದೊಡ್ಡದು", hi: "बड़ा", te: "పెద్దది" },
  fontScaleExtraLarge: {
    en: "Extra Large",
    ta: "மிகப் பெரியது",
    kn: "ಹೆಚ್ಚು ದೊಡ್ಡದು",
    hi: "अतिरिक्त बड़ा",
    te: "మరింత పెద్దది",
  },

  onboardingTitle: {
    en: "Make it yours",
    ta: "உங்களுக்கேற்றவாறு அமைக்கவும்",
    kn: "ನಿಮಗೆ ತಕ್ಕಂತೆ ಹೊಂದಿಸಿ",
    hi: "इसे अपने अनुसार बनाएं",
    te: "మీ అభిరుచికి అనుగుణంగా మార్చుకోండి",
  },
  onboardingSubtitle: {
    en: "Choose how Vedanta Yojana looks and reads. You can always change these later from Settings.",
    ta: "வேதாந்த யோஜனா எப்படித் தோன்றும், படிக்கப்படும் என்பதைத் தேர்ந்தெடுக்கவும். இவற்றை பின்னர் அமைப்புகளில் இருந்து எப்போது வேண்டுமானாலும் மாற்றலாம்.",
    kn: "ವೇದಾಂತ ಯೋಜನಾ ಹೇಗೆ ಕಾಣಬೇಕು ಮತ್ತು ಓದಬೇಕು ಎಂಬುದನ್ನು ಆಯ್ಕೆಮಾಡಿ. ಇವುಗಳನ್ನು ನೀವು ನಂತರ ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಂದ ಯಾವಾಗಲಾದರೂ ಬದಲಾಯಿಸಬಹುದು.",
    hi: "वेदांत योजना कैसी दिखे और पढ़ी जाए, यह चुनें। इन्हें आप बाद में सेटिंग्स से कभी भी बदल सकते हैं।",
    te: "వేదాంత యోజన రూపం మరియు పఠన శైలిని ఎంచుకోండి. వీటిని మీరు ఎప్పుడైనా సెట్టింగ్స్ నుండి మార్చుకోవచ్చు.",
  },
  onboardingContinue: { en: "Continue", ta: "தொடரவும்", kn: "ಮುಂದುವರಿಸಿ", hi: "जारी रखें", te: "కొనసాగించండి" },

  draftBadge: {
    en: "Draft — under review",
    ta: "வரைவு — மறுஆய்வில் உள்ளது",
    kn: "ಕರಡು — ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    hi: "प्रारूप — समीक्षाधीन",
    te: "చిత్తుప్రతి — సమీక్షలో ఉంది",
  },
  draftBadgeFlaggedSuffix: {
    en: " · flagged for additional review",
    ta: " · கூடுதல் மறுஆய்விற்காகக் குறிக்கப்பட்டது",
    kn: " · ಹೆಚ್ಚುವರಿ ಪರಿಶೀಲನೆಗಾಗಿ ಗುರುತಿಸಲಾಗಿದೆ",
    hi: " · अतिरिक्त समीक्षा हेतु चिह्नित",
    te: " · అదనపు సమీక్ష కోసం గుర్తించబడింది",
  },
  draftBadgeA11y: {
    en: "Draft, under review",
    ta: "வரைவு, மறுஆய்வில் உள்ளது",
    kn: "ಕರಡು, ಪರಿಶೀಲನೆಯಲ್ಲಿದೆ",
    hi: "प्रारूप, समीक्षाधीन",
    te: "చిత్తుప్రతి, సమీక్షలో ఉంది",
  },
  draftBadgeFlaggedA11ySuffix: {
    en: ", flagged for additional review",
    ta: ", கூடுதல் மறுஆய்விற்காகக் குறிக்கப்பட்டது",
    kn: ", ಹೆಚ್ಚುವರಿ ಪರಿಶೀಲನೆಗಾಗಿ ಗುರುತಿಸಲಾಗಿದೆ",
    hi: ", अतिरिक्त समीक्षा हेतु चिह्नित",
    te: ", అదనపు సమీక్ష కోసం గుర్తించబడింది",
  },

  closeImage: { en: "Close image", ta: "படத்தை மூடு", kn: "ಚಿತ್ರ ಮುಚ್ಚಿ", hi: "छवि बंद करें", te: "చిత్రాన్ని మూసివేయి" },
  tapAnywhereToClose: {
    en: "Tap anywhere to close",
    ta: "மூட எங்கு வேண்டுமானாலும் தட்டவும்",
    kn: "ಮುಚ್ಚಲು ಎಲ್ಲಿ ಬೇಕಾದರೂ ಟ್ಯಾಪ್ ಮಾಡಿ",
    hi: "बंद करने के लिए कहीं भी टैप करें",
    te: "మూసివేయడానికి ఎక్కడైనా తాకండి",
  },
  viewImageFullScreen: {
    en: "View image full screen",
    ta: "படத்தை முழுத்திரையில் காண்க",
    kn: "ಚಿತ್ರವನ್ನು ಪೂರ್ಣ ಪರದೆಯಲ್ಲಿ ವೀಕ್ಷಿಸಿ",
    hi: "छवि को पूर्ण स्क्रीन में देखें",
    te: "చిత్రాన్ని పూర్తి తెరపై చూడండి",
  },
  opensInBrowserSuffix: {
    en: ", opens in browser",
    ta: ", உலாவியில் திறக்கும்",
    kn: ", ಬ್ರೌಸರ್‌ನಲ್ಲಿ ತೆರೆಯುತ್ತದೆ",
    hi: ", ब्राउज़र में खुलता है",
    te: ", బ్రౌజర్‌లో తెరవబడుతుంది",
  },

  // Web-only, no mobile equivalent: mobile's search corpus is built
  // in-memory synchronously (buildMobileSearchCorpus()), so it can never
  // be "still loading" or "failed to load" the way web's fetched
  // search-index.json can.
  searchLoadingMessage: { en: "Searching…", ta: "தேடுகிறது…", kn: "ಹುಡುಕುತ್ತಿದೆ…", hi: "खोज रहे हैं…", te: "శోధిస్తోంది…" },
  searchUnavailableMessage: {
    en: "Search is temporarily unavailable. Please reload the page to try again.",
    ta: "தேடல் தற்காலிகமாகக் கிடைக்கவில்லை. மீண்டும் முயற்சிக்க பக்கத்தை மீண்டும் ஏற்றவும்.",
    kn: "ಹುಡುಕಾಟ ತಾತ್ಕಾಲಿಕವಾಗಿ ಲಭ್ಯವಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಲು ಪುಟವನ್ನು ಮರುಲೋಡ್ ಮಾಡಿ.",
    hi: "खोज अस्थायी रूप से अनुपलब्ध है। पुनः प्रयास करने के लिए पृष्ठ को रीलोड करें।",
    te: "శోధన తాత్కాలికంగా అందుబాటులో లేదు. దయచేసి పేజీని రీలోడ్ చేసి మళ్లీ ప్రయత్నించండి.",
  },
} satisfies Record<string, UiStringEntry>;

export type UiStringKey = keyof typeof UI_STRINGS;

export function translateUi(key: UiStringKey, language: LanguageCode | null): string {
  const entry = UI_STRINGS[key];
  return language ? entry[language] : entry.en;
}

function pick(language: LanguageCode | null, en: string, ta: string, kn: string, hi: string, te: string): string {
  if (language === "ta") return ta;
  if (language === "kn") return kn;
  if (language === "hi") return hi;
  if (language === "te") return te;
  return en;
}

export function chapterCountLabel(language: LanguageCode | null, count: number): string {
  return pick(
    language,
    `${count} chapter${count === 1 ? "" : "s"}`,
    `${count} ${count === 1 ? "அத்தியாயம்" : "அத்தியாயங்கள்"}`,
    `${count} ${count === 1 ? "ಅಧ್ಯಾಯ" : "ಅಧ್ಯಾಯಗಳು"}`,
    `${count} अध्याय`,
    `${count} ${count === 1 ? "అధ్యాయం" : "అధ్యాయాలు"}`
  );
}

export function chapterOrdinalLabel(language: LanguageCode | null, position: number): string {
  return pick(language, `Chapter ${position}`, `அத்தியாயம் ${position}`, `ಅಧ್ಯಾಯ ${position}`, `अध्याय ${position}`, `అధ్యాయం ${position}`);
}

export function recordCountLabel(language: LanguageCode | null, count: number): string {
  return pick(language, `${count} records`, `${count} பதிவுகள்`, `${count} ದಾಖಲೆಗಳು`, `${count} अभिलेख`, `${count} వివరాలు`);
}

export function chapterPositionLabel(language: LanguageCode | null, position: number, total: number): string {
  return pick(
    language,
    `CHAPTER ${position} OF ${total}`,
    `அத்தியாயம் ${position} / ${total}`,
    `ಅಧ್ಯಾಯ ${position} / ${total}`,
    `अध्याय ${position} / ${total}`,
    `అధ్యాయం ${position} / ${total}`
  );
}

export function continueReadingProgressLabel(
  language: LanguageCode | null,
  position: number,
  total: number,
  percentComplete: number,
  minutesLeft: number
): string {
  return pick(
    language,
    `Chapter ${position} of ${total} • ${percentComplete}% completed • ${minutesLeft}m left`,
    `அத்தியாயம் ${position} / ${total} • ${percentComplete}% முடிந்தது • ${minutesLeft} நிமிடம் மீதம்`,
    `ಅಧ್ಯಾಯ ${position} / ${total} • ${percentComplete}% ಪೂರ್ಣಗೊಂಡಿದೆ • ${minutesLeft} ನಿಮಿಷ ಬಾಕಿ`,
    `अध्याय ${position} / ${total} • ${percentComplete}% पूर्ण • ${minutesLeft} मिनट शेष`,
    `అధ్యాయం ${position} / ${total} • ${percentComplete}% పూర్తయింది • ${minutesLeft} నిమిషాలు మిగిలి ఉన్నాయి`
  );
}

export function minReadLabel(language: LanguageCode | null, minutes: number): string {
  return pick(
    language,
    `${minutes} MIN READ`,
    `${minutes} நிமிட வாசிப்பு`,
    `${minutes} ನಿಮಿಷ ಓದು`,
    `${minutes} मिनट का पठन`,
    `${minutes} నిమిషాల పఠనం`
  );
}

export function nowReadingAnnouncement(language: LanguageCode | null, title: string): string {
  return pick(
    language,
    `Now reading: ${title}`,
    `இப்போது படிக்கிறது: ${title}`,
    `ಈಗ ಓದುತ್ತಿದೆ: ${title}`,
    `अभी पढ़ रहे हैं: ${title}`,
    `ఇప్పుడు చదువుతున్నారు: ${title}`
  );
}

export function shrineOrdinalLabel(language: LanguageCode | null, index: number): string {
  return pick(language, `Shrine ${index}`, `சன்னதி ${index}`, `ಗುಡಿ ${index}`, `उप-मंदिर ${index}`, `సన్నిధి ${index}`);
}

export function pasuramResourceLabel(language: LanguageCode | null, resourceLanguage: string): string {
  return `${resourceLanguage} ${translateUi("pasuramPdfSuffix", language)}`;
}

export function filterAccessibilityLabel(language: LanguageCode | null, filterLabel: string): string {
  return pick(language, `Filter: ${filterLabel}`, `வடிகட்டி: ${filterLabel}`, `ಫಿಲ್ಟರ್: ${filterLabel}`, `फ़िल्टर: ${filterLabel}`, `ఫిల్టర్: ${filterLabel}`);
}

export function noResultsLabel(language: LanguageCode | null, query: string): string {
  return pick(
    language,
    `No results for "${query}".`,
    `"${query}" க்கு முடிவுகள் இல்லை.`,
    `"${query}" ಗಾಗಿ ಫಲಿತಾಂಶಗಳಿಲ್ಲ.`,
    `"${query}" के लिए कोई परिणाम नहीं मिला।`,
    `"${query}" కొరకు ఫలితాలు లేవు.`
  );
}

export function settingChangedAnnouncement(language: LanguageCode | null, label: string, option: string): string {
  return pick(
    language,
    `${label} set to ${option}`,
    `${label} ${option} ஆக அமைக்கப்பட்டது`,
    `${label} ${option} ಗೆ ಹೊಂದಿಸಲಾಗಿದೆ`,
    `${label} को ${option} पर सेट किया गया`,
    `${label} ను ${option} కి మార్చబడింది`
  );
}

export function shrineLocationsHeading(language: LanguageCode | null, count: number): string {
  return translateUi(count > 1 ? "shrineLocationPlural" : "shrineLocationSingular", language);
}

/** Bound to the current reader-language preference -- `t(key)` reads from the same LanguageContext content translation already uses. */
export function useT(): (key: UiStringKey) => string {
  const { language } = useLanguage();
  return (key: UiStringKey) => translateUi(key, language);
}
