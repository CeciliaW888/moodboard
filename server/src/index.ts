import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { images, terminologyTags, weeks } from './db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateTerminologyFromMedia } from './services/gemini';

const app = express();
const PORT = process.env.PORT || 8000;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : undefined; // undefined = allow all in dev

app.use(cors(ALLOWED_ORIGINS ? { origin: ALLOWED_ORIGINS } : undefined));
app.use(express.json());

// Setup multer for local file uploads with size limit
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

// Serve uploaded UI screens statically
app.use('/uploads', express.static(uploadDir));

// Validate weekStr format: e.g. "2026-W08"
const WEEK_STR_REGEX = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

function isValidWeekStr(weekStr: string): boolean {
  return WEEK_STR_REGEX.test(weekStr);
}

// --- API ROUTES ---

// Get data for a specific week
app.get('/api/weeks/:weekStr', async (req, res) => {
  const { weekStr } = req.params;

  if (!isValidWeekStr(weekStr)) {
    return res.status(400).json({ error: 'Invalid weekStr format. Expected YYYY-Www (e.g. 2026-W08)' });
  }

  try {
    // Ensure week exists
    let weekEntry = await db.query.weeks.findFirst({
      where: eq(weeks.weekStr, weekStr)
    });

    if (!weekEntry) {
      const [inserted] = await db.insert(weeks).values({ weekStr }).returning();
      weekEntry = inserted;
    }

    const weekImages = await db.query.images.findMany({
      where: eq(images.weekStr, weekStr),
    });

    // Fetch tags only for images in this week (fixes N+1 query)
    let resultImages: Array<typeof weekImages[number] & { tags: any[] }> = [];
    if (weekImages.length > 0) {
      const imageIds = weekImages.map(img => img.id);
      const imageTags = await db.query.terminologyTags.findMany({
        where: inArray(terminologyTags.imageId, imageIds),
      });

      resultImages = weekImages.map(img => ({
        ...img,
        tags: imageTags.filter(t => t.imageId === img.id),
      }));
    }

    res.json({
       week: weekEntry,
       images: resultImages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update week properties (notes height, notes content)
app.patch('/api/weeks/:weekStr', async (req, res) => {
  const { weekStr } = req.params;

  if (!isValidWeekStr(weekStr)) {
    return res.status(400).json({ error: 'Invalid weekStr format' });
  }

  const { notesHeight, notes } = req.body;
  const updates: Record<string, any> = {};

  if (notesHeight !== undefined) updates.notesHeight = notesHeight;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length > 0) {
    await db.update(weeks).set(updates).where(eq(weeks.weekStr, weekStr));
  }
  res.json({ success: true });
});

// Upload image and get AI terminology
app.post('/api/images', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  const { weekStr, dayOfWeek, language } = req.body;
  if (!weekStr || !dayOfWeek) {
     return res.status(400).json({ error: 'Missing week object data' });
  }

  if (!isValidWeekStr(weekStr)) {
    return res.status(400).json({ error: 'Invalid weekStr format' });
  }

  const day = parseInt(dayOfWeek, 10);
  if (isNaN(day) || day < 1 || day > 7) {
    return res.status(400).json({ error: 'dayOfWeek must be between 1 and 7' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  const localPath = req.file.path;
  const mimeType = req.file.mimetype;

  try {
    // 1. Save to DB
    const [insertedImage] = await db.insert(images).values({
      url: imageUrl,
      weekStr,
      dayOfWeek: day,
    }).returning();

    // 2. Call Gemini API
    const terms = await generateTerminologyFromMedia(mimeType, localPath, language || 'zh');
    console.log("Extracted terms:", terms);

    // 3. Save terms to DB
    const tagsToInsert = terms.map(term => ({
      imageId: insertedImage.id,
      term
    }));

    let insertedTags: any[] = [];
    if (tagsToInsert.length > 0) {
      insertedTags = await db.insert(terminologyTags).values(tagsToInsert).returning();
    }

    res.json({
      image: { ...insertedImage, tags: insertedTags }
    });
  } catch (err) {
     console.error(err);
     res.status(500).json({ error: 'Failed to process image' });
  }
});

// Route to delete a term
app.delete('/api/terms/:id', async (req, res) => {
  try {
     const id = parseInt(req.params.id, 10);
     if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
     await db.delete(terminologyTags).where(eq(terminologyTags.id, id));
     res.json({ success: true });
  } catch (err) {
     res.status(500).json({ error: 'Failed to delete term' });
  }
});

// Route to delete an image entirely
app.delete('/api/images/:id', async (req, res) => {
  try {
     const imageId = parseInt(req.params.id, 10);
     if (isNaN(imageId)) return res.status(400).json({ error: 'Invalid ID' });

     // Delete associated terminology tags first to prevent foreign key errors
     await db.delete(terminologyTags).where(eq(terminologyTags.imageId, imageId));

     // Delete the image
     await db.delete(images).where(eq(images.id, imageId));
     res.json({ success: true });
  } catch (err) {
     console.error("Error deleting image:", err);
     res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Batch delete all images for a week
app.delete('/api/weeks/:weekStr/images', async (req, res) => {
  const { weekStr } = req.params;

  if (!isValidWeekStr(weekStr)) {
    return res.status(400).json({ error: 'Invalid weekStr format' });
  }

  try {
    // Find all images for this week
    const weekImages = await db.query.images.findMany({
      where: eq(images.weekStr, weekStr),
    });

    if (weekImages.length > 0) {
      const imageIds = weekImages.map(img => img.id);
      // Delete all tags for these images
      await db.delete(terminologyTags).where(inArray(terminologyTags.imageId, imageIds));
      // Delete all images
      await db.delete(images).where(eq(images.weekStr, weekStr));
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Error clearing week:", err);
    res.status(500).json({ error: 'Failed to clear week' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
