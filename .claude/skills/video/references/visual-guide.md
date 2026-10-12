# Hướng dẫn phần hình (stage 2 + 5)

## Chọn loại hình cho scene
| Lời đọc nói về… | Loại | Ghi chú |
|---|---|---|
| Con số, tỷ lệ, so sánh, mốc thời gian | `animation` (spec counter/bars/ring) | số trên hình phải khớp lời đọc |
| Địa điểm, dòng chảy giữa nơi chốn | `animation` (spec map) | |
| Khái niệm, tên chiến lược, câu chốt | `text_card` (spec text) hoặc `animation` (layers/smile/versus/chain) | |
| Địa lý thật: tỉnh, nước, khu vực, tuyến đường | `animation` (spec geo) | bản đồ thật, mọi nước; không bao giờ để AI vẽ bản đồ |
| Bối cảnh thật chung chung: nhà máy, cảng, đô thị, con người | `stock` | không gắn nhãn sai địa điểm/công ty |
| Hiện vật, bản thảo, tranh khắc, chân dung, ảnh lịch sử **có thật** | `archive` (Wikimedia Commons) | đúng vật/người được nhắc; không để AI vẽ thay; **kèm chú thích dữ kiện** (tên, năm sinh–mất / năm + nơi) |
| **Thước phim** tư liệu có thật: thời sự 1929–1967, Thế chiến II, chiến tranh Lạnh, Apollo/NASA, phim chính phủ Mỹ, quảng cáo/giáo dục cũ | `archive` (Internet Archive, `cvm ia`) | phim ≥ 720p (SD chỉ khi user cho); kèm caption sự kiện + năm; tránh logo NASA, người nhận diện được |
| Thứ không quay được: quá khứ, ý niệm, cảnh đặc thù | Pexels/Commons/đồ hoạ trước; `ai_image` → `ai_video` chỉ khi cả ba không có | phương án cuối; theo trần credit; không có Higgsfield thì bỏ AI |
| Con số cần bối cảnh mà footage không có | `animation` + `bg` là ảnh Higgsfield | chỉ khi Pexels không có cảnh hợp; AI lo không khí, mẫu HTML lo số |
| Danh sách xếp hạng "top N", "N điều…" | `animation` (spec `rank`) | đếm ngược, hạng 1 hiện cuối |
| Chuỗi mốc thời gian, tiểu sử theo năm, lịch sử một ngành | `animation` (spec `timeline`) | 2–6 mốc; `focus` = mốc lời đọc nhấn |
| Quy trình, các bước, "làm thế nào" | `animation` (spec `steps`) | 2–5 bước; `active` = bước đang nói |
| Câu nói có thật của một người | `text_card` (spec `quote`) | đúng nguyên văn + nguồn trong `script.md`; dịch thì ghi rõ là bản dịch |
| Tin/bài báo có thật (tiêu đề, ngày, tờ báo) | `animation` (spec `headline`) | chỉ tiêu đề có thật; dịch sang tiếng Việt được, nguồn ghi `script.md` |
| "Nhìn vào dòng này": hồ sơ, bản thảo, văn bản, ảnh chụp tài liệu | `animation` (spec `docmark`) | ảnh thật (Commons/Internet Archive) làm hình chính, máy quay đẩy vào chỗ đánh dấu |
| Giới thiệu một nhân vật (lần đầu xuất hiện) | `animation` (spec `profile`) | chân dung thật + tên, năm sinh–mất, vai trò; thay cho caption khi cần kể 1–3 mốc đời |

Tránh 3 scene liền nhau cùng loại; xen footage giữa các đồ hoạ. Cùng một kiểu "hé lộ" (ví dụ thẻ trượt vào → đánh dấu)
không dùng quá 3 lần liền — đổi sang mẫu khác hoặc footage, kẻo người xem đoán trước được nhịp.

