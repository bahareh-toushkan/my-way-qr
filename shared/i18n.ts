// 휴대폰 앱의 고정 문구(메뉴 이름이 아닌 틀 문구). 메뉴 내용은 AI가 프로필 언어로 바꾼다.
import type { Lang } from './types.js';

export interface UiStrings {
  appName: string;
  loadingFirst: string;
  badgeAi: string;
  badgeFallback: string;
  callStaff: string;
  staffCalled: string;
  listen: string;
  settings: string;
  showMore: string; // {n}
  total: string;
  cartEmpty: string;
  added: string; // {name}
  steps: [string, string, string, string];
  orderNo: string;
  chooseWhereFirst: string;
  qty: string;
  allergens: string;
  noExtra: string;
  connected: string;
  sessionGone: string;
  payMock: string;
  retrying: string;
  setupTitle: string;
  setupPrivacy: string;
  langQ: string;
  textQ: string;
  textOpts: [string, string, string];
  touchQ: string;
  touchOpts: [string, string];
  wordsQ: string;
  wordsOpts: [string, string];
  detailQ: string;
  detailOpts: [string, string];
  voiceQ: string;
  voiceOpts: [string, string];
  contrastQ: string;
  contrastOpts: [string, string];
  quickQ: string;
  presets: Record<'see' | 'slow' | 'listen' | 'hands', string>;
  sayItLabel: string;
  sayItPlaceholder: string;
  sayItButton: string;
  sayItWorking: string;
  start: string;
  guides: Record<'menu' | 'options' | 'cart' | 'pay' | 'done', string>;
  sections: Record<'controls' | 'lines' | 'where' | 'payMethod' | 'qty', string>;
}

const ko: UiStrings = {
  appName: '내 방식 주문',
  loadingFirst: '내 방식 화면을 만드는 중이에요… (처음 한 번만 조금 걸려요)',
  badgeAi: 'AI가 내 방식으로 바꾼 화면 · 검사 통과',
  badgeFallback: '간단 화면 (AI 대신 규칙으로 만든 화면)',
  callStaff: '직원 호출',
  staffCalled: '직원에게 알렸어요. 잠시만 기다려 주세요.',
  listen: '읽어 주기',
  settings: '내 방식 바꾸기',
  showMore: '더 보기 ({n}개 더)',
  total: '합계',
  cartEmpty: '아직 고른 것이 없어요',
  added: '담았어요: {name}',
  steps: ['고르기', '옵션', '확인', '결제'],
  orderNo: '주문번호',
  chooseWhereFirst: '먼저 매장에서 먹을지, 포장할지 골라 주세요',
  qty: '수량',
  allergens: '알레르기 정보',
  noExtra: '추가 요금 없음',
  connected: '키오스크와 연결됨',
  sessionGone: '연결이 끝났어요. 키오스크의 QR을 다시 찍어 주세요.',
  payMock: '시연용 결제예요. 실제로 돈이 나가지 않아요.',
  retrying: '잠시 연결이 불안정해요. 다시 해 볼게요.',
  setupTitle: '어떻게 보여 드릴까요?',
  setupPrivacy: '이 설정은 내 휴대폰에만 저장돼요. 이름이나 장애 정보는 묻지 않아요.',
  langQ: '언어',
  textQ: '글씨 크기',
  textOpts: ['보통', '크게', '아주 크게'],
  touchQ: '버튼 크기',
  touchOpts: ['보통', '크게'],
  wordsQ: '말',
  wordsOpts: ['보통 말', '쉬운 말'],
  detailQ: '설명',
  detailOpts: ['짧게', '자세히 하나씩'],
  voiceQ: '소리로 읽어 주기',
  voiceOpts: ['끄기', '켜기'],
  contrastQ: '화면 색',
  contrastOpts: ['보통', '진하게 (고대비)'],
  quickQ: '빠르게 고르기',
  presets: { see: '글씨가 잘 안 보여요', slow: '천천히 하나씩 하고 싶어요', listen: '소리로 듣고 싶어요', hands: '작은 버튼은 누르기 어려워요' },
  sayItLabel: '말로 알려 주세요 (선택)',
  sayItPlaceholder: '예: 글씨가 작아서 잘 안 보이고, 영어가 편해요',
  sayItButton: 'AI로 설정하기',
  sayItWorking: 'AI가 설정을 고르는 중…',
  start: '이 방식으로 시작',
  guides: {
    menu: '드실 것을 골라 주세요.',
    options: '원하는 것을 고르고 담기를 눌러 주세요.',
    cart: '주문을 확인해 주세요.',
    pay: '매장/포장을 고르고 결제 방법을 골라 주세요.',
    done: '주문번호는 {orderNo}번이에요. 준비되면 불러 드릴게요.',
  },
  sections: { controls: '다른 버튼', lines: '주문 고치기', where: '드시는 곳', payMethod: '결제 방법', qty: '수량' },
};

