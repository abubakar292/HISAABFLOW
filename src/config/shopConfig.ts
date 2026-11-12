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
 * Dictionary of common Pakistani mobile shop words, names, and locations
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
  communication: 'کمیونیکیشن',
  communications: 'کمیونیکیشنز',
  electronics: 'الیکٹرانکس',
  electronic: 'الیکٹرانک',
  accessories: 'ایکسیسریز',
  computers: 'کمپیوٹرز',
  computer: 'کمپیوٹر',
  cell: 'سیل',
  cellular: 'سیلولر',
  traders: 'ٹریڈرز',
  trader: 'ٹریڈر',
  trading: 'ٹریڈنگ',
  enterprises: 'انٹرپرائزز',
  enterprise: 'انٹرپرائز',
  brothers: 'برادرز',
  bros: 'برادرز',
  sons: 'سنز',
  links: 'لنکس',
  link: 'لنک',
  hub: 'ہب',
  world: 'ورلڈ',
  city: 'سٹی',
  palace: 'پیلس',
  house: 'ہاؤس',
  corner: 'کارنر',
  gallery: 'گیلری',
  care: 'کیئر',
  repair: 'ریپئرنگ',
  repairing: 'ریپئرنگ',
  lab: 'لیب',
  tech: 'ٹیک',
  technology: 'ٹیکنالوجی',
  digital: 'ڈیجیٹل',
  smart: 'سمارٹ',
  phone: 'فون',
  phones: 'فونز',
  apple: 'ایپل',
  iphone: 'آئی فون',
  samsung: 'سام سنگ',
  vivo: 'ویوو',
  oppo: 'اوپو',
  xiaomi: 'شاؤمی',
  redmi: 'ریڈمی',
  infinix: 'انفینکس',
  tecno: 'ٹیکنو',
  realme: 'ریئل می',
  nokia: 'نوکیا',
  new: 'نیو',
  pak: 'پاک',
  pakistan: 'پاکستان',
  national: 'نیشنل',
  royal: 'رائل',
  star: 'سٹار',
  super: 'سپر',
  golden: 'گولڈن',
  prime: 'پرائم',
  best: 'بیسٹ',
  top: 'ٹاپ',
  express: 'ایکسپریس',
  global: 'گلوبل',
  modern: 'ماڈرن',
  friends: 'فرینڈز',
  united: 'یونائیٹڈ',
  asia: 'ایشیا',
  and: 'اینڈ',
  '&': 'اینڈ',

  // Common Islamic / Shop & Owner Names
  al: 'ال',
  ul: 'ال',
  madina: 'مدینہ',
  madeena: 'مدینہ',
  almadina: 'المدینہ',
  makkah: 'مکہ',
  makka: 'مکہ',
  mecca: 'مکہ',
  almakkah: 'المکہ',
  haram: 'حرم',
  bismillah: 'بسم اللہ',
  mashallah: 'ماشاءاللہ',
  subhanallah: 'سبحان اللہ',
  alhamdulillah: 'الحمدللہ',
  allah: 'اللہ',
  rehman: 'رحمان',
  rahman: 'رحمان',
  raheem: 'رحیم',
  rahim: 'رحیم',
  karim: 'کریم',
  kareem: 'کریم',
  ghani: 'غنی',
  razzaq: 'رزاق',
  wahab: 'وہاب',
  fattah: 'فتاح',
  noor: 'نور',
  jannat: 'جنت',
  firdous: 'فردوس',
  madni: 'مدنی',
  madani: 'مدنی',
  chishti: 'چشتی',
  qadri: 'قادری',
  jilani: 'جیلانی',
  gillani: 'گیلانی',
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
  umar: 'عمر',
  omer: 'عمر',
  usman: 'عثمان',
  osman: 'عثمان',
  abubakar: 'ابوبکر',
  bilal: 'بلال',
  arshad: 'ارشد',
  rashid: 'راشد',
  shahid: 'شاہد',
  zahid: 'زاہد',
  abid: 'عابد',
  sajid: 'ساجد',
  majid: 'ماجد',
  wajid: 'واجد',
  khalid: 'خالد',
  tariq: 'طارق',
  tahir: 'طاہر',
  zahir: 'ظاہر',
  nasir: 'ناصر',
  yasir: 'یاسر',
  qasim: 'قاسم',
  asim: 'عاصم',
  atif: 'عاطف',
  asif: 'آصف',
  kashif: 'کاشف',
  saqib: 'ثاقب',
  aqib: 'عاقب',
  talha: 'طلحہ',
  zubair: 'زبیر',
  uzair: 'عزیر',
  umair: 'عمیر',
  junaid: 'جنید',
  awais: 'اویس',
  owais: 'اویس',
  anas: 'انس',
  saad: 'سعد',
  fahad: 'فہد',
  asad: 'اسد',
  zain: 'زین',
  zaid: 'زید',
  haris: 'حارث',
  farhan: 'فرحان',
  imran: 'عمران',
  kamran: 'کامران',
  adnan: 'عدنان',
  salman: 'سلمان',
  sulaiman: 'سلیمان',
  suleman: 'سلیمان',
  noman: 'نعمان',
  nauman: 'نعمان',
  rizwan: 'رضوان',
  irfan: 'عرفان',
  zeeshan: 'ذیشان',
  zishan: 'ذیشان',
  faizan: 'فیضان',
  sufyan: 'سفیان',
  sufiyan: 'سفیان',
  rehan: 'ریحان',
  burhan: 'برہان',
  arslan: 'ارسلان',
  arsalan: 'ارسلان',
  danish: 'دانش',
  tabish: 'تابش',
  waqas: 'وقاص',
  waqar: 'وقار',
  abrar: 'ابرار',
  israr: 'اسرار',
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
  kabir: 'کبیر',
  kabeer: 'کبیر',
  amir: 'عامر',
  aamir: 'عامر',
  samir: 'سمیر',
  sameer: 'سمیر',
  javid: 'جاوید',
  javed: 'جاوید',
  javaid: 'جاوید',
  parvez: 'پرویز',
  pervez: 'پرویز',
  naveed: 'نوید',
  navid: 'نوید',
  waleed: 'ولید',
  walid: 'ولید',
  hameed: 'حمید',
  hamid: 'حامد',
  saeed: 'سعید',
  fareed: 'فرید',
  farid: 'فرید',
  waheed: 'وحید',
  rasheed: 'رشید',
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
  saleem: 'سلیم',
  salim: 'سلیم',
  kaleem: 'کلیم',
  kalim: 'کلیم',
  nadeem: 'ندیم',
  nadim: 'ندیم',
  waseem: 'وسیم',
  wasim: 'وسیم',
  naeem: 'نعیم',
  naim: 'نعیم',
  azeem: 'عظیم',
  azim: 'عظیم',
  faheem: 'فہیم',
  fahim: 'فہیم',
  naseem: 'نسیم',
  iqbal: 'اقبال',
  afzal: 'افضل',
  ajmal: 'اجمل',
  akmal: 'اکمل',
  faisal: 'فیصل',
  sohail: 'سہیل',
  suhail: 'سہیل',
  tufail: 'طفیل',
  sharjeel: 'شرجیل',
  haseeb: 'حسیب',
  muneeb: 'منیب',
  habib: 'حبیب',
  habeeb: 'حبیب',
  najeeb: 'نجیب',
  tayyab: 'طیب',
  azam: 'اعظم',
  akram: 'اکرم',
  aslam: 'اسلم',
  akhtar: 'اختر',
  anwar: 'انور',
  azhar: 'اظہر',
  mazhar: 'مظہر',
  sikandar: 'سکندر',
  babar: 'بابر',
  sarwar: 'سرور',
  safdar: 'صفدر',
  muzaffar: 'مظفر',
  mudassar: 'مدثر',
  mudassir: 'مدثر',
  mubashir: 'مبشر',
  muzammil: 'مزمل',
  hashim: 'ہاشم',
  altaf: 'الطاف',
  ashraf: 'اشرف',
  yousaf: 'یوسف',
  yousuf: 'یوسف',
  yusuf: 'یوسف',
  younas: 'یونس',
  younis: 'یونس',
  yaqoob: 'یعقوب',
  ayub: 'ایوب',
  haroon: 'ہارون',
  dawood: 'داؤد',
  ibrahim: 'ابراہیم',
  ismail: 'اسماعیل',
  ishaq: 'اسحاق',
  ilyas: 'الیاس',
  idrees: 'ادریس',
  isa: 'عیسیٰ',
  musa: 'موسیٰ',
  yahya: 'یحییٰ',
  zakariya: 'زکریا',
  luqman: 'لقمان',
  sajjad: 'سجاد',
  fawad: 'فواد',
  jawad: 'جواد',
  hammad: 'حماد',
  murad: 'مراد',
  ziyad: 'زیاد',
  shahzad: 'شہزاد',
  shehzad: 'شہزاد',
  azad: 'آزاد',
  dilshad: 'دلشاد',
  irshad: 'ارشاد',
  nawaz: 'نواز',
  shahbaz: 'شہباز',
  shehbaz: 'شہباز',
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
  khan: 'خان',
  shah: 'شاہ',
  malik: 'ملک',
  sheikh: 'شیخ',
  shaikh: 'شیخ',
  chaudhry: 'چوہدری',
  choudhary: 'چوہدری',
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
  butt: 'بٹ',
  dar: 'ڈار',
  mir: 'میر',
  bhatti: 'بھٹی',
  rana: 'رانا',
  rao: 'راؤ',
  cheema: 'چیمہ',
  bajwa: 'باجوہ',
  gill: 'گل',
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
  lodhi: 'لودھی',
  syed: 'سید',
  sayed: 'سید',
  pir: 'پیر',
  peer: 'پیر',
  mian: 'میاں',
  haji: 'حاجی',
  hafiz: 'حافظ',
  qari: 'قاری',
  sardar: 'سردار',
  nawab: 'نواب',
  arbaz: 'ارباز',
  huzaifa: 'حذیفہ',
  usama: 'اسامہ',
  osama: 'اسامہ',
  sohaib: 'صہیب',
  zohaib: 'زوہیب',
  shoaib: 'شعیب',
  ata: 'عطا',
  atta: 'عطا',

  // Cities & Places
  khyber: 'خیبر',
  bara: 'باڑہ',
  peshawar: 'پشاور',
  lahore: 'لاہور',
  karachi: 'کراچی',
  islamabad: 'اسلام آباد',
  rawalpindi: 'راولپنڈی',
  multan: 'ملتان',
  faisalabad: 'فیصل آباد',
  quetta: 'کوئٹہ',
  mardan: 'مردان',
  swat: 'سوات',
  kohat: 'کوہاٹ',
  bannu: 'بنوں',
  chaman: 'چمن',
  gujranwala: 'گوجرانوالہ',
  sialkot: 'سیالکوٹ',
  abbottabad: 'ایبٹ آباد',
  nowshera: 'نوشہرہ',
  charsadda: 'چارسدہ',
  hangu: 'ہنگو',
  landikotal: 'لنڈی کوتل',
  jamrud: 'جمرود',
};

