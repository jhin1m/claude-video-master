# claude-video-master — pipeline ý tưởng → video tiếng Việt

Trả lời user bằng tiếng Việt có dấu. Không log/in API key. Không commit/push. Hỏi trước khi đổi kiến trúc hoặc thêm dependency nặng.

## Kiến trúc (không đổi nếu chưa hỏi user)
1. **Audio trước, hình sau** — duration thật của audio quyết định độ dài scene.
2. **Animatic** (audio thật + thẻ chữ) phải được duyệt xong mới tiêu credit sinh hình.
3. **Đơn vị = scene.** `projects/<slug>/manifest.json` là nguồn sự thật.
   `hash = sha256(narration + voice + speed + emotion)`; stage chỉ chạy lại scene có hash đổi.
4. **CLI `cvm`** (Node/TS) làm phần máy móc (TTS, ffprobe, ffmpeg, render), chạy được khi không có Claude.
   Claude làm phần cần nghĩ: brief, outline, script, intent/prompt scene, code animation, gọi Higgsfield MCP, duyệt.

## Stages — mỗi stage có "DỪNG" thì chờ user duyệt
| # | Stage | Đầu ra |
|---|---|---|
| – | `cvm init <slug>` | `projects/<slug>/` |
| 0 | brief (hỏi user bằng bảng, mỗi câu kèm mặc định) — DỪNG | `brief.json` |
| 1 | outline: chapter + ý chính + ngân sách giây (150 từ/phút) — DỪNG | `outline.json` |
| 2 | script (mọi số liệu có nguồn) + scenes — DỪNG | `script.md`, `manifest.json` |
| 3 | `cvm tts --chapter N [--yes]` | `tts/chNN.tts`, `audio/chNN/sNNN.*` |
| 4 | `cvm animatic --chapter N` — DỪNG | `renders/chNN_animatic.mp4` |
| 5 | visuals: Pexels (stock), Wikimedia Commons (archive), HyperFrames (animation/text_card), Higgsfield MCP (ai_image/ai_video) | `visuals/chNN/`, `cvm stock …`, `cvm archive …`, `cvm asset set <sceneId> <path>` |
| 6 | `cvm render --chapter N` — DỪNG | `renders/chNN.mp4` + `.srt` |
| 7 | `cvm final` | `final.mp4` + `subs.srt` + `credits.txt` |

## Quy tắc scene
- id dạng `ch02_s004`; dài 4–8s; `narration` ≥ 60 ký tự (VieNeu tính tối thiểu 50 ký tự/request).
- `visual.type` ∈ `animation | ai_image | ai_video | stock | archive | text_card`; `ai_video` ≤ 15% số scene.
- `audio.duration` = ffprobe của lời đọc thật; `audio.pauseAfterMs` lưu riêng (không nằm trong hash).
  Độ dài slot scene = duration + pause. Pause do ffmpeg chèn, không gửi lên API.

## Chạy CLI
Trình tự làm việc đầy đủ: skill **`/video`** (`.claude/skills/video/`). `./cvm status` cho biết project đang ở đâu và lệnh tiếp theo.
`./cvm <lệnh>` (hoặc `npm run cvm -- <lệnh>`). Project hiện tại lưu ở `projects/.current`; `--project <slug>` để chọn khác.
`projects/lexicon-test/` là project thử nghiệm TTS/lexicon — không phải video thật.

## File `.tts`
```
@voice: <voiceId v4>
@speed: 1.0
@emotion: natural
[ch02_s004]
<lời đọc>
<pause 500ms>
```

