# Moodboard

A weekly design inspiration board powered by AI. Upload screenshots, images, or videos and get automatic design terminology extracted using Google Gemini.

## What It Does

- **Infinite Canvas** — Drag, drop, resize, and arrange images freely on a zoomable canvas
- **AI-Powered Tagging** — Gemini analyzes your uploads and extracts design terms (e.g., "Glassmorphism", "Hero Section")
- **Weekly Organization** — Content is grouped by ISO week with calendar navigation
- **Bilingual Support** — Toggle between Chinese and English for AI-generated tags
- **Color Extraction** — Pull dominant colors from any image
- **Dark Mode** — Toggle between light and dark themes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Framer Motion |
| Backend | Express, TypeScript, Drizzle ORM |
| Database | PostgreSQL 15 (Docker) |
| AI | Google Gemini 2.5 Flash |
| Canvas | react-rnd (drag/resize) |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL)
- A [Google AI Studio](https://aistudio.google.com/) API key

### Setup

1. **Start the database**
   ```bash
   docker-compose up -d
   ```

2. **Configure the server**

   In the `server/` folder, create a file called `.env` with the following content:
   ```
   GEMINI_API_KEY=your_api_key_here
   DATABASE_URL=postgres://postgres:postgrespassword@localhost:5432/moodboard
   PORT=8000
   ```
   Get your Gemini API key from [Google AI Studio](https://aistudio.google.com/).

   Then install dependencies and push the database schema:
   ```bash
   cd server
   npm install
   npm run db:push
   ```

3. **Start the server**
   ```bash
   npm run dev
   ```

4. **Start the client** (in a new terminal)
   ```bash
   cd client
   npm install
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
moodboard/
├── client/          # React frontend (Vite)
│   ├── src/
│   │   ├── components/   # UI components (canvas, cards, tags, etc.)
│   │   ├── hooks/        # Custom React hooks
│   │   ├── App.tsx       # Main application
│   │   └── api.ts        # API client
│   └── package.json
├── server/          # Express backend
│   ├── src/
│   │   ├── db/           # Database schema & connection
│   │   ├── services/     # Gemini AI integration
│   │   └── index.ts      # API routes
│   └── package.json
└── docker-compose.yml    # PostgreSQL container
```
