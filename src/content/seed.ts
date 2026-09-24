// Default "National Day 96" content. Used to seed Supabase (see scripts/gen-seed-sql.ts)
// and as the in-memory content store for local development.
import type { Category, Question, QuestionType, Theme } from "../lib/game/types";

export const THEME: Theme = { id: "national-day-96", name: "اليوم الوطني 96" };

const T = THEME.id;

const V10_CATEGORIES: Category[] = [
  { id: "nd96-watani", themeId: T, name: "وطنية 96", description: "تاريخ الوطن ورموزه", color: "#22A06B", pattern: "star", mode: "normal", sort: 1, active: true },
  { id: "nd96-truefalse", themeId: T, name: "صح أو خطأ", description: "قرّر بسرعة", color: "#2F6FDE", pattern: "lattice", mode: "normal", sort: 2, active: true },
  { id: "nd96-whois", themeId: T, name: "من هو؟", description: "شخصيات سعودية", color: "#7E57D8", pattern: "arches", mode: "normal", sort: 3, active: true },
  { id: "nd96-complete", themeId: T, name: "أكمل العبارة", description: "النشيد والأمثال", color: "#D6A63A", pattern: "chevron", mode: "normal", sort: 4, active: true },
  { id: "nd96-password", themeId: T, name: "كلمة السر", description: "ثلاث تلميحات وكلمة واحدة", color: "#E0548A", pattern: "dots", mode: "normal", sort: 5, active: true },
  { id: "nd96-emoji", themeId: T, name: "خمّنها بالإيموجي", description: "عينك على الصورة", color: "#169C9C", pattern: "waves", mode: "normal", sort: 6, active: true },
  { id: "nd96-speed", themeId: T, name: "تحدي السرعة", description: "أسرع إصبع يجاوب", color: "#E07A3A", pattern: "star", mode: "buzzer", sort: 7, active: true },
  { id: "nd96-saudi", themeId: T, name: "سعودي وبس", description: "ثقافة وأماكن", color: "#2F6FDE", pattern: "arches", mode: "normal", sort: 8, active: true },
];

type Draft = Omit<Question, "id" | "themeId" | "categoryId" | "points" | "active"> & { points?: number };

const mcq = (question: string, options: string[], correct: number): Draft => ({
  question,
  answer: options[correct],
  type: "MULTIPLE_CHOICE",
  options,
  correctOption: correct,
  imageUrl: null,
});
const tf = (question: string, isTrue: boolean, note?: string): Draft => ({
  question,
  answer: (isTrue ? "صح" : "خطأ") + (note ? ` — ${note}` : ""),
  type: "TRUE_FALSE",
  options: null,
  correctOption: isTrue ? 0 : 1,
  imageUrl: null,
});
const open = (question: string, answer: string, type: QuestionType = "TEXT"): Draft => ({
  question,
  answer,
  type,
  options: null,
  correctOption: null,
  imageUrl: null,
});
const phrase = (question: string, answer: string) => open(question, answer, "COMPLETE_PHRASE");

