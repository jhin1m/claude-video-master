---
name: video
description: Pipeline ý tưởng → video explainer tiếng Việt (brief → outline → script → TTS VieNeu → animatic → visuals Pexels/HyperFrames/Higgsfield → render → final.mp4 + .srt) bằng CLI `cvm` của repo này. Dùng khi user muốn làm video mới từ một ý tưởng/chủ đề, tiếp tục/sửa một project trong projects/<slug>/, hoặc gõ /video. Args: "<ý tưởng>" [--auto] | import <kịch-bản.md> | resume <slug>. Có kịch bản sẵn thì dùng import.
---

# /video — pipeline video tiếng Việt

Quy ước kỹ thuật (API VieNeu, Pexels, HyperFrames, render, giọng đã duyệt, trần credit Higgsfield) nằm ở `CLAUDE.md` gốc repo — đọc trước. File này là **trình tự làm việc**.

## Vào việc
- `/video "<ý tưởng>"` → video mới. `--auto` → chạy một mạch, bỏ các điểm DỪNG (vẫn giữ mọi trần chi phí).
- `/video import <file.md>` → user đã có kịch bản; xem mục **Nhập kịch bản có sẵn**.
- `/video resume <slug>` hoặc "tiếp tục project X" → `./cvm status --project <slug>`; làm tiếp từ dòng "Tiếp theo".
- Sửa lẻ ("đổi câu ch02_s005…") → sửa `manifest.json` → `cvm tts`/`graphics`/`render`/`final` cho chapter đó (hash tự bỏ qua scene không đổi).

## Chế độ
| | Mặc định | `--auto` |
|---|---|---|
| Brief | hỏi bảng câu hỏi | vẫn hỏi (một lượt), trừ khi user đã trả lời sẵn |
| Outline / script / animatic / render | DỪNG chờ duyệt | chạy tiếp, báo tóm tắt cuối |
| TTS | in ước tính → chạy `--yes` sau khi duyệt | chạy `--yes` ngay |
| Higgsfield | in bảng credit; trong trần thì chạy | như mặc định |

Mỗi lần render chỉ giữ **một bản** (file gốc `cvm` xuất ra); không làm bản nén/bản điện thoại (user chọn 2026-09-29). Báo đường dẫn file để user xem.

## Stages
0. **Init + brief** — `./cvm init <slug>`. Hỏi user theo `references/brief-questions.md` (mỗi câu kèm mặc định). Ghi `projects/<slug>/brief.json`; đặt `manifest.tts` = giọng đã chọn.
1. **Outline** — `outline.json`: chapter, ý chính, giây mỗi chapter, `dataToVerify`, phân bổ loại hình. Tổng giây ≈ số phút brief.
2. **Script** — tra nguồn (bản đăng thật: đọc tận bài gốc; bản test: kiểm nhanh, ghi chỗ đáng ngờ). Viết `script.md` (mỗi scene: id · loại · lời đọc · [nguồn]) + `manifest.json` scenes.
   - Lời đọc 65–120 ký tự/scene (nhịp giọng xem CLAUDE.md: Nhật Phong ~14,4 ký tự/s; câu nhiều số chậm hơn) ⇒ scene 4–8s; tối thiểu 60 ký tự.
   - `pauseAfterMs`: 300 thường, 500 sau câu hỏi, 700–800 cuối hook/chapter.
   - `visual`: type, intent (mô tả cho người), prompt (query Pexels tiếng Anh | prompt Higgsfield), `spec` cho animation/text_card — xem `references/visual-guide.md`.
   - Chạy thử `./cvm tts --chapter N` (không --yes) để lấy ước tính; tổng thời lượng lệch mục tiêu > 15% thì sửa lời trước khi TTS.
3. **TTS** — `./cvm tts --chapter N --yes` từng chapter. Sau đó kiểm `./cvm status`: tổng thời lượng + không scene nào < 4s hoặc > 8s; lệch thì sửa lời, TTS lại (chỉ scene đổi).
   **Trong lúc TTS chạy** (job nền): tìm nguồn cho mọi scene — `cvm stock search` / `cvm archive search` chỉ ghi
   `stock|archive/<sceneId>.json`, không đụng manifest. Chọn xong ảnh Commons thì chạy nền ngay `cvm archive fetch --batch picks.json`.