const en: UiStrings = {
  appName: 'Order My Way',
  loadingFirst: 'Making the screen your way… (only slow the first time)',
  badgeAi: 'Adapted by AI for you · checks passed',
  badgeFallback: 'Simple screen (made by rules instead of AI)',
  callStaff: 'Call staff',
  staffCalled: 'Staff has been notified. Please wait a moment.',
  listen: 'Read aloud',
  settings: 'Change my way',
  showMore: 'Show more ({n} more)',
  total: 'Total',
  cartEmpty: 'Nothing chosen yet',
  added: 'Added: {name}',
  steps: ['Choose', 'Options', 'Check', 'Pay'],
  orderNo: 'Order number',
  chooseWhereFirst: 'First choose eat here or take out',
  qty: 'Quantity',
  allergens: 'Allergy info',
  noExtra: 'No extra charge',
  connected: 'Connected to the kiosk',
  sessionGone: 'The connection ended. Please scan the QR on the kiosk again.',
  payMock: 'Demo payment. No real money is charged.',
  retrying: 'Connection is unstable. Trying again.',
  setupTitle: 'How should we show things?',
  setupPrivacy: 'These settings stay on your phone only. We never ask your name or disability.',
  langQ: 'Language',
  textQ: 'Text size',
  textOpts: ['Normal', 'Large', 'Extra large'],
  touchQ: 'Button size',
  touchOpts: ['Normal', 'Large'],
  wordsQ: 'Wording',
  wordsOpts: ['Normal', 'Easy words'],
  detailQ: 'Explanations',
  detailOpts: ['Short', 'Step by step'],
  voiceQ: 'Read aloud',
  voiceOpts: ['Off', 'On'],
  contrastQ: 'Colors',
  contrastOpts: ['Normal', 'High contrast'],
  quickQ: 'Quick choices',
  presets: { see: 'I can’t see small text', slow: 'One step at a time', listen: 'I want to hear it', hands: 'Small buttons are hard to press' },
  sayItLabel: 'Tell us in your words (optional)',
  sayItPlaceholder: 'e.g. Text is too small and I prefer English',
  sayItButton: 'Set up with AI',
  sayItWorking: 'AI is choosing settings…',
  start: 'Start this way',
  guides: {
    menu: 'Please choose what you’d like.',
    options: 'Choose your options, then press add.',
    cart: 'Please check your order.',
    pay: 'Choose eat here or take out, then a payment method.',
    done: 'Your order number is {orderNo}. We will call you when it’s ready.',
  },
  sections: { controls: 'Other buttons', lines: 'Change your order', where: 'Where you eat', payMethod: 'Payment method', qty: 'Quantity' },
};