const DRAFTS: Record<string, Draft[]> = {
  "nd96-watani": [
    mcq("في أي عام أُعلن توحيد المملكة العربية السعودية؟", ["1902", "1932", "1945", "1953"], 1),
    mcq("ما الاسم الذي كانت تُعرف به البلاد قبل إعلان اسم «المملكة العربية السعودية»؟", ["سلطنة نجد", "مملكة الحجاز ونجد وملحقاتها", "إمارة الدرعية", "المملكة العربية المتحدة"], 1),
    mcq("في أي يوم من شهر سبتمبر يُحتفل باليوم الوطني السعودي؟", ["21", "22", "23", "24"], 2),
    mcq("هذا العام نحتفل باليوم الوطني السعودي رقم…", ["94", "95", "96", "97"], 2),
    mcq("من هو مؤسس المملكة العربية السعودية؟", ["الملك سعود", "الملك عبدالعزيز بن عبدالرحمن آل سعود", "الإمام محمد بن سعود", "الملك فيصل"], 1),
    mcq("في أي عام استردّ الملك عبدالعزيز الرياض؟", ["1902", "1912", "1925", "1932"], 0),
    mcq("ما اسم الحصن الذي ارتبط باسترداد الرياض؟", ["قصر المربع", "قصر المصمك", "قصر سلوى", "قلعة تاروت"], 1),
    mcq("كم عدد المناطق الإدارية في المملكة؟", ["11", "13", "15", "17"], 1),
    mcq("ما مكوّنات شعار المملكة العربية السعودية؟", ["نخلة وسيفان متقاطعان", "صقر وسيف", "نخلة وهلال", "سيف ونجمة"], 0),
    mcq("متى يُحتفل بيوم العلم السعودي؟", ["11 مارس", "22 فبراير", "23 سبتمبر", "1 يناير"], 0),
    mcq("متى يُحتفل بيوم التأسيس؟", ["22 فبراير", "11 مارس", "23 سبتمبر", "15 يناير"], 0),
    mcq("بأي كلمات يبدأ النشيد الوطني السعودي؟", ["سارعي للمجد والعلياء", "بلادي بلادي", "موطني موطني", "يا بلادي يا وطني"], 0),
    mcq("في أي عام أُعلنت رؤية المملكة 2030؟", ["2014", "2016", "2018", "2020"], 1),
  ],
  "nd96-truefalse": [
    tf("العلم السعودي لا يُنكَّس أبداً.", true, "لأنه يحمل كلمة التوحيد"),
    tf("يُحتفل باليوم الوطني السعودي في 22 فبراير.", false, "22 فبراير يوم التأسيس، واليوم الوطني 23 سبتمبر"),
    tf("الربع الخالي أكبر صحراء رملية متصلة في العالم.", true),
    tf("أول رائد فضاء سعودي وعربي هو الأمير سلطان بن سلمان.", true, "عام 1985"),
    tf("تقع نيوم في منطقة الجوف.", false, "تقع في منطقة تبوك"),
    tf("ستستضيف المملكة كأس العالم 2034.", true),
    tf("ألوان العلم السعودي هي الأخضر والأحمر.", false, "الأخضر والأبيض"),
    tf("الملك سلمان بن عبدالعزيز هو سابع ملوك المملكة.", true),
    tf("تطل المملكة على البحر الأبيض المتوسط.", false, "تطل على البحر الأحمر والخليج العربي"),
    tf("الحِجر (مدائن صالح) أول موقع سعودي يُسجَّل في قائمة التراث العالمي لليونسكو.", true, "عام 2008"),
    tf("عملة المملكة هي الدينار السعودي.", false, "الريال السعودي"),
    tf("عاصمة المملكة العربية السعودية هي جدة.", false, "الرياض"),
    tf("العرضة السعودية مسجّلة في قائمة اليونسكو للتراث الثقافي غير المادي.", true),
  ],
  "nd96-whois": [
    open("وحّد المملكة وأعلن اسمها «المملكة العربية السعودية» عام 1932.", "الملك عبدالعزيز بن عبدالرحمن آل سعود"),
    open("أسّس الدولة السعودية الأولى في الدرعية عام 1727م.", "الإمام محمد بن سعود"),
    open("أول رائد فضاء عربي ومسلم، صعد إلى الفضاء عام 1985.", "الأمير سلطان بن سلمان"),
    open("أول رائدة فضاء سعودية، صعدت إلى محطة الفضاء الدولية عام 2023.", "ريانة برناوي"),
    open("رائد الفضاء السعودي الذي رافق ريانة برناوي في رحلة 2023.", "علي القرني"),
    open("ولي العهد، ويُعرف بأنه مهندس رؤية 2030.", "الأمير محمد بن سلمان"),
    open("خادم الحرمين الشريفين وملك المملكة الحالي.", "الملك سلمان بن عبدالعزيز"),
    open("كاتب كلمات النشيد الوطني «سارعي للمجد والعلياء».", "إبراهيم خفاجي"),
    open("سجّل هدف الفوز التاريخي على الأرجنتين في كأس العالم 2022.", "سالم الدوسري"),
    open("فنان سعودي يُلقّب بـ«فنان العرب».", "محمد عبده"),
    open("فنان سعودي يُلقّب بـ«صوت الأرض».", "طلال مداح"),
    open("شاعر وأمير يُلقّب بـ«مهندس الكلمة».", "الأمير بدر بن عبدالمحسن"),
    open("رمز الكرم عند العرب، وارتبط اسمه بمنطقة حائل.", "حاتم الطائي"),
  ],
  "nd96-complete": [
    phrase("سارعي للمجد و…", "العلياء"),
    phrase("مجّدي لخالق …", "السماء"),
    phrase("وارفعي الخفّاق …", "أخضر"),
    phrase("يحمل النور …", "المسطّر"),
    phrase("ردّدي الله أكبر يا …", "موطني"),
    phrase("موطني عشتَ فخرَ …", "المسلمين"),
    phrase("الجار قبل …", "الدار"),
    phrase("من جدّ …", "وجد"),
    phrase("اللي ما يعرف الصقر …", "يشويه"),
    phrase("حبل الكذب …", "قصير"),
    phrase("على قد لحافك …", "مد رجولك"),
    phrase("العين ما تعلى على …", "الحاجب"),
    phrase("الوقت كالسيف إن لم تقطعه …", "قطعك"),
  ],
  "nd96-password": [
    open("أخضر • شهادة • سيف", "العلم السعودي"),
    open("نخلة • سيفان • رمز", "شعار المملكة"),
    open("دلّة • فنجال • هيل", "القهوة السعودية"),
    open("طيور جارحة • برقع • مقناص", "الصقارة"),
    open("طبول • سيوف • قصيد", "العرضة"),
    open("كثبان • رمال • أكبر صحراء رملية", "الربع الخالي"),
    open("المصمك • البطحاء • العاصمة", "الرياض"),
    open("البحر الأحمر • البلد • عروس", "جدة"),
    open("ورد • الهدا • الشفا", "الطائف"),
    open("نخيل • واحة • جبل القارة", "الأحساء"),
    open("جبل الفيل • الحِجر • آثار", "العلا"),
    open("رز • لحم • بهارات", "الكبسة"),
    open("23 • سبتمبر • توحيد", "اليوم الوطني"),
    open("22 • فبراير • الدرعية", "يوم التأسيس"),
  ],
  "nd96-emoji": [
    open("🐪 + 🏁", "سباق الهجن"),
    open("☕ + 🌴", "القهوة والتمر"),
    open("🦅 + 🧤", "الصقارة"),
    open("🌹 + ⛰️", "الطائف (مدينة الورد)"),
    open("🌴 + ⚔️⚔️", "شعار المملكة"),
    open("🐘 + 🪨", "جبل الفيل في العلا"),
    open("🚀 + 👩‍🚀 + 🇸🇦", "ريانة برناوي"),
    open("⚽ 🇸🇦 2 – 1 🇦🇷", "فوز السعودية على الأرجنتين في كأس العالم 2022"),
    open("🛢️ + 7️⃣", "بئر الدمام رقم 7 (بئر الخير)"),
    open("🚇 + 🏙️", "مترو الرياض"),
    open("🌊 + 👰", "جدة (عروس البحر الأحمر)"),
    open("🏜️ + ¼", "الربع الخالي"),
    open("🥁 + ⚔️ + 🎶", "العرضة"),
  ],
  "nd96-speed": [
    open("ما عاصمة المملكة العربية السعودية؟", "الرياض"),
    open("ما عملة المملكة؟", "الريال السعودي"),
    open("كم عدد المناطق الإدارية في المملكة؟", "13"),
    open("ما البحر الذي يطل عليه غرب المملكة؟", "البحر الأحمر"),
    open("ما المسطح المائي على الساحل الشرقي للمملكة؟", "الخليج العربي"),
    open("في أي منطقة تقع نيوم؟", "تبوك"),
    open("في أي منطقة تقع جزر فرسان؟", "جازان"),
    open("أي مدينة تُلقّب بمدينة الورد؟", "الطائف"),
    open("جسر الملك فهد يربط المملكة بأي دولة؟", "البحرين"),
    open("أي مدينة ستستضيف إكسبو 2030؟", "الرياض"),
    open("كم عدد ملوك المملكة حتى اليوم؟", "سبعة"),
    open("في أي شهر ميلادي يُحتفل باليوم الوطني؟", "سبتمبر"),
    open("ما لونا العلم السعودي؟", "الأخضر والأبيض"),
  ],
  "nd96-saudi": [
    mcq("أي عام سُمّي «عام القهوة السعودية»؟", ["2020", "2021", "2022", "2024"], 2),
    mcq("عام 2024 سُمّي في المملكة:", ["عام الإبل", "عام الخيل", "عام الصقور", "عام النخلة"], 0),
    mcq("في أي منطقة تقع محافظة العلا؟", ["المدينة المنورة", "تبوك", "حائل", "الجوف"], 0),
    mcq("أين يقع حي الطريف التاريخي المسجّل في اليونسكو؟", ["الدرعية", "العلا", "جدة", "الأحساء"], 0),
    mcq("ما النسيج البدوي التقليدي المسجّل في قائمة اليونسكو؟", ["السدو", "البشت", "الزري", "الشماغ"], 0),
    mcq("فن تزيين جدران البيوت في عسير المسجّل في اليونسكو هو:", ["القط العسيري", "السدو", "الخط الكوفي", "الأرابيسك"], 0),
    mcq("أي مدينة تُسمّى «عروس البحر الأحمر»؟", ["جدة", "ينبع", "الوجه", "جازان"], 0),
    mcq("ما أول بئر نفط تجاري في المملكة؟", ["بئر الدمام رقم 7", "بئر الغوار 1", "بئر أبقيق 3", "بئر الظهران 12"], 0),
    mcq("في أي عام اكتُشف النفط تجارياً في المملكة؟", ["1932", "1938", "1945", "1950"], 1),
    mcq("في أي مدينة يقع قصر المصمك؟", ["الرياض", "حائل", "جدة", "بريدة"], 0),
    mcq("ما اسم القطار السريع الذي يربط مكة المكرمة بالمدينة المنورة؟", ["قطار الحرمين", "قطار الشمال", "قطار الرياض", "قطار الخليج"], 0),
    mcq("أي واحة سعودية تُعدّ من أكبر واحات النخيل في العالم؟", ["الأحساء", "القطيف", "تيماء", "خيبر"], 0),
    mcq("ما اسم أكبر صحراء رملية في المملكة؟", ["الربع الخالي", "النفود الكبير", "الدهناء", "الجافورة"], 0),
  ],
};