## Higgsfield: AI lo không khí, HTML lo dữ kiện
**Phương án cuối** (user chốt 2026-09-30): chỉ dùng khi đã tìm Pexels + Commons và cân nhắc đồ hoạ mà không có hình/video
phù hợp — ghi query đã thử vào `intent`. Session không có tool Higgsfield → không dùng AI, dựng bằng nguồn khác.
Dùng Higgsfield cho:
- **Scene `ai_image`/`ai_video`** khi Pexels không có cảnh đạt (đã `cvm stock search` mà không có ứng viên đúng nội dung): lịch sử, khái niệm trừu tượng, chủ đề ngách, cảnh đặc thù.
- **Nền (`bg`) cho mẫu đồ hoạ** chỉ khi đã tìm Pexels (`cvm stock search`) mà không có cảnh hợp với bối cảnh riêng (dây chuyền chip, phòng lab, ruộng lúa…). Lưu ở `visuals/bg/<sceneId>.png`, trỏ `"bg": { "src": "visuals/bg/<sceneId>.png" }`.

**Không** giao cho AI những thứ phải đúng: chữ (nhất là tiếng Việt có dấu), con số, biểu đồ, bản đồ/biên giới, cờ, logo/thương hiệu, gương mặt người thật có danh tính. Những thứ này luôn làm bằng mẫu HTML (`counter`, `chart`, `geo`, `text`…).

Prompt:
- Luôn thêm `no text, no letters, no numbers, no watermark, no logo, no borders`; tỉ lệ 16:9.
- Ảnh nền: `dark moody, low detail in the center, negative space` (chữ đồ hoạ nằm giữa khung; mẫu tự làm mờ + tối thêm).
- Mỗi ảnh (kể cả ảnh nền, lượt sinh lại) tính vào trần `ai_image` trong CLAUDE.md. Xem ảnh trước khi dùng; chữ giả hoặc viền phim thì cắt bằng ffmpeg `crop` hoặc sinh lại.

## Query Wikimedia Commons (`archive`)
Tiếng Anh hoặc tên gốc: `Ada Lovelace portrait`, `al-Jazari elephant clock`, `Mark I Perceptron`, `Babbage difference engine`,
`Vaucanson duck engraving`. Thêm `manuscript`, `engraving`, `photograph`, `folio` để lọc loại. Ưu tiên bản gốc thời đó
(tranh khắc, ảnh chụp) hơn bản dựng lại/ảnh bảo tàng hiện đại; dùng bản dựng lại thì lời đọc/intent phải khớp ("bản dựng lại").
Ảnh có tên người/đồ vật khác lời đọc → bỏ. Nhiều ảnh cùng một hiện vật ở các scene liền nhau: chọn khung khác nhau.
Thứ Pexels gần như không có (cờ vây, máy tính cổ, bản thảo…) → tìm Commons trước (`Go game board`, `baduk stones`).

**Chú thích dữ kiện trên hình (bắt buộc, `visual.caption`):** `{ "title": "…", "detail": "…" }` — title ngắn (≤ 40 ký tự), detail một dòng. Người → `Jacques de Vaucanson (1709–1782) · thợ đồng hồ, Paris`; hiện vật/bản
thảo → `Sách tri thức về các cơ cấu tài tình · al-Jazari, 1206 (bản chép 1315)`; bản dựng lại → `Đồng hồ voi · bản dựng lại, Dubai`.
Năm/nơi lấy từ trang Commons hoặc nguồn trong `script.md`, không đoán.

