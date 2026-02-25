import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  LayoutGrid,
  Moon,
  Sun,
  Download,
  Trash2,
} from "lucide-react";
import {
  format,
  addWeeks,
  subWeeks,
  startOfWeek,
  addDays,
  getISOWeek,
  getYear,
} from "date-fns";
import { ResizableNotesArea } from "./components/NotesArea";
import { ImageCard } from "./components/ImageCard";
import { InfiniteCanvas } from "./components/InfiniteCanvas";
import { ColorExtractor } from "./components/ColorExtractor";
import { useToast } from "./components/Toast";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useDebouncedSave } from "./hooks/useDebouncedSave";
import { CalendarDropdown } from "./components/CalendarDropdown";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { api, BoardImage } from "./api";

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [images, setImages] = useState<BoardImage[]>([]);
  const [notesHeight, setNotesHeight] = useState(256);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [language, setLanguage] = useLocalStorage<"zh" | "en">("moodboard-language", "zh");
  const [isDarkMode, setIsDarkMode] = useLocalStorage("moodboard-dark-mode", false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isRetagging, setIsRetagging] = useState(false);
  const [zIndexMap, setZIndexMap] = useState<{ counter: number; map: Record<number, number> }>({ counter: 1, map: {} });
  const [colorExtractId, setColorExtractId] = useState<number | null>(null);
  const [expandedImageId, setExpandedImageId] = useState<number | null>(null);
  const { showToast } = useToast();

  // Sync dark mode class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const toggleLanguage = async () => {
    const newLang = language === "en" ? "zh" : "en";
    setLanguage(newLang);

    if (images.length === 0) return;

    setIsRetagging(true);
    try {
      const updated = await Promise.all(
        images.map(async (img) => {
          try {
            const result = await api.retagImage(img.id, newLang);
            return { ...img, tags: result.tags };
          } catch {
            return img;
          }
        })
      );
      setImages(updated);
      showToast(`Tags updated to ${newLang === "en" ? "English" : "Chinese"}`, "success");
    } catch {
      showToast("Failed to update some tags", "error");
    } finally {
      setIsRetagging(false);
    }
  };

  const handleClearWeek = async () => {
    setShowClearDialog(false);
    try {
      await api.clearWeek(weekStr);
      setImages([]);
      showToast("Week cleared", "success");
    } catch (e) {
      showToast("Failed to clear week. Please try again.", "error");
    }
  };

  const weekStr = `${getYear(currentDate)}-W${getISOWeek(currentDate).toString().padStart(2, "0")}`;

  const fetchWeekData = useCallback(async () => {
    try {
      const data = await api.getWeekData(weekStr);
      setNotesHeight(data.week?.notesHeight || 256);
      setNotes(data.week?.notes || "");
      setImages(data.images || []);
      setZIndexMap({ counter: 1, map: {} });
    } catch (e) {
      showToast("Failed to load week data", "error");
    }
  }, [weekStr]);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  // Debounced position save
  const savePosition = useCallback(
    (id: number, pos: { x?: number; y?: number; width?: number; height?: number }) => {
      api.updateImagePosition(id, pos).catch(() => {
        showToast("Failed to save position", "error");
      });
    },
    []
  );
  const { debouncedFn: debouncedSavePosition } = useDebouncedSave(savePosition, 300);

  const handleUploadFile = useCallback(
    async (file: File, canvasX: number, canvasY: number) => {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        showToast("Unsupported file type. Use images or videos.", "info");
        return;
      }

      setUploading(true);
      try {
        const result = await api.uploadImage(weekStr, 1, file, language, {
          x: Math.round(canvasX),
          y: Math.round(canvasY),
        });
        setImages((prev) => [...prev, result.image]);
        showToast("Image uploaded", "success");
      } catch (err: any) {
        showToast(err?.message || "Upload failed", "error");
      } finally {
        setUploading(false);
      }
    },
    [weekStr, language]
  );

  const handleBringToFront = useCallback((id: number) => {
    setZIndexMap((prev) => {
      const next = prev.counter + 1;
      return { counter: next, map: { ...prev.map, [id]: next } };
    });
  }, []);

  const handlePositionChange = useCallback(
    (id: number, pos: { x: number; y: number; width: number; height: number }) => {
      setImages((prev) =>
        prev.map((img) => (img.id === id ? { ...img, ...pos } : img))
      );
      debouncedSavePosition(id, pos);
    },
    [debouncedSavePosition]
  );

  const handleRemoveTag = (imageId: number, tagId: number) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === imageId
          ? { ...img, tags: img.tags.filter((t) => t.id !== tagId) }
          : img
      )
    );
  };

  const handleDeleteImage = async (id: number) => {
    try {
      await api.deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      if (colorExtractId === id) setColorExtractId(null);
      if (expandedImageId === id) setExpandedImageId(null);
      showToast("Image deleted", "success");
    } catch (e) {
      showToast("Failed to delete image", "error");
    }
  };

  const handleNotesHeightChange = async (h: number) => {
    setNotesHeight(h);
    api.updateNotesHeight(weekStr, h).catch(() => {
      showToast("Failed to save notes height", "error");
    });
  };

  const handleNotesChange = async (value: string) => {
    setNotes(value);
    api.updateNotes(weekStr, value).catch(() => {
      showToast("Failed to save notes", "error");
    });
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const expandedImage = expandedImageId
    ? images.find((img) => img.id === expandedImageId) || null
    : null;

  const colorExtractImage = colorExtractId
    ? images.find((img) => img.id === colorExtractId) || null
    : null;

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-surface dark:bg-neutral-900 selection:bg-neutral-200 selection:text-neutral-900 relative overflow-hidden">
      {/* Navbar */}
      <header className="flex items-center justify-between px-8 py-3 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-neutral-200/50 dark:border-neutral-800/50 shrink-0">
        <div className="flex items-center gap-4 text-neutral-900 dark:text-stone-200">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2 text-neutral-900 dark:text-stone-200">
            Week
            <strong className="font-semibold">
              {getISOWeek(currentDate)}
            </strong>
          </h1>
          <div className="w-px h-4 bg-neutral-300 dark:bg-stone-700" />
          <span className="text-sm font-semibold text-neutral-500 dark:text-stone-400">
            {format(weekStart, "MMMM d")} -{" "}
            {format(addDays(weekStart, 6), "d")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex items-center bg-white dark:bg-neutral-800 rounded-sm shadow-sm border border-neutral-200 dark:border-neutral-700 h-8">
            <button
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="px-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors h-full rounded-l-sm"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="px-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-600 dark:text-stone-300 hover:text-neutral-900 border-x border-neutral-200 dark:border-stone-700 h-full flex items-center bg-neutral-50 dark:bg-neutral-800/50"
              onClick={() => setCalendarOpen((prev) => !prev)}
              aria-label="Open calendar"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="px-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors h-full rounded-r-sm"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {calendarOpen && (
              <CalendarDropdown
                currentDate={currentDate}
                onSelectDate={(date) => {
                  setCurrentDate(date);
                  setCalendarOpen(false);
                }}
                onClose={() => setCalendarOpen(false)}
              />
            )}
          </div>
        </div>
      </header>

      {/* Right Floating Action Bar */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col items-center z-40 max-md:right-2 max-md:top-auto max-md:bottom-4 max-md:translate-y-0 max-md:flex-row max-md:right-auto max-md:left-1/2 max-md:-translate-x-1/2">
        <div className="flex flex-col max-md:flex-row items-center gap-5 max-md:gap-3 bg-white/50 dark:bg-neutral-800/50 backdrop-blur-xl shadow-lg border border-neutral-200/30 dark:border-neutral-700/50 rounded-sm max-md:rounded-sm p-2.5 py-6 max-md:py-2.5 max-md:px-6 w-14 max-md:w-auto max-md:h-14">
          <button
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors group relative"
            aria-label="Grid view"
          >
            <LayoutGrid className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </button>

          <button
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors group relative"
            onClick={toggleDarkMode}
            aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDarkMode ? (
              <Sun className="w-[22px] h-[22px]" strokeWidth={1.5} />
            ) : (
              <Moon className="w-[22px] h-[22px]" strokeWidth={1.5} />
            )}
          </button>

          <button
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors group relative"
            aria-label="Export"
          >
            <Download className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </button>

          <div className="w-8 max-md:w-px max-md:h-8 border-b max-md:border-b-0 max-md:border-r border-neutral-200/40 dark:border-neutral-700/60 my-0.5 max-md:mx-0.5" />

          <button
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-stone-200 transition-colors group relative flex items-center justify-center w-[22px] h-[22px]"
            onClick={toggleLanguage}
            disabled={isRetagging}
            aria-label={language === "zh" ? "Switch to English" : "Switch to Chinese"}
          >
            {isRetagging ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <span className="text-[11px] font-bold uppercase leading-none">{language === "zh" ? "中" : "EN"}</span>
            )}
            <span className="absolute right-full max-md:right-auto max-md:bottom-full mr-3 max-md:mr-0 max-md:mb-3 bg-neutral-800 text-white text-[10px] px-2 py-1 flex items-center h-6 rounded shadow-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              {language === "zh" ? "Switch to English" : "Switch to Chinese"}
            </span>
          </button>

          <div className="w-8 max-md:w-px max-md:h-8 border-b max-md:border-b-0 max-md:border-r border-neutral-200/40 dark:border-neutral-700/60 my-0.5 max-md:mx-0.5" />

          <button
            className="text-red-400/80 hover:text-red-600 dark:hover:text-red-500 transition-colors group relative"
            onClick={() => setShowClearDialog(true)}
            aria-label="Clear all images from this week"
          >
            <Trash2 className="w-[22px] h-[22px]" strokeWidth={1.5} />
            <span className="absolute right-full max-md:right-auto max-md:bottom-full mr-3 max-md:mr-0 max-md:mb-3 bg-red-600 text-white text-[10px] px-2 py-1 flex items-center h-6 rounded shadow-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              Clear Week
            </span>
          </button>
        </div>
      </div>

      {/* Upload overlay */}
      {uploading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 dark:bg-neutral-800/90 backdrop-blur-md rounded-lg shadow-2xl border border-neutral-200/50 dark:border-neutral-700/50 px-8 py-6 flex flex-col items-center gap-3 pointer-events-auto">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-700 dark:text-stone-300" />
            <span className="text-sm font-medium text-neutral-700 dark:text-stone-300">
              Uploading & analyzing...
            </span>
            <div className="w-32 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
              <div className="h-full bg-neutral-800 dark:bg-amber-500 w-full animate-progress rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Infinite Canvas */}
      <InfiniteCanvas
        images={images}
        zIndexMap={zIndexMap.map}
        onBringToFront={handleBringToFront}
        onPositionChange={handlePositionChange}
        onRemoveTag={handleRemoveTag}
        onDelete={handleDeleteImage}
        onExtractColors={(id) => setColorExtractId(id)}
        onExpand={(id) => setExpandedImageId(id)}
        onUploadFile={handleUploadFile}
      />

      {/* Notes Area */}
      <ResizableNotesArea
        height={notesHeight}
        onHeightChange={handleNotesHeightChange}
        notes={notes}
        onNotesChange={handleNotesChange}
      />

      {/* Color Extractor Panel */}
      {colorExtractImage && (
        <ColorExtractor
          image={colorExtractImage}
          onClose={() => setColorExtractId(null)}
        />
      )}

      {/* Expanded Image Modal */}
      {expandedImage && (
        <ImageCard
          image={expandedImage}
          onRemoveTag={handleRemoveTag}
          onDelete={handleDeleteImage}
          forceExpanded
          onClose={() => setExpandedImageId(null)}
        />
      )}

      {/* Clear Week Confirmation */}
      {showClearDialog && (
        <ConfirmDialog
          title="Clear week"
          message="This will delete all images from this week. Are you sure?"
          confirmLabel="Clear All"
          variant="danger"
          onConfirm={handleClearWeek}
          onCancel={() => setShowClearDialog(false)}
        />
      )}
    </div>
  );
}

export default App;
