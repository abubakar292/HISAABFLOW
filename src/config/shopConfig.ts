export const SHOP_CONFIG = {
  shopId: 'arshad-mobile-zone',
  name: 'Arshad Mobile Zone',
  shortName: 'AMZ',
  subTitle: 'Bara Bazar Khyber',
  fullTitle: 'Arshad Mobile Zone — AMZ',
  address: 'Bara Bazar, Khyber',
  phone: '0300-0000000',
  logoUrl: '/logo.svg',
  logoPng: '/logo.png',
  faviconUrl: '/favicon.png',
  theme: {
    primaryBg: '#12141D',
    primaryBorder: '#1E2230',
    accentGold: '#F59E0B',
    accentGoldHover: '#D97706',
    surface: '#0F1117',
    textMain: '#FFFFFF',
  },
};

/**
 * Multi-word phrase map for compound shop names, Islamic phrases, and cities.
 */
const URDU_PHRASE_MAP: Record<string, string> = {
  'zam zam': 'زمزم',
  'al zamzam': 'الزمزم',
  'al zam zam': 'الزمزم',
  'al madina': 'المدینہ',
  'al madeena': 'المدینہ',
  'al makkah': 'المکہ',
  'al makka': 'المکہ',
  'al haram': 'الحرم',
  'al rehman': 'الرحمان',
  'al rahman': 'الرحمان',
  'al raheem': 'الرحیم',
  'al rahim': 'الرحیم',
  'al karim': 'الکریم',
  'al kareem': 'الکریم',
  'al noor': 'النور',
  'al khair': 'الخیر',
  'al barkat': 'البرکت',
  'al barakah': 'البرکہ',
  'al falah': 'الفلاح',
  'al safa': 'الصفا',
  'al marwa': 'المروہ',
  'al quds': 'القدس',
  'al fajr': 'الفجر',
  'al huda': 'الہدیٰ',
  'al haq': 'الحق',
  'al aziz': 'العزیز',
  'al wahab': 'الوہاب',
  'al razzaq': 'الرزاق',
  'al ghani': 'الغنی',
  'al fattah': 'الفتاح',
  'al hafeez': 'الحفیظ',
  'al latif': 'اللطیف',
  'al wadood': 'الودود',
  'al majeed': 'المجید',
  'al wakeel': 'الوکیل',
  'al qadir': 'القادر',
  'bismillah': 'بسم اللہ',
  'bismillah hir rahman nir raheem': 'بسم اللہ الرحمٰن الرحیم',
  'mashallah': 'ماشاءاللہ',
  'ma sha allah': 'ماشاءاللہ',
  'subhanallah': 'سبحان اللہ',
  'subhan allah': 'سبحان اللہ',
  'alhamdulillah': 'الحمدللہ',
  'al hamdu lillah': 'الحمدللہ',
  'inshallah': 'ان شاءاللہ',
  'in sha allah': 'ان شاءاللہ',
  'dera ghazi khan': 'ڈیرہ غازی خان',
  'dera ismail khan': 'ڈیرہ اسماعیل خان',
  'rahim yar khan': 'رحیم یار خان',
  'toba tek singh': 'ٹوبہ ٹیک سنگھ',
  'mirpur khas': 'میرپور خاص',
  'mandi bahauddin': 'منڈی بہاؤالدین',
  'bara bazar': 'باڑہ بازار',
  'saddar bazar': 'صدر بازار',
  'main market': 'مین مارکیٹ',
  'main bazar': 'مین بازار',
};

/**
 * Dictionary of Pakistani mobile shop words, Islamic/Urdu names, and locations
 * for accurate English-to-Urdu conversion.
 */