## Query Internet Archive (`cvm ia`)
Tiếng Anh, danh từ cụ thể của thời đó: `D-Day invasion`, `atomic bomb test`, `Sputnik`, `Berlin airlift`, `apollo moon`,
`space shuttle launch`, `television commercials 1950s`, `assembly line 1940s`. Chỉ tìm trong collection danh sách trắng
(`universal_newsreels`, `FedFlix`, `prelinger`, `wwIIarchive`, `nasa`); thu hẹp bằng `--collection universal_newsreels`.
Thực tế: phim trước 1970 hầu hết là 480p 4:3 → mặc định (≥ 720p) chủ yếu ra phim NASA đời mới; muốn dùng thước phim cũ thì
hỏi user cho `--min-height 480` (hình mềm hơn, dựng trên nền mờ). Ảnh tĩnh: `--type image` (chủ yếu NASA) — chân dung,
bản thảo vẫn tìm Commons trước.
**Duyệt bằng mắt**: logo/nhãn hiệu (quảng cáo cũ có nhãn hàng thật), watermark "Prelinger"/Getty in trên hình, khung đen
(`cvm` báo ⚠), người nhận diện được trong ngữ cảnh quảng cáo, nội dung tuyên truyền (lời đọc phải nói rõ bối cảnh).
Caption: `{ "title": "Đổ bộ Normandy", "detail": "Bản tin Universal · 6/6/1944" }`; năm lấy từ trang item, không đoán.

## Query Pexels
Tiếng Anh, danh từ cụ thể + góc máy: `aerial industrial park vietnam`, `container port crane`, `microchip close up`, `hanoi skyline sunrise`. Thêm `vietnam`/`hanoi`/`ho chi minh city` khi cần bối cảnh Việt Nam (Pexels có nhiều flycam KCN, cảng, TP.HCM). `cvm stock search` đã lọc: ngang, ≥1080p, dài ≥ slot + 1s.

**Duyệt bằng mắt (bắt buộc):** sau khi pick, ghép các `visuals/chNN/sNNN.jpg` thành một contact sheet (ffmpeg `xstack`, lặp bằng Python vì shell là zsh) rồi Read ảnh. Loại clip có: logo/nhãn hiệu rõ, khung trống/tường trắng, người nhận diện được trong ngữ cảnh tiêu cực, nội dung lệch lời đọc. Thay bằng ứng viên khác trong `stock/<sceneId>.json`.
Nền đồ hoạ (`--bg`): ứng viên đầu thường đủ (nền đã mờ + tối) — soát contact sheet `stock/bg/*.jpg`, thay 1–2 cái lệch ý.

## `visual.spec` cho `cvm graphics`
Tone màu: `accent` (màu nhấn của theme) · `cyan` (màu phụ) · `muted` · `dim`. Màu thật lấy từ theme (`brief.json` → `theme`, mặc định `muc-ho-phach`). Toạ độ map theo khung 1920×1080 (sơ đồ, không phải bản đồ thật). Ví dụ:

```json
{ "template": "counter", "kicker": "Vốn Samsung tại Việt Nam", "to": 24, "decimals": 0, "unit": "tỷ USD", "sub": "Khởi đầu: 670 triệu USD năm 2008" }
{ "template": "bars", "kicker": "Xuất khẩu 2025", "items": [{ "label": "Máy tính, điện tử", "value": 107.7, "tone": "accent" }, { "label": "Điện thoại", "value": 56.7, "tone": "cyan" }], "unit": "tỷ USD", "sub": "…" }
{ "template": "ring", "kicker": "Xuất khẩu 2025", "pct": 77.3, "label": "đến từ khối FDI", "sub": "367,1 / 475 tỷ USD" }
{ "template": "map", "kicker": "Bắc Ninh · 2008", "points": [{ "label": "Hà Nội", "x": 760, "y": 640 }, { "label": "Bắc Ninh", "x": 980, "y": 560, "highlight": true, "tag": "Yên Phong" }], "links": [[0, 1]], "sub": "…" }
{ "template": "text", "kicker": "Chiến lược mới", "text": "Trung Quốc + 1", "sub": "…" }
{ "template": "layers", "kicker": "Một chiếc điện thoại", "items": [{ "label": "Thiết kế", "value": "Cao" }, { "label": "Lắp ráp", "value": "Thấp", "tone": "cyan" }], "sub": "…" }
{ "template": "smile", "kicker": "Chuỗi giá trị", "left": "Nghiên cứu · Thiết kế", "right": "Thương hiệu · Bán hàng", "bottom": "Lắp ráp", "sub": "…" }
{ "template": "versus", "kicker": "2018 · Thương chiến", "left": "MỸ", "right": "TRUNG QUỐC", "leftTag": "Thuế quan →", "rightTag": "← Thuế quan", "sub": "…" }
{ "template": "chain", "kicker": "Đại dịch", "label": "Dồn hết vào một nước = rủi ro", "sub": "…" }
{ "template": "geo", "kicker": "Bắc Ninh · 2008", "zoom": [105.35, 20.72, 106.75, 21.52], "highlight": ["Bắc Ninh"], "pins": [{ "label": "Hà Nội", "lon": 105.85, "lat": 21.03 }, { "label": "KCN Yên Phong", "lon": 105.98, "lat": 21.17, "tag": "2008", "main": true }], "sub": "…" }
{ "template": "geo", "kicker": "Đông Á", "region": [95, 5, 145, 50], "zoom": [124, 33, 131, 39], "highlight": ["KOR"], "pins": [{ "label": "Seoul", "lon": 126.98, "lat": 37.57, "tag": "Samsung", "main": true }], "sub": "…" }
{ "template": "chart", "kicker": "FDI giải ngân", "items": [{ "label": "2021", "value": 19.7 }, { "label": "2025", "value": 27.6 }], "unit": "tỷ USD", "label": "vốn FDI giải ngân năm 2025", "badge": "Cao nhất 5 năm", "sub": "…" }
{ "template": "chat", "prompt": "Vì sao bầu trời có màu xanh?", "reply": "Ánh sáng mặt trời gồm nhiều màu…" }
{ "template": "duel", "kicker": "Hai phe · 1956 → nay", "from": 1956, "to": 2024, "lines": [{ "label": "Luật Lệ", "tone": "cyan", "points": [[1956, 0.55], [1997, 0.86], [2024, 0.36]] }, { "label": "Tự Học", "tone": "accent", "points": [[1956, 0.5], [1969, 0.16], [2012, 0.72], [2024, 1.0]] }], "marks": [{ "year": 1969, "label": "Bản án tử" }], "fade": 0, "sub": "…" }
{ "template": "links", "kicker": "Transformer · 2017", "words": ["Con", "mèo", "không", "qua", "đường", "vì", "nó", "quá", "mệt"], "links": [[6, 1], [6, 8], [3, 4]], "focus": 6, "sub": "…" }
{ "template": "montage", "step": 0.6, "items": [{ "src": "visuals/montage/llull.jpg", "year": "1308", "label": "Ramon Llull · Ars brevis" }, { "src": "visuals/montage/duck.jpg", "year": "1739", "label": "Con vịt của Vaucanson" }] }
{ "template": "rank", "kicker": "Cỗ máy “biết nghĩ” đầu tiên", "items": [{ "label": "Deep Blue thắng Kasparov", "value": "1997" }, { "label": "ELIZA", "value": "1966" }, { "label": "Mark I Perceptron", "value": "1958" }], "sub": "…" }
{ "template": "timeline", "kicker": "Hai lần AI “chết”", "events": [{ "year": "1956", "label": "Hội thảo Dartmouth" }, { "year": "1974", "label": "Mùa đông AI thứ nhất" }, { "year": "1987", "label": "Mùa đông AI thứ hai" }, { "year": "2012", "label": "AlexNet" }], "focus": 1, "sub": "…" }
{ "template": "steps", "kicker": "Mạng nơ-ron học thế nào", "steps": [{ "title": "Nhận dữ liệu", "detail": "một bức ảnh mèo" }, { "title": "Đoán", "detail": "“chó” — sai" }, { "title": "Sửa trọng số" }], "active": 2, "sub": "…" }
{ "template": "quote", "quote": "Ta chỉ nhìn thấy một quãng ngắn phía trước, nhưng ở đó có *rất nhiều việc* cần làm.", "author": "Alan Turing", "role": "Computing Machinery and Intelligence, 1950", "photo": "archive/raw/commons-152236331.jpg" }
{ "template": "headline", "kicker": "Báo chí năm 1958", "paper": "The New York Times", "date": "8 tháng 7, 1958", "headline": "Thiết bị mới của Hải quân *tự học* bằng cách làm", "deck": "…" }
{ "template": "docmark", "kicker": "Hồ sơ của Turing tại Princeton", "src": "archive/raw/commons-137325615.jpg", "marks": [{ "box": [0.385, 0.733, 0.385, 0.038], "type": "highlight", "note": "Đề tài luận án" }, { "box": [0.43, 0.803, 0.13, 0.03], "type": "circle", "note": "Bảo vệ: 18/5/1938", "side": "below" }], "sub": "Nguồn: Princeton University" }
{ "template": "profile", "photo": "archive/raw/commons-28131684.jpg", "name": "Ada Lovelace", "years": "1815–1852", "role": "Nhà toán học", "facts": [{ "year": "1833", "text": "Gặp Charles Babbage" }, { "year": "1843", "text": "Công bố Note G" }] }
```

