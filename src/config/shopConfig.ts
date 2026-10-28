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

export const getWhatsAppKhataUrl = (
  phone: string | undefined,
  customerName: string,
  balance: number,
  type: 'receivable' | 'payable' = 'receivable'
): string => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  const message = type === 'receivable'
    ? `السلام علیکم ${customerName || 'صاحب'}،\n\nارشد موبائل زون (AMZ) باڑہ بازار خیبر کی طرف سے آپ کا کل بقایا (ادھار): *Rs. ${balance.toLocaleString()}* واجب الادا ہے۔\n\nبرائے مہربانی اپنا بقایا جلد از جلد ادا فرما دیں۔\n\nشکریہ!\n*ارشد موبائل زون (AMZ)*\nباڑہ بازار، خیبر`
    : `السلام علیکم ${customerName || 'صاحب'}،\n\nارشد موبائل زون (AMZ) کے پاس آپ کی جمع شدہ رقم: *Rs. ${balance.toLocaleString()}* ہے۔\n\nشکریہ!\n*ارشد موبائل زون (AMZ)*`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
};

export const getWhatsAppTransactionUrl = (
  phone: string | undefined,
  customerName: string,
  txType: 'udhar' | 'wasooli',
  amount: number,
  description?: string,
  runningBalance?: number,
  dateStr?: string
): string => {
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  const typeUrdu = txType === 'udhar' ? 'ادھار دیا گیا (Udhar)' : 'وصولی موصول ہوئی (Wasooli)';
  const dateFormatted = dateStr || new Date().toLocaleDateString('en-GB');

  let message = `السلام علیکم ${customerName || 'صاحب'}،\n\nارشد موبائل زون (AMZ) باڑہ بازار کی طرف سے آپ کی ٹرانزیکشن کا اندراج:\n\n📅 تاریخ: *${dateFormatted}*\n📌 نوعیت: *${typeUrdu}*\n💰 رقم: *Rs. ${(amount || 0).toLocaleString()}*`;
  
  if (description) {
    message += `\n📝 تفصیل: ${description}`;
  }
  
  if (runningBalance !== undefined && runningBalance !== null) {
    message += `\n\n📊 موجودہ کل بقایا: *Rs. ${runningBalance.toLocaleString()}*`;
  }

  message += `\n\nشکریہ!\n*ارشد موبائل زون (AMZ)*\nباڑہ بازار، خیبر`;

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
  if (!phone) return '#';
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? '92' + cleanPhone.slice(1) : cleanPhone;

  let msg = `السلام علیکم ${customerName || 'صاحب'}،\n\nارشد موبائل زون (AMZ) سے خریداری کا شکریہ!\n\n📱 موبائل/آئٹم: *${itemName}*`;
  if (imei1) {
    msg += `\n🔢 IMEI: ${imei1}`;
  }
  msg += `\n💵 قیمت: *Rs. ${(sellPrice || 0).toLocaleString()}*`;
  msg += `\n💳 طریقہ ادائیگی: *${paymentMethod || 'Cash'}*`;
  if (billNumber) {
    msg += `\n🧾 بل نمبر: *${billNumber}*`;
  }
  msg += `\n\nکسی بھی معلومات یا سروس کے لیے رابطہ فرمائیں۔\n*ارشد موبائل زون (AMZ)*\nباڑہ بازار، خیبر`;

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}`;
};
