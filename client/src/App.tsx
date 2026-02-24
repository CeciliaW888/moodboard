import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Globe,
  LayoutGrid,
  Moon,
  Sun,
  Download,
  Trash2,
  Plus,
  ImagePlus,
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
import clsx from "clsx";
import { ResizableNotesArea } from "./components/NotesArea";
import { ImageCard } from "./components/ImageCard";
import { useToast } from "./components/Toast";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { api, BoardImage } from "./api";

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [images, setImages] = useState<BoardImage[]>([]);
  const [notesHeight, setNotesHeight] = useState(256);
  const [notes, setNotes] = useState("");
  const [uploadingDay, setUploadingDay] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);
  const [language, setLanguage] = useLocalStorage<"zh" | "en">("moodboard-language", "zh");
  const [isDarkMode, setIsDarkMode] = useLocalStorage("moodboard-dark-mode", false);
  const [confirmClear, setConfirmClear] = useState(false);
  const { showToast } = useToast();

  // Sync dark mode class with persisted state
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleClearWeek = async () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setConfirmClear(false);
    try {
      await api.clearWeek(weekStr);
      setImages([]);
      showToast("Week cleared", "success");
    } catch (e) {
      showToast("Failed to clear week. Please try again.", "error");
    }
  };

  // Derive week string (e.g. 2026-W08)
  const weekStr = `${getYear(currentDate)}-W${getISOWeek(currentDate).toString().padStart(2, "0")}`;

  const fetchWeekData = useCallback(async () => {
    try {
      const data = await api.getWeekData(weekStr);
      setNotesHeight(data.week?.notesHeight || 256);
      setNotes(data.week?.notes || "");
      setImages(data.images || []);
    } catch (e) {
      showToast("Failed to load week data", "error");
    }
  }, [weekStr]);

  useEffect(() => {
    fetchWeekData();
  }, [fetchWeekData]);

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file" || item.type.startsWith("image/") || item.type.startsWith("video/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const dayOfWeek = currentDayFallback(dragOverDay ?? undefined);
            setUploadingDay(dayOfWeek);
            try {
              const result = await api.uploadImage(weekStr, dayOfWeek, file, language);
              setImages((prev) => [...prev, result.image]);
              showToast("Image uploaded", "success");
            } catch (err: any) {
              showToast(err?.message || "Upload failed", "error");
            } finally {
              setUploadingDay(null);
            }
            return; // Process only the first valid file
          }
        }
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [weekStr, currentDate, dragOverDay, language]);

  const handleDrop = async (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDay(null);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        setUploadingDay(dayIndex);
        try {
          const result = await api.uploadImage(weekStr, dayIndex, file, language);
          setImages((prev) => [...prev, result.image]);
          showToast("Image uploaded", "success");
        } catch (err: any) {
          showToast(err?.message || "Upload failed", "error");
        } finally {
          setUploadingDay(null);
        }
        return;
      }
    }
    showToast("Unsupported file type. Use images or videos.", "info");
  };

  const handleDragOver = (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverDay(dayIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverDay(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, dayIndex?: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const dayOfWeek = currentDayFallback(dayIndex);
    setUploadingDay(dayOfWeek);

    try {
      const result = await api.uploadImage(weekStr, dayOfWeek, file, language);
      setImages((prev) => [...prev, result.image]);
      showToast("Image uploaded", "success");
    } catch (err: any) {
      showToast(err?.message || "Upload failed", "error");
    } finally {
      setUploadingDay(null);
      // Reset input value so same file can be selected again
      if (event.target) event.target.value = "";
    }
  };

  const currentDayFallback = (dayIndex?: number) => {
    if (dayIndex !== undefined && dayIndex >= 1) return dayIndex;
    const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon...
    return dayOfWeek === 0 ? 7 : dayOfWeek;
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
      showToast("Image deleted", "success");
    } catch (e) {
      showToast("Failed to delete image", "error");
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday

  // Group images by day
  const groupedImages = images.reduce<{ [key: number]: BoardImage[] }>(
    (acc, img) => {
      if (!acc[img.dayOfWeek]) acc[img.dayOfWeek] = [];
      acc[img.dayOfWeek].push(img);
      return acc;
    },
    {}
  );

  const renderDayCell = (dayIndex: number, label?: string) => {
    const dayImages = groupedImages[dayIndex] || [];
    const dateObj = addDays(weekStart, dayIndex - 1);
    const dateNum = format(dateObj, "d");
    const dayLabel = label || format(dateObj, "EEE").toUpperCase();
    const isDragTarget = dragOverDay === dayIndex;
    const isUploadingHere = uploadingDay === dayIndex;

    return (
      <div
        key={dayIndex}
        onMouseEnter={() => setDragOverDay(null)}
        onDragOver={(e) => handleDragOver(e, dayIndex)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, dayIndex)}
        className={clsx(
          "relative flex flex-col gap-4 overflow-y-auto mix-blend-normal px-2 h-full rounded-lg transition-colors duration-200",
          isDragTarget && "bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-amber-300 dark:ring-amber-600 ring-inset"
        )}
      >
        <div className="flex flex-col items-center sticky top-0 bg-surface dark:bg-neutral-900 z-10 pb-6 pt-2">
          <span className="text-2xl font-light text-stone-700 dark:text-stone-300 leading-none">
            {dateNum}
          </span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-stone-500 dark:text-stone-400 mt-1">
            {dayLabel}
          </span>
        </div>

        {/* Render Cards */}
        <div className="flex flex-col gap-4 pb-4">
          {dayImages.map((img) => (
            <ImageCard
              key={img.id}
              image={img}
              onRemoveTag={handleRemoveTag}
              onDelete={handleDeleteImage}
            />
          ))}

          {/* Upload area / empty state */}
          {dayImages.length === 0 && !isUploadingHere ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ImagePlus className="w-8 h-8 text-stone-300 dark:text-neutral-600 mb-2" strokeWidth={1} />
              <p className="text-xs text-stone-400 dark:text-stone-500 mb-1">
                Drop image here
              </p>
              <label className="text-xs text-stone-500 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 cursor-pointer underline underline-offset-2 transition-colors">
                or browse
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={(e) => handleFileUpload(e, dayIndex)}
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-4 border border-dashed border-transparent hover:border-stone-300 dark:hover:border-neutral-700 rounded-lg text-stone-500 text-xs text-center relative mt-2 group transition-colors">
              {isUploadingHere ? (
                <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
              ) : (
                <label className="flex items-center gap-1 opacity-0 group-hover:opacity-100 cursor-pointer text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-all">
                  <Plus className="w-4 h-4" />
                  Add Image
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    onChange={(e) => handleFileUpload(e, dayIndex)}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-full flex flex-col font-sans bg-surface dark:bg-neutral-900 selection:bg-stone-200 selection:text-stone-900 overflow-hidden relative">
      {/* Navbar / Header */}
      <header className="flex items-center justify-between px-8 py-5 sticky top-0 z-50 bg-surface dark:bg-neutral-900">
        <div className="flex items-center gap-4 text-stone-800 dark:text-stone-200">
          <h1 className="text-xl font-light tracking-tight flex items-center gap-2 text-stone-500">
            Week
            <strong className="font-medium text-stone-800 dark:text-stone-200">
              {getISOWeek(currentDate)}
            </strong>
          </h1>
          <div className="w-px h-4 bg-stone-300 dark:bg-stone-700" />
          <span className="text-sm font-medium text-stone-500 dark:text-stone-400">
            {format(weekStart, "MMMM d")} -{" "}
            {format(addDays(weekStart, 6), "d")}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Elegant Today Navigation */}
          <div className="flex items-center bg-white dark:bg-neutral-800 rounded-full shadow-sm border border-stone-200 dark:border-neutral-700 h-8">
            <button
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="px-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors h-full rounded-l-full"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              className="px-3 text-[11px] font-bold uppercase tracking-widest text-stone-600 dark:text-stone-300 hover:text-stone-900 border-x border-stone-200 dark:border-stone-700 h-full flex items-center bg-stone-50 dark:bg-neutral-800/50"
              onClick={() => setCurrentDate(new Date())}
              aria-label="Go to current week"
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="px-2 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors h-full rounded-r-full"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Right Floating Action Bar */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col items-center z-40 max-md:right-2 max-md:top-auto max-md:bottom-4 max-md:translate-y-0 max-md:flex-row max-md:right-auto max-md:left-1/2 max-md:-translate-x-1/2">
        <div className="flex flex-col max-md:flex-row items-center gap-5 max-md:gap-3 bg-white/90 dark:bg-neutral-800/90 backdrop-blur-md shadow-xl border border-stone-200/50 dark:border-neutral-700/50 rounded-[32px] max-md:rounded-full p-2.5 py-6 max-md:py-2.5 max-md:px-6 w-14 max-md:w-auto max-md:h-14">
          <button
            className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors group relative"
            aria-label="Grid view"
          >
            <LayoutGrid className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </button>

          <button
            className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors group relative"
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
            className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors group relative"
            aria-label="Export"
          >
            <Download className="w-[22px] h-[22px]" strokeWidth={1.5} />
          </button>

          <div className="w-8 max-md:w-px max-md:h-8 border-b max-md:border-b-0 max-md:border-r border-stone-100 dark:border-neutral-700/60 my-0.5 max-md:mx-0.5" />

          <button
            className="text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors group relative"
            onClick={() =>
              setLanguage((l) => (l === "en" ? "zh" : "en"))
            }
            aria-label={language === "zh" ? "Switch to English" : "Switch to Chinese"}
          >
            <Globe className="w-[22px] h-[22px]" strokeWidth={1.5} />
            <span className="absolute right-full max-md:right-auto max-md:bottom-full mr-3 max-md:mr-0 max-md:mb-3 bg-stone-800 text-white text-[10px] px-2 py-1 flex items-center h-6 rounded shadow-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              {language === "zh" ? "Switch to English" : "Switch to Chinese"}
            </span>
          </button>

          <div className="w-8 max-md:w-px max-md:h-8 border-b max-md:border-b-0 max-md:border-r border-stone-100 dark:border-neutral-700/60 my-0.5 max-md:mx-0.5" />

          <button
            className="text-red-400/80 hover:text-red-600 dark:hover:text-red-500 transition-colors group relative"
            onClick={handleClearWeek}
            aria-label={confirmClear ? "Click again to confirm clearing the week" : "Clear all images from this week"}
          >
            <Trash2 className="w-[22px] h-[22px]" strokeWidth={1.5} />
            <span className="absolute right-full max-md:right-auto max-md:bottom-full mr-3 max-md:mr-0 max-md:mb-3 bg-red-600 text-white text-[10px] px-2 py-1 flex items-center h-6 rounded shadow-lg opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">
              {confirmClear ? "Click again to confirm" : "Clear Week"}
            </span>
          </button>
        </div>
      </div>

      {/* Board Area */}
      <main
        className="flex-1 p-6 flex flex-col gap-6 overflow-hidden"
        style={{ paddingBottom: `${notesHeight + 24}px` }}
      >
        {/* Progress bar / loader */}
        {uploadingDay !== null && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-amber-100 dark:bg-amber-950 z-[100] overflow-hidden">
            <div className="h-full bg-amber-500 w-full animate-progress" />
          </div>
        )}

        {/* Row 1: Mon, Tue, Wed */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
          {renderDayCell(1)}
          {renderDayCell(2)}
          {renderDayCell(3)}
        </div>

        {/* Row 2: Thu, Fri, Weekend (Sat + Sun) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 min-h-0">
          {renderDayCell(4)}
          {renderDayCell(5)}
          <div className="grid grid-cols-2 gap-2 h-full">
            {renderDayCell(6, "SAT")}
            {renderDayCell(7, "SUN")}
          </div>
        </div>
      </main>

      {/* Notes Area */}
      <ResizableNotesArea
        height={notesHeight}
        onHeightChange={handleNotesHeightChange}
        notes={notes}
        onNotesChange={handleNotesChange}
      />
    </div>
  );
}

export default App;