## VieNeu (TTS)
- Spec: `docs/vieneu-openapi.json`. Overview và spec lệch nhau thì theo overview (https://docs.vieneu.io/docs/cloud-api/overview/).
- Base `https://api.vieneu.io/api/v1`, `Authorization: Bearer $VIENEU_API_KEY` (lấy từ `.env`).
- `POST /tts {text, voiceId, speed, emotion, aiRefine:false}` + `Idempotency-Key: <scene hash>` → 201 `{jobId,status}`;
  `status: completed` nghĩa là server đã có sẵn audio, có `audioUrl` luôn, không cần poll.
- Poll hàng loạt `GET /tts?ids=` (≤ 50 id); `audioUrl` hết hạn sau 24h → tải về ngay.
- voiceId lấy lúc chạy từ `GET /voices?engine=v4` (id là tên tiếng Việt, ví dụ `Ngọc Lan`), không hardcode.
- Ước tính trước khi gửi: `token = ký tự × billingMultiplier × globalMultiplier` (lấy từ `GET /engines`), làm tròn lên **từng request**
  (đã đối chiếu với `GET /usage`); không có `--yes` thì chỉ in rồi thoát. Audio trả về: WAV 48 kHz mono.
- Nhịp đọc đo được ở speed 1.0: `Anh Khôi` câu thường ~16 ký tự/giây, câu nhiều số ~11,5; **`Nhật Phong` ≈ 14,4 ký tự/giây**
  (đo trên 16 phút `ai-chet-hai-lan`), pause trung bình ~0,5 s/scene. Scene 4–8s ⇒ lời đọc khoảng 65–120 ký tự.
  Outline tạm tính 150 từ/phút; độ dài thật do audio quyết định — `cvm status` in nhịp đo được + ước lượng tổng.
- 429 → chờ theo `Retry-After`; 409 `IDEMPOTENCY_IN_FLIGHT` → thử lại với cùng key.

## Công cụ
- Node 24 chạy `.ts` trực tiếp (type stripping) — không dùng tsx. Chỉ dùng thư viện có sẵn của Node.
  `npm run typecheck` / `npm run lint` = `tsc --noEmit` (strict).
- ffmpeg local **không có drawtext/libass** → chữ trên hình làm bằng HyperFrames. **Không burn-in phụ đề**
  (user chọn 2026-09-29); `.srt` xuất dạng file đi kèm (sidecar). Chưa dùng nhạc nền (user: tạm chưa tính).
- HyperFrames: `npx --yes hyperframes@0.8.83 …`; đọc skill `/hyperframes-core` và `/hyperframes-cli` trước khi viết composition.
- Stock video: **chỉ Pexels** (`PEXELS_API_KEY`; hạn mức 200 request/giờ). Pixabay đã bỏ.
  `cvm stock search <sceneId> "<query tiếng Anh>"` lọc clip ngang, ≥1080p, dài ≥ slot + 1s → `stock/<sceneId>.json`;
  `cvm stock pick <sceneId> <id> [--start s]` tải về, cắt đoạn giữa clip, 1920×1080/30fps, bỏ tiếng, ghi `visual.source`
  (tác giả + URL để ghi credit) và xuất `visuals/chNN/sNNN.jpg` — **xem frame này trước khi chấp nhận**.
  Nhiều scene: `cvm stock pick --batch picks.json` (`[{scene, id, start?, bg?}]`, tải 4 luồng, ghi manifest một lần).
  Không gắn nhãn sai footage (không nói footage chung là nhà máy Samsung); tránh người nhận diện được ở đoạn nói về mặt trái.
- Ảnh tư liệu (`archive`): **Wikimedia Commons** — hiện vật, bản thảo, tranh khắc, ảnh lịch sử có thật mà Pexels không có
  và AI không được vẽ. `cvm archive search <sceneId> "<query tiếng Anh>"` chỉ giữ PD/CC0/CC BY/CC BY-SA, cạnh dài ≥ 800px
  → `archive/<sceneId>.json`; `cvm archive pick <sceneId> <pageid> [--fit cover|contain]` tải về `archive/raw/`, dựng
  `visuals/chNN/sNNN.jpg` 1920×1080 (gần 16:9 thì cắt đầy khung; ảnh dọc/dải hẹp đặt nguyên trên nền mờ) và ghi
  `visual.source` (tác giả, giấy phép, URL). Nhiều scene: `cvm archive pick --batch picks.json` (`[{scene, id, fit?}]`);
  `cvm archive fetch <pageid|sceneId…> | --batch picks.json` chỉ tải ảnh gốc về `archive/raw/` (không ghi manifest — chạy nền
  ngay khi chọn xong, `pick` sau đó dùng lại file). Tải từ `upload.wikimedia.org` luôn **một luồng, giãn 5–8 s**, 429 → dừng
  và chờ `Retry-After` (≤ 15 phút, quá thì báo lỗi), không retry dồn; bộ đếm dùng chung mọi tiến trình (`projects/.throttle/`).
  Chỉ tải thumb 1920 (cỡ chuẩn) — bản gốc/cỡ lạ bị throttle. Render coi như ảnh tĩnh (Ken Burns). **Xem ảnh trước khi chấp nhận**;
  đúng hiện vật/người mà lời đọc nhắc, không dùng ảnh minh hoạ hiện đại thay cho tư liệu gốc mà không nói rõ.
  **Ảnh tư liệu lên hình phải kèm chú thích dữ kiện** (user chốt 2026-09-30): người → tên + năm sinh–mất (+ vai trò),
  hiện vật/bản thảo → tên + năm + nơi lưu giữ, bản dựng lại → ghi rõ "bản dựng lại". Ví dụ lời đọc "Năm 1738, Paris,
  một thợ đồng hồ tên Jacques de Vaucanson…" → chú thích "Jacques de Vaucanson (1709–1782) · thợ đồng hồ, Paris".
  Ghi vào manifest `visual.caption: { "title": "…", "detail": "…" }` → `cvm render` vẽ thành dải chữ góc dưới trái
  (font/màu theo theme, hiện 0,5s sau đầu scene, tắt trước khi chuyển cảnh). Scene `archive` thiếu caption thì
  `cvm render` từ chối, `cvm status` báo. Scene khác cũng dùng được caption khi cần. Dữ kiện phải có nguồn trong `script.md`.
  `cvm final` xuất thêm `credits.txt` (mọi nguồn Pexels + Commons) để dán vào mô tả video — CC BY/BY-SA bắt buộc ghi.
- Render (`src/compose.ts`): mỗi chapter là một composition HyperFrames ở `projects/<slug>/compose/chNN/`
  (asset hard-link, không copy): scene đặt theo mốc tuyệt đối của lời đọc, chuyển cảnh chồng 0,4s (mỗi clip dư
  0,2s hai đầu; stock lấy dư từ file gốc qua `visual.clip`, đồ hoạ render dư đuôi 0,5s), Ken Burns cho stock/ảnh,
  SFX (whoosh khi đổi đồ hoạ ↔ footage; tick/pop do mẫu đồ hoạ khai báo qua `soundCues()`; file ở `templates/sfx/`).
  Giọng đọc không bị dời. Audio đã trộn được giải mã ra `renders/chNN.wav` cắt đúng mốc frame; `final` ghép từ WAV
  (không nối thẳng AAC). Render mất khoảng 1,5–2 phút mỗi chapter (tuần tự).
  `cvm render --chapters 3-12 | --all [--jobs N]` render nhiều chapter song song (mặc định N=2; **chưa đo** CPU/RAM/thời gian
  thật N=2 vs 3 trên máy 8 CPU/16 GB — mỗi render HyperFrames đã tự dùng nhiều worker Chrome). Render chỉ đọc manifest.
- Đồ hoạ (animation/text_card): khai báo `visual.spec` trong manifest → `cvm graphics --chapter N [--scene id] [--draft]`
  sinh `projects/<slug>/graphics/<sceneId>/index.html` từ `src/graphics/templates.ts` (counter, bars, ring, map, text,
  layers, smile, versus, chain, geo = bản đồ thật 63 tỉnh VN + mọi nước, chart, chat = ô chat gõ chữ/chữ chảy ra, montage = chuỗi ảnh cắt nhanh kèm mốc năm, duel = hai đường đua trên trục năm (phe thắng/thua), links = các từ trong câu nối nhau bằng cung sáng; mọi mẫu nhận `bg` footage/ảnh làm nền), render HyperFrames và gắn asset; cache theo hash(spec + slot + theme + `TEMPLATE_VERSIONS[template]`) — sửa mẫu nào thì
  tăng số của mẫu đó (sửa phần dùng chung thì tăng tất cả). `--jobs N` render N scene song song (mặc định 1), ghi manifest
  một lần cuối chapter.
  Theme ở `src/graphics/theme.ts`: mặc định `muc-ho-phach` (nền mực + hổ phách; tiêu đề + số Phudu, chữ thường Be Vietnam Pro — user chốt 2026-09-30);
  `"theme": "classic"` trong `brief.json` để dùng giao diện cũ. Màu/font chỉ lấy từ token theme, không hardcode trong mẫu.
  HTML tự phát khi mở ngoài HyperFrames (xem trước qua Artifact được).
  **Nền mặc định của đồ hoạ = footage Pexels** (user chốt 2026-09-30; trừ `geo`, `montage`): `cvm stock pick <sceneId> <id> --bg`.
  Mọi chữ có viền tối + bóng để không chìm vào footage. Ví dụ spec: `.claude/skills/video/references/visual-guide.md`.
- Shell là zsh: biến chứa danh sách không tự tách từ — lặp bằng Python hoặc mảng, đừng dùng `for x in $list`.
- Chạy song song: mọi lệnh `cvm` ghi `manifest.json` bằng đọc-sửa-ghi trong khoá file (`manifest.json.lock`, `src/lock.ts`)
  → nhiều lệnh `cvm` chạy cùng lúc không mất dữ liệu. Script Python/Edit sửa manifest **không** đi qua khoá: không sửa tay khi
  có lệnh `cvm` ghi manifest đang chạy nền. Dừng job nền bằng TaskStop (pkill con không dừng vòng lặp cha).
  `npm test` = `node --test` (khoá manifest, mẫu `text`).
- Higgsfield: MCP hosted (OAuth). **Phương án cuối** (user chốt 2026-09-30): chỉ dùng khi đã tìm Pexels + Wikimedia Commons
  và cân nhắc đồ hoạ mà không có hình/video phù hợp; ghi lý do (query đã thử) vào `visual.intent`. Ưu tiên ảnh → image-to-video. Trước khi gọi luôn in bảng scene | model | prompt | credit ước tính.
  **Trần mặc định (user uỷ quyền 2026-09-29, nâng cùng ngày):** mỗi video tối đa 8 ai_image + 3 ai_video (ai_video
  vẫn ≤ 15% số scene; lượt sinh lại tính vào trần), và tổng ≤ 20% số dư credit
  lúc bắt đầu stage 5. Trong trần thì tự chạy không cần duyệt; sắp vượt trần thì DỪNG hỏi. `brief.json` có
  `higgsfieldCreditCap` thì dùng số đó thay mặc định. Giá tham khảo (2026-09-29): ảnh `cinematic_studio_2_5` 2k = 2 credit;
  video `kling3_0` pro 6s tắt tiếng = 9 (std 7,5). Ảnh → video: `generate_video` với `medias:[{role:"start_image", value:<job id ảnh>}]`.
  Luôn xem ảnh trước khi dùng (lỗi hay gặp: vật thể sai thực tế, viền phim/chữ giả → cắt bằng ffmpeg crop).
  AI lo không khí, HTML lo dữ kiện: không để AI vẽ chữ, số, biểu đồ, bản đồ, cờ, logo; ảnh AI làm nền đồ hoạ qua `bg`
  (tính vào trần ảnh). Chi tiết: `.claude/skills/video/references/visual-guide.md`.
  Không có tool Higgsfield trong session (chưa cài, hoặc thêm MCP giữa session mà chưa restart) → **bỏ hẳn AI**, dựng
  scene bằng nguồn khác (Pexels, Commons, đồ hoạ HyperFrames); không để chỗ chờ thay ảnh AI sau.

## Giọng đọc đã duyệt (user chọn 2026-09-29)
- `Nhật Phong` — nam, Bắc, trẻ, dễ gần → **mặc định**.
- `Châu Thảo` — nữ, Bắc, tin tức, hoạt ngôn → phương án thay.
Brief chỉ hỏi chọn 1 trong 2 giọng này (kiểm lại id bằng `GET /voices?engine=v4` khi chạy). Project
`vn-cong-xuong-dien-tu` làm trước khi chốt nên vẫn dùng `Anh Khôi`.