- `geo` = **bản đồ thật** (Natural Earth): 63 tỉnh Việt Nam trước sáp nhập 2025 (`templates/geo/vietnam.json`) + mọi nước khác theo quan điểm Việt Nam (`templates/geo/world.json`, tên nước tiếng Việt). Luôn vẽ QĐ Hoàng Sa, QĐ Trường Sa thuộc Việt Nam. Mở ở `region` rồi zoom vào `zoom`, cả hai là `[lonMin, latMin, lonMax, latMax]`.
  - Không có `region` → toàn cảnh Việt Nam (láng giềng tối, nhãn đặt tay). Có `region` → khu vực bất kỳ, mọi nước cùng màu, nhãn nước tự đặt (chỉ hiện khi vừa trong lãnh thổ; "VIỆT NAM" luôn ưu tiên); `labels: [{ "text", "lon", "lat" }]` thay nhãn tự động (vd. tên biển, đại dương).
  - `highlight` = tên tỉnh đúng như trong `vietnam.json` và/hoặc mã ISO-3 nước (`KOR`, `USA`, `DEU`; `VNM` = cả Việt Nam). Tên in trên vùng tô sáng chỉ hiện khi đủ chỗ sau zoom; nơi quá nhỏ thì dùng ghim.
  - Toạ độ ghim là kinh/vĩ độ thật. Khung `zoom` ngoài Việt Nam nên rộng ≥ 3° (dữ liệu thế giới giản lược ~2 km, zoom sâu hơn sẽ thấy đường gãy khúc). Không hỗ trợ vùng vắt qua kinh tuyến 180°.
  - `map` cũ chỉ còn cho sơ đồ trừu tượng.
  - Dựng lại dữ liệu thế giới: `node src/graphics/build-world-geo.ts <ne_10m_admin_0_countries_vnm.geojson>` (link tải trong đầu file).