const zh: UiStrings = {
  appName: '按我的方式点餐',
  loadingFirst: '正在按您的方式生成界面…（只有第一次会慢一点）',
  badgeAi: 'AI 已按您的方式调整 · 检查通过',
  badgeFallback: '简易界面（由规则生成，而非 AI）',
  callStaff: '呼叫店员',
  staffCalled: '已通知店员，请稍等。',
  listen: '朗读',
  settings: '更改我的方式',
  showMore: '查看更多（还有 {n} 个）',
  total: '合计',
  cartEmpty: '还没有选择',
  added: '已加入：{name}',
  steps: ['选择', '选项', '确认', '付款'],
  orderNo: '订单号',
  chooseWhereFirst: '请先选择堂食或外带',
  qty: '数量',
  allergens: '过敏信息',
  noExtra: '不加价',
  connected: '已连接自助点餐机',
  sessionGone: '连接已结束。请重新扫描点餐机上的二维码。',
  payMock: '演示付款，不会真的扣款。',
  retrying: '连接不稳定，正在重试。',
  setupTitle: '您希望怎样显示？',
  setupPrivacy: '这些设置只保存在您的手机上。我们不会询问姓名或残障信息。',
  langQ: '语言',
  textQ: '字体大小',
  textOpts: ['普通', '大', '特大'],
  touchQ: '按钮大小',
  touchOpts: ['普通', '大'],
  wordsQ: '用语',
  wordsOpts: ['普通', '简单易懂'],
  detailQ: '说明',
  detailOpts: ['简短', '一步一步详细'],
  voiceQ: '朗读',
  voiceOpts: ['关', '开'],
  contrastQ: '颜色',
  contrastOpts: ['普通', '高对比度'],
  quickQ: '快速选择',
  presets: { see: '小字看不清', slow: '想一步一步来', listen: '想听语音', hands: '小按钮很难按' },
  sayItLabel: '用自己的话告诉我们（可选）',
  sayItPlaceholder: '例如：字太小，我更习惯中文',
  sayItButton: '用 AI 设置',
  sayItWorking: 'AI 正在选择设置…',
  start: '用这个方式开始',
  guides: {
    menu: '请选择您想要的。',
    options: '请选择选项，然后按加入。',
    cart: '请确认您的订单。',
    pay: '请选择堂食或外带，再选择付款方式。',
    done: '您的订单号是 {orderNo}。做好后会叫您。',
  },
  sections: { controls: '其他按钮', lines: '修改订单', where: '用餐方式', payMethod: '付款方式', qty: '数量' },
};

