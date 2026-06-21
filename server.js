/**
 * ============================================================
 * OUR LOVE STORY - Backend Server
 * ============================================================
 * Server Node.js + Express cho Website kỷ niệm tình yêu.
 * Chức năng chính:
 *   - REST API cho Kỷ niệm (Memories), Bucket List, Time Capsule
 *   - Upload ảnh với Multer (lưu file vật lý vào /uploads)
 *   - Xác thực Admin bằng mật khẩu
 *   - Mock Database (mảng trong bộ nhớ) - dễ thay thế bằng MongoDB/MySQL
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// 1. KẾT NỐI MONGODB ATLAS
// ============================================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('[DB] Kết nối MongoDB Atlas thành công!'))
  .catch(err => console.error('[DB] Lỗi kết nối MongoDB:', err.message));

// ============================================================
// 2. CẤU HÌNH CLOUDINARY - LƯU TRỮ ẢNH TRÊN MÂY
// ============================================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'our_love_story',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    transformation: [{ width: 1000, height: 1000, crop: 'limit' }]
  },
});

const upload = multer({ storage: storage });

// ============================================================
// 3. ĐỊNH NGHĨA SCHEMAS (DATABASE MODELS)
// ============================================================

// --- Model: Kỷ niệm (Memories) ---
const MemorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String },
  imageUrl: { type: String }, // Lưu link Cloudinary
  date: { type: Date, required: true }
}, { timestamps: true });
const Memory = mongoose.model('Memory', MemorySchema);

// --- Model: Danh sách mong ước (Bucket List) ---
const BucketListSchema = new mongoose.Schema({
  task: { type: String, required: true },
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date }
});
const BucketItem = mongoose.model('BucketItem', BucketListSchema);

// --- Model: Hộp thư hẹn giờ (Time Capsule) ---
const TimeCapsuleSchema = new mongoose.Schema({
  message: { type: String, required: true },
  unlockDate: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});
const TimeCapsule = mongoose.model('TimeCapsule', TimeCapsuleSchema);

// --- Model: Cấu hình (Settings) ---
const SettingsSchema = new mongoose.Schema({
  avatar1: { type: String, default: '' },
  avatar2: { type: String, default: '' },
  loveStartDate: { type: Date, default: new Date('2025-12-22T00:00:00') }
});
const Settings = mongoose.model('Settings', SettingsSchema);

// ============================================================
// 4. MIDDLEWARE CẤU HÌNH
// ============================================================

// Cho phép Frontend (khác port) gọi API
app.use(cors());

// Parse JSON body cho các request không có file
app.use(express.json());

// --- Mật khẩu Admin ---
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ourlove2025';

// ============================================================
// 5. API ROUTES - XÁC THỰC ADMIN
// ============================================================

/**
 * POST /api/auth/login
 * Xác thực mật khẩu Admin
 * Body: { password: "ourlove2025" }
 * Response: { success: true/false, token: "admin-xxx" }
 *
 * LƯU Ý: Đây là cơ chế đơn giản. Khi deploy thật, nên dùng:
 * - JWT (jsonwebtoken) để tạo token có thời hạn
 * - bcrypt để hash mật khẩu
 * - Lưu mật khẩu trong biến môi trường (.env)
 */
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    // Tạo token đơn giản (trong thực tế nên dùng JWT)
    const token = 'admin-' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    console.log(`[AUTH] Admin đăng nhập thành công. Token: ${token}`);
    res.json({ success: true, token: token, message: 'Đăng nhập thành công!' });
  } else {
    console.log('[AUTH] Đăng nhập thất bại - Sai mật khẩu');
    res.status(401).json({ success: false, message: 'Mật khẩu không đúng!' });
  }
});

// ============================================================
// 5. API ROUTES - KỶ NIỆM (MEMORIES)
// ============================================================

// ============================================================
// 6. API ROUTES - KỶ NIỆM (MEMORIES)
// ============================================================

/**
 * GET /api/memories
 * Lấy danh sách tất cả kỷ niệm từ MongoDB
 */
