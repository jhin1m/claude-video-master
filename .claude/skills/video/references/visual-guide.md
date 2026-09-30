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
| Thứ không quay được: quá khứ, ý niệm, cảnh đặc thù | Pexels/Commons/đồ hoạ trước; `ai_image` → `ai_video` chỉ khi cả ba không có | phương án cuối; theo trần credit; không có Higgsfield thì bỏ AI |
| Con số cần bối cảnh mà footage không có | `animation` + `bg` là ảnh Higgsfield | chỉ khi Pexels không có cảnh hợp; AI lo không khí, mẫu HTML lo số |

Tránh 3 scene liền nhau cùng loại; xen footage giữa các đồ hoạ.

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

Thêm mẫu mới: sửa `src/graphics/templates.ts` (thêm vào union `GraphicSpec`, `TEMPLATES`, `TEMPLATE_VERSIONS`, `build()`; dùng chung `kick()`, `sub()`, `mask()`/`rise()`, `wheel()` và màu từ `t.colors`), sửa mẫu có sẵn thì tăng số của mẫu đó trong `TEMPLATE_VERSIONS` (sửa phần dùng chung thì tăng tất cả), chạy `npm run typecheck`, render thử `--draft`. Trước khi tự viết chuyển động, tìm khối có sẵn: `npx --yes hyperframes@0.8.83 catalog --query "<hiệu ứng bằng tiếng Anh>" --json` (xem skill `/hyperframes-registry`).

## Xem trước trên điện thoại
`graphics/<sceneId>/index.html` tự phát khi mở ngoài HyperFrames, nên có thể publish nó thành Artifact để user xem animation thật trước khi render (nhớ gửi kèm thư mục `fonts/` qua `files`). Gộp nhiều mẫu vào một trang thì **không dùng iframe** trỏ tới file con (khung xem Artifact không tải) — nhúng mỗi mẫu vào Shadow DOM và chạy JS của mẫu trong `gsap.context(..., root)`.