const V10_QUESTIONS: Question[] = Object.entries(DRAFTS).flatMap(([categoryId, drafts]) =>
  drafts.map((d, i) => ({
    ...d,
    id: `${categoryId}-${String(i + 1).padStart(2, "0")}`,
    themeId: T,
    categoryId,
    points: d.points ?? 100,
    active: true,
  })),
);

// ─── V1.2 — خيمة الفنتوخ seed (khaymat_alfantokh_questions_seed.md, READY sections only) ───
// Additive: fixed IDs, never overwrites or deletes existing rows. HOLD items are not imported.
// Equivalent existing categories are reused (وطنية 96، سعودي وبس، كلمة السر).

export const V12_CATEGORIES: Category[] = [
  { id: "fk-dialect", themeId: T, name: "لهجات وعادات", description: "كلامنا وسوالفنا", color: "#169C9C", pattern: "lattice", mode: "normal", sort: 9, active: true },
  { id: "fk-proverbs", themeId: T, name: "أمثال وكلام سعودي", description: "وش المثل؟", color: "#7E57D8", pattern: "waves", mode: "normal", sort: 10, active: true },
  { id: "fk-challenges", themeId: T, name: "تحديات وأخرى", description: "أول واحد يسويها", color: "#E0548A", pattern: "chevron", mode: "buzzer", sort: 11, active: true },
  // Picture questions need their images first — add them from /admin/content, then activate.
  { id: "fk-image", themeId: T, name: "خمنها من الصورة", description: "عينك على الصورة", color: "#2F6FDE", pattern: "dots", mode: "normal", sort: 12, active: false },
];