const vi: UiStrings = {
  appName: 'Gọi món theo cách của tôi',
  loadingFirst: 'Đang tạo màn hình theo cách của bạn… (chỉ chậm lần đầu)',
  badgeAi: 'AI đã điều chỉnh cho bạn · đã kiểm tra',
  badgeFallback: 'Màn hình đơn giản (tạo bằng quy tắc, không phải AI)',
  callStaff: 'Gọi nhân viên',
  staffCalled: 'Đã báo nhân viên. Vui lòng chờ một chút.',
  listen: 'Đọc to',
  settings: 'Đổi cách hiển thị',
  showMore: 'Xem thêm (còn {n})',
  total: 'Tổng',
  cartEmpty: 'Chưa chọn món nào',
  added: 'Đã thêm: {name}',
  steps: ['Chọn', 'Tùy chọn', 'Kiểm tra', 'Thanh toán'],
  orderNo: 'Số đơn',
  chooseWhereFirst: 'Hãy chọn ăn tại chỗ hay mang đi trước',
  qty: 'Số lượng',
  allergens: 'Thông tin dị ứng',
  noExtra: 'Không tính thêm',
  connected: 'Đã kết nối với máy gọi món',
  sessionGone: 'Kết nối đã kết thúc. Hãy quét lại mã QR trên máy.',
  payMock: 'Thanh toán thử. Không trừ tiền thật.',
  retrying: 'Kết nối không ổn định. Đang thử lại.',
  setupTitle: 'Bạn muốn hiển thị như thế nào?',
  setupPrivacy: 'Cài đặt chỉ lưu trên điện thoại của bạn. Chúng tôi không hỏi tên hay tình trạng khuyết tật.',
  langQ: 'Ngôn ngữ',
  textQ: 'Cỡ chữ',
  textOpts: ['Thường', 'Lớn', 'Rất lớn'],
  touchQ: 'Cỡ nút',
  touchOpts: ['Thường', 'Lớn'],
  wordsQ: 'Cách nói',
  wordsOpts: ['Thường', 'Từ dễ hiểu'],
  detailQ: 'Giải thích',
  detailOpts: ['Ngắn', 'Từng bước'],
  voiceQ: 'Đọc to',
  voiceOpts: ['Tắt', 'Bật'],
  contrastQ: 'Màu sắc',
  contrastOpts: ['Thường', 'Tương phản cao'],
  quickQ: 'Chọn nhanh',
  presets: { see: 'Tôi khó nhìn chữ nhỏ', slow: 'Từng bước một', listen: 'Tôi muốn nghe', hands: 'Nút nhỏ khó bấm' },
  sayItLabel: 'Hãy nói bằng lời của bạn (tùy chọn)',
  sayItPlaceholder: 'Ví dụ: Chữ quá nhỏ, tôi thích tiếng Việt',
  sayItButton: 'Cài đặt bằng AI',
  sayItWorking: 'AI đang chọn cài đặt…',
  start: 'Bắt đầu theo cách này',
  guides: {
    menu: 'Hãy chọn món bạn muốn.',
    options: 'Chọn tùy chọn rồi bấm thêm.',
    cart: 'Hãy kiểm tra đơn của bạn.',
    pay: 'Chọn ăn tại chỗ hoặc mang đi, rồi chọn cách thanh toán.',
    done: 'Số đơn của bạn là {orderNo}. Khi xong chúng tôi sẽ gọi bạn.',
  },
  sections: { controls: 'Nút khác', lines: 'Sửa đơn', where: 'Nơi ăn', payMethod: 'Cách thanh toán', qty: 'Số lượng' },
};

