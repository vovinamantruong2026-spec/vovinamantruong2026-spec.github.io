# Bổ sung quản lý vận hành CLB

## Chức năng

- Cài đặt & sao lưu: tình trạng sao lưu tuần, lần lỗi và cảnh báo quá 8 ngày chưa có bản mới.
- Bản sao đầy đủ: ZIP gồm data.json, ảnh võ sinh, CCCD và chứng chỉ còn được hồ sơ tham chiếu, kể cả hồ sơ trong thùng rác. Tải đủ tệp và kiểm tra toàn vẹn rồi mới cho tải ZIP. Nếu dữ liệu thay đổi trong lúc tải tệp, dừng và yêu cầu thử lại.
- Kiểm tra khôi phục cục bộ: chọn ZIP, xác minh SHA-256, liên kết lớp/võ sinh/điểm danh/học phí và tái tạo dữ liệu cùng tệp vào bộ nhớ riêng. Không ghi dữ liệu thử vào Firebase thật.
- Khôi phục: dùng data.json với quy trình xem trước/hoàn tác hiện có. Sau đó chọn ZIP đã kiểm tra và bấm Phục hồi tệp bị thiếu. Tệp tồn tại không bị ghi đè; chỉ chủ CLB có quyền, liên kết và dung lượng/định dạng phải khớp hồ sơ hiện tại. Cần chức năng studentFiles mới.
- Dung lượng & chi phí: ước tính JSON hồ sơ và số byte tệp được tham chiếu; chủ CLB nhập số thực tế từ Console, ngưỡng dung lượng, ngân sách, tháng đối chiếu và ngày hết ưu đãi. Cảnh báo ở 80% ngưỡng hoặc trong 30 ngày cuối ưu đãi, hiển thị trên bảng điều hành khi mở web.
- Yêu cầu xóa: lý do 5–500 ký tự, xem yêu cầu của tôi ở tab Võ sinh; người duyệt thêm ghi chú. Lịch sử giữ người yêu cầu/duyệt, ngày giờ, kết quả. Quyền theo lớp, kiểm tra phiên bản hồ sơ và giao dịch nguyên tử vẫn giữ nguyên.
- Quyền giấy tờ: CCCD chỉ chủ CLB; chứng chỉ chỉ chủ CLB và tài khoản quản lý võ sinh trong lớp. Máy chủ kiểm tra lại quyền trước khi trả tệp và ghi nhật ký tải giấy tờ. Bài kiểm tra gồm khóa tài khoản, thu hồi phạm vi lớp, giả mạo loại giấy tờ, đổi liên kết và quyền phục hồi.
- Excel .xlsx: nút tại Võ sinh và Học phí; xuất đúng bộ lọc tên/lớp/trạng thái hoặc tháng đang chọn; cần quyền Xuất báo cáo. Số điện thoại/mã giữ dạng chữ, số tiền là số, dữ liệu đầu vào không biến thành công thức Excel.

## Giới hạn hiển thị rõ trên giao diện

- Sao lưu tuần vẫn là JSON và liên kết tệp; không biến thành ZIP tự động. ZIP đầy đủ do chủ CLB tải khi mở trang.
- Kiểm tra cục bộ không xác nhận đã phục hồi hạ tầng Firebase thực tế. Không nhập hay xóa dữ liệu thật để thử nghiệm.
- ZIP tối đa 200 MiB, JSON tối đa 20 MiB; file giấy tờ tối đa 5 MiB; không mã hóa ZIP bằng mật khẩu. Lưu ZIP ở nơi riêng tư vì chứa giấy tờ cá nhân.
- Hóa đơn không được đồng bộ tự động từ Google Cloud; số liệu chủ CLB nhập có thể cũ. Ước tính JSON không gồm chỉ mục, nhật ký, bản sao hoặc tệp không còn tham chiếu. Không dùng số ước tính để kết luận phí thực tế.
- Mật khẩu Firebase không nằm trong bản sao. Lịch sử giữ nguyên tháng hiện tại + hai tháng trước; bản cũ vào thùng rác 15 ngày.

## Áp dụng trên Firebase sau khi GitHub Pages cập nhật

Phần website được biên dịch sẵn trong index.html và v2/. Cần hoàn tất hai bước Firebase sau để có đầy đủ hành vi mới.

### A. Publish quy tắc mới

1. Mở new-app/firestore.rules trong kho GitHub, chọn Copy raw file.
2. Firebase Console > dự án clb-vovinam-antruong-2026 > Firestore > Quy tắc.
3. Thay toàn bộ nội dung, bấm Publish. Quy tắc mới thêm reason và reviewNote. Không cấp quyền tài khoản thường tự xóa hoặc đọc CCCD.

### B. Cập nhật riêng chức năng xử lý giấy tờ

Dùng Google Cloud Shell hoặc máy đã có Node.js 22 và Firebase CLI. Đăng nhập tài khoản quản lý đúng dự án. Không cần tạo dự án mới, thay kho dữ liệu hay cấp thêm quyền cho tài khoản thành viên.

```bash
CLB_UPGRADE_DIR="$(mktemp -d)"
git clone https://github.com/vovinamantruong2026-spec/vovinamantruong2026-spec.github.io.git "$CLB_UPGRADE_DIR"
cd "$CLB_UPGRADE_DIR/new-app"
npm ci
npm --prefix functions ci
npx --yes firebase-tools login --no-localhost
npx --yes firebase-tools deploy --only functions:studentFiles --project clb-vovinam-antruong-2026
```

Nếu CLI hỏi BACKUP_BUCKET: dùng đúng bucket đang lưu giấy tờ, không tạo hoặc chuyển sang bucket khác. Giá trị mặc định trong mã là clb-vovinam-antruong-2026-backups. Nếu CLI báo thiếu quyền, dừng và gửi nguyên thông báo lỗi; không tự mở công khai bucket hoặc thay quyền toàn dự án. Lệnh chỉ triển khai studentFiles, giữ nguyên các lịch sao lưu/dọn dữ liệu đã có.

Nếu Firebase CLI đã đăng nhập thì có thể bỏ dòng login. Có thể triển khai Rules từ CLI cùng lúc bằng --only functions:studentFiles,firestore:rules nếu có quyền và đã kiểm tra đúng dự án.

## Kiểm tra sau triển khai

- Ctrl+F5, đăng nhập chủ CLB, mở Cài đặt & sao lưu.
- Nhập ngưỡng và số liệu từ Console, lưu; mở tài khoản khác kiểm tra không nhìn thấy quản lý chi phí.
- Tải ZIP đầy đủ và chọn lại file để kiểm tra cục bộ. Không bấm khôi phục dữ liệu thật chỉ để thử.
- Thử Excel trên bộ lọc một lớp/tháng và đối chiếu số dòng, tổng tiền, số điện thoại.
- Chỉ tạo yêu cầu xóa với hồ sơ thực sự cần xử lý; người gửi xem trạng thái, người được cấp quyền theo lớp duyệt/từ chối. Không tạo hồ sơ giả trên dữ liệu sản xuất để kiểm thử.