- `duel` = hai đường cong chạy trên trục năm (mức 0–1 chỉ mang tính minh hoạ, không vẽ trục giá trị — không dùng cho số liệu thật); `marks` hiện khi đường chạy qua; `fade` làm mờ đường thua.
- `links` = câu thành hàng ô chữ, cung sáng nối các cặp từ liên quan; cung chạm `focus` vẽ sau cùng, sáng nhất (minh hoạ attention).
- `chat` = cửa sổ chat sáng: câu hỏi được gõ vào ô nhập (có tiếng phím), gửi lên thành bong bóng, câu trả lời chảy ra từng chữ. Nội dung trả lời phải đúng sự thật.
- `montage` = cắt nhanh qua ảnh tĩnh 1920×1080 (thường lấy từ `cvm archive pick` rồi chép sang `visuals/montage/`), mỗi ảnh `step` giây kèm mốc năm + nhãn; ảnh cuối giữ đến hết scene. Không mở bằng ảnh vừa chiếu ở scene ngay trước. Ghi credit từng ảnh vào `visual.sources` (mảng, cùng dạng `visual.source`) để `credits.txt` đủ tên.
- **Mẫu kể chuyện** (`rank` `timeline` `steps` `quote` `headline` `docmark` `profile`, mã ở `src/graphics/story.ts` + bản Hồ sơ
  ở `dossier-story.ts`) — luật chung: mỗi màn một tiêu điểm (ý chính hiện xong thì phần còn lại lùi mờ), dựng khung trước →
  dữ liệu → một chú thích, tư liệu thật làm hình chính.
  - `rank`: `items[0]` là hạng 1; hiện từ hạng cuối lên, hạng 1 hiện sau cùng rồi sáng lên (pop). 2–6 mục; `value` là chữ tuỳ ý (năm, số + đơn vị).
  - `timeline`: 2–6 mốc rải đều trên trục (không theo tỉ lệ năm — khoảng cách năm khác nhau vẫn cách đều); mốc xen trên/dưới trục; `year` là chữ (`"1950"`, `"TK 18"`, `"1950s"`).
  - `steps`: cả quy trình hiện mờ trước, từng bước sáng dần tới `active` (mặc định bước cuối); bước xong có dấu tích.
  - `quote`: `*…*` = cụm nhấn; `photo` tuỳ chọn (ảnh chân dung trong project). Câu ≤ 150 ký tự thì đọc kịp.
  - `headline`: dựng lại mẩu báo bằng chữ (không chụp báo thật); thân bài là các vạch xám, không bịa chữ. `*…*` = chữ được tô.
  - `docmark`: `src` = ảnh tài liệu trong project (ảnh gốc ở `archive/raw/`); `box` = `[x, y, w, h]` theo tỉ lệ 0–1 của ảnh (đo trên
    ảnh: mở ảnh, đọc toạ độ pixel rồi chia cho kích thước); 1–4 dấu, `type` = `highlight` (mặc định) · `circle` · `underline` ·
    `redact`; `note` đặt bên phải nếu đủ chỗ, `side` ép `right`/`above`/`below`; `"zoom": false` để không đẩy máy quay. Kích thước ảnh
    `cvm graphics` tự đo. Vẫn ghi `visual.source` (credit) như ảnh tư liệu.
  - `profile`: ảnh chân dung + tên + `years` (chữ số cuộn như đồng hồ, có tick) + vai trò + ≤ 3 mốc đời.
- `chart` = cột + đường xu hướng; phần tử cuối là số tiêu đề (chữ số cuộn, chuyển thể từ registry `number-wheel`).
- `text`: con số trong câu tự đổi sang font số màu nhấn; bọc `*chữ*` để tô nền màu nhấn; không có số/`*` thì từ cuối được gạch chân. Câu càng ngắn chữ càng to (≤ 10 ký tự: 230px).
- `layers`: nếu có tone khác số đông (vd. một dòng `cyan` giữa các dòng `accent`), dòng đó tự sáng lên sau khi xếp xong — dùng tone để chỉ "ngoại lệ".
- Mọi mẫu dựng xong trong ~2,5s rồi giữ hình (máy quay đẩy chậm 3%); cảnh nên dài ≥ 4,5s.
- **Nền footage Pexels là mặc định** cho mọi mẫu trừ `geo` và `montage` (user chốt 2026-09-30: nền mực trơn trông "công nghiệp"). Quy trình: `cvm stock search <sceneId> "<query>"` → `cvm stock pick <sceneId> <id> --bg` (cắt slot + 0,5s đuôi → `stock/bg/<sceneId>.mp4`, ghi `visual.spec.bg` + credit vào `visual.source`, xuất `stock/bg/<sceneId>.jpg` để xem) → `cvm graphics`. Nền được làm mờ 6px, sáng 0,6, Ken Burns chậm; chỉnh bằng `"blur"`/`"dim"` trong `bg` nếu footage quá rối/sáng. Chọn cảnh hợp ý câu (cảng → xuất khẩu, KCN → FDI, server → AI); ít chi tiết ở nửa trái vì chữ nằm đó. Không lấy trùng clip với scene `stock` liền kề trừ khi cố ý nối cảnh.
- Mọi chữ có viền tối (`colors.stroke` của theme) + bóng mềm để không chìm vào footage; chữ trên ô màu nhấn và khung chat không có viền.
- Mỗi mẫu tự khai báo SFX của chuyển động mình (`soundCues()` trong `templates.ts`: tick khi số chạy, whoosh khi bản đồ zoom, pop khi ghim/huy hiệu hiện).

