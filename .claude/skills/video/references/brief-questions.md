# Bảng câu hỏi brief (stage 0)

Hỏi một lượt dưới dạng bảng markdown, **mỗi câu kèm mặc định Claude đề xuất** (cột 3). User trả "OK hết" hoặc chỉ ghi số dòng cần sửa. Những câu user đã trả lời trong lời gọi `/video` thì điền sẵn, không hỏi lại.

| # | Câu hỏi | Mặc định |
|---|---|---|
| 1 | Chế độ chạy: dừng duyệt từng stage hay `--auto` (một mạch) | dừng từng stage |
| 2 | Mục đích: bản **test** hay bản **đăng thật** (đăng thật ⇒ mọi số liệu đọc tận bài gốc) | test |
| 3 | Chủ đề + 3 góc nhìn (chọn 1) | Claude đề xuất 3 góc |
| 4 | Khán giả | người Việt 20–40 tuổi, phổ thông |
| 5 | Độ dài + số chapter | 3,5 phút · 3 chapter |
| 6 | Khung hình: 16:9 (YouTube) hay 9:16 (Shorts/TikTok) | 16:9 · 1920×1080 · 30fps |
| 7 | 3 hook (chọn 1) — hook có số liệu phải kiểm được | Claude đề xuất |
| 8 | 3–6 ý chính bắt buộc | Claude đề xuất |
| 9 | Điều cần tránh | chính trị nhạy cảm; số liệu không nguồn; cổ vũ quá đà; dự báo khẳng định; gắn nhãn sai footage; logo thương hiệu |
| 10 | Giọng văn | kể chuyện – phân tích, trung lập, câu ngắn; kết chapter bằng câu gợi mở |
| 11 | Yêu cầu nguồn | NSO/GSO, World Bank, bộ ngành, Reuters, Nikkei; ưu tiên số liệu năm gần nhất |
| 12 | Phong cách hình | explainer biên tập: nền tối, Barlow, đồ hoạ động + footage thật |
| 13 | Tỷ lệ loại hình | stock ~45% · animation ~40% · text_card ~5% · AI ≤ 8 ảnh + 3 video (ai_video ≤ 15% scene) |
| 14 | Trần credit Higgsfield cho video này | mặc định trong CLAUDE.md (≤ 8 ảnh + 3 video, ≤ 20% số dư) |
| 15 | Kết / CTA | câu hỏi mở + mời bình luận, đăng ký |
| 16 | Giọng đọc (chỉ 2 giọng đã duyệt) · speed · emotion | `Nhật Phong` (nam Bắc) · 1.0 · natural — hoặc `Châu Thảo` (nữ Bắc) |
| 17 | Lexicon: từ cần đọc đặc biệt (tên riêng, viết tắt) | chưa có — nghe bản TTS rồi bổ sung |
| 18 | Slug project | Claude đặt (kebab-case, không dấu) |

## Ghi `brief.json`
Các khoá đã dùng: `slug, topic, angle, alternativeAngles, audience, targetMinutes, chapters, wordsPerMinute, aspect, resolution, fps, hook, alternativeHooks, keyPoints, avoid, tone, sources{rule,preferred}, visualStyle, visualMix, higgsfieldCreditCap?, cta, voice{id,speed,emotion}, mode ("step"|"auto"), purpose ("test"|"publish"), approvedAt`.
Sau khi ghi: `manifest.tts = { voice, speed, emotion }` theo câu 16.