4. **Animatic** — `./cvm animatic --chapter N`. Báo đường dẫn `renders/chNN_animatic.mp4` nếu không phải `--auto`.
5. **Visuals** — trình tự nhanh: chọn nguồn theo lô → **cổng soi mẫu** → đồ hoạ hàng loạt → chapter nào đủ hình thì render ngay.
   - **Chọn theo lô**: ghi lựa chọn vào `picks.json` (`[{ "scene": "ch03_s004", "id": 123, "fit"?, "start"?, "bg"? }]`) rồi
     `./cvm stock pick --batch picks-stock.json` (tải 4 luồng) và `./cvm archive pick --batch picks-archive.json`
     (Commons tải từng ảnh, giãn 5–8 s; ảnh đã `fetch` sẵn thì không tải lại) — mỗi lệnh ghi manifest một lần.
   - **Cổng soi mẫu (trước khi render đồ hoạ hàng loạt)**: mỗi mẫu dùng trong video render 1 scene
     (`./cvm graphics --chapter N --scene <id> --draft`), chụp frame **độ phân giải gốc** (`ffmpeg -ss <giây> -i visuals/chNN/sNNN.mp4 -frames:v 1`)
     rồi crop phóng to đúng chỗ chữ có dấu chồng (ễ ỗ ẫ ẵ ấ ể) và ô tô màu/pill — contact sheet thu nhỏ che mất lỗi dấu.
     Checklist ở mục "Soát trước khi render" trong `references/visual-guide.md`. Qua cổng rồi mới `./cvm graphics --chapter N --jobs 2`.
   - `animation`/`text_card`: viết `visual.spec` → `./cvm graphics --chapter N [--jobs N]` (`--draft` khi thử). Ngoài mẫu số liệu
     còn các mẫu kể chuyện: `rank` (top N), `timeline`, `steps` (quy trình), `quote`, `headline` (mẩu báo), `docmark` (soi tài liệu
     thật, máy quay đẩy vào dòng được đánh dấu), `profile` (nhân vật) — ví dụ spec ở `references/visual-guide.md`.
   - `archive` (hiện vật, bản thảo, tranh khắc, chân dung, ảnh lịch sử có thật): `./cvm archive search <id> "<query>"` → chọn
     ảnh đúng hiện vật/người → `./cvm archive pick <id> <pageid>` (`--fit cover` nếu muốn cắt đầy khung) → xem `visuals/chNN/sNNN.jpg`.
     Rồi ghi `visual.caption {title, detail}` — chú thích dữ kiện trên hình (tên + năm sinh–mất / năm + nơi, "bản dựng lại" nếu có);
     `cvm render` từ chối ảnh tư liệu chưa có caption.
     Không tìm thấy tư liệu thật thì đổi sang đồ hoạ/stock — không để AI vẽ giả tư liệu.
   - `archive` **dạng phim** (thước phim thời sự, phim chính phủ Mỹ, phim quảng cáo/giáo dục cũ, Apollo/NASA) — Internet Archive:
     `./cvm ia search <id> "<query tiếng Anh>"` (`--type image` cho ảnh NASA) → `./cvm ia pick <id> <identifier>` (cắt đúng đoạn
     từ server, không tải cả phim; `--start s` chọn đoạn) → xem `visuals/chNN/sNNN.jpg`, có ⚠ khung đen thì pick lại `--start` khác.
     Chỉ collection danh sách trắng + giấy phép PD/CC0/CC BY/BY-SA; phim ≥ 480p (phần lớn phim tư liệu trước 1970
     là 480p 4:3: dựng trên nền mờ, không cắt, render không Ken Burns); `--min-height 720` khi chỉ muốn HD.
     Vẫn bắt buộc `visual.caption` (sự kiện + năm + nguồn, vd. "Bản tin Universal · 6/6/1944").
   - **Thứ tự ưu tiên nguồn**: footage chung chung hiện đại → Pexels; ảnh tư liệu (bản thảo, tranh khắc, chân dung, mọi nước)
     → Wikimedia Commons; **phim** tư liệu 1920–1967 / Mỹ / NASA → Internet Archive; số liệu, quy trình, mốc thời gian →
     đồ hoạ; AI chỉ sau cùng. Ảnh tĩnh ưu tiên Commons (giấy phép + tác giả rõ, độ phân giải cao); Internet Archive chỉ thay
     khi Commons không có (ảnh NASA). Không dùng Internet Archive cho chủ đề hiện đại Pexels/Commons đã có.
   - `stock`: `./cvm stock search <id> "<query>"` → chọn clip → `./cvm stock pick <id> <pexelsId>`; ghép frame `visuals/chNN/sNNN.jpg` thành contact sheet và **xem bằng mắt** (logo, sai ngữ cảnh, khung trống) → thay clip lỗi.
   - `ai_image`/`ai_video`: **phương án cuối** — chỉ khi Pexels + Commons + đồ hoạ đều không có hình hợp (ghi query đã thử vào `intent`). Higgsfield MCP theo trần trong CLAUDE.md → tải về `visuals/chNN/` → `./cvm asset set <id> <path>`. Không có tool Higgsfield → không dùng AI, dựng bằng stock/archive/đồ hoạ.
   - Nền đồ hoạ mặc định là footage Pexels: `./cvm stock pick <sceneId> <id> --bg` (trừ `geo`, `montage`).
   - Ảnh Higgsfield làm nền đồ hoạ (chỉ khi Pexels không có cảnh hợp): tải về `visuals/bg/<sceneId>.png` → `visual.spec.bg.src` → `./cvm graphics`. AI không vẽ chữ/số/bản đồ — xem mục Higgsfield trong `references/visual-guide.md`.