const URDU_WORD_MAP: Record<string, string> = {
  // Mobile & Shop business words
  mobile: 'موبائل',
  mobiles: 'موبائلز',
  zone: 'زون',
  center: 'سینٹر',
  centre: 'سینٹر',
  shop: 'شاپ',
  store: 'سٹور',
  point: 'پوائنٹ',
  mart: 'مارٹ',
  plaza: 'پلازہ',
  market: 'مارکیٹ',
  bazar: 'بازار',
  bazaar: 'بازار',
  telecom: 'ٹیلی کام',
  telecommunication: 'ٹیلی کمیونیکیشن',
  communication: 'کمیونیکیشن',
  communications: 'کمیونیکیشنز',
  electronics: 'الیکٹرانکس',
  electronic: 'الیکٹرانک',
  accessories: 'ایکسیسریز',
  accessory: 'ایکسیسری',
  computers: 'کمپیوٹرز',
  computer: 'کمپیوٹر',
  laptop: 'لیپ ٹاپ',
  laptops: 'لیپ ٹاپس',
  cell: 'سیل',
  cellular: 'سیلولر',
  traders: 'ٹریڈرز',
  trader: 'ٹریڈر',
  trading: 'ٹریڈنگ',
  enterprises: 'انٹرپرائزز',
  enterprise: 'انٹرپرائز',
  corporation: 'کارپوریشن',
  company: 'کمپنی',
  co: 'کمپنی',
  brothers: 'برادرز',
  brother: 'برادر',
  bros: 'برادرز',
  sons: 'سنز',
  son: 'سن',
  associates: 'ایسوسی ایٹس',
  group: 'گروپ',
  links: 'لنکس',
  link: 'لنک',
  network: 'نیٹ ورک',
  networks: 'نیٹ ورکس',
  hub: 'ہب',
  world: 'ورلڈ',
  planet: 'پلینٹ',
  city: 'سٹی',
  town: 'ٹاؤن',
  tower: 'ٹاور',
  towers: 'ٹاورز',
  arcade: 'آرکیڈ',
  mall: 'مال',
  complex: 'کمپلیکس',
  palace: 'پیلس',
  house: 'ہاؤس',
  home: 'ہوم',
  corner: 'کارنر',
  gallery: 'گیلری',
  studio: 'سٹوڈیو',
  care: 'کیئر',
  service: 'سروس',
  services: 'سروسز',
  solution: 'سولوشن',
  solutions: 'سولوشنز',
  system: 'سسٹم',
  systems: 'سسٹمز',
  repair: 'ریپئرنگ',
  repairing: 'ریپئرنگ',
  software: 'سافٹ ویئر',
  hardware: 'ہارڈویئر',
  parts: 'پارٹس',
  spare: 'سپیئر',
  lab: 'لیب',
  tech: 'ٹیک',
  technology: 'ٹیکنالوجی',
  technologies: 'ٹیکنالوجیز',
  digital: 'ڈیجیٹل',
  smart: 'سمارٹ',
  phone: 'فون',
  phones: 'فونز',
  apple: 'ایپل',
  iphone: 'آئی فون',
  ipad: 'آئی پیڈ',
  samsung: 'سام سنگ',
  galaxy: 'گیلکسی',
  vivo: 'ویوو',
  oppo: 'اوپو',
  xiaomi: 'شاؤمی',
  redmi: 'ریڈمی',
  poco: 'پوکو',
  infinix: 'انفینکس',
  tecno: 'ٹیکنو',
  itel: 'آئی ٹیل',
  realme: 'ریئل می',
  oneplus: 'ون پلس',
  huawei: 'ہواوے',
  honor: 'آنر',
  motorola: 'موٹرولا',
  google: 'گوگل',
  pixel: 'پکسل',
  sony: 'سونی',
  qmobile: 'کیو موبائل',
  sparx: 'سپارکس',
  vgo: 'وی گو',
  tel: 'ٹیل',
  dcode: 'ڈی کوڈ',
  nokia: 'نوکیا',
  new: 'نیو',
  old: 'اولڈ',
  pak: 'پاک',
  pakistan: 'پاکستان',
  national: 'نیشنل',
  international: 'انٹرنیشنل',
  royal: 'رائل',
  imperial: 'امپیریل',
  king: 'کنگ',
  kings: 'کنگز',
  prince: 'پرنس',
  crown: 'کراؤن',
  star: 'سٹار',
  stars: 'سٹارز',
  super: 'سپر',
  supreme: 'سپریم',
  ultra: 'الٹرا',
  pro: 'پرو',
  plus: 'پلس',
  max: 'میکس',
  golden: 'گولڈن',
  gold: 'گولڈ',
  silver: 'سلور',
  diamond: 'ڈائمنڈ',
  crystal: 'کرسٹل',
  pearl: 'پرل',
  prime: 'پرائم',
  premier: 'پریمیئر',
  elite: 'ایلیٹ',
  classic: 'کلاسک',
  best: 'بیسٹ',
  top: 'ٹاپ',
  first: 'فرسٹ',
  fast: 'فاسٹ',
  quick: 'کوئیک',
  speed: 'سپیڈ',
  express: 'ایکسپریس',
  global: 'گلوبل',
  universal: 'یونیورسل',
  modern: 'ماڈرن',
  future: 'فیوچر',
  vision: 'وژن',
  dream: 'ڈریم',
  choice: 'چوائس',
  trust: 'ٹرسٹ',
  trusted: 'ٹرسٹڈ',
  official: 'آفیشل',
  original: 'اوریجنل',
  master: 'ماسٹر',
  expert: 'ایکسپرٹ',
  doctor: 'ڈاکٹر',
  friends: 'فرینڈز',
  friend: 'فرینڈ',
  united: 'یونائیٹڈ',
  union: 'یونین',
  asia: 'ایشیا',
  asian: 'ایشین',
  oriental: 'اورینٹل',
  western: 'ویسٹرن',
  eastern: 'ایسٹرن',
  northern: 'نادرن',
  southern: 'سدرن',
  central: 'سینٹرل',
  main: 'مین',
  wholesale: 'ہول سیل',
  dealer: 'ڈیلر',
  dealers: 'ڈیلرز',
  distributor: 'ڈسٹری بیوٹر',
  distributors: 'ڈسٹری بیوٹرز',
  agency: 'ایجنسی',
  franchise: 'فرنچائز',
  branch: 'برانچ',
  cash: 'نقد',
  carry: 'کیری',
  and: 'اینڈ',
  '&': 'اینڈ',

  // Sacred, Islamic & Classical Shop Names (including Zamzam)
  zamzam: 'زمزم',
  zam: 'زم',
  alzamzam: 'الزمزم',
  al: 'ال',
  ul: 'ال',
  madina: 'مدینہ',
  madeena: 'مدینہ',
  madinah: 'مدینہ',
  almadina: 'المدینہ',
  makkah: 'مکہ',
  makka: 'مکہ',
  mecca: 'مکہ',
  almakkah: 'المکہ',
  makki: 'مکی',
  madni: 'مدنی',
  madani: 'مدنی',
  haram: 'حرم',
  haramain: 'حرمین',
  harmain: 'حرمین',
  kaaba: 'کعبہ',
  qibla: 'قبلہ',
  aqsa: 'اقصیٰ',
  quds: 'قدس',
  bismillah: 'بسم اللہ',
  mashallah: 'ماشاءاللہ',
  subhanallah: 'سبحان اللہ',
  alhamdulillah: 'الحمدللہ',
  inshallah: 'ان شاءاللہ',
  allah: 'اللہ',
  khuda: 'خدا',
  rab: 'رب',
  rabi: 'ربی',
  rehman: 'رحمان',
  rahman: 'رحمان',
  ur: 'ال',
  raheem: 'رحیم',
  rahim: 'رحیم',
  karim: 'کریم',
  kareem: 'کریم',
  ghani: 'غنی',
  razzaq: 'رزاق',
  razaq: 'رزاق',
  wahab: 'وہاب',
  wahhab: 'وہاب',
  fattah: 'فتاح',
  fatah: 'فتح',
  fateh: 'فاتح',
  noor: 'نور',
  nur: 'نور',
  noorani: 'نورانی',
  rabbani: 'ربانی',
  subhani: 'سبحانی',
  rehmani: 'رحمانی',
  rahmani: 'رحمانی',
  lasani: 'لاثانی',
  yazdani: 'یزدانی',
  haqqani: 'حقانی',
  jannat: 'جنت',
  firdous: 'فردوس',
  firdaus: 'فردوس',
  kausar: 'کوثر',
  kawsar: 'کوثر',
  tasneem: 'تسنیم',
  tasnim: 'تسنیم',
  salsabeel: 'سلسبیل',
  safa: 'صفا',
  marwa: 'مروہ',
  marwah: 'مروہ',
  ajwa: 'عجوہ',
  quba: 'قبا',
  taiba: 'طیبہ',
  tayyaba: 'طیبہ',
  tayyibah: 'طیبہ',
  mina: 'منیٰ',
  arafat: 'عرفات',
  hira: 'حرا',
  badr: 'بدر',
  badar: 'بدر',
  uhud: 'احد',
  ahad: 'احد',
  wahid: 'واحد',
  samad: 'صمد',
  khair: 'خیر',
  falah: 'فلاح',
  huda: 'ہدیٰ',
  haq: 'حق',
  barkat: 'برکت',
  barakah: 'برکت',
  barakat: 'برکت',
  rehmat: 'رحمت',
  rahmat: 'رحمت',
  nemat: 'نعمت',
  niamat: 'نعمت',
  hikmat: 'حکمت',
  qismat: 'قسمت',
  kismat: 'قسمت',
  izzat: 'عزت',
  azmat: 'عظمت',
  shaukat: 'شوکت',
  shafqat: 'شفقت',
  liaqat: 'لیاقت',
  sadaqat: 'صداقت',
  amanat: 'امانت',
  diyanat: 'دیانت',
  sharafat: 'شرافت',
  karamat: 'کرامت',
  inayat: 'عنایت',
  hidayat: 'ہدایت',
  wilayat: 'ولایت',
  kifayat: 'کفایت',
  riayat: 'رعایت',
  shujat: 'شجاعت',
  saadat: 'سعادت',
  ibadat: 'عبادت',
  khidmat: 'خدمت',
  nusrat: 'نصرت',
  qudrat: 'قدرت',
  fitrat: 'فطرت',
  sunnat: 'سنت',
  ummat: 'امت',
  millat: 'ملت',
  ulfat: 'الفت',
  chahat: 'چاہت',
  rahat: 'راحت',
  hasrat: 'حسرت',
  zeenat: 'زینت',
  midhat: 'مدحت',
  nighat: 'نگہت',
  riffat: 'رفعت',
  talat: 'طلعت',
  nudrat: 'ندرت',
  ishrat: 'عشرت',
  farhat: 'فرحت',
  masarrat: 'مسرت',
  chishti: 'چشتی',
  qadri: 'قادری',
  jilani: 'جیلانی',
  gillani: 'گیلانی',
  gilani: 'گیلانی',
  faridi: 'فریدی',
  sabri: 'صابری',
  nizami: 'نظامی',
  naqshbandi: 'نقشبندی',
  saharwardi: 'سہروردی',
  attari: 'عطاری',
  razvi: 'رضوی',
  ashrafi: 'اشرفی',
  owaisi: 'اویسی',
  ghosia: 'غوثیہ',
  ghousia: 'غوثیہ',
  ghous: 'غوث',
  data: 'داتا',
  darbar: 'دربار',
  qalandar: 'قلندر',
  masjid: 'مسجد',
  markaz: 'مرکز',
  manzil: 'منزل',
  mahal: 'محل',
  mehal: 'محل',
  chashma: 'چشمہ',
  gulshan: 'گلشن',
  gulbahar: 'گل بہار',
  gulberg: 'گلبرگ',
  bahar: 'بہار',
  bagh: 'باغ',
  sitara: 'ستارہ',
  tara: 'تارہ',
  chand: 'چاند',
  suraj: 'سورج',
  falak: 'فلک',
  asman: 'آسمان',
  darya: 'دریا',
  sahil: 'ساحل',
  sagar: 'ساگر',
  kohsar: 'کوہسار',
  mehran: 'مہران',
  bolan: 'بولان',
  chenab: 'چناب',
  ravi: 'راوی',
  indus: 'انڈس',
  sindh: 'سندھ',
  punjab: 'پنجاب',
  balochistan: 'بلوچستان',
  sarhad: 'سرحد',
  kashmir: 'کشمیر',
  gilgit: 'گلگت',
  baltistan: 'بلتستان',

  // Common Pakistani Names & Surnames
  ramzan: 'رمضان',
  ramadan: 'رمضان',
  ramadhan: 'رمضان',
  shaban: 'شعبان',
  shaaban: 'شعبان',
  rajab: 'رجب',
  muharram: 'محرم',
  safar: 'صفر',
  shawwal: 'شوال',
  haider: 'حیدر',
  hyder: 'حیدر',
  ali: 'علی',
  hassan: 'حسن',
  hasan: 'حسن',
  hussain: 'حسین',
  husain: 'حسین',
  muhammad: 'محمد',
  mohammad: 'محمد',
  mohammed: 'محمد',
  ahmad: 'احمد',
  ahmed: 'احمد',
  hamza: 'حمزہ',
  hamzah: 'حمزہ',
  umar: 'عمر',
  omer: 'عمر',
  omar: 'عمر',
  usman: 'عثمان',
  osman: 'عثمان',
  abubakar: 'ابوبکر',
  bakar: 'بکر',
  bakr: 'بکر',
  siddiq: 'صدیق',
  siddique: 'صدیق',
  farooq: 'فاروق',
  faruk: 'فاروق',
  bilal: 'بلال',
  arshad: 'ارشد',
  rashid: 'راشد',
  rasheed: 'رشید',
  shahid: 'شاہد',
  zahid: 'زاہد',
  abid: 'عابد',
  sajid: 'ساجد',
  majid: 'ماجد',
  wajid: 'واجد',
  hamid: 'حامد',
  hameed: 'حمید',
  khalid: 'خالد',
  waleed: 'ولید',
  walid: 'ولید',
  saeed: 'سعید',
  fareed: 'فرید',
  farid: 'فرید',
  waheed: 'وحید',
  naveed: 'نوید',
  navid: 'نوید',
  javid: 'جاوید',
  javed: 'جاوید',
  javaid: 'جاوید',
  parvez: 'پرویز',
  pervez: 'پرویز',
  pervaiz: 'پرویز',
  tariq: 'طارق',
  tahir: 'طاہر',
  zahir: 'ظاہر',
  mahir: 'ماہر',
  shakir: 'شاکر',
  zakir: 'ذاکر',
  sabir: 'صابر',
  jabir: 'جابر',
  nadir: 'نادر',
  bahadur: 'بہادر',
  nasir: 'ناصر',
  yasir: 'یاسر',
  qasim: 'قاسم',
  asim: 'عاصم',
  hashim: 'ہاشم',
  hatim: 'حاتم',
  khadim: 'خادم',
  azim: 'عظیم',
  azeem: 'عظیم',
  kazim: 'کاظم',
  nazim: 'ناظم',
  salim: 'سلیم',
  saleem: 'سلیم',
  kalim: 'کلیم',
  kaleem: 'کلیم',
  halim: 'حلیم',
  haleem: 'حلیم',
  nadim: 'ندیم',
  nadeem: 'ندیم',
  wasim: 'وسیم',
  waseem: 'وسیم',
  naim: 'نعیم',
  naeem: 'نعیم',
  fahim: 'فہیم',
  faheem: 'فہیم',
  nasim: 'نسیم',
  naseem: 'نسیم',
  shamim: 'شمیم',
  shameem: 'شمیم',
  taslim: 'تسلیم',
  tasleem: 'تسلیم',
  muslim: 'مسلم',
  amin: 'امین',
  ameen: 'امین',
  matin: 'متین',
  mateen: 'متین',
  mubin: 'مبین',
  mubeen: 'مبین',
  yasin: 'یٰسین',
  yaseen: 'یٰسین',
  mohsin: 'محسن',
  ahsan: 'احسن',
  tahsin: 'تحسین',
  tehseen: 'تحسین',
  atif: 'عاطف',
  asif: 'آصف',
  kashif: 'کاشف',
  wasif: 'واصف',
  arif: 'عارف',
  sharif: 'شریف',
  shareef: 'شریف',
  latif: 'لطیف',
  lateef: 'لطیف',
  hanif: 'حنیف',
  haneef: 'حنیف',
  afif: 'عفیف',
  tauseef: 'توصیف',
  tausif: 'توصیف',
  saqib: 'ثاقب',
  aqib: 'عاقب',
  raqib: 'راقب',
  talib: 'طالب',
  ghalib: 'غالب',
  shoeb: 'شعیب',
  shoaib: 'شعیب',
  sohaib: 'صہیب',
  suhaib: 'صہیب',
  zohaib: 'زوہیب',
  zuhaib: 'زوہیب',
  khubaib: 'خبیب',
  habib: 'حبیب',
  habeeb: 'حبیب',
  haseeb: 'حسیب',
  hasib: 'حسیب',
  muneeb: 'منیب',
  munib: 'منیب',
  najeeb: 'نجیب',
  najib: 'نجیب',
  mujib: 'مجیب',
  mujeeb: 'مجیب',
  raqeeb: 'رقیب',
  tayyab: 'طیب',
  tayyib: 'طیب',
  talha: 'طلحہ',
  talhah: 'طلحہ',
  huzaifa: 'حذیفہ',
  huzaifah: 'حذیفہ',
  usama: 'اسامہ',
  osama: 'اسامہ',
  zubair: 'زبیر',
  uzair: 'عزیر',
  umair: 'عمیر',
  numair: 'نمیر',
  sumair: 'سمیر',
  suhail: 'سہیل',
  sohail: 'سہیل',
  tufail: 'طفیل',
  kumail: 'کمیل',
  junaid: 'جنید',
  ubaid: 'عبید',
  obaid: 'عبید',
  suwaid: 'سوید',
  awais: 'اویس',
  owais: 'اویس',
  qais: 'قیس',
  anas: 'انس',
  abbas: 'عباس',
  ilyas: 'الیاس',
  idrees: 'ادریس',
  idris: 'ادریس',
  anees: 'انیس',
  anis: 'انیس',
  nafees: 'نفیس',
  nafis: 'نفیس',
  raees: 'رئیس',
  rais: 'رئیس',
  waqas: 'وقاص',
  saad: 'سعد',
  fahad: 'فہد',
  fahd: 'فہد',
  asad: 'اسد',
  amjad: 'امجد',
  sajjad: 'سجاد',
  fawad: 'فواد',
  jawad: 'جواد',
  hammad: 'حماد',
  ibad: 'عباد',
  ziyad: 'زیاد',
  ziad: 'زیاد',
  murad: 'مراد',
  shahzad: 'شہزاد',
  shehzad: 'شہزاد',
  azad: 'آزاد',
  dilshad: 'دلشاد',
  irshad: 'ارشاد',
  shamshad: 'شمشاد',
  naushad: 'نوشاد',
  farhad: 'فرہاد',
  zain: 'زین',
  zaid: 'زید',
  zayd: 'زید',
  haris: 'حارث',
  waris: 'وارث',
  faris: 'فارس',
  farhan: 'فرحان',
  rehan: 'ریحان',
  subhan: 'سبحان',
  furqan: 'فرقان',
  burhan: 'برہان',
  gufran: 'غفران',
  ghufran: 'غفران',
  imran: 'عمران',
  kamran: 'کامران',
  adnan: 'عدنان',
  salman: 'سلمان',
  sulaiman: 'سلیمان',
  suleman: 'سلیمان',
  luqman: 'لقمان',
  noman: 'نعمان',
  nauman: 'نعمان',
  rizwan: 'رضوان',
  irfan: 'عرفان',
  ehsan: 'احسان',
  ihsan: 'احسان',
  zeeshan: 'ذیشان',
  zishan: 'ذیشان',
  kashan: 'کاشان',
  roshan: 'روشن',
  faizan: 'فیضان',
  sufyan: 'سفیان',
  sufiyan: 'سفیان',
  arslan: 'ارسلان',
  arsalan: 'ارسلان',
  farman: 'فرمان',
  arman: 'ارمان',
  azlan: 'اذلان',
  ayan: 'عیان',
  ayaan: 'عیان',
  rayyan: 'ریان',
  rayan: 'ریان',
  shayan: 'شایان',
  affan: 'عفان',
  hannan: 'حنان',
  mannan: 'منان',
  dayyan: 'دیان',
  danish: 'دانش',
  tabish: 'تابش',
  kashish: 'کشش',
  nazish: 'نازش',
  beenish: 'بینش',
  sehrish: 'سحرش',
  waqar: 'وقار',
  abrar: 'ابرار',
  israr: 'اسرار',
  iqrar: 'اقرار',
  izhar: 'اظہار',
  iftikhar: 'افتخار',
  zulfiqar: 'ذوالفقار',
  mukhtar: 'مختار',
  gulzar: 'گلزار',
  nisar: 'نثار',
  ghaffar: 'غفار',
  sattar: 'ستار',
  jabbar: 'جبار',
  qadir: 'قادر',
  qadeer: 'قدیر',
  munir: 'منیر',
  muneer: 'منیر',
  bashir: 'بشیر',
  basheer: 'بشیر',
  nazir: 'نذیر',
  nazeer: 'نذیر',
  shabir: 'شبیر',
  shabbir: 'شبیر',
  tanveer: 'تنویر',
  tanvir: 'تنویر',
  zaheer: 'ظہیر',
  zahiruddin: 'ظہیرالدین',
  kabir: 'کبیر',
  kabeer: 'کبیر',
  amir: 'عامر',
  aamir: 'عامر',
  samir: 'سمیر',
  sameer: 'سمیر',
  zamir: 'ضمیر',
  zameer: 'ضمیر',
  saghir: 'صغیر',
  sagheer: 'صغیر',
  tauqeer: 'توقیر',
  tauqir: 'توقیر',
  shakeel: 'شکیل',
  shakil: 'شکیل',
  adeel: 'عدیل',
  adil: 'عادل',
  nabeel: 'نبیل',
  nabil: 'نبیل',
  jameel: 'جمیل',
  jamil: 'جمیل',
  khalil: 'خلیل',
  khaleel: 'خلیل',
  jalil: 'جلیل',
  jaleel: 'جلیل',
  wakil: 'وکیل',
  wakeel: 'وکیل',
  aqeel: 'عقیل',
  aqil: 'عقیل',
  raheel: 'رحیل',
  rahil: 'رحیل',
  sharjeel: 'شرجیل',
  iqbal: 'اقبال',
  afzal: 'افضل',
  fazal: 'فضل',
  fazl: 'فضل',
  ajmal: 'اجمل',
  akmal: 'اکمل',
  jamal: 'جمال',
  kamal: 'کمال',
  jalal: 'جلال',
  hilal: 'ہلال',
  talal: 'طلال',
  nihal: 'نہال',
  wisal: 'وصال',
  khayal: 'خیال',
  faisal: 'فیصل',
  azam: 'اعظم',
  moazzam: 'معظم',
  mukarram: 'مکرم',
  khurram: 'خرم',
  rustam: 'رستم',
  gulfam: 'گلفام',
  akram: 'اکرم',
  ikram: 'اکرام',
  inam: 'انعام',
  inaam: 'انعام',
  ehtisham: 'احتشام',
  ehtesham: 'احتشام',
  hisham: 'ہشام',
  saddam: 'صدام',
  nizam: 'نظام',
  ghulam: 'غلام',
  salam: 'سلام',
  islam: 'اسلام',
  kalam: 'کلام',
  imam: 'امام',
  aslam: 'اسلم',
  akbar: 'اکبر',
  asghar: 'اصغر',
  afsar: 'افسر',
  akhtar: 'اختر',
  anwar: 'انور',
  azhar: 'اظہر',
  mazhar: 'مظہر',
  gauhar: 'گوہر',
  gohar: 'گوہر',
  jauhar: 'جوہر',
  johar: 'جوہر',
  sikandar: 'سکندر',
  babar: 'بابر',
  khawar: 'خاور',
  dilawar: 'دلاور',
  munawar: 'منور',
  sarwar: 'سرور',
  safdar: 'صفدر',
  haidar: 'حیدر',
  qaiser: 'قیصر',
  qaisar: 'قیصر',
  zafar: 'ظفر',
  zaffar: 'ظفر',
  qamar: 'قمر',
  samar: 'ثمر',
  ammar: 'عمار',
  amar: 'عمار',
  muzaffar: 'مظفر',
  mudassar: 'مدثر',
  mudassir: 'مدثر',
  mubashir: 'مبشر',
  mubashar: 'مبشر',
  muzammil: 'مزمل',
  altaf: 'الطاف',
  ashraf: 'اشرف',
  mushtaq: 'مشتاق',
  ishtiaq: 'اشتیاق',
  ashfaq: 'اشفاق',
  ishfaq: 'اشفاق',
  ikhlaq: 'اخلاق',
  aftab: 'آفتاب',
  mehtab: 'مہتاب',
  shadab: 'شاداب',
  sohrab: 'سہراب',
  nayab: 'نایاب',
  zaryab: 'زریاب',
  taimoor: 'تیمور',
  taimur: 'تیمور',
  mansoor: 'منصور',
  manzoor: 'منظور',
  masroor: 'مسرور',
  shakoor: 'شکور',
  ghafoor: 'غفور',
  saboor: 'صبور',
  zahoor: 'ظہور',
  mahboob: 'محبوب',
  mehboob: 'محبوب',
  matloob: 'مطلوب',
  maqsood: 'مقصود',
  masood: 'مسعود',
  mahmood: 'محمود',
  mehmood: 'محمود',
  wadood: 'ودود',
  mashkoor: 'مشکور',
  taufeeq: 'توفیق',
  taufiq: 'توفیق',
  rafiq: 'رفیق',
  rafique: 'رفیق',
  shafiq: 'شفیق',
  shafique: 'شفیق',
  atiq: 'عتیق',
  atique: 'عتیق',
  laeeq: 'لئیق',
  yousaf: 'یوسف',
  yousuf: 'یوسف',
  yusuf: 'یوسف',
  younas: 'یونس',
  younis: 'یونس',
  yunus: 'یونس',
  yaqoob: 'یعقوب',
  yaqub: 'یعقوب',
  ayub: 'ایوب',
  ayyub: 'ایوب',
  haroon: 'ہارون',
  harun: 'ہارون',
  mamoon: 'مامون',
  dawood: 'داؤد',
  daud: 'داؤد',
  ibrahim: 'ابراہیم',
  ismail: 'اسماعیل',
  ishaq: 'اسحاق',
  isa: 'عیسیٰ',
  musa: 'موسیٰ',
  moosa: 'موسیٰ',
  yahya: 'یحییٰ',
  zakariya: 'زکریا',
  zulqarnain: 'ذوالقرنین',
  mustafa: 'مصطفیٰ',
  murtaza: 'مرتضیٰ',
  mujtaba: 'مجتبیٰ',
  irtaza: 'ارتضیٰ',
  raza: 'رضا',
  zia: 'ضیاء',
  ziya: 'ضیاء',
  fida: 'فدا',
  sana: 'ثناء',
  ata: 'عطا',
  atta: 'عطا',
  abdullah: 'عبداللہ',
  abdul: 'عبد',
  abdur: 'عبد',
  sanaullah: 'ثناء اللہ',
  attaullah: 'عطا اللہ',
  ataullah: 'عطا اللہ',
  inayatullah: 'عنایت اللہ',
  hidayatullah: 'ہدایت اللہ',
  kifayatullah: 'کفایت اللہ',
  rehmanullah: 'رحمان اللہ',
  rahmatullah: 'رحمت اللہ',
  rehmatullah: 'رحمت اللہ',
  barkatullah: 'برکت اللہ',
  habibullah: 'حبیب اللہ',
  khalilullah: 'خلیل اللہ',
  kalimullah: 'کلیم اللہ',
  waliullah: 'ولی اللہ',
  noorullah: 'نور اللہ',
  saifullah: 'سیف اللہ',
  asadullah: 'اسد اللہ',
  zafarullah: 'ظفر اللہ',
  nasrullah: 'نصر اللہ',
  fazalullah: 'فضل اللہ',
  lutfullah: 'لطف اللہ',
  ubaidullah: 'عبید اللہ',
  nawaz: 'نواز',
  shahbaz: 'شہباز',
  shehbaz: 'شہباز',
  arbaz: 'ارباز',
  ejaz: 'اعجاز',
  ijaz: 'اعجاز',
  fayyaz: 'فیاض',
  niaz: 'نیاز',
  riaz: 'ریاض',
  mumtaz: 'ممتاز',
  imtiaz: 'امتیاز',
  sarfraz: 'سرفراز',
  sarfaraz: 'سرفراز',
  faraz: 'فراز',
  ayaz: 'ایاز',
  sheraz: 'شیراز',
  shiraz: 'شیراز',
  maaz: 'معاذ',
  moiz: 'معز',
  faiz: 'فیض',
  aziz: 'عزیز',
  hafeez: 'حفیظ',
  hafiz: 'حافظ',
  laziz: 'لذیذ',
  saif: 'سیف',
  kaif: 'کیف',
  taif: 'طائف',
  khan: 'خان',
  jaan: 'جان',
  jan: 'جان',
  shan: 'شان',
  shah: 'شاہ',
  malik: 'ملک',
  sheikh: 'شیخ',
  shaikh: 'شیخ',
  chaudhry: 'چوہدری',
  choudhary: 'چوہدری',
  ch: 'چوہدری',
  raja: 'راجہ',
  mirza: 'مرزا',
  mughal: 'مغل',
  awan: 'اعوان',
  qureshi: 'قریشی',
  abbasi: 'عباسی',
  ansari: 'انصاری',
  farooqi: 'فاروقی',
  siddiqui: 'صدیقی',
  usmani: 'عثمانی',
  hashmi: 'ہاشمی',
  bukhari: 'بخاری',
  naqvi: 'نقوی',
  rizvi: 'رضوی',
  zaidi: 'زیدی',
  kazmi: 'کاظمی',
  jafri: 'جعفری',
  butt: 'بٹ',
  dar: 'ڈار',
  mir: 'میر',
  lone: 'لون',
  wani: 'وانی',
  bhatti: 'بھٹی',
  rana: 'رانا',
  rao: 'راؤ',
  cheema: 'چیمہ',
  bajwa: 'باجوہ',
  warraich: 'وڑائچ',
  chattha: 'چٹھہ',
  tarar: 'تارڑ',
  gondal: 'گونڈل',
  gujjar: 'گجر',
  jutt: 'جٹ',
  jat: 'جٹ',
  arain: 'آرائیں',
  kamboh: 'کمبوہ',
  dogar: 'ڈوگر',
  khokhar: 'کھوکھر',
  sial: 'سیال',
  tiwana: 'ٹوانہ',
  leghari: 'لغاری',
  mazari: 'مزاری',
  bugti: 'بگٹی',
  marri: 'مری',
  mengal: 'مینگل',
  jamali: 'جمالی',
  brohi: 'بروہی',
  soomro: 'سومرو',
  bhutto: 'بھٹو',
  talpur: 'تالپور',
  mahar: 'مہر',
  jatoi: 'جتوئی',
  chandio: 'چانڈیو',
  magsi: 'مگسی',
  zardari: 'زرداری',
  gill: 'گل',
  gul: 'گل',
  niazi: 'نیازی',
  khattak: 'خٹک',
  afridi: 'آفریدی',
  shinwari: 'شنواری',
  mohmand: 'مہمند',
  orakzai: 'اورکزئی',
  wazir: 'وزیر',
  mehsud: 'محسود',
  bangash: 'بنگش',
  marwat: 'مروت',
  yousafzai: 'یوسفزئی',
  durrani: 'درانی',
  tareen: 'ترین',
  kakar: 'کاکڑ',
  achakzai: 'اچکزئی',
  lodhi: 'لودھی',
  ghauri: 'غوری',
  sur: 'سوری',
  suri: 'سوری',
  syed: 'سید',
  sayed: 'سید',
  pir: 'پیر',
  peer: 'پیر',
  pirzada: 'پیرزادہ',
  makhdoom: 'مخدوم',
  mian: 'میاں',
  haji: 'حاجی',
  qari: 'قاری',
  maulana: 'مولانا',
  mufti: 'مفتی',
  allama: 'علامہ',
  sardar: 'سردار',
  nawab: 'نواب',
  sultan: 'سلطان',
  badshah: 'بادشاہ',
  shahzada: 'شہزادہ',
  sahib: 'صاحب',
  ustad: 'استاد',
  baba: 'بابا',
  lala: 'لالہ',
  kaka: 'کاکا',
  chacha: 'چاچا',
  mama: 'ماما',
  fauji: 'فوجی',
  afghan: 'افغان',
  pathan: 'پٹھان',
  pashtun: 'پشتون',
  baloch: 'بلوچ',
  punjabi: 'پنجابی',
  sindhi: 'سندھی',
  kashmiri: 'کشمیری',
  hazara: 'ہزارہ',
  chitrali: 'چترالی',
  gilgiti: 'گلگتی',
  fatima: 'فاطمہ',
  fatimah: 'فاطمہ',
  zainab: 'زینب',
  khadija: 'خدیجہ',
  khadijah: 'خدیجہ',
  ayesha: 'عائشہ',
  aisha: 'عائشہ',
  maryam: 'مریم',
  mariam: 'مریم',
  amna: 'آمنہ',
  amina: 'آمنہ',
  halima: 'حلیمہ',
  ruqayya: 'رقیہ',
  sumayya: 'سمیہ',
  hafsa: 'حفصہ',
  javeria: 'جویریہ',
  maimoona: 'میمونہ',
  safia: 'صفیہ',
  rabia: 'رابعہ',
  asma: 'اسماء',
  bushra: 'بشریٰ',
  uzma: 'عظمیٰ',
  salma: 'سلمیٰ',
  aqsa_name: 'اقصیٰ',
  iqra: 'اقراء',
  sidra: 'سدرہ',
  nimra: 'نمرہ',
  kinza: 'کنزہ',
  fiza: 'فضا',
  hina: 'حنا',
  saba: 'صبا',
  nida: 'ندا',
  rida: 'ردا',
  huma: 'ہما',
  adia: 'عدیہ',
  sadia: 'سعدیہ',
  nadia: 'نادیہ',
  shazia: 'شازیہ',
  fouzia: 'فوزیہ',
  razia: 'رضیہ',
  nazia: 'نازیہ',
  samina: 'ثمینہ',
  rubina: 'روبینہ',
  shabana: 'شبانہ',
  farzana: 'فرزانہ',
  rukhsana: 'رخسانہ',
  rehana: 'ریحانہ',
  sultana: 'سلطانہ',
  yasmin: 'یاسمین',
  nasreen: 'نسرین',
  parveen: 'پروین',
  ambreen: 'عنبرین',
  samreen: 'سمرین',
  mehreen: 'مہرین',
  noreen: 'نورین',
  shirin: 'شیریں',
  afreen: 'آفرین',

  // Cities, Towns & Market Places
  khyber: 'خیبر',
  bara: 'باڑہ',
  peshawar: 'پشاور',
  lahore: 'لاہور',
  karachi: 'کراچی',
  islamabad: 'اسلام آباد',
  rawalpindi: 'راولپنڈی',
  pindi: 'پنڈی',
  multan: 'ملتان',
  faisalabad: 'فیصل آباد',
  quetta: 'کوئٹہ',
  mardan: 'مردان',
  swat: 'سوات',
  mingora: 'مینگورہ',
  kohat: 'کوہاٹ',
  bannu: 'بنوں',
  chaman: 'چمن',
  gujranwala: 'گوجرانوالہ',
  sialkot: 'سیالکوٹ',
  gujrat: 'گجرات',
  jhelum: 'جہلم',
  chakwal: 'چکوال',
  attock: 'اٹک',
  taxila: 'ٹیکسلا',
  wah: 'واہ',
  cantt: 'کینٹ',
  saddar: 'صدر',
  sadar: 'صدر',
  sargodha: 'سرگودھا',
  mianwali: 'میانوالی',
  bhakkar: 'بھکر',
  khushab: 'خوشاب',
  chiniot: 'چنیوٹ',
  jhang: 'جھنگ',
  toba: 'ٹوبہ',
  sahiwal: 'ساہیوال',
  okara: 'اوکاڑہ',
  pakpattan: 'پاکپتن',
  kasur: 'قصور',
  sheikhupura: 'شیخوپورہ',
  nankana: 'ننکانہ',
  narowal: 'نارووال',
  hafizabad: 'حافظ آباد',
  mandi: 'منڈی',
  bahauddin: 'بہاؤالدین',
  wazirabad: 'وزیرآباد',
  kamoke: 'کامونکی',
  muridke: 'مریدکے',
  daska: 'ڈسکہ',
  pasrur: 'پسرور',
  sambrial: 'سمبڑیال',
  kharian: 'کھاریاں',
  lalamusa: 'لالہ موسیٰ',
  sadiqabad: 'صادق آباد',
  rahimyar: 'رحیم یار',
  khanpur: 'خان پور',
  bahawalpur: 'بہاولپور',
  bahawalnagar: 'بہاولنگر',
  lodhran: 'لودھراں',
  vehari: 'وہاڑی',
  burewala: 'بورے والا',
  mailsi: 'میلسی',
  khanewal: 'خانیوال',
  muzaffargarh: 'مظفرگڑھ',
  layyah: 'لیہ',
  kot: 'کوٹ',
  addu: 'ادو',
  dera: 'ڈیرہ',
  rajanpur: 'راجن پور',
  taunsa: 'تونسہ',
  hyderabad: 'حیدرآباد',
  sukkur: 'سکھر',
  larkana: 'لاڑکانہ',
  nawabshah: 'نواب شاہ',
  mirpurkhas: 'میرپورخاص',
  mirpur: 'میرپور',
  jacobabad: 'جیکب آباد',
  shikarpur: 'شکارپور',
  khairpur: 'خیرپور',
  dadu: 'دادو',
  thatta: 'ٹھٹھہ',
  badin: 'بدین',
  sanghar: 'سانگھڑ',
  ghotki: 'گھوٹکی',
  kashmore: 'کشمور',
  umarkot: 'عمرکوٹ',
  swabi: 'صوابی',
  nowshera: 'نوشہرہ',
  charsadda: 'چارسدہ',
  karak: 'کرک',
  hangu: 'ہنگو',
  lakki: 'لکی',
  tank: 'ٹانک',
  shangla: 'شانگلہ',
  buner: 'بونیر',
  dir: 'دیر',
  chitral: 'چترال',
  malakand: 'ملاکنڈ',
  dargai: 'درگئی',
  batkhela: 'بٹ خیلہ',
  abbottabad: 'ایبٹ آباد',
  mansehra: 'مانسہرہ',
  haripur: 'ہری پور',
  battagram: 'بٹگرام',
  kohistan: 'کوہستان',
  landikotal: 'لنڈی کوتل',
  jamrud: 'جمرود',
  torkham: 'طورخم',
  parachinar: 'پاراچنار',
  kurram: 'کرم',
  thal: 'تھل',
  miranshah: 'میران شاہ',
  wana: 'وانا',
  zhob: 'ژوب',
  loralai: 'لورالائی',
  sibi: 'سبی',
  pishin: 'پشین',
  qila: 'قلعہ',
  kalat: 'قلات',
  khuzdar: 'خضدار',
  turbat: 'تربت',
  gwadar: 'گوادر',
  lasbela: 'لسبیلہ',
  muzaffarabad: 'مظفرآباد',
  rawalakot: 'راولاکوٹ',
  kotli: 'کوٹلی',
  bhimber: 'بھمبر',
  skardu: 'سکردو',
  hunza: 'ہنزہ',
  chilas: 'چلاس',
  road: 'روڈ',
  street: 'سٹریٹ',
  gali: 'گلی',
  chowk: 'چوک',
  chok: 'چوک',
  adda: 'اڈہ',
  pul: 'پل',
  pull: 'پل',
  colony: 'کالونی',
  phase: 'فیز',
  block: 'بلاک',
  sector: 'سیکٹر',
  station: 'سٹیشن',
  gate: 'گیٹ',
  near: 'نزد',
  opposite: 'بمقابل',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
function isVowel(ch: string | undefined): boolean {
  return Boolean(ch && VOWELS.has(ch));
}

/**
 * Checks whether a single word is a compound of two known dictionary words
 * or known suffixes (e.g., zamzam -> زمزم, alzamzam -> الزمزم, khanpur -> خان پور).
 */
function tryCompoundUrduLookup(lower: string): string | null {
  // 1. Prefix "al" or "ul" attached directly (e.g., alzamzam, almadina, alrehman)
  if ((lower.startsWith('al') || lower.startsWith('ul')) && lower.length > 4) {
    const rest = lower.slice(2);
    if (URDU_WORD_MAP[rest]) {
      return `ال${URDU_WORD_MAP[rest]}`;
    }
  }

  // 2. Reduplicated root (e.g., zamzam -> zam + zam -> زمزم)
  if (lower.length >= 4 && lower.length % 2 === 0) {
    const half = lower.slice(0, lower.length / 2);
    if (half === lower.slice(lower.length / 2) && URDU_WORD_MAP[half]) {
      return `${URDU_WORD_MAP[half]}${URDU_WORD_MAP[half]}`;
    }
  }

  // 3. Common Pakistani place/name suffixes (-abad, -pur, -kot, -garh, -wala, -wali, -ullah, -uddin)
  const suffixes: Array<[string, string, boolean]> = [
    ['ullah', ' اللہ', true],
    ['uddin', ' الدین', false],
    ['abad', ' آباد', true],
    ['pur', ' پور', true],
    ['kot', ' کوٹ', false],
    ['garh', ' گڑھ', false],
    ['wala', ' والہ', true],
    ['wali', ' والی', true],
    ['zone', ' زون', true],
    ['shop', ' شاپ', true],
    ['mart', ' مارٹ', true],
    ['point', ' پوائنٹ', true],
    ['center', ' سینٹر', true],
    ['centre', ' سینٹر', true],
  ];

  for (const [sfx, urduSfx, withSpace] of suffixes) {
    if (lower.endsWith(sfx) && lower.length > sfx.length + 2) {
      const stem = lower.slice(0, lower.length - sfx.length);
      if (URDU_WORD_MAP[stem]) {
        return withSpace ? `${URDU_WORD_MAP[stem]}${urduSfx}` : `${URDU_WORD_MAP[stem]}${urduSfx.trim()}`;
      }
    }
  }

  // 4. General 2-word split where both parts exist in URDU_WORD_MAP
  for (let splitIdx = 3; splitIdx <= lower.length - 3; splitIdx++) {
    const left = lower.slice(0, splitIdx);
    const right = lower.slice(splitIdx);
    if (URDU_WORD_MAP[left] && URDU_WORD_MAP[right]) {
      return `${URDU_WORD_MAP[left]} ${URDU_WORD_MAP[right]}`;
    }
  }

  return null;
}

/**
 * Syllable-aware English-to-Urdu script transliterator for any custom word not in URDU_WORD_MAP.
 * Properly handles Urdu abjad rules:
 * - Short medial 'a', 'i', 'u' in closed syllables (like zamzam -> زمزم, markaz -> مرکز) are omitted instead of inserting false long vowels.
 * - Dental 't' (ت) and 'd' (د) are used as natural Urdu defaults.
 * - Word-final '-ah' / '-a' maps cleanly to 'ہ' or 'ا'.
 */
function transliterateWordToUrdu(word: string): string {
  const clean = word.trim();
  if (!clean) return '';

  // If already contains Urdu characters or is a number, keep as-is
  if (/[\u0600-\u06FF]/.test(clean) || /^\d+$/.test(clean)) {
    return clean;
  }

  const lower = clean.toLowerCase();
  if (URDU_WORD_MAP[lower]) {
    return URDU_WORD_MAP[lower];
  }

  const compoundMatch = tryCompoundUrduLookup(lower);
  if (compoundMatch) {
    return compoundMatch;
  }

  // Keep short all-caps acronyms (like AMZ, VIP, POS, PK, UK, US) or alphanumeric model codes readable
  if (/^[A-Z0-9]{2,4}$/.test(clean) && !/[aeiouAEIOU]/.test(clean)) {
    return clean;
  }

  // Collapse doubled identical consonants (e.g., makkah -> makah, saddam -> sadam, muhammad -> muhamad)
  const s = lower.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');
  let out = '';
  let i = 0;

  while (i < s.length) {
    const rem = s.slice(i);
    const isStart = i === 0;
    const isEnd = i === s.length - 1;

    // Multi-character digraphs first
    if (rem.startsWith('sh')) {
      out += 'ش';
      i += 2;
      continue;
    }
    if (rem.startsWith('ch')) {
      out += 'چ';
      i += 2;
      continue;
    }
    if (rem.startsWith('kh')) {
      out += 'خ';
      i += 2;
      continue;
    }
    if (rem.startsWith('gh')) {
      out += 'غ';
      i += 2;
      continue;
    }
    if (rem.startsWith('ph')) {
      out += 'ف';
      i += 2;
      continue;
    }
    if (rem.startsWith('th')) {
      out += 'تھ';
      i += 2;
      continue;
    }
    if (rem.startsWith('dh')) {
      out += 'دھ';
      i += 2;
      continue;
    }
    if (rem.startsWith('bh')) {
      out += 'بھ';
      i += 2;
      continue;
    }
    if (rem.startsWith('zh')) {
      out += 'ژ';
      i += 2;
      continue;
    }
    if (rem.startsWith('ck')) {
      out += 'ک';
      i += 2;
      continue;
    }
    if (rem.startsWith('qu')) {
      out += 'ق';
      i += 2;
      continue;
    }

    // Word-final '-ah' (e.g. makkah, madinah, barakah, fatimah) -> 'ہ'
    if (rem === 'ah' && !isStart) {
      out += 'ہ';
      i += 2;
      continue;
    }

    // Long vowel digraphs
    if (rem.startsWith('aa')) {
      out += isStart ? 'آ' : 'ا';
      i += 2;
      continue;
    }
    if (rem.startsWith('ee') || rem.startsWith('ea')) {
      out += isStart ? 'ای' : 'ی';
      i += 2;
      continue;
    }
    if (rem.startsWith('oo') || rem.startsWith('ou') || rem.startsWith('au') || rem.startsWith('aw')) {
      out += isStart ? 'او' : 'و';
      i += 2;
      continue;
    }
    if (rem.startsWith('ai') || rem.startsWith('ay') || rem.startsWith('ei')) {
      out += isStart ? 'اے' : i + 2 === s.length ? 'ے' : 'ی';
      i += 2;
      continue;
    }
    if (rem.startsWith('ia') || rem.startsWith('ya')) {
      out += 'یا';
      i += 2;
      continue;
    }

    const ch = s[i];
    const nextCh = s[i + 1];
    const afterNextCh = s[i + 2];

    if (ch === 'a') {
      if (isStart) {
        out += 'ا';
      } else if (isEnd) {
        // Word-final -a: in multi-syllable Urdu words (like sitara, madina, zamana) use 'ہ', in short words use 'ا'
        out += s.length >= 5 ? 'ہ' : 'ا';
      } else {
        // Medial 'a':
        // Omit short 'a' (Zabar) when followed by 2+ consonants (closed syllable like zam-zam, mar-kaz, bar-kat)
        // or when it is in the final syllable before a single consonant in a short root like '-am', '-at', '-ad', '-ar', '-al', '-as', '-az'
        const followedByCluster = !isVowel(nextCh) && Boolean(afterNextCh) && !isVowel(afterNextCh);
        const isBeforeFinalConsonant = i === s.length - 2 && !isVowel(nextCh);

        if (followedByCluster) {
          // Short closed syllable (e.g. first 'a' in zamzam, markaz, barkat, masjid) -> unwritten Zabar
        } else if (isBeforeFinalConsonant) {
          // Only write Alif before final consonant if the ending is a long '-an' / '-ab' / '-az' in a 2+ syllable word,
          // or if it is a 3-letter CVC word with long vowel (except short roots like zam, rab, haq, dil, gul, sab, hum, kal)
          const shortThreeLetterRoots = new Set(['zam', 'rab', 'haq', 'sab', 'hum', 'tum', 'kal', 'pal', 'hal', 'nal', 'dam', 'kam', 'gham', 'fan', 'man', 'tan', 'ban', 'dar', 'sar', 'kar', 'par', 'mar', 'zar', 'bar', 'har', 'nar', 'dal', 'mal', 'sal', 'tal', 'chal', 'phal', 'bad', 'had', 'mad', 'sad', 'qad', 'rad', 'bas', 'kas', 'ras', 'das', 'nas', 'pas']);
          if (s.length === 3) {
            if (!shortThreeLetterRoots.has(s)) {
              out += 'ا';
            }
          } else {
            // In multi-syllable words (like zamzam, markaz, barkat, rehmat, akram, aslam, ahmad, arshad),
            // only endings like -an (rehman, sultan, multan, farhan) or -ab (aftab, shadab) take Alif
            if (nextCh === 'n' || nextCh === 'b') {
              out += 'ا';
            }
          }
        } else {
          // Open syllable (followed by consonant + vowel, e.g., ka-mal, ja-mal, sa-lam, na-eem) -> write Alif if in second-to-last open syllable
          out += 'ا';
        }
      }
      i += 1;
      continue;
    }

    if (ch === 'e') {
      if (isStart) {
        out += 'ا';
      } else if (isEnd) {
        out += 'ے';
      } else {
        // Medial 'e': in 'rehmat' / 'mehal' / 'sehgal' before 'h', omit short vowel; otherwise 'ی'
        if (nextCh !== 'h') {
          out += 'ی';
        }
      }
      i += 1;
      continue;
    }

    if (ch === 'i') {
      if (isStart) {
        out += 'ا';
      } else if (isEnd) {
        out += 'ی';
      } else {
        // Medial 'i': omit short Zer in closed consonant clusters (e.g., mas-jid, man-zil, mus-lim, mur-shid)
        const followedByCluster = !isVowel(nextCh) && Boolean(afterNextCh) && !isVowel(afterNextCh);
        const isShortEnding = i === s.length - 2 && ['d', 'l', 'm', 'r', 's', 't', 'z', 'q', 'f', 'b', 'k'].includes(nextCh);
        if (!followedByCluster && !isShortEnding) {
          out += 'ی';
        }
      }
      i += 1;
      continue;
    }

    if (ch === 'o') {
      if (isStart) {
        out += 'او';
      } else {
        out += 'و';
      }
      i += 1;
      continue;
    }

    if (ch === 'u') {
      if (isStart) {
        out += 'ا';
      } else if (isEnd) {
        out += 'و';
      } else {
        // Medial 'u': omit short Pesh in closed consonant clusters (e.g., gul-shan, sul-tan, mul-tan, mus-lim, bur-han, sub-han, fur-qan)
        const followedByCluster = !isVowel(nextCh) && Boolean(afterNextCh) && !isVowel(afterNextCh);
        const isShortThreeLetter = s.length === 3 && i === 1;
        if (!followedByCluster && !isShortThreeLetter) {
          out += 'و';
        }
      }
      i += 1;
      continue;
    }

    // Consonants
    switch (ch) {
      case 'b':
        out += 'ب';
        break;
      case 'c':
        out += nextCh === 'e' || nextCh === 'i' || nextCh === 'y' ? 'س' : 'ک';
        break;
      case 'd':
        out += 'د';
        break;
      case 'f':
        out += 'ف';
        break;
      case 'g':
        out += 'گ';
        break;
      case 'h':
        out += 'ہ';
        break;
      case 'j':
        out += 'ج';
        break;
      case 'k':
        out += 'ک';
        break;
      case 'l':
        out += 'ل';
        break;
      case 'm':
        out += 'م';
        break;
      case 'n':
        out += 'ن';
        break;
      case 'p':
        out += 'پ';
        break;
      case 'q':
        out += 'ق';
        break;
      case 'r':
        out += 'ر';
        break;
      case 's':
        out += 'س';
        break;
      case 't':
        out += 'ت';
        break;
      case 'v':
      case 'w':
        out += 'و';
        break;
      case 'x':
        out += 'کس';
        break;
      case 'y':
        out += 'ی';
        break;
      case 'z':
        out += 'ز';
        break;
      default:
        out += ch;
    }
    i += 1;
  }

  return out || clean;
}

/**
 * Converts any English phrase, person name, or shop name into accurate Urdu script.
 */
export function convertTextToUrdu(input?: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';

  // If already contains Urdu script, return as-is
  if (/[\u0600-\u06FF]/.test(raw)) {
    return raw;
  }

  const normalized = raw
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (URDU_PHRASE_MAP[normalized]) {
    return URDU_PHRASE_MAP[normalized];
  }

  const rawTokens = raw
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (rawTokens.length === 0) return raw;

  const resultWords: string[] = [];
  let idx = 0;

  while (idx < rawTokens.length) {
    const cleanCurr = rawTokens[idx].replace(/[^a-zA-Z0-9&\u0600-\u06FF]/g, '');
    const lowerCurr = cleanCurr.toLowerCase();

    // Check 3-word phrase match first
    if (idx + 2 < rawTokens.length) {
      const w2 = rawTokens[idx + 1].replace(/[^a-zA-Z0-9&\u0600-\u06FF]/g, '').toLowerCase();
      const w3 = rawTokens[idx + 2].replace(/[^a-zA-Z0-9&\u0600-\u06FF]/g, '').toLowerCase();
      const tri = `${lowerCurr} ${w2} ${w3}`;
      if (URDU_PHRASE_MAP[tri]) {
        resultWords.push(URDU_PHRASE_MAP[tri]);
        idx += 3;
        continue;
      }
    }

    // Check 2-word phrase match (e.g. "zam zam" -> "زمزم", "al madina" -> "المدینہ")
    if (idx + 1 < rawTokens.length) {
      const nextClean = rawTokens[idx + 1].replace(/[^a-zA-Z0-9&\u0600-\u06FF]/g, '');
      const lowerNext = nextClean.toLowerCase();
      const bi = `${lowerCurr} ${lowerNext}`;
      if (URDU_PHRASE_MAP[bi]) {
        resultWords.push(URDU_PHRASE_MAP[bi]);
        idx += 2;
        continue;
      }

      // Join "Al" / "Ul" prefix directly onto the next Urdu word (e.g. "Al Zamzam" -> "الزمزم")
      if ((lowerCurr === 'al' || lowerCurr === 'ul') && nextClean) {
        const nextUrdu = transliterateWordToUrdu(nextClean);
        resultWords.push(nextUrdu.startsWith('ال') ? nextUrdu : `ال${nextUrdu}`);
        idx += 2;
        continue;
      }

      // Join "Zam Zam" or any repeated short root
      if (lowerCurr === 'zam' && lowerNext === 'zam') {
        resultWords.push('زمزم');
        idx += 2;
        continue;
      }
    }

    if (cleanCurr) {
      resultWords.push(transliterateWordToUrdu(cleanCurr));
    }
    idx += 1;
  }

  return resultWords.join(' ') || raw;
}

/**
 * Automatically converts the current shop's name (set in Store Settings) into Urdu script.
 */
export function convertShopNameToUrdu(shopName?: string): string {
  let raw = (shopName || '').trim();
  if (!raw && typeof window !== 'undefined') {
    try {
      raw = (localStorage.getItem('cached_shop_name') || '').trim();
    } catch {
      // ignore
    }
  }

  if (!raw) {
    return 'موبائل شاپ';
  }

  return convertTextToUrdu(raw) || raw;
}

/**
 * Translates common English payment methods into natural Urdu for WhatsApp receipts.
 */
function translatePaymentMethodToUrdu(method?: string): string {
  const m = (method || 'Cash').trim();
  const lower = m.toLowerCase();
  if (lower === 'cash' || lower === 'naqad') return 'نقد (Cash)';
  if (lower.includes('easypaisa') || lower.includes('easy paisa')) return 'ایزی پیسہ (Easypaisa)';
  if (lower.includes('jazzcash') || lower.includes('jazz cash')) return 'جاز کیش (JazzCash)';
  if (lower.includes('bank') || lower.includes('online') || lower.includes('transfer')) return 'بینک ٹرانسفر (Bank)';
  if (lower.includes('khata') || lower.includes('udhar') || lower.includes('credit')) return 'کھاتہ / ادھار (Khata)';
  if (lower.includes('card') || lower.includes('pos')) return 'کارڈ (Card)';
  return m;
}

/**
 * Translates English warranty status strings into natural Urdu for WhatsApp IMEI sharing.
 */
function translateWarrantyToUrdu(statusText?: string): string {
  const raw = (statusText || '').trim();
  if (!raw) return 'کوئی وارنٹی نہیں';
  if (/[\u0600-\u06FF]/.test(raw)) return raw;

  const lower = raw.toLowerCase();
  if (lower.includes('expired')) {
    return `وارنٹی کی مدت ختم ہو چکی ہے (${raw})`;
  }
  if (lower.includes('no warranty') || lower === 'none') {
    return 'وارنٹی نہیں ہے';
  }
  if (lower.includes('active') || lower.includes('under') || lower.includes('left') || lower.includes('valid')) {
    return `وارنٹی موجود ہے (${raw})`;
  }
  return raw;
}

export const getWhatsAppKhataUrl = (
  phone: string | undefined,
  customerName: string,
  balance: number,
  type: 'receivable' | 'payable' = 'receivable',
  shopName?: string
): string => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  const urduShopName = convertShopNameToUrdu(shopName);
  const urduCustomerName = convertTextToUrdu(customerName) || 'محترم کسٹمر';

  const message =
    type === 'receivable'
      ? `السلام علیکم ${urduCustomerName} صاحب،\n\n*${urduShopName}* کی طرف سے آپ کے کھاتے کا کل بقایا (ادھار): *Rs. ${balance.toLocaleString()}* واجب الادا ہے۔\n\nبرائے مہربانی اپنا بقایا جلد از جلد ادا فرما دیں۔\n\nشکریہ!\n*${urduShopName}*`
      : `السلام علیکم ${urduCustomerName} صاحب،\n\n*${urduShopName}* کے پاس آپ کی امانت / جمع شدہ رقم: *Rs. ${balance.toLocaleString()}* موجود ہے۔\n\nشکریہ!\n*${urduShopName}*`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export const getWhatsAppTransactionUrl = (
  phone: string | undefined,
  customerName: string,
  txType: 'udhar' | 'wasooli',
  amount: number,
  description?: string,
  runningBalance?: number,
  dateStr?: string,
  shopName?: string
): string => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  const urduShopName = convertShopNameToUrdu(shopName);
  const urduCustomerName = convertTextToUrdu(customerName) || 'محترم کسٹمر';
  const typeUrdu = txType === 'udhar' ? 'ادھار (بقایا میں اضافہ)' : 'وصولی (رقم موصول ہوئی)';
  const dateFormatted = dateStr || new Date().toLocaleDateString('en-GB');

  let message = `السلام علیکم ${urduCustomerName} صاحب،\n\n*${urduShopName}* میں آپ کے کھاتے کی نئی ٹرانزیکشن کا اندراج:\n\n📅 تاریخ: *${dateFormatted}*\n📌 نوعیت: *${typeUrdu}*\n💰 رقم: *Rs. ${(amount || 0).toLocaleString()}*`;

  if (description) {
    message += `\n📝 تفصیل: ${description}`;
  }

  if (runningBalance !== undefined && runningBalance !== null) {
    message += `\n\n📊 موجودہ کل بقایا: *Rs. ${runningBalance.toLocaleString()}*`;
  }

  message += `\n\nشکریہ!\n*${urduShopName}*`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export const getWhatsAppSaleBillUrl = (
  phone: string | undefined,
  customerName: string,
  itemName: string,
  sellPrice: number,
  paymentMethod: string,
  imei1?: string,
  billNumber?: string,
  shopName?: string
): string => {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  const urduShopName = convertShopNameToUrdu(shopName);
  const urduCustomerName =
    customerName && customerName.toLowerCase() !== 'walk-in customer'
      ? convertTextToUrdu(customerName)
      : 'محترم کسٹمر';
  const urduPaymentMethod = translatePaymentMethodToUrdu(paymentMethod);

  let msg = `السلام علیکم ${urduCustomerName} صاحب،\n\n*${urduShopName}* سے خریداری کا شکریہ!\n\n📱 موبائل / آئٹم: *${itemName}*`;
  if (imei1) {
    msg += `\n🔢 IMEI: *${imei1}*`;
  }
  msg += `\n💵 کل قیمت: *Rs. ${(Number(sellPrice) || 0).toLocaleString()}*`;
  msg += `\n💳 طریقہ ادائیگی: *${urduPaymentMethod}*`;
  if (billNumber) {
    msg += `\n🧾 بل نمبر: *${billNumber}*`;
  }
  msg += `\n\nشکریہ!\n*${urduShopName}*`;

  if (formattedPhone) {
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
};

export const getWhatsAppSupplierBalanceUrl = (
  phone: string | undefined,
  supplierName: string,
  balance: number,
  shopName?: string
): string => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
  const urduShopName = convertShopNameToUrdu(shopName);
  const urduSupplierName = convertTextToUrdu(supplierName) || 'محترم سپلائر';

  const message =
    balance > 0
      ? `السلام علیکم ${urduSupplierName} صاحب،\n\n*${urduShopName}* کی طرف سے آپ کے کھاتے کا موجودہ بقایا بل: *Rs. ${balance.toLocaleString()}* واجب الادا ہے۔\n\nشکریہ!\n*${urduShopName}*`
      : balance < 0
      ? `السلام علیکم ${urduSupplierName} صاحب،\n\n*${urduShopName}* کی طرف سے آپ کے پاس ہماری ایڈوانس رقم: *Rs. ${Math.abs(balance).toLocaleString()}* جمع ہے۔\n\nشکریہ!\n*${urduShopName}*`
      : `السلام علیکم ${urduSupplierName} صاحب،\n\n*${urduShopName}* کے ساتھ آپ کا کھاتہ مکمل کلیئر (Rs. 0) ہے۔\n\nشکریہ!\n*${urduShopName}*`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export const getWhatsAppSupplierTxUrl = (
  phone: string | undefined,
  supplierName: string,
  txType: 'purchase' | 'payment',
  amount: number,
  paymentMethod?: string,
  referenceId?: string,
  description?: string,
  runningBalance?: number,
  dateStr?: string,
  shopName?: string
): string => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  const urduShopName = convertShopNameToUrdu(shopName);
  const urduSupplierName = convertTextToUrdu(supplierName) || 'محترم سپلائر';
  const typeUrdu =
    txType === 'payment'
      ? 'ادائیگی بھیج دی گئی (Payment Sent)'
      : 'مال خریداری بل (Stock Purchase)';
  const dateFormatted = dateStr || new Date().toLocaleDateString('en-GB');

  let message = `السلام علیکم ${urduSupplierName} صاحب،\n\n*${urduShopName}* کی طرف سے کھاتہ اپڈیٹ:\n\n📅 تاریخ: *${dateFormatted}*\n📌 نوعیت: *${typeUrdu}*\n💰 رقم: *Rs. ${(amount || 0).toLocaleString()}*`;

  if (paymentMethod) {
    message += `\n💳 طریقہ ادائیگی: *${translatePaymentMethodToUrdu(paymentMethod)}*`;
  }
  if (referenceId) {
    message += `\n🔢 ٹرانزیکشن / بل نمبر: *${referenceId}*`;
  }
  if (description) {
    message += `\n📝 تفصیل: ${description}`;
  }
  if (runningBalance !== undefined && runningBalance !== null) {
    message += `\n\n📊 موجودہ کل بقایا: *Rs. ${runningBalance.toLocaleString()}*`;
  }

  message += `\n\nشکریہ!\n*${urduShopName}*`;
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export const getWhatsAppImeiWarrantyUrl = (
  phone: string | undefined,
  customerName: string,
  modelName: string,
  imei: string,
  saleDateStr: string,
  warrantyStatusText: string,
  shopName?: string
): string => {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;
  const urduShopName = convertShopNameToUrdu(shopName);
  const urduCustomerName =
    customerName && customerName.toLowerCase() !== 'walk-in customer'
      ? convertTextToUrdu(customerName)
      : 'محترم کسٹمر';
  const urduWarrantyStatus = translateWarrantyToUrdu(warrantyStatusText);

  const msg = `السلام علیکم ${urduCustomerName} صاحب،\n\n*${urduShopName}* — IMEI وارنٹی اور ریکارڈ کی تفصیل:\n\n📱 موبائل: *${modelName}*\n🔢 IMEI: *${imei}*\n📅 تاریخ خریداری: *${saleDateStr}*\n🛡️ وارنٹی سٹیٹس: *${urduWarrantyStatus}*\n\nشکریہ!\n*${urduShopName}*`;

  if (formattedPhone) {
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
};