const q = (id: string, categoryId: string, d: Draft, active = true): Question => ({
  ...d,
  id,
  themeId: T,
  categoryId,
  points: d.points ?? 100,
  active,
});
const PASSWORD_PROMPT = "كلمة السر 🤫 — المضيف يُري الكلمة للاعب واحد فقط، وهو يلمّح لفريقه بدون ما يقولها";
const CHALLENGE_ANSWER = "أول من ينجز التحدي ويُريه للمضيف";

export const V12_QUESTIONS: Question[] = [
  // 1) وطنية ومعرفة سعودية → وطنية 96
  q("fk-watani-01", "nd96-watani", open("ما هي أكبر مدينة في المملكة العربية السعودية؟", "الرياض")),
  q("fk-watani-02", "nd96-watani", open("متى يكون تاريخ اليوم الوطني السعودي؟", "23 سبتمبر")),
  q("fk-watani-03", "nd96-watani", open("ما هو شعار اليوم الوطني السعودي 96؟", "عزنا بطبعنا")),
  q("fk-watani-04", "nd96-watani", mcq("ما الحي التاريخي الشهير في الدرعية والمسجل في اليونسكو؟", ["حي المنيف", "حي الطريف", "حي الخفيف"], 1)),
  q("fk-watani-05", "nd96-watani", phrase("فوق هام السحب…", "وإن كنت ثرى")),
  q("fk-watani-06", "nd96-watani", phrase("ارفع راسك أنت…", "سعودي")),
  q("fk-watani-07", "nd96-watani", open("لدى السعوديين همة مثل هذا الجبل، ما اسم الجبل؟", "جبل طويق")),
  q("fk-watani-08", "nd96-watani", open("قامت هذه الدولة على أساس أنها دولة التوحيد ودعوة لدين الله ورسوله. من أكون؟", "المملكة العربية السعودية")),
  // 2) لهجات وعادات
  q("fk-dialect-01", "fk-dialect", mcq("إذا قال لك أحد «اهجد»، وش يقصد؟", ["اهجم", "اهدأ", "اهرب"], 1)),
  q("fk-dialect-02", "fk-dialect", mcq("وش ترد على جملة «هذا ما هو قدرك»؟", ["من طيب أصلك", "عاش من شافك", "الله يحييك ويبقيك"], 0)),
  // 3) مدن ومعالم وتراث وأكل → سعودي وبس
  q("fk-heritage-01", "nd96-saudi", mcq("منطقة مشهورة برقصة «الدحة»؟", ["الرياض", "الجوف", "مكة"], 1)),
  q("fk-heritage-02", "nd96-saudi", mcq("طبق شعبي من القمح يُطبخ حتى يصبح قوامه متماسك، وش هو؟", ["القرصان", "الجريش", "المرقوق"], 1)),
  // 4) خمنها من الصورة — inactive until an image is attached
  q("fk-image-01", "fk-image", { ...open("خمّن المدينة من الصورة", "جدة (الجدة ↔ مدينة جدة)"), type: "IMAGE" }, false),
  // 5) أمثال وكلام سعودي
  q("fk-proverbs-01", "fk-proverbs", open("ما المثل السعودي الذي يُضرب لمن ينتقد شيئاً أو يقلل من قيمته لأنه يجهل قيمته الحقيقية؟", "اللي ما يعرف الصقر يشويه")),
  q("fk-proverbs-02", "fk-proverbs", open("ما المثل الذي يُضرب في أن الإنسان يحكم على الآخرين غالباً من خلال أخلاقه وصفاته الشخصية؟", "كل يرى الناس بعين طبعه")),
  // 6) أكمل ورتب والكلمات (the two «أكمل» items duplicate section 1 and are imported once)
  q("fk-password-01", "nd96-password", open(PASSWORD_PROMPT, "قلم أخضر")),
  q("fk-password-02", "nd96-password", open(PASSWORD_PROMPT, "ملعقة")),
  q("fk-password-03", "nd96-password", open(PASSWORD_PROMPT, "قلم أخضر وكوب أخضر")),
  q("fk-password-04", "nd96-password", open(PASSWORD_PROMPT, "سبيكة")),
  q("fk-wordsearch-01", "fk-image", { ...open("ابحث عن الكلمة في الصورة", "السعودية"), type: "IMAGE" }, false),
  q("fk-wordsearch-02", "fk-image", { ...open("ابحث عن الكلمة في الصورة", "ملك"), type: "IMAGE" }, false),
  // 7) تحديات وأخرى — fastest finger
  q("fk-challenge-01", "fk-challenges", open("أول شخص يكتب ويصوّر 📸", CHALLENGE_ANSWER)),
  q("fk-challenge-02", "fk-challenges", open("أول شخص يصوّر 📸", CHALLENGE_ANSWER)),
  q("fk-challenge-03", "fk-challenges", open("أول شخص يصوّر علم السعودية 🇸🇦", CHALLENGE_ANSWER)),
  q("fk-challenge-04", "fk-challenges", open("أول شخص يصوّر قلم أخضر", CHALLENGE_ANSWER)),
  q("fk-challenge-05", "fk-challenges", open("أول شخص يصوّر ملعقة", CHALLENGE_ANSWER)),
  q("fk-challenge-06", "fk-challenges", open("أول شخص يصوّر قلم أخضر وكوب أخضر", CHALLENGE_ANSWER)),
  q("fk-challenge-07", "fk-challenges", open("أول شخص يحط خلفية جوال وطنية", CHALLENGE_ANSWER)),
];

export const SEED_CATEGORIES: Category[] = [...V10_CATEGORIES, ...V12_CATEGORIES];
export const SEED_QUESTIONS: Question[] = [...V10_QUESTIONS, ...V12_QUESTIONS];
