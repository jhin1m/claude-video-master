# Hướng dẫn cài đặt — claude-video-master

Biến một ý tưởng thành video explainer tiếng Việt (giọng đọc + hình + phụ đề `.srt`) bằng Claude Code.
Đã chạy thử trên macOS. Linux chắc cũng chạy được. Windows thì dùng WSL (chưa thử).

## 1. Cần có sẵn

| Thứ | Ghi chú |
|---|---|
| Claude Code | `npm i -g @anthropic-ai/claude-code`, đăng nhập bằng tài khoản Claude (Pro/Max) |
| Node.js ≥ 22.18 (nên dùng 24) | `node -v` để kiểm tra. Không cần `tsx`, Node tự chạy file `.ts` |
| ffmpeg (đi kèm ffprobe) | macOS: `brew install ffmpeg` |
| git | |

## 2. Cài repo (làm một lần)

```bash
git clone https://github.com/jhin1m/claude-video-master.git
cd claude-video-master
npm install

# Bộ skill HyperFrames: Claude đọc để viết đồ hoạ/animation (khoảng 10 giây)
npx --yes skills add heygen-com/hyperframes --skill '*' -a claude-code -y

# Chrome headless dùng để render (tự tải về nếu máy chưa có)
npx --yes hyperframes@0.8.83 browser ensure
npx --yes hyperframes@0.8.83 doctor   # Node/FFmpeg/Chrome phải ✓; whisper/Kokoro/MusicGen báo ✗ là bình thường
```

## 3. API key (bắt buộc 2 cái)

```bash
cp .env.example .env
```

Mở `.env` rồi điền:

| Biến | Lấy ở đâu | Chi phí |
|---|---|---|
| `VIENEU_API_KEY` | https://vieneu.io → Cloud API | **Trả phí** theo số ký tự. Lệnh TTS luôn in ước tính trước, có `--yes` mới gửi |
| `PEXELS_API_KEY` | https://www.pexels.com/api/ | Miễn phí |

Ảnh tư liệu lấy từ Wikimedia Commons nên không cần key. **Không gửi file `.env` cho ai, cũng không commit nó.**

## 4. Higgsfield (ảnh/video AI): không bắt buộc

Không có tài khoản thì bỏ qua bước này. Pipeline tự nhận ra không có Higgsfield và dựng hình bằng Pexels,
Wikimedia Commons và đồ hoạ HTML. Ngay cả khi đã cài, AI cũng chỉ là phương án cuối.

Nếu có tài khoản thì nên cài:

```bash
claude mcp add --transport http --scope user higgsfield https://mcp.higgsfield.ai/mcp
```

Sau đó mở `claude`, gõ `/mcp`, chọn **higgsfield** rồi bấm **Authenticate** để đăng nhập trên trình duyệt.
Thêm MCP xong thì phải thoát Claude Code rồi mở lại mới dùng được.
Trần mặc định cho mỗi video là 8 ảnh + 3 video AI, và không quá 20% số credit đang có. Vượt trần thì Claude dừng lại hỏi.
Muốn đổi thì ghi `higgsfieldCreditCap` vào `brief.json`.

## 5. Kiểm tra

```bash
./cvm          # in danh sách lệnh là CLI chạy được
npm test       # mọi test phải pass
```

## 6. Dùng hằng ngày

Mở Claude Code **trong thư mục repo** (`cd claude-video-master && claude`), rồi gõ:

| Lệnh | Khi nào |
|---|---|
| `/video "ý tưởng của anh"` | Làm video mới, Claude hỏi brief trước (mỗi câu đều có sẵn mặc định) |
| `/video import duong-dan/kich-ban.md` | Đã có sẵn kịch bản |
| `/video resume <slug>` | Làm tiếp một project đang dở |
| `/video "…" --auto` | Chạy một mạch, không dừng lại chờ duyệt (vẫn giữ trần chi phí) |

Claude sẽ dừng lại để anh duyệt ở các bước: **brief → outline → kịch bản → animatic → bản render từng chương**.
Animatic là bản audio thật ghép với thẻ chữ, duyệt xong mới tốn công làm hình.

Kết quả nằm ở `projects/<slug>/`:
- `final.mp4`: video hoàn chỉnh
- `subs.srt`: phụ đề, tải lên YouTube dưới dạng file riêng (không in cứng vào hình)
- `credits.txt`: nguồn Pexels/Commons, **phải dán vào phần mô tả video** (giấy phép CC BY/BY-SA bắt buộc ghi nguồn)

`./cvm status` cho biết project đang ở bước nào và lệnh cần chạy tiếp theo.

## Ghi chú

- Giọng đọc đã duyệt: `Nhật Phong` (mặc định, nam miền Bắc) và `Châu Thảo` (nữ miền Bắc, giọng tin tức).
- Các quy ước (giọng, theme đồ hoạ, trần credit…) nằm trong `CLAUDE.md`. Muốn đổi thì sửa file đó, hoặc nói thẳng với Claude.
- Cập nhật bản mới: `git pull`, sau đó chạy lại lệnh `npx --yes skills add …` ở bước 2 nếu skill HyperFrames có bản mới.
- Render mỗi chương mất khoảng 1,5–2 phút (máy M3, 16 GB RAM). Video 15 phút cần còn trống vài GB ổ đĩa.