6. **Render** — `./cvm render --chapter N`, hoặc nhiều chapter song song `./cvm render --chapters 3-12 --jobs 2` / `--all`
   (render chỉ đọc manifest nên chạy song song an toàn; chapter đủ hình thì render luôn, không chờ cả video) (HyperFrames ghép: chuyển cảnh, Ken Burns, SFX; xem mục Render trong CLAUDE.md). Muốn soi khung cụ thể sau render: `npx --yes hyperframes@0.8.83 snapshot projects/<slug>/compose/chNN --at <giây,…>` rồi Read `snapshots/contact-sheet.jpg`.
7. **Final** — `./cvm final` → kiểm: `ffprobe` (video = audio), `blackdetect`, `silencedetect`, loudness; báo đường dẫn `final.mp4` + `subs.srt` + `credits.txt` (dán vào mô tả video).

## Nhập kịch bản có sẵn (`/video import <file.md>`)
Thay stage 0–2; từ TTS trở đi như thường.
- **Brief**: chỉ hỏi giọng + slug (và thời lượng nếu kịch bản không ghi). Giọng lấy từ danh sách đã duyệt.
- **Outline**: lấy từ tiêu đề mục / danh sách chapter của kịch bản — mỗi mục là một chapter `chNN`.
- **Scene**: cắt lời dẫn thành scene 65–120 ký tự, **giữ nguyên câu chữ của tác giả**; chỉ bỏ ký hiệu markdown và sửa
  chỗ TTS đọc sai (số, viết tắt). Ghi chú dựng → `visual`: `[HÌNH]` → `intent` (chỉ thành `ai_*` khi không nguồn thật nào có); `[TƯ LIỆU: "…"]` → `archive` (+ `caption`) với query
  đó; `[ĐỒ HOẠ]` → `animation`/`text_card` + `spec`; `[NHỊP: dừng/im lặng]` → `pauseAfterMs` (700–1500). Montage ảnh
  nhanh (< 1s/ảnh) gộp thành một scene đồ hoạ.