const fa: UiStrings = {
  appName: 'سفارش به روش من',
  loadingFirst: 'در حال ساختن صفحه به روش شما… (فقط بار اول کمی طول می‌کشد)',
  badgeAi: 'هوش مصنوعی صفحه را برای شما تنظیم کرد · بررسی شد',
  badgeFallback: 'صفحهٔ ساده (ساخته‌شده با قاعده، نه هوش مصنوعی)',
  callStaff: 'صدا زدن کارمند',
  staffCalled: 'به کارمند خبر دادیم. لطفاً کمی صبر کنید.',
  listen: 'بلند بخوان',
  settings: 'تغییر روش من',
  showMore: 'بیشتر ({n} مورد دیگر)',
  total: 'جمع',
  cartEmpty: 'هنوز چیزی انتخاب نکرده‌اید',
  added: 'اضافه شد: {name}',
  steps: ['انتخاب', 'گزینه‌ها', 'بررسی', 'پرداخت'],
  orderNo: 'شمارهٔ سفارش',
  chooseWhereFirst: 'اول انتخاب کنید اینجا می‌خورید یا بیرون می‌برید',
  qty: 'تعداد',
  allergens: 'اطلاعات حساسیت',
  noExtra: 'بدون هزینهٔ اضافه',
  connected: 'به کیوسک وصل است',
  sessionGone: 'اتصال تمام شد. لطفاً دوباره کد QR روی کیوسک را اسکن کنید.',
  payMock: 'پرداخت نمایشی است. پولی کم نمی‌شود.',
  retrying: 'اتصال ناپایدار است. دوباره تلاش می‌کنیم.',
  setupTitle: 'چطور برایتان نمایش بدهیم؟',
  setupPrivacy: 'این تنظیمات فقط روی گوشی شما ذخیره می‌شود. نام یا اطلاعات معلولیت پرسیده نمی‌شود.',
  langQ: 'زبان',
  textQ: 'اندازهٔ نوشته',
  textOpts: ['معمولی', 'بزرگ', 'خیلی بزرگ'],
  touchQ: 'اندازهٔ دکمه',
  touchOpts: ['معمولی', 'بزرگ'],
  wordsQ: 'زبان گفتار',
  wordsOpts: ['معمولی', 'کلمات ساده'],
  detailQ: 'توضیح',
  detailOpts: ['کوتاه', 'قدم به قدم'],
  voiceQ: 'بلند خواندن',
  voiceOpts: ['خاموش', 'روشن'],
  contrastQ: 'رنگ صفحه',
  contrastOpts: ['معمولی', 'کنتراست بالا'],
  quickQ: 'انتخاب سریع',
  presets: { see: 'نوشتهٔ کوچک را خوب نمی‌بینم', slow: 'قدم به قدم', listen: 'می‌خواهم بشنوم', hands: 'زدن دکمه‌های کوچک سخت است' },
  sayItLabel: 'با زبان خودتان بگویید (اختیاری)',
  sayItPlaceholder: 'مثلاً: نوشته‌ها خیلی کوچک است و فارسی راحت‌ترم',
  sayItButton: 'تنظیم با هوش مصنوعی',
  sayItWorking: 'هوش مصنوعی در حال انتخاب تنظیمات است…',
  start: 'با همین روش شروع کن',
  guides: {
    menu: 'لطفاً چیزی را که می‌خواهید انتخاب کنید.',
    options: 'گزینه‌ها را انتخاب کنید و «اضافه کن» را بزنید.',
    cart: 'لطفاً سفارشتان را بررسی کنید.',
    pay: 'اول محل خوردن و بعد روش پرداخت را انتخاب کنید.',
    done: 'شمارهٔ سفارش شما {orderNo} است. وقتی آماده شد صدایتان می‌کنیم.',
  },
  sections: { controls: 'دکمه‌های دیگر', lines: 'تغییر سفارش', where: 'محل خوردن', payMethod: 'روش پرداخت', qty: 'تعداد' },
};

export const UI: Record<Lang, UiStrings> = { ko, en, zh, vi, fa };

export function t(lang: Lang): UiStrings {
  return UI[lang] ?? ko;
}

export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** 알레르기 성분 이름 (매장 데이터는 한국어 → 표시 언어로) */
const ALLERGEN_NAMES: Record<string, Record<Lang, string>> = {
  우유: { ko: '우유', en: 'milk', zh: '牛奶', vi: 'sữa', fa: 'شیر' },
  대두: { ko: '대두', en: 'soy', zh: '大豆', vi: 'đậu nành', fa: 'سویا' },
  밀: { ko: '밀', en: 'wheat', zh: '小麦', vi: 'lúa mì', fa: 'گندم' },
  계란: { ko: '계란', en: 'egg', zh: '鸡蛋', vi: 'trứng', fa: 'تخم‌مرغ' },
  돼지고기: { ko: '돼지고기', en: 'pork', zh: '猪肉', vi: 'thịt heo', fa: 'گوشت خوک' },
  쇠고기: { ko: '쇠고기', en: 'beef', zh: '牛肉', vi: 'thịt bò', fa: 'گوشت گاو' },
  땅콩: { ko: '땅콩', en: 'peanut', zh: '花生', vi: 'đậu phộng', fa: 'بادام‌زمینی' },
  새우: { ko: '새우', en: 'shrimp', zh: '虾', vi: 'tôm', fa: 'میگو' },
};

export function allergenName(name: string, lang: Lang): string {
  return ALLERGEN_NAMES[name]?.[lang] ?? name;
}

/** 오른쪽→왼쪽 언어 */
export function isRtl(lang: Lang): boolean {
  return lang === 'fa';
}

/** 브라우저 음성 합성용 언어 태그 */
export const SPEECH_LANG: Record<Lang, string> = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', vi: 'vi-VN', fa: 'fa-IR' };
