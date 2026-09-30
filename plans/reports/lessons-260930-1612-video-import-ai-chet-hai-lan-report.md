# Đúc kết: `/video import` — ai-chet-hai-lan (2026-09-30)

## Trạng thái khi dừng
- Project `projects/ai-chet-hai-lan/`: 150 scene / 12 chapter, TTS xong (16,1 phút, Nhật Phong).
- Visual 150/150 có asset (41 archive có caption, 47 stock, 62 đồ hoạ có nền Pexels). Đồ hoạ đã render lại với TEMPLATE_VERSION 10.
- Render xong ch01, ch02. Còn: `cvm render --chapter 3..12` → `cvm final` → kiểm ffprobe/blackdetect/silencedetect.
- Chưa làm animatic (chế độ chạy một mạch).

## Thời gian ~2h20, mất vào đâu
| Việc | Mất | Nguyên nhân gốc |
|---|---|---|
| Wikimedia 429 | ~35 phút kẹt | Tải bản gốc/thumbnail 2560 (không phải cỡ chuẩn), gọi dồn 40 ảnh, retry dồn làm block kéo dài (`retry-after: 600`) |
| Render trên máy | ~10 phút/lượt đồ hoạ (60 scene) + ~2 phút/chapter | Tuần tự |
| Lỗi mất dấu ngã "DIỄN" | ~20 phút tìm + ~10 phút render lại toàn bộ | Dấu ngã của glyph chồng (ễ ỗ ẫ ẵ) nằm trên mép ô tô màu `.hlb` → chữ tối trên nền tối. Không lộ ở contact sheet thu nhỏ |
| Job nền chạy song song cùng ghi `manifest.json` | nguy cơ mất dữ liệu; 1 job tưởng đã kill vẫn chạy | Lệnh `cvm` read-modify-write manifest, không khoá |
| 2 mẫu mới (`duel`, `links`) | ~10 phút | Kịch bản yêu cầu đồ hoạ lặp lại mà repo chưa có |

## Đã sửa trong repo (session này)
- `src/stock/wikimedia.ts`: `THUMB_WIDTH` 2560 → 1920 (cỡ chuẩn Wikimedia; cỡ lạ/bản gốc bị throttle).
- `src/graphics/templates.ts`: thêm `duel`, `links`; `.hlb` top `.06em → -.14em` (bao dấu chồng); mask `.m/.mb` padding trên `.24 → .42em`; `.dtag` bỏ viền chữ; TEMPLATE_VERSION 10.
- `CLAUDE.md`, `visual-guide.md`: ghi 2 mẫu mới.

## Kinh nghiệm (đưa vào skill)
1. **Ước lượng thời lượng theo giọng thật**: Nhật Phong đọc ~14,4 ký tự/s (không phải 16) + pause trung bình ~0,5 s/scene → kịch bản "13 phút" ra 16 phút. Nên TTS thử 1 chapter, đo ký tự/s, báo lệch trước khi TTS hết.
2. **Import: đối chiếu lời tự động** — nối narration từng chapter so với bản gốc (bỏ markdown + danh sách sửa có chủ đích) ⇒ phát hiện gõ nhầm 100%. Làm thành bước bắt buộc.
3. **Wikimedia**: tìm (API) thoải mái, **tải** thì giãn ≥ 5–8 s/ảnh, dừng hẳn khi 429 và chờ `retry-after`, không retry dồn. Tải trước file raw vào `archive/raw/` (pick dùng lại) để tách khỏi bước ghi manifest.
4. **Một người ghi manifest tại một thời điểm**: không chạy song song 2 lệnh `cvm` có ghi manifest (archive/stock pick, graphics, asset set). Kill job nền bằng TaskStop (pkill con không dừng vòng lặp Python cha).
5. **Soi chữ ở độ phân giải gốc**: contact sheet thu nhỏ che mất lỗi dấu. Với mỗi mẫu đồ hoạ có chữ tô màu/pill, chụp 1 frame gốc và crop phóng to từ chữ có dấu chồng (ễ ỗ ẫ ẵ ấ ể).
6. **Chữ tô màu `*…*`**: dấu câu ngay sau `*` bị tách thành từ riêng và rớt dòng → đặt dấu câu bên trong `*…?*`.
7. **Montage** không mở bằng ảnh vừa chiếu ở scene ngay trước.
8. **Soát footage**: lỗi hay gặp — cờ tướng thay cờ vây, logo card đồ hoạ (GALAX/RTX), sách có tên thật (thánh ca). Pexels gần như không có cờ vây → dùng Commons.
9. **Nền đồ hoạ tự chọn ứng viên đầu** đủ tốt (nền bị mờ + tối); chỉ cần soát contact sheet và thay 1–2 cái.
10. **Render là nút cổ chai**: 12 chapter ≈ 25 phút tuần tự.