- **Đối chiếu lời (bắt buộc, trước TTS)**: nối `narration` từng chapter, so với lời dẫn gốc của mục đó đã bỏ markdown/ghi chú
  dựng (`[HÌNH]`, `[TƯ LIỆU…]`, `**`, `#`…) — chuẩn hoá khoảng trắng rồi diff theo từ (Python `difflib`). Mọi chỗ lệch phải
  nằm trong **danh sách sửa có chủ đích** (số → chữ, viết tắt, sửa dữ kiện đã ghi ở `brief.json` → `decisions`); chỗ lệch
  khác là gõ nhầm/sót câu → sửa manifest rồi đối chiếu lại đến khi sạch. Báo số chỗ lệch có chủ đích trong báo cáo.
- **Ước lượng thời lượng sơ bộ**: tổng ký tự lời dẫn ÷ nhịp giọng trong CLAUDE.md (Nhật Phong ≈ 14,4 ký tự/s) + tổng
  `pauseAfterMs`. Câu nhắc mốc phút ("ở phút thứ 11") sẽ sai → đổi thành mốc nội dung ("ở phần Turing").
- **TTS thử 1 chapter trước**: `./cvm tts --chapter 1 --yes` → `./cvm status` in nhịp đo được (ký tự/giây) và ước lượng
  tổng thời lượng (phần chưa TTS tính theo nhịp đó, cộng cả pause) so với `brief.json` → `targetMinutes`. Lệch > 15% thì
  **dừng, báo user** (cắt/gộp lời, đổi `speed`, hay chấp nhận thời lượng mới) trước khi TTS các chapter còn lại.
- **Nguồn**: kiểm các số liệu/ngày tháng chính, ghi nguồn vào `script.md`; giữ nguyên chỗ tác giả dặn giữ cách diễn đạt.
  Ghi chú dựng pipeline chưa làm được (nhạc nền, chỉnh màu…) thì liệt kê trong báo cáo, không tự thêm tính năng.
- Kịch bản dài (> 15 phút): làm **một chapter thử trọn vòng** (TTS → visuals → render) để user duyệt phong cách trước,
  rồi mới làm hàng loạt.

## Quy tắc vận hành
- **Manifest có khoá**: lệnh `cvm` ghi `manifest.json` bằng đọc-sửa-ghi trong khoá (`manifest.json.lock`), nên chạy song song
  các lệnh `cvm` không làm mất dữ liệu. Khoá **không** che script tự viết: đừng sửa manifest bằng Python/Edit khi có lệnh `cvm`
  ghi manifest (tts, graphics, stock/archive pick, asset set) đang chạy nền — đợi nó xong rồi mới sửa. Không cho hai lệnh cùng
  đụng một scene (vd. `stock pick --bg` và `graphics` cùng scene).
- **Job nền**: dừng bằng **TaskStop** (id của task). `pkill` tiến trình con không dừng vòng lặp cha (Python/zsh) — job tưởng
  đã chết vẫn chạy tiếp. Dừng xong kiểm `ps aux | grep -E "cvm|hyperframes"`.
- **Internet Archive**: mọi request (tìm, metadata, cắt phim) qua `cvm ia …` — một hàng đợi chung, giãn ≥ 2 s; server quá tải
  (502/`BACKEND_ERROR`) thì `cvm` tự thử lại 3 lần rồi báo "đang quá tải" — chờ vài phút, không vòng lặp tự viết.
- **Wikimedia**: gọi API tìm kiếm thoải mái; **tải ảnh** chỉ qua `cvm archive fetch|pick` (một luồng, giãn 5–8 s, bộ đếm chung mọi
  tiến trình ở `projects/.throttle/`), không tự viết vòng lặp curl/tải song song. Gặp 429: `cvm` tự dừng và chờ `Retry-After`
  (≤ 15 phút, quá thì báo lỗi) — không retry dồn; báo lỗi thì chờ hết hạn rồi chạy lại đúng lệnh đó.

## Báo cáo cuối
Thời lượng, số scene theo loại, token VieNeu đã dùng, số ảnh/phim tư liệu theo nguồn + giấy phép, credit Higgsfield đã dùng, các quyết định tự đưa ra (fallback, sửa lời), số liệu còn đáng ngờ, việc còn chờ user.