- `text` ô tô màu `*…*`: dấu câu viết liền sau dấu `*` (`*tự nghĩ ra*?`, `(*diễn*)`) được dính vào cụm, không rớt dòng; có dấu cách thì là từ riêng.

## Soát trước khi render (cổng soi mẫu)
Mỗi mẫu dùng trong video: render 1 scene (`cvm graphics --chapter N --scene <id> --draft`), lấy frame **độ phân giải gốc**
lúc mẫu đã dựng xong (`ffmpeg -ss 3 -i visuals/chNN/sNNN.mp4 -frames:v 1 f.png`), crop phóng to rồi Read. Contact sheet thu nhỏ
không thấy lỗi dấu (lỗi "DIỄN" mất dấu ngã từng phải render lại cả video).
- [ ] Chữ có **dấu chồng** (ễ ỗ ẫ ẵ ấ ể, Ự Ậ) trong ô tô màu `*…*`, pill/nhãn (`tag`, `badge`, `dtag`) và mask chữ: dấu nằm trọn
      trong ô/không bị cắt; phần dấu thò ra ngoài ô là chữ tối trên nền tối → mất. Viết spec có sẵn một chữ như vậy khi soi.
- [ ] Dấu câu đi liền `*…*`: `*…*?` không rớt dòng, không cách xa ô.
- [ ] Chữ không chìm vào footage nền (viền tối + bóng còn đọc được ở vùng sáng nhất của nền).
- [ ] `montage`: ảnh đầu **không** trùng ảnh vừa chiếu ở scene ngay trước (khán giả thấy như bị lặp/giật).
- [ ] Footage (scene `stock` và nền `bg`) — lỗi hay gặp: cờ tướng/cờ vua thay cho cờ vây; logo card đồ hoạ (GALAX, RTX, GeForce)
      trên cảnh "máy tính/AI"; sách/bìa có tên thật (thánh ca, sách tôn giáo) trong cảnh "tri thức"; chữ/biển hiệu đọc được.
- [ ] Số, năm, tên trên hình khớp lời đọc và `script.md`.
Qua hết thì mới render hàng loạt (`cvm graphics --chapter N --jobs 2`).

Thêm mẫu mới: sửa `src/graphics/templates.ts` (thêm vào union `GraphicSpec` — mẫu kể chuyện thì `StorySpec` + `story.ts`/`dossier-story.ts` —, `TEMPLATES`, `TEMPLATE_VERSIONS`, `build()`; dùng chung `kick()`, `sub()`, `mask()`/`rise()`, `wheel()` và màu từ `t.colors`), sửa mẫu có sẵn thì tăng số của mẫu đó trong `TEMPLATE_VERSIONS` (sửa phần dùng chung thì tăng tất cả), chạy `npm run typecheck`, render thử `--draft`. Trước khi tự viết chuyển động, tìm khối có sẵn: `npx --yes hyperframes@0.8.83 catalog --query "<hiệu ứng bằng tiếng Anh>" --json` (xem skill `/hyperframes-registry`).

## Xem trước trên điện thoại
`graphics/<sceneId>/index.html` tự phát khi mở ngoài HyperFrames, nên có thể publish nó thành Artifact để user xem animation thật trước khi render (nhớ gửi kèm thư mục `fonts/` qua `files`). Gộp nhiều mẫu vào một trang thì **không dùng iframe** trỏ tới file con (khung xem Artifact không tải) — nhúng mỗi mẫu vào Shadow DOM và chạy JS của mẫu trong `gsap.context(..., root)`.
