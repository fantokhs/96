// V1.7 — one-time human gameplay classification of the global questions (no AI at runtime).
// Difficulty is relative to the category's format: a «كلمة السر» card is hard when the clues
// are indirect, a «صح أو خطأ» when the statement is subtle, a «أمثال» when the proverb is rare.
// The database column (questions.difficulty) is the source of truth once the V1.7 migration
// has run; this map fills it (migration SQL) and backs it up when the column is missing.
import type { Difficulty, Question } from "../lib/game/types";

const E = "easy" as const;
const M = "medium" as const;
const H = "hard" as const;

export const SEED_DIFFICULTY: Record<string, Difficulty> = {
  // وطنية 96
  "nd96-watani-01": M, // 1932
  "nd96-watani-02": H, // مملكة الحجاز ونجد وملحقاتها
  "nd96-watani-03": E, // 23
  "nd96-watani-04": E, // 96
  "nd96-watani-05": E, // الملك عبدالعزيز
  "nd96-watani-06": H, // 1902
  "nd96-watani-07": M, // المصمك
  "nd96-watani-08": M, // 13 منطقة
  "nd96-watani-09": E, // الشعار
  "nd96-watani-10": M, // يوم العلم 11 مارس
  "nd96-watani-11": M, // يوم التأسيس 22 فبراير
  "nd96-watani-12": E, // سارعي للمجد
  "nd96-watani-13": M, // 2016
  "fk-watani-01": E, // الرياض
  "fk-watani-02": E, // 23 سبتمبر
  "fk-watani-03": M, // عزنا بطبعنا
  "fk-watani-04": M, // حي الطريف
  "fk-watani-05": M, // وإن كنت ثرى
  "fk-watani-06": E, // سعودي
  "fk-watani-07": M, // جبل طويق
  "fk-watani-08": M, // لغز: المملكة
  // صح أو خطأ
  "nd96-truefalse-01": M,
  "nd96-truefalse-02": E,
  "nd96-truefalse-03": M,
  "nd96-truefalse-04": E,
  "nd96-truefalse-05": M,
  "nd96-truefalse-06": E,
  "nd96-truefalse-07": E,
  "nd96-truefalse-08": H, // سابع الملوك
  "nd96-truefalse-09": E,
  "nd96-truefalse-10": H, // الحِجر أول موقع يونسكو
  "nd96-truefalse-11": E,
  "nd96-truefalse-12": E,
  "nd96-truefalse-13": H, // العرضة في اليونسكو
  // من هو؟
  "nd96-whois-01": E,
  "nd96-whois-02": M,
  "nd96-whois-03": E,
  "nd96-whois-04": M,
  "nd96-whois-05": H, // علي القرني
  "nd96-whois-06": E,
  "nd96-whois-07": E,
  "nd96-whois-08": H, // إبراهيم خفاجي
  "nd96-whois-09": E,
  "nd96-whois-10": E,
  "nd96-whois-11": M,
  "nd96-whois-12": M,
  "nd96-whois-13": M,
  // أكمل العبارة
  "nd96-complete-01": E,
  "nd96-complete-02": M,
  "nd96-complete-03": M,
  "nd96-complete-04": H, // المسطّر
  "nd96-complete-05": M,
  "nd96-complete-06": H, // المسلمين
  "nd96-complete-07": E,
  "nd96-complete-08": E,
  "nd96-complete-09": M,
  "nd96-complete-10": E,
  "nd96-complete-11": E,
  "nd96-complete-12": E,
  "nd96-complete-13": M,
  // كلمة السر
  "nd96-password-01": E,
  "nd96-password-02": M,
  "nd96-password-03": E,
  "nd96-password-04": M,
  "nd96-password-05": E,
  "nd96-password-06": E,
  "nd96-password-07": E,
  "nd96-password-08": E,
  "nd96-password-09": M,
  "nd96-password-10": H, // جبل القارة → الأحساء
  "nd96-password-11": M,
  "nd96-password-12": E,
  "nd96-password-13": E,
  "nd96-password-14": M,
  "fk-password-01": M, // قلم أخضر
  "fk-password-02": E, // ملعقة
  "fk-password-03": H, // قلم أخضر وكوب أخضر
  "fk-password-04": H, // سبيكة
  // خمّنها بالإيموجي
  "nd96-emoji-01": E,
  "nd96-emoji-02": M,
  "nd96-emoji-03": E,
  "nd96-emoji-04": M,
  "nd96-emoji-05": M,
  "nd96-emoji-06": M,
  "nd96-emoji-07": M,
  "nd96-emoji-08": E,
  "nd96-emoji-09": H, // بئر الخير
  "nd96-emoji-10": M,
  "nd96-emoji-11": M,
  "nd96-emoji-12": H, // 🏜️ + ¼
  "nd96-emoji-13": E,
  // تحدي السرعة (أسرع إصبع)
  "nd96-speed-01": E,
  "nd96-speed-02": E,
  "nd96-speed-03": M,
  "nd96-speed-04": E,
  "nd96-speed-05": E,
  "nd96-speed-06": M,
  "nd96-speed-07": H, // جزر فرسان
  "nd96-speed-08": M,
  "nd96-speed-09": E,
  "nd96-speed-10": M,
  "nd96-speed-11": H, // عدد الملوك
  "nd96-speed-12": E,
  "nd96-speed-13": E,
  // سعودي وبس
  "nd96-saudi-01": H, // عام القهوة 2022
  "nd96-saudi-02": M,
  "nd96-saudi-03": H, // العلا في منطقة المدينة
  "nd96-saudi-04": M,
  "nd96-saudi-05": M,
  "nd96-saudi-06": H, // القط العسيري
  "nd96-saudi-07": E,
  "nd96-saudi-08": M,
  "nd96-saudi-09": H, // 1938
  "nd96-saudi-10": E,
  "nd96-saudi-11": E,
  "nd96-saudi-12": M,
  "nd96-saudi-13": E,
  "fk-heritage-01": H, // الدحة → الجوف
  "fk-heritage-02": E, // الجريش
  // لهجات وعادات
  "fk-dialect-01": M,
  "fk-dialect-02": M,
  // أمثال وكلام سعودي
  "fk-proverbs-01": M,
  "fk-proverbs-02": H,
  // تحديات وأخرى (أسرع إصبع)
  "fk-challenge-01": E,
  "fk-challenge-02": E,
  "fk-challenge-03": E,
  "fk-challenge-04": M,
  "fk-challenge-05": E,
  "fk-challenge-06": H,
  "fk-challenge-07": M,
};

export const isDifficulty = (v: unknown): v is Difficulty => v === "easy" || v === "medium" || v === "hard";

/** Fill missing difficulty from the classification (explicit values always win). */
export function withDifficulty<T extends Question>(qs: T[], overrides: Record<string, Difficulty> = {}): T[] {
  return qs.map((q) => {
    const d = isDifficulty(q.difficulty) ? q.difficulty : (overrides[q.id] ?? SEED_DIFFICULTY[q.id] ?? null);
    return d === q.difficulty ? q : { ...q, difficulty: d };
  });
}
