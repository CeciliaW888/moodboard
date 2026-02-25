import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { images, terminologyTags, weeks } from './db/schema';
import { eq, inArray, sql } from 'drizzle-orm';
import { setISOWeek, setISODay, getYear as dfGetYear, getMonth, format as dfFormat, parseISO } from 'date-fns';
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

// Get dates that have images for a given month
app.get('/api/images/dates', async (req, res) => {
  const month = req.query.month as string; // Expected format: YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Invalid month format. Expected YYYY-MM' });
  }

  const [yearStr, monthStr] = month.split('-');
  const targetYear = parseInt(yearStr, 10);
  const targetMonth = parseInt(monthStr, 10) - 1; // 0-indexed for comparison

  try {
    // Get all distinct (weekStr, dayOfWeek) pairs that have images
    const rows = await db
      .select({ weekStr: images.weekStr, dayOfWeek: images.dayOfWeek })
      .from(images)
      .groupBy(images.weekStr, images.dayOfWeek);

    const dates: string[] = [];
    for (const row of rows) {
      const weekMatch = row.weekStr.match(/^(\d{4})-W(\d{2})$/);
      if (!weekMatch) continue;

      const wYear = parseInt(weekMatch[1], 10);
      const wNum = parseInt(weekMatch[2], 10);

      // Build the actual date from ISO week + day
      let d = new Date(wYear, 0, 4); // Jan 4 is always in ISO week 1
      d = setISOWeek(d, wNum);
      d = setISODay(d, row.dayOfWeek ?? 1);

      if (dfGetYear(d) === targetYear && getMonth(d) === targetMonth) {
        dates.push(dfFormat(d, 'yyyy-MM-dd'));
      }
    }

    // Deduplicate (multiple images on same day)
    const uniqueDates = [...new Set(dates)].sort();
    res.json({ dates: uniqueDates });
  } catch (err) {
    console.error('Error fetching image dates:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload image and get AI terminology
app.post('/api/images', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image provided' });
  }

  const { weekStr, dayOfWeek, language, x, y, width, height } = req.body;
  if (!weekStr) {
     return res.status(400).json({ error: 'Missing weekStr' });
  }

  if (!isValidWeekStr(weekStr)) {
    return res.status(400).json({ error: 'Invalid weekStr format' });
  }

  const day = dayOfWeek ? parseInt(dayOfWeek, 10) : 1;
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
      x: x ? parseInt(x, 10) : 0,
      y: y ? parseInt(y, 10) : 0,
      width: width ? parseInt(width, 10) : 280,
      height: height ? parseInt(height, 10) : 0,
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

// Update image canvas position/size
app.patch('/api/images/:id/position', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id, 10);
    if (isNaN(imageId)) return res.status(400).json({ error: 'Invalid ID' });

    const { x, y, width, height } = req.body;
    const updates: Record<string, any> = {};

    // Round to integers — react-rnd sends floats, but DB columns are integer
    if (x !== undefined && x !== null) updates.x = Math.round(Number(x));
    if (y !== undefined && y !== null) updates.y = Math.round(Number(y));
    if (width !== undefined && width !== null) updates.width = Math.round(Number(width));
    if (height !== undefined && height !== null) updates.height = Math.round(Number(height));

    // Guard against NaN from bad input
    for (const key of Object.keys(updates)) {
      if (isNaN(updates[key])) delete updates[key];
    }

    if (Object.keys(updates).length > 0) {
      await db.update(images).set(updates).where(eq(images.id, imageId));
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating image position:', err);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

// Re-extract tags for an image in a different language
app.post('/api/images/:id/retag', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id, 10);
    if (isNaN(imageId)) return res.status(400).json({ error: 'Invalid ID' });

    const { language } = req.body;
    if (!language) return res.status(400).json({ error: 'Missing language' });

    const image = await db.query.images.findFirst({
      where: eq(images.id, imageId),
    });
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const localPath = path.join(uploadDir, path.basename(image.url));
    if (!fs.existsSync(localPath)) {
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    const ext = path.extname(localPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
      '.gif': 'image/gif', '.webp': 'image/webp', '.mp4': 'video/mp4',
      '.webm': 'video/webm', '.mov': 'video/quicktime', '.ogg': 'video/ogg',
    };
    const mimeType = mimeMap[ext] || 'image/png';

    // Delete old tags
    await db.delete(terminologyTags).where(eq(terminologyTags.imageId, imageId));

    // Re-extract with new language
    const terms = await generateTerminologyFromMedia(mimeType, localPath, language);

    let insertedTags: any[] = [];
    if (terms.length > 0) {
      const tagsToInsert = terms.map(term => ({ imageId, term }));
      insertedTags = await db.insert(terminologyTags).values(tagsToInsert).returning();
    }

    res.json({ tags: insertedTags });
  } catch (err) {
    console.error('Error re-tagging image:', err);
    res.status(500).json({ error: 'Failed to re-extract tags' });
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