## Câu hỏi còn mở
- Có cho render nhiều chapter song song không (CPU, RAM, và `render` có ghi manifest không)?
- Có muốn thêm khoá file (lock) cho manifest thay vì dựa vào kỷ luật tuần tự?

## Prompt cho session sau
```
Cải thiện skill /video (.claude/skills/video/) và CLI cvm theo đúc kết ở
plans/reports/lessons-260930-1612-video-import-ai-chet-hai-lan-report.md. Làm theo thứ tự, mỗi mục xong thì typecheck:

1. SKILL.md — mục "Nhập kịch bản có sẵn": thêm bước bắt buộc đối chiếu lời (nối narration từng chapter, so với lời dẫn
   gốc đã bỏ markdown, trừ danh sách sửa có chủ đích); thêm bước TTS thử 1 chapter → đo ký tự/giây thật của giọng →
   ước lượng lại tổng thời lượng (tính cả pause) và báo nếu lệch mục tiêu > 15% trước khi TTS hết.
   Cập nhật CLAUDE.md: nhịp đọc Nhật Phong ≈ 14,4 ký tự/s.
2. SKILL.md + CLAUDE.md — quy tắc vận hành: không chạy song song 2 lệnh cvm cùng ghi manifest.json; dừng job nền bằng
   TaskStop; Wikimedia: tải giãn ≥ 5 s/ảnh, gặp 429 thì dừng và chờ retry-after, không retry dồn.
3. cvm: thêm khoá file cho manifest (read-modify-write trong lock, Node built-in, không thêm dependency) để chạy song song
   an toàn. Hỏi tôi trước nếu cần đổi kiến trúc.
4. cvm archive: thêm `cvm archive fetch <sceneId|pageid…>` hoặc cờ giãn cách/tôn trọng Retry-After trong download()
   (src/media.ts) cho host upload.wikimedia.org.
5. Đo thử `cvm render` có ghi manifest không; nếu không, thêm `cvm render --chapters 3-12 --jobs N` (N mặc định 2)
   để render song song — đo CPU/RAM trên 2 chapter trước khi chọn N. Hỏi tôi trước khi đổi mặc định.
6. visual-guide.md — checklist soát: crop frame gốc ở chữ có dấu chồng (ễ ỗ ẫ ẵ ấ ể) cho mỗi mẫu có chữ tô màu/pill;
   dấu câu đặt trong `*…?*`; montage không mở bằng ảnh vừa chiếu; lỗi footage hay gặp (cờ tướng ≠ cờ vây, logo GPU,
   tên sách thật); Pexels thiếu cờ vây → Commons.
7. Sửa mẫu `text` (src/graphics/templates.ts) để dấu câu ngay sau `*…*` dính vào từ trước (không rớt dòng), rồi viết
   test nhỏ (node --test) cho việc đó và cho manifest lock.

Không render/TTS project nào trong session này. Cuối cùng tóm tắt thay đổi và việc còn lại.
Sau đó (nếu tôi bảo) render tiếp projects/ai-chet-hai-lan: cvm render --chapter 3..12 → cvm final.
```
