# Nghiên cứu: dạng video faceless + nguồn Internet Archive (2026-10-13)

Kết quả đã làm: 7 mẫu đồ hoạ kể chuyện mới (2 theme), lệnh `cvm ia` cho Internet Archive. Commit `5cc72f7`, `5aa8648` (+ commit docs), **chưa push**.
Báo cáo chi tiết IA (API, probe thật, số liệu độ phân giải): [researcher-261013-internet-archive-report.md](researcher-261013-internet-archive-report.md).

## 1. Nguồn đã khảo sát
- **GitHub faceless/auto-video**: [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (~130k★), [short-video-maker](https://github.com/gyoridavid/short-video-maker), [MoneyPrinter](https://github.com/FujiwaraChoki/MoneyPrinter), [ShortGPT](https://github.com/RayVentura/ShortGPT) (ngừng từ 2025-02). Tất cả là "stock footage + giọng đọc + phụ đề"; **không repo nào có mẫu đồ hoạ dữ liệu** → pipeline mình đã đi xa hơn ở phần đồ hoạ. Thứ họ có mà mình bỏ: phụ đề từng từ (user đã chốt không burn-in).
- **Remotion**: [remotion.dev/templates](https://www.remotion.dev/templates), [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates) — nhóm mẫu Charts/Text/Content/Cinematic; mẫu đáng học: Animated List, Progress Steps, Quote Card, Timeline, Polaroid/Photo Stack.
- **HyperFrames registry** (`npx --yes hyperframes@0.8.83 catalog --json`, 446 mục): `bar-chart-race`, `beat-timeline`, `marker-highlight`, `cursor-annotate`, `hw-callout-circle`, `marker-checklist-card`, `news-ticker`, `testimonial-card`, `nyc-paris-flight`, `split-flap-board` — dùng làm tham chiếu chuyển động, không cài vào repo.
- **[alchaincyf/huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion)** (MIT, user gợi ý): 8 "ngữ pháp hoạt hình giải thích" đo từ video thật — Kurzgesagt, Vox (bàn tư liệu), 3Blue1Brown, whiteboard, storytime, kinetic type, keynote UI, finance chart. Quy luật đã áp dụng vào mẫu mới:
  - một màn một tiêu điểm (ý chính hiện xong thì phần còn lại lùi mờ) → `rank`, `timeline`, `steps`;
  - dựng khung trước → dữ liệu → một chú thích → mọi mẫu mới;
  - **tư liệu thật làm hình chính, máy quay đẩy vào đúng dòng đang đọc** (Vox) → `docmark`;
  - vào chậm/ra nhanh, số dừng ≥ 0,5 s sau khi chạy xong; luân phiên kiểu "hé lộ", không dùng một kiểu quá 3 lần liền → ghi vào `visual-guide.md`;
  - "máy quay mượt, phần tử bước 12 fps" (Vox) → bản Hồ sơ đã có `hs.boil` (bước 10 fps), chưa áp cho toàn bộ (xem câu hỏi 6).
- Thể loại faceless (nguồn yếu, chỉ gián tiếp: [Opus](https://www.opus.pro/blog/faceless-youtube-niches-2026), [RNDR](https://rndr.beehiiv.com/p/5-visuals-next-video-908f), [Vozo](https://www.vozo.ai/blogs/youtube/profitable-faceless-youtube-niches)).

## 2. Đối chiếu thể loại ↔ mẫu
| Dạng video | Thiết bị hình lặp lại | Mẫu có sẵn | Thiếu | Đã thêm |
|---|---|---|---|---|
| Top-N / "N điều" | số hạng đếm ngược, #1 cuối | bars (một phần) | xếp hạng tuần tự | **`rank`** |
| Lịch sử / tiểu sử theo năm | trục năm, mốc | montage, duel | trục sự kiện có nhãn | **`timeline`** |
| Khoa học / how-to | bước đánh số, tiến độ | layers, chain | danh sách bước | **`steps`** |
| Trích dẫn | ngoặc kép lớn, tác giả | text | thẻ trích dẫn | **`quote`** |
| Tin tức / báo chí | mẩu báo, tiêu đề tô | text | mẩu báo | **`headline`** |
| True crime / phân tích tư liệu | trang tài liệu, khoanh, tô, bôi đen | — | hoàn toàn thiếu | **`docmark`** |
| Giới thiệu nhân vật | chân dung + năm sinh–mất + mốc | caption archive | thẻ nhân vật | **`profile`** |
| So sánh A/B | chia đôi | versus, duel | so kích thước | (đề xuất `scale`) |
| Hành trình | đường đi trên bản đồ | geo, map | tuyến chạy trên bản đồ thật | (đề xuất `route` = tuỳ chọn của `geo`) |
| Điều tra | bảng chứng cứ dây đỏ | links | ghim ảnh + dây | (đề xuất `board`) |
| Kinetic typography | chữ bật theo nhịp | text, links | đủ | — |

## 3. Mẫu đồ hoạ mới (đã làm)
Mã: `src/graphics/story.ts` (editorial + nhịp dùng chung + kiểm spec + SFX) và `src/graphics/dossier-story.ts` (theme `ho-so`, thiết kế lại bố cục + chuyển động, không chỉ đổi màu). Mỗi mẫu `TEMPLATE_VERSIONS = 1`; 15 mẫu cũ cho HTML **giống hệt từng byte** (so 282 HTML của 3 project thật ở 3 theme).

| Mẫu | Editorial | Hồ sơ | SFX |
|---|---|---|---|
| `rank` | hàng xếp hạng trượt lên từ hạng cuối, #1 có thanh sáng + số nảy, hàng khác lùi mờ | phiếu kẻ dòng dán băng keo, số hạng viết tay đỏ, #1 tô dạ quang + khoanh mực | tick mỗi hàng, pop #1 |
| `timeline` | trục vẽ đều có đầu sáng chạy, mốc trên/dưới, mốc trọng tâm phồng + vòng xung | đường kẻ tay, phiếu giấy ghim + chỉ đỏ, năm viết tay, khoanh mực năm trọng tâm | tick mỗi mốc, pop trọng tâm |
| `steps` | nút số trên đường ray, cả quy trình hiện mờ trước, từng bước sáng, bước xong thành dấu tích | sổ checklist, ô vuông vẽ tay, tích đỏ, bước đang nói tô dạ quang | tick mỗi bước |
| `quote` | ngoặc kép lớn, chữ trồi khỏi mask, cụm `*…*` lên nền màu nhấn, ảnh tròn có vòng | chữ gõ máy từng từ, ngoặc viết tay đỏ, nhãn Dymo tên, ảnh in dán băng keo | — |
| `headline` | trang báo bay lên nằm nghiêng, máy quay đẩy vào tiêu đề, tô từng cụm | mẩu báo xé mép rơi xuống + rung, dán 3 băng keo, dạ quang + gạch ngày đỏ | whoosh, tick mỗi cụm |
| `docmark` | tài liệu thật gần đầy khung, máy quay đẩy vào chỗ đánh dấu, tô/khoanh/gạch/bôi đen + nhãn chú thích | bản photocopy dán băng keo, đẩy vào + thẳng tờ giấy, mực đỏ/dạ quang/bút đen, chú thích viết tay trên giấy note | whoosh, tick mỗi dấu |
| `profile` | ảnh lộ từ dưới + khung lệch màu nhấn, tên, năm sinh–mất cuộn số, ray mốc đời | bìa hồ sơ, ảnh ghim, tên in, năm cuộn số rồi khoanh đỏ, mốc gõ máy | tick khi số cuộn + mỗi mốc |

Đã render nháp đủ 7 × 2 theme (project thử `template-lab`, `template-lab-hoso`), xem frame, sửa lỗi phát hiện: gradient trục timeline (bbox cao 0), chữ nhoè trên ô màu nhấn, class `.clip` trùng class dành riêng của HyperFrames (có test chặn), class `.cd` trùng CSS Hồ sơ, vệt dạ quang lệch (đầu nét tròn giãn theo bề rộng), `tl.to` ghi giá trị đầu muộn khi tua.

## 4. Remotion: chỉ học, không thêm dependency
Đề xuất **không** dùng Remotion: giấy phép source-available (công ty ≥ 4 người phải trả phí — [FAQ](https://www.remotion.dev/docs/license/faq), chưa đọc LICENSE.md gốc), kéo theo React + bundler, trùng vai với HyperFrames đã tích hợp. Các mẫu học từ Remotion đã viết lại bằng HTML/GSAP.

## 5. Internet Archive (đã làm `cvm ia`)
- API: Advanced Search (`advancedsearch.php`, sort downloads) → Metadata API (`/metadata/<id>`) chọn file → cắt bằng `ffmpeg -ss` trên URL đã resolve redirect (HTTP range, không tải cả phim; ~6–8 s/đoạn).
- **Danh sách trắng** (lý do + bằng chứng trong báo cáo chi tiết): `universal_newsreels`, `FedFlix` (phân biệt hoa thường), `prelinger`, `wwIIarchive` — bắt buộc item có `licenseurl` PD/CC0; `nasa` — nhận khi không có licenseurl (tác phẩm chính phủ Mỹ), nhắc soát logo NASA + người nhận diện được.
- **Loại**: item nằm cả trong bộ upload cộng đồng (`opensource_movies`, `community`, `ourmedia`, `feature_films`, `classic_tv*`, `flickrcommons`…), NC/ND, `rights` có "fair use"/"all rights reserved"/"©", mô tả nhắc Getty/"licensed from", geo-restricted, bản trùng tên + năm. Bằng chứng: bản Apollo 4K re-upload mang CC BY-NC-ND; item "Apollo 11" ghi PD Mark **và** "Fair Use Notice".
- Giấy phép chấp nhận: CC PD Dedication cũ (`licenses/publicdomain/`), PD Mark, CC0, CC BY, CC BY-SA.
- Chủ đề nên dùng IA: thước phim 1920–1967 (Thế chiến II, chiến tranh Lạnh, thử bom nguyên tử, Sputnik, đời sống/quảng cáo Mỹ 1930–60), Apollo/NASA, phim huấn luyện/công nghiệp của chính phủ Mỹ. Không dùng: chủ đề hiện đại (Pexels), ảnh tĩnh chân dung/bản thảo (Commons tốt hơn, có tác giả + giấy phép máy đọc được), chủ đề ngoài Mỹ.
- Thử thật: tìm "world war II", "apollo moon", "space shuttle launch", "1950s commercial", "the space program"; pick 2 phim NASA (720p, 4K) + 2 ảnh NASA + 1 phim Prelinger 4:3 (`--min-height 480`); render + `final` → `credits.txt` đúng 4 dòng nguồn. Phát hiện + sửa: URL CC0 bị khớp nhầm luật PD cũ (test bắt), phim 4:3 bị cắt khung trong render (nay dùng bản đã đóng khung làm nguồn), đoạn giữa phim rơi vào khung đen (nay báo ⚠).

## Câu hỏi chờ duyệt
1. **Ngưỡng 720p cho phim Internet Archive.** Số liệu: chỉ 1,3% item có MP4 ≥ 720p (80 item mẫu); Prelinger/newsreel hầu hết 640×480, Apollo 852×480. Với 720p, 3 chủ đề thử ("world war II", "1950s commercial", "apollo moon") ra **0** phim, chỉ phim NASA đời mới qua. Đã giữ 720p (quy tắc của anh) + thêm `--min-height 480` để mở khi anh cho phép; phim 4:3 dựng trên nền mờ, không cắt. → Anh có muốn hạ mặc định xuống 480 cho phim tư liệu không?
2. **Prelinger bắt buộc `licenseurl`** (theo FAQ của chính Prelinger: nhiều phim không phải PD) → mất ~82% kho Prelinger. Tôi chọn chặt. Nới thì rủi ro bản quyền.
3. **`headline` dịch tiêu đề sang tiếng Việt.** Tôi ghi trong hướng dẫn là được dịch (nguồn ghi ở `script.md`). Nếu anh muốn giữ nguyên văn tiếng Anh trên mẩu báo, cần đổi hướng dẫn.
4. **Mẫu chưa làm** (đề xuất đợt sau): `route` (tuyến chạy trên bản đồ thật — nên là tuỳ chọn của `geo`), `board` (bảng chứng cứ dây đỏ), `scale` (so kích thước). `iceberg`/`ticker` bỏ vì thiếu nhu cầu thật.
5. **Ảnh Internet Archive** hầu như chỉ có NASA; ảnh LoC/NARA trên IA không có giấy phép máy đọc được nên chưa đưa vào danh sách trắng.
6. **"Phần tử bước 12 fps"** (Vox) cho theme Hồ sơ: hiện chỉ nét mực "sôi" bước 10 fps; áp cho cả chuyển động thẻ/giấy sẽ đổi mọi mẫu Hồ sơ → phải tăng phiên bản cả 22 mẫu và render lại video cũ. Chưa làm, chờ anh quyết.
7. **Ken Burns trên phim 480p** làm hình mềm thêm (báo cáo IA khuyên không zoom > 1.0 với phim SD). Hiện render áp Ken Burns như stock; nếu dùng nhiều phim SD nên tắt cho cảnh đó.
8. Chưa push lên GitHub (goal: "chưa push"). Project thử `template-lab*`, `ia-lab` nằm trong `projects/` (không commit), xoá được.