/**
 * Phonetic English-to-Urdu script transliterator for any custom word not in URDU_WORD_MAP.
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

  let s = lower;
  let out = '';
  let i = 0;

  while (i < s.length) {
    const rem = s.slice(i);

    if (rem.startsWith('sh')) {
      out += 'ش';
      i += 2;
    } else if (rem.startsWith('ch')) {
      out += 'چ';
      i += 2;
    } else if (rem.startsWith('kh')) {
      out += 'خ';
      i += 2;
    } else if (rem.startsWith('gh')) {
      out += 'غ';
      i += 2;
    } else if (rem.startsWith('ph')) {
      out += 'ف';
      i += 2;
    } else if (rem.startsWith('th')) {
      out += 'تھ';
      i += 2;
    } else if (rem.startsWith('dh')) {
      out += 'دھ';
      i += 2;
    } else if (rem.startsWith('bh')) {
      out += 'بھ';
      i += 2;
    } else if (rem.startsWith('zh')) {
      out += 'ژ';
      i += 2;
    } else if (rem.startsWith('ck')) {
      out += 'ک';
      i += 2;
    } else if (rem.startsWith('qu')) {
      out += 'کو';
      i += 2;
    } else if (rem.startsWith('aa')) {
      out += i === 0 ? 'آ' : 'ا';
      i += 2;
    } else if (rem.startsWith('ee') || rem.startsWith('ea')) {
      out += 'ی';
      i += 2;
    } else if (rem.startsWith('oo') || rem.startsWith('ou')) {
      out += 'و';
      i += 2;
    } else if (rem.startsWith('ai') || rem.startsWith('ay')) {
      out += 'ے';
      i += 2;
    } else {
      const ch = s[i];
      switch (ch) {
        case 'a':
          out += i === 0 ? 'ا' : 'ا';
          break;
        case 'b':
          out += 'ب';
          break;
        case 'c':
          out += 'ک';
          break;
        case 'd':
          out += 'ڈ';
          break;
        case 'e':
          out += i === 0 ? 'اے' : 'ی';
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
        case 'i':
          out += i === 0 ? 'آئی' : 'ی';
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
        case 'o':
          out += i === 0 ? 'او' : 'و';
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
          out += 'ٹ';
          break;
        case 'u':
          out += i === 0 ? 'ا' : 'و';
          break;
        case 'v':
        case 'w':
          out += 'و';
          break;
        case 'x':
          out += 'یکس';
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
  }

  return out;
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

  // If already written in Urdu script, return as-is
  if (/[\u0600-\u06FF]/.test(raw)) {
    return raw;
  }

  // Split on spaces and hyphens while converting each word into Urdu
  const words = raw
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return 'موبائل شاپ';

  const urduWords = words.map((w) => {
    const cleanWord = w.replace(/[^a-zA-Z0-9&\u0600-\u06FF]/g, '');
    if (!cleanWord) return '';
    return transliterateWordToUrdu(cleanWord);
  }).filter(Boolean);

  return urduWords.join(' ') || raw;
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

  const message = type === 'receivable'
    ? `السلام علیکم ${customerName || 'صاحب'}،\n\n${urduShopName} کی طرف سے آپ کا کل بقایا (ادھار): *Rs. ${balance.toLocaleString()}* واجب الادا ہے۔\n\nبرائے مہربانی اپنا بقایا جلد از جلد ادا فرما دیں۔\n\nشکریہ!\n*${urduShopName}*`
    : `السلام علیکم ${customerName || 'صاحب'}،\n\n${urduShopName} کے پاس آپ کی جمع شدہ رقم: *Rs. ${balance.toLocaleString()}* ہے۔\n\nشکریہ!\n*${urduShopName}*`;

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
  const typeUrdu = txType === 'udhar' ? 'ادھار دیا گیا (Udhar)' : 'وصولی موصول ہوئی (Wasooli)';
  const dateFormatted = dateStr || new Date().toLocaleDateString('en-GB');

  let message = `السلام علیکم ${customerName || 'صاحب'}،\n\n${urduShopName} کی طرف سے آپ کی ٹرانزیکشن کا اندراج:\n\n📅 تاریخ: *${dateFormatted}*\n📌 نوعیت: *${typeUrdu}*\n💰 رقم: *Rs. ${(amount || 0).toLocaleString()}*`;
  
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
  billNumber?: string
): string => {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  let msg = `السلام علیکم ${customerName || 'صاحب'}،\n\nخریداری کا شکریہ!\n\n📱 موبائل/آئٹم: *${itemName}*`;
  if (imei1) {
    msg += `\n🔢 IMEI: ${imei1}`;
  }
  msg += `\n💵 قیمت: *Rs. ${(Number(sellPrice) || 0).toLocaleString()}*`;
  msg += `\n💳 طریقہ ادائیگی: *${paymentMethod || 'Cash'}*`;
  if (billNumber) {
    msg += `\n🧾 بل نمبر: *${billNumber}*`;
  }
  msg += `\n\nکسی بھی معلومات یا سروس کے لیے رابطہ فرمائیں۔`;

  if (formattedPhone) {
    return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
  }
  return `https://wa.me/?text=${encodeURIComponent(msg)}`;
};
