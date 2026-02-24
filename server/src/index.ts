import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from './db';
import { images, terminologyTags, weeks } from './db/schema';
import { eq, desc } from 'drizzle-orm';
import { generateTerminologyFromMedia } from './services/gemini';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

// Setup multer for local file uploads
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
const upload = multer({ storage });

// Serve uploaded UI screens statically
app.use('/uploads', express.static(uploadDir));

// --- API ROUTES ---

// Get data for a specific week
app.get('/api/weeks/:weekStr', async (req, res) => {
  const { weekStr } = req.params;
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
      with: {
         // Drizzle issue: relation needs to be defined in schema, alternatively we fetch separately.
         // Let's just fetch them via join or two queries.
      }
    });
    
    // Fetch manually since we didn't define drizzle relations object in schema:
    const allTags = await db.query.terminologyTags.findMany(); // For production use proper joins
    // Let's optimize:
    const resultImages = weekImages.map(img => {
       const tags = allTags.filter(t => t.imageId === img.id);
       return { ...img, tags };
    });

    res.json({
       week: weekEntry,
       images: resultImages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Notes Height
app.patch('/api/weeks/:weekStr', async (req, res) => {
  const { weekStr } = req.params;
  const { notesHeight } = req.body;
  
  if (notesHeight) {
    await db.update(weeks).set({ notesHeight }).where(eq(weeks.weekStr, weekStr));
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

  const imageUrl = `/uploads/${req.file.filename}`;
  const localPath = req.file.path;
  const mimeType = req.file.mimetype;
  
  try {
    // 1. Save to DB
    const [insertedImage] = await db.insert(images).values({
      url: imageUrl,
      weekStr,
      dayOfWeek: parseInt(dayOfWeek, 10),
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
     await db.delete(terminologyTags).where(eq(terminologyTags.id, parseInt(req.params.id, 10)));
     res.json({ success: true });
  } catch (err) {
     res.status(500).json({ error: 'Failed to delete term' });
  }
});

// Route to delete an image entirely
app.delete('/api/images/:id', async (req, res) => {
  try {
     const imageId = parseInt(req.params.id, 10);
     
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

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
