-- V1.2 خيمة الفنتوخ — additive import. Safe to run on production: ON CONFLICT DO NOTHING.
insert into public.categories (id, theme_id, name, description, color, pattern, mode, sort, active) values
  ('fk-dialect', 'national-day-96', 'لهجات وعادات', 'كلامنا وسوالفنا', '#169C9C', 'lattice', 'normal', 9, true),
  ('fk-proverbs', 'national-day-96', 'أمثال وكلام سعودي', 'وش المثل؟', '#7E57D8', 'waves', 'normal', 10, true),
  ('fk-challenges', 'national-day-96', 'تحديات وأخرى', 'أول واحد يسويها', '#E0548A', 'chevron', 'buzzer', 11, true),
  ('fk-image', 'national-day-96', 'خمنها من الصورة', 'عينك على الصورة', '#2F6FDE', 'dots', 'normal', 12, false)
on conflict (id) do nothing;

insert into public.questions (id, theme_id, category_id, question, answer, type, points, image_url, options, correct_option, active) values
  ('fk-watani-01', 'national-day-96', 'nd96-watani', 'ما هي أكبر مدينة في المملكة العربية السعودية؟', 'الرياض', 'TEXT', 100, null, null, null, true),
  ('fk-watani-02', 'national-day-96', 'nd96-watani', 'متى يكون تاريخ اليوم الوطني السعودي؟', '23 سبتمبر', 'TEXT', 100, null, null, null, true),
  ('fk-watani-03', 'national-day-96', 'nd96-watani', 'ما هو شعار اليوم الوطني السعودي 96؟', 'عزنا بطبعنا', 'TEXT', 100, null, null, null, true),
  ('fk-watani-04', 'national-day-96', 'nd96-watani', 'ما الحي التاريخي الشهير في الدرعية والمسجل في اليونسكو؟', 'حي الطريف', 'MULTIPLE_CHOICE', 100, null, '["حي المنيف","حي الطريف","حي الخفيف"]'::jsonb, 1, true),
  ('fk-watani-05', 'national-day-96', 'nd96-watani', 'فوق هام السحب…', 'وإن كنت ثرى', 'COMPLETE_PHRASE', 100, null, null, null, true),
  ('fk-watani-06', 'national-day-96', 'nd96-watani', 'ارفع راسك أنت…', 'سعودي', 'COMPLETE_PHRASE', 100, null, null, null, true),
  ('fk-watani-07', 'national-day-96', 'nd96-watani', 'لدى السعوديين همة مثل هذا الجبل، ما اسم الجبل؟', 'جبل طويق', 'TEXT', 100, null, null, null, true),
  ('fk-watani-08', 'national-day-96', 'nd96-watani', 'قامت هذه الدولة على أساس أنها دولة التوحيد ودعوة لدين الله ورسوله. من أكون؟', 'المملكة العربية السعودية', 'TEXT', 100, null, null, null, true),
  ('fk-dialect-01', 'national-day-96', 'fk-dialect', 'إذا قال لك أحد «اهجد»، وش يقصد؟', 'اهدأ', 'MULTIPLE_CHOICE', 100, null, '["اهجم","اهدأ","اهرب"]'::jsonb, 1, true),
  ('fk-dialect-02', 'national-day-96', 'fk-dialect', 'وش ترد على جملة «هذا ما هو قدرك»؟', 'من طيب أصلك', 'MULTIPLE_CHOICE', 100, null, '["من طيب أصلك","عاش من شافك","الله يحييك ويبقيك"]'::jsonb, 0, true),
  ('fk-heritage-01', 'national-day-96', 'nd96-saudi', 'منطقة مشهورة برقصة «الدحة»؟', 'الجوف', 'MULTIPLE_CHOICE', 100, null, '["الرياض","الجوف","مكة"]'::jsonb, 1, true),
  ('fk-heritage-02', 'national-day-96', 'nd96-saudi', 'طبق شعبي من القمح يُطبخ حتى يصبح قوامه متماسك، وش هو؟', 'الجريش', 'MULTIPLE_CHOICE', 100, null, '["القرصان","الجريش","المرقوق"]'::jsonb, 1, true),
  ('fk-image-01', 'national-day-96', 'fk-image', 'خمّن المدينة من الصورة', 'جدة (الجدة ↔ مدينة جدة)', 'IMAGE', 100, null, null, null, false),
  ('fk-proverbs-01', 'national-day-96', 'fk-proverbs', 'ما المثل السعودي الذي يُضرب لمن ينتقد شيئاً أو يقلل من قيمته لأنه يجهل قيمته الحقيقية؟', 'اللي ما يعرف الصقر يشويه', 'TEXT', 100, null, null, null, true),
  ('fk-proverbs-02', 'national-day-96', 'fk-proverbs', 'ما المثل الذي يُضرب في أن الإنسان يحكم على الآخرين غالباً من خلال أخلاقه وصفاته الشخصية؟', 'كل يرى الناس بعين طبعه', 'TEXT', 100, null, null, null, true),
  ('fk-password-01', 'national-day-96', 'nd96-password', 'كلمة السر 🤫 — المضيف يُري الكلمة للاعب واحد فقط، وهو يلمّح لفريقه بدون ما يقولها', 'قلم أخضر', 'TEXT', 100, null, null, null, true),
  ('fk-password-02', 'national-day-96', 'nd96-password', 'كلمة السر 🤫 — المضيف يُري الكلمة للاعب واحد فقط، وهو يلمّح لفريقه بدون ما يقولها', 'ملعقة', 'TEXT', 100, null, null, null, true),
  ('fk-password-03', 'national-day-96', 'nd96-password', 'كلمة السر 🤫 — المضيف يُري الكلمة للاعب واحد فقط، وهو يلمّح لفريقه بدون ما يقولها', 'قلم أخضر وكوب أخضر', 'TEXT', 100, null, null, null, true),
  ('fk-password-04', 'national-day-96', 'nd96-password', 'كلمة السر 🤫 — المضيف يُري الكلمة للاعب واحد فقط، وهو يلمّح لفريقه بدون ما يقولها', 'سبيكة', 'TEXT', 100, null, null, null, true),
  ('fk-wordsearch-01', 'national-day-96', 'fk-image', 'ابحث عن الكلمة في الصورة', 'السعودية', 'IMAGE', 100, null, null, null, false),
  ('fk-wordsearch-02', 'national-day-96', 'fk-image', 'ابحث عن الكلمة في الصورة', 'ملك', 'IMAGE', 100, null, null, null, false),
  ('fk-challenge-01', 'national-day-96', 'fk-challenges', 'أول شخص يكتب ويصوّر 📸', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true),
  ('fk-challenge-02', 'national-day-96', 'fk-challenges', 'أول شخص يصوّر 📸', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true),
  ('fk-challenge-03', 'national-day-96', 'fk-challenges', 'أول شخص يصوّر علم السعودية 🇸🇦', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true),
  ('fk-challenge-04', 'national-day-96', 'fk-challenges', 'أول شخص يصوّر قلم أخضر', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true),
  ('fk-challenge-05', 'national-day-96', 'fk-challenges', 'أول شخص يصوّر ملعقة', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true),
  ('fk-challenge-06', 'national-day-96', 'fk-challenges', 'أول شخص يصوّر قلم أخضر وكوب أخضر', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true),
  ('fk-challenge-07', 'national-day-96', 'fk-challenges', 'أول شخص يحط خلفية جوال وطنية', 'أول من ينجز التحدي ويُريه للمضيف', 'TEXT', 100, null, null, null, true)
on conflict (id) do nothing;

insert into public.themes (id, name, active) values ('_seed:v1.2', 'seed marker V1.2', false) on conflict (id) do nothing;
