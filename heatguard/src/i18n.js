// Worker-facing messages. The agent picks WHICH message to send; it never writes free text
// to workers. That keeps safety instructions consistent, short and reviewed.
//
// These are draft translations. Have a native speaker check each language before a pilot.

export const LANGUAGES = {
  en: { name: 'English', voice: 'en-US' },
  ar: { name: 'العربية', voice: 'ar-AE' },
  hi: { name: 'हिन्दी', voice: 'hi-IN' },
  ur: { name: 'اردو', voice: 'ur-PK' },
  ml: { name: 'മലയാളം', voice: 'ml-IN' },
  bn: { name: 'বাংলা', voice: 'bn-BD' },
  tl: { name: 'Tagalog', voice: 'fil-PH' },
  ta: { name: 'தமிழ்', voice: 'ta-IN' },
};

// Templates the live agent may choose. (shift_tomorrow is sent by the planner with times.)
export const TEMPLATES = ['risk_update', 'take_break', 'hydrate', 'stop_work', 'midday_break', 'checkin', 'checkin_thanks', 'first_aid_coming'];

const T = {
  en: {
    levels: ['Normal', 'Caution', 'High', 'Danger', 'Extreme'],
    shift_tomorrow: 'HeatGuard: Tomorrow your crew starts at {start} and finishes by {end}. Heavy work is planned for the cooler hours. Drink water before you come.',
    risk_update: 'HeatGuard: Heat risk is now {levelName}. Drink water every {water} minutes. Work {work} min, then rest {rest} min in the shade.',
    risk_normal: 'HeatGuard: Heat risk is normal. Keep drinking water every {water} minutes.',
    stop_work: 'HeatGuard: EXTREME heat. Stop heavy outdoor work now. Go to the shade or rest area and drink water.',
    midday_break: 'HeatGuard: Midday break. Outdoor work stops until 3:00 PM. Rest in the shade and drink water.',
    checkin: 'HeatGuard check-in: Are you OK? Reply 1 if OK, 2 if you feel unwell.',
    checkin_thanks: 'Thank you. Stay safe and keep drinking water.',
    first_aid_coming: 'Help is coming. Stop work, sit in the shade, and drink water slowly. Your supervisor has been told.',
    take_break: 'HeatGuard: Take a {rest}-minute break in the shade now and drink water.',
    hydrate: 'HeatGuard: Drink a cup of water now.',
  },
  ar: {
    levels: ['طبيعي', 'حذر', 'مرتفع', 'خطر', 'شديد'],
    shift_tomorrow: 'HeatGuard: غدًا يبدأ فريقك العمل الساعة {start} وينتهي بحلول {end}. تم تخطيط العمل الشاق في الساعات الأبرد. اشرب الماء قبل أن تأتي.',
    risk_update: 'HeatGuard: مستوى خطر الحرارة الآن {levelName}. اشرب الماء كل {water} دقيقة. اعمل {work} دقيقة، ثم استرح {rest} دقيقة في الظل.',
    risk_normal: 'HeatGuard: مستوى خطر الحرارة طبيعي. استمر في شرب الماء كل {water} دقيقة.',
    stop_work: 'HeatGuard: حرارة شديدة. أوقف العمل الشاق في الخارج الآن. توجّه إلى الظل أو منطقة الراحة واشرب الماء.',
    midday_break: 'HeatGuard: استراحة منتصف النهار. يتوقف العمل في الخارج حتى الساعة 3:00 مساءً. استرح في الظل واشرب الماء.',
    checkin: 'HeatGuard: هل أنت بخير؟ أرسل 1 إذا كنت بخير، و2 إذا كنت تشعر بتعب.',
    checkin_thanks: 'شكرًا لك. ابقَ آمنًا واستمر في شرب الماء.',
    first_aid_coming: 'المساعدة في الطريق. أوقف العمل واجلس في الظل واشرب الماء ببطء. تم إبلاغ مشرفك.',
    take_break: 'HeatGuard: خذ استراحة {rest} دقيقة في الظل الآن واشرب الماء.',
    hydrate: 'HeatGuard: اشرب كوبًا من الماء الآن.',
  },
  hi: {
    levels: ['सामान्य', 'सावधान', 'अधिक', 'खतरा', 'अत्यधिक'],
    shift_tomorrow: 'HeatGuard: कल आपकी टीम {start} बजे काम शुरू करेगी और {end} तक खत्म करेगी। भारी काम ठंडे समय में रखा गया है। आने से पहले पानी पिएं।',
    risk_update: 'HeatGuard: गर्मी का खतरा अब {levelName} है। हर {water} मिनट में पानी पिएं। {work} मिनट काम करें, फिर {rest} मिनट छाया में आराम करें।',
    risk_normal: 'HeatGuard: गर्मी का खतरा सामान्य है। हर {water} मिनट में पानी पीते रहें।',
    stop_work: 'HeatGuard: अत्यधिक गर्मी। भारी बाहरी काम अभी बंद करें। छाया या आराम क्षेत्र में जाएं और पानी पिएं।',
    midday_break: 'HeatGuard: दोपहर का विश्राम। बाहरी काम दोपहर 3:00 बजे तक बंद है। छाया में आराम करें और पानी पिएं।',
    checkin: 'HeatGuard जांच: क्या आप ठीक हैं? ठीक हैं तो 1 भेजें, तबीयत खराब है तो 2 भेजें।',
    checkin_thanks: 'धन्यवाद। सुरक्षित रहें और पानी पीते रहें।',
    first_aid_coming: 'मदद आ रही है। काम रोकें, छाया में बैठें और धीरे-धीरे पानी पिएं। आपके सुपरवाइज़र को बता दिया गया है।',
    take_break: 'HeatGuard: अभी छाया में {rest} मिनट का आराम लें और पानी पिएं।',
    hydrate: 'HeatGuard: अभी एक कप पानी पिएं।',
  },
  ur: {
    levels: ['معمول', 'احتیاط', 'زیادہ', 'خطرہ', 'شدید'],
    shift_tomorrow: 'HeatGuard: کل آپ کی ٹیم {start} بجے کام شروع کرے گی اور {end} تک ختم کرے گی۔ بھاری کام ٹھنڈے اوقات میں رکھا گیا ہے۔ آنے سے پہلے پانی پئیں۔',
    risk_update: 'HeatGuard: گرمی کا خطرہ اب {levelName} ہے۔ ہر {water} منٹ بعد پانی پئیں۔ {work} منٹ کام کریں، پھر {rest} منٹ سائے میں آرام کریں۔',
    risk_normal: 'HeatGuard: گرمی کا خطرہ معمول کے مطابق ہے۔ ہر {water} منٹ بعد پانی پیتے رہیں۔',
    stop_work: 'HeatGuard: شدید گرمی۔ بھاری بیرونی کام ابھی بند کریں۔ سائے یا آرام کی جگہ پر جائیں اور پانی پئیں۔',
    midday_break: 'HeatGuard: دوپہر کا وقفہ۔ بیرونی کام سہ پہر 3:00 بجے تک بند ہے۔ سائے میں آرام کریں اور پانی پئیں۔',
    checkin: 'HeatGuard چیک اِن: کیا آپ ٹھیک ہیں؟ ٹھیک ہیں تو 1 بھیجیں، طبیعت خراب ہے تو 2 بھیجیں۔',
    checkin_thanks: 'شکریہ۔ محفوظ رہیں اور پانی پیتے رہیں۔',
    first_aid_coming: 'مدد آ رہی ہے۔ کام روکیں، سائے میں بیٹھیں اور آہستہ آہستہ پانی پئیں۔ آپ کے سپروائزر کو بتا دیا گیا ہے۔',
    take_break: 'HeatGuard: ابھی سائے میں {rest} منٹ کا وقفہ لیں اور پانی پئیں۔',
    hydrate: 'HeatGuard: ابھی ایک کپ پانی پئیں۔',
  },
  ml: {
    levels: ['സാധാരണ', 'ജാഗ്രത', 'ഉയർന്നത്', 'അപകടം', 'അതികഠിനം'],
    shift_tomorrow: 'HeatGuard: നാളെ നിങ്ങളുടെ ടീം {start}-ന് ജോലി തുടങ്ങി {end}-ഓടെ അവസാനിപ്പിക്കും. കഠിനമായ ജോലി ചൂട് കുറഞ്ഞ സമയത്താണ് ക്രമീകരിച്ചിരിക്കുന്നത്. വരുന്നതിന് മുമ്പ് വെള്ളം കുടിക്കുക.',
    risk_update: 'HeatGuard: ചൂടിന്റെ അപകടസാധ്യത ഇപ്പോൾ {levelName} ആണ്. ഓരോ {water} മിനിറ്റിലും വെള്ളം കുടിക്കുക. {work} മിനിറ്റ് ജോലി ചെയ്ത ശേഷം {rest} മിനിറ്റ് തണലിൽ വിശ്രമിക്കുക.',
    risk_normal: 'HeatGuard: ചൂടിന്റെ അപകടസാധ്യത സാധാരണ നിലയിലാണ്. ഓരോ {water} മിനിറ്റിലും വെള്ളം കുടിക്കുന്നത് തുടരുക.',
    stop_work: 'HeatGuard: അതികഠിനമായ ചൂട്. കഠിനമായ പുറംജോലി ഇപ്പോൾ നിർത്തുക. തണലിലേക്കോ വിശ്രമസ്ഥലത്തേക്കോ പോയി വെള്ളം കുടിക്കുക.',
    midday_break: 'HeatGuard: ഉച്ചവിശ്രമം. ഉച്ചയ്ക്ക് 3:00 വരെ പുറംജോലി നിർത്തിവച്ചിരിക്കുന്നു. തണലിൽ വിശ്രമിച്ച് വെള്ളം കുടിക്കുക.',
    checkin: 'HeatGuard പരിശോധന: നിങ്ങൾക്ക് സുഖമാണോ? സുഖമാണെങ്കിൽ 1, സുഖമില്ലെങ്കിൽ 2 എന്ന് മറുപടി അയയ്ക്കുക.',
    checkin_thanks: 'നന്ദി. സുരക്ഷിതരായിരിക്കുക, വെള്ളം കുടിക്കുന്നത് തുടരുക.',
    first_aid_coming: 'സഹായം വരുന്നു. ജോലി നിർത്തി തണലിൽ ഇരുന്ന് പതുക്കെ വെള്ളം കുടിക്കുക. നിങ്ങളുടെ സൂപ്പർവൈസറെ അറിയിച്ചിട്ടുണ്ട്.',
    take_break: 'HeatGuard: ഇപ്പോൾ തണലിൽ {rest} മിനിറ്റ് വിശ്രമിച്ച് വെള്ളം കുടിക്കുക.',
    hydrate: 'HeatGuard: ഇപ്പോൾ ഒരു കപ്പ് വെള്ളം കുടിക്കുക.',
  },
  bn: {
    levels: ['স্বাভাবিক', 'সতর্কতা', 'উচ্চ', 'বিপজ্জনক', 'চরম'],
    shift_tomorrow: 'HeatGuard: আগামীকাল আপনার দল {start}-এ কাজ শুরু করবে এবং {end}-এর মধ্যে শেষ করবে। ভারী কাজ ঠান্ডা সময়ে রাখা হয়েছে। আসার আগে পানি পান করুন।',
    risk_update: 'HeatGuard: গরমের ঝুঁকি এখন {levelName}। প্রতি {water} মিনিটে পানি পান করুন। {work} মিনিট কাজ করুন, তারপর {rest} মিনিট ছায়ায় বিশ্রাম নিন।',
    risk_normal: 'HeatGuard: গরমের ঝুঁকি স্বাভাবিক। প্রতি {water} মিনিটে পানি পান করতে থাকুন।',
    stop_work: 'HeatGuard: চরম গরম। ভারী বাইরের কাজ এখনই বন্ধ করুন। ছায়ায় বা বিশ্রামের জায়গায় যান এবং পানি পান করুন।',
    midday_break: 'HeatGuard: দুপুরের বিরতি। বিকেল ৩:০০টা পর্যন্ত বাইরের কাজ বন্ধ। ছায়ায় বিশ্রাম নিন এবং পানি পান করুন।',
    checkin: 'HeatGuard চেক-ইন: আপনি কি ঠিক আছেন? ঠিক থাকলে 1, অসুস্থ বোধ করলে 2 পাঠান।',
    checkin_thanks: 'ধন্যবাদ। নিরাপদে থাকুন এবং পানি পান করতে থাকুন।',
    first_aid_coming: 'সাহায্য আসছে। কাজ বন্ধ করুন, ছায়ায় বসুন এবং ধীরে ধীরে পানি পান করুন। আপনার সুপারভাইজারকে জানানো হয়েছে।',
    take_break: 'HeatGuard: এখনই ছায়ায় {rest} মিনিটের বিরতি নিন এবং পানি পান করুন।',
    hydrate: 'HeatGuard: এখনই এক কাপ পানি পান করুন।',
  },
  tl: {
    levels: ['Normal', 'Mag-ingat', 'Mataas', 'Mapanganib', 'Matindi'],
    shift_tomorrow: 'HeatGuard: Bukas, magsisimula ang iyong crew nang {start} at matatapos bago mag-{end}. Ang mabibigat na trabaho ay nakaplano sa mas malamig na oras. Uminom ng tubig bago pumasok.',
    risk_update: 'HeatGuard: Ang panganib ng init ay {levelName} na ngayon. Uminom ng tubig tuwing {water} minuto. Magtrabaho nang {work} minuto, pagkatapos ay magpahinga nang {rest} minuto sa lilim.',
    risk_normal: 'HeatGuard: Normal ang panganib ng init. Patuloy na uminom ng tubig tuwing {water} minuto.',
    stop_work: 'HeatGuard: MATINDING init. Itigil na ngayon ang mabigat na trabaho sa labas. Pumunta sa lilim o pahingahan at uminom ng tubig.',
    midday_break: 'HeatGuard: Midday break. Hinto ang trabaho sa labas hanggang 3:00 PM. Magpahinga sa lilim at uminom ng tubig.',
    checkin: 'HeatGuard check-in: Okay ka lang ba? Sumagot ng 1 kung okay, 2 kung masama ang pakiramdam mo.',
    checkin_thanks: 'Salamat. Mag-ingat at patuloy na uminom ng tubig.',
    first_aid_coming: 'Paparating na ang tulong. Itigil ang trabaho, umupo sa lilim, at uminom ng tubig nang dahan-dahan. Naabisuhan na ang iyong supervisor.',
    take_break: 'HeatGuard: Magpahinga nang {rest} minuto sa lilim ngayon at uminom ng tubig.',
    hydrate: 'HeatGuard: Uminom ng isang tasang tubig ngayon.',
  },
  ta: {
    levels: ['இயல்பு', 'எச்சரிக்கை', 'அதிகம்', 'ஆபத்து', 'மிகக் கடுமை'],
    shift_tomorrow: 'HeatGuard: நாளை உங்கள் குழு {start} மணிக்கு வேலையைத் தொடங்கி {end} மணிக்குள் முடிக்கும். கனமான வேலை குளிர்ச்சியான நேரத்தில் திட்டமிடப்பட்டுள்ளது. வருவதற்கு முன் தண்ணீர் குடியுங்கள்.',
    risk_update: 'HeatGuard: வெப்ப அபாயம் இப்போது {levelName}. ஒவ்வொரு {water} நிமிடத்திற்கும் தண்ணீர் குடியுங்கள். {work} நிமிடம் வேலை செய்து, பிறகு {rest} நிமிடம் நிழலில் ஓய்வெடுங்கள்.',
    risk_normal: 'HeatGuard: வெப்ப அபாயம் இயல்பாக உள்ளது. ஒவ்வொரு {water} நிமிடத்திற்கும் தண்ணீர் குடித்துக்கொண்டே இருங்கள்.',
    stop_work: 'HeatGuard: மிகக் கடுமையான வெப்பம். கனமான வெளிப்புற வேலையை இப்போதே நிறுத்துங்கள். நிழலுக்கோ ஓய்வு இடத்திற்கோ சென்று தண்ணீர் குடியுங்கள்.',
    midday_break: 'HeatGuard: மதிய ஓய்வு. மாலை 3:00 மணி வரை வெளிப்புற வேலை நிறுத்தப்படுகிறது. நிழலில் ஓய்வெடுத்து தண்ணீர் குடியுங்கள்.',
    checkin: 'HeatGuard சரிபார்ப்பு: நீங்கள் நலமாக இருக்கிறீர்களா? நலமாக இருந்தால் 1, உடல்நிலை சரியில்லை என்றால் 2 என பதில் அனுப்புங்கள்.',
    checkin_thanks: 'நன்றி. பாதுகாப்பாக இருங்கள், தண்ணீர் குடித்துக்கொண்டே இருங்கள்.',
    first_aid_coming: 'உதவி வந்துகொண்டிருக்கிறது. வேலையை நிறுத்தி, நிழலில் அமர்ந்து, மெதுவாக தண்ணீர் குடியுங்கள். உங்கள் மேற்பார்வையாளருக்கு தெரிவிக்கப்பட்டுள்ளது.',
    take_break: 'HeatGuard: இப்போதே நிழலில் {rest} நிமிடம் ஓய்வெடுத்து தண்ணீர் குடியுங்கள்.',
    hydrate: 'HeatGuard: இப்போதே ஒரு கப் தண்ணீர் குடியுங்கள்.',
  },
};

/**
 * Render a template for one worker. `risk_update` picks the right wording for the plan:
 * level 0 → "normal", level 4 → "stop work", otherwise the work/rest schedule.
 */
export function render(template, lang, plan = {}) {
  const t = T[lang] ?? T.en;
  let key = template;
  if (template === 'risk_update') key = plan.level === 0 ? 'risk_normal' : plan.level >= 4 ? 'stop_work' : 'risk_update';
  const text = t[key] ?? T.en[key];
  if (!text) throw new Error(`Unknown template: ${template}`);
  return text.replace(/\{(\w+)\}/g, (_, name) =>
    name === 'levelName' ? t.levels[plan.level] ?? '' : String(plan[name] ?? ''),
  );
}