app.get('/api/memories', async (req, res) => {
  try {
    const memories = await Memory.find().sort({ date: -1 });
    res.json({ success: true, data: memories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/memories
 * Tạo kỷ niệm mới, ảnh lưu trên Cloudinary
 */
app.post('/api/memories', upload.single('image'), async (req, res) => {
  try {
    const { title, content, date } = req.body;

    if (!title || !date) {
      return res.status(400).json({ success: false, message: 'Tiêu đề và ngày tháng là bắt buộc!' });
    }

    const newMemory = new Memory({
      title,
      content,
      imageUrl: req.file ? req.file.path : '', // URL từ Cloudinary
      date
    });

    await newMemory.save();
    console.log(`[MEMORY] Đã lưu kỷ niệm mới lên Cloud: "${title}"`);
    res.status(201).json({ success: true, data: newMemory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * PUT /api/memories/:id
 */
app.put('/api/memories/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    if (req.file) {
      updateData.imageUrl = req.file.path;
    }

    const memory = await Memory.findByIdAndUpdate(id, updateData, { new: true });
    if (!memory) return res.status(404).json({ success: false, message: 'Không tìm thấy kỷ niệm!' });

    res.json({ success: true, data: memory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/memories/:id
 */
app.delete('/api/memories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Memory.findByIdAndDelete(id);
    res.json({ success: true, message: 'Đã xóa kỷ niệm thành công!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 7. API ROUTES - BUCKET LIST
// ============================================================

app.get('/api/bucketlist', async (req, res) => {
  try {
    const items = await BucketItem.find();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/bucketlist', async (req, res) => {
  try {
    const newItem = new BucketItem({ task: req.body.task });
    await newItem.save();
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/bucketlist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isCompleted } = req.body;
    const completedAt = isCompleted ? new Date() : null;
    
    const item = await BucketItem.findByIdAndUpdate(id, { isCompleted, completedAt }, { new: true });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/bucketlist/:id', async (req, res) => {
  try {
    await BucketItem.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa mục tiêu!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 8. API ROUTES - TIME CAPSULE
// ============================================================

app.get('/api/timecapsule', async (req, res) => {
  try {
    const capsules = await TimeCapsule.find().sort({ unlockDate: 1 });
    res.json({ success: true, data: capsules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/timecapsule', async (req, res) => {
  try {
    const { message, unlockDate } = req.body;
    const newCapsule = new TimeCapsule({ message, unlockDate });
    await newCapsule.save();
    res.status(201).json({ success: true, data: newCapsule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/timecapsule/:id', async (req, res) => {
  try {
    await TimeCapsule.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Đã xóa thư!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 9. API ROUTES - CÀI ĐẶT (SETTINGS & AVATARS)
// ============================================================

/**
 * Lấy Settings duy nhất (tạo nếu chưa có)
 */
async function getSettings() {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = new Settings();
    await settings.save();
  }
  return settings;
}

app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/settings/avatars', upload.fields([
  { name: 'avatar1', maxCount: 1 },
  { name: 'avatar2', maxCount: 1 }
]), async (req, res) => {
  try {
    const settings = await getSettings();

    if (req.files['avatar1']) {
      settings.avatar1 = req.files['avatar1'][0].path;
    }
    if (req.files['avatar2']) {
      settings.avatar2 = req.files['avatar2'][0].path;
    }

    await settings.save();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    const { loveStartDate } = req.body;
    if (loveStartDate) {
      settings.loveStartDate = loveStartDate;
      await settings.save();
      res.json({ success: true, data: settings });
    } else {
      res.status(400).json({ success: false, message: 'Thiếu ngày bắt đầu!' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================================
// 10. KHỞI ĐỘNG SERVER
// ============================================================
app.listen(PORT, () => {
  console.log(`\n  OUR LOVE STORY - Backend Cloud Server`);
  console.log(`  Đang chạy tại: http://localhost:${PORT}\n`);
});
