import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Brain,
  Calendar,
  Download,
  FileHeart,
  FileText,
  FileUp,
  Loader2,
  Paperclip,
  Plus,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createRecord, getRecordFileDownloadUrl, getRecords, HealthRecord, UploadedRecordFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const MAX_UPLOAD_BYTES = 6 * 1024 * 1024;

const recordTypes = [
  { value: "consultation", label: "Consultation" },
  { value: "lab-report", label: "Lab Report" },
  { value: "vaccination", label: "Vaccination" },
  { value: "prescription", label: "Prescription" },
];

const emptyForm = {
  title: "",
  description: "",
  date: new Date().toISOString().split("T")[0],
  type: "lab-report",
};

const typeLabel = (value: string) => recordTypes.find((type) => type.value === value)?.label ?? value;

const formatBytes = (bytes?: number) => {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const titleFromFileName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const inferTypeFromFileName = (name: string) => {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("prescription") || lowerName.includes("rx")) return "prescription";
  if (lowerName.includes("vaccine") || lowerName.includes("vaccination")) return "vaccination";
  if (lowerName.includes("consult")) return "consultation";
  return "lab-report";
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const readReadableText = async (file: File) => {
  if (file.type.startsWith("image/")) return "";

  try {
    const raw = await file.text();
    const readable = raw
      .replace(/[^\x09\x0A\x0D\x20-\x7E\u0900-\u097F]/g, " ")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return readable.length > 80 ? readable.slice(0, 12000) : "";
  } catch {
    return "";
  }
};

function RecordsContent() {
  const { user } = useAuth();
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploadedFile, setUploadedFile] = useState<UploadedRecordFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [filePreparing, setFilePreparing] = useState(false);

  useEffect(() => {
    const fetchRecords = async () => {
      if (!user) return;
      try {
        setRecords(await getRecords());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to load records.");
      }
    };

    fetchRecords();
  }, [user]);

  const recordsWithFiles = useMemo(() => records.filter((record) => record.fileUrl).length, [records]);

  const resetForm = () => {
    setForm({ ...emptyForm, date: new Date().toISOString().split("T")[0] });
    setUploadedFile(null);
  };

  const closeDialog = () => {
    if (loading || filePreparing) return;
    setOpen(false);
    resetForm();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("File size must be 6 MB or less.");
      event.target.value = "";
      return;
    }

    setFilePreparing(true);
    try {
      const [dataUrl, extractedText] = await Promise.all([readFileAsDataUrl(file), readReadableText(file)]);
      const base64 = dataUrl.split(",").pop() || "";
      const nextFile: UploadedRecordFile = {
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        base64,
        extractedText,
      };

      setUploadedFile(nextFile);
      setForm((current) => ({
        ...current,
        title: current.title.trim() || titleFromFileName(file.name),
        type: current.type || inferTypeFromFileName(file.name),
      }));
    } catch {
      toast.error("Unable to prepare selected file.");
    } finally {
      setFilePreparing(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !form.title.trim()) return;
    if (!form.description.trim() && !uploadedFile) {
      toast.error("Add notes or upload a medical document.");
      return;
    }

    setLoading(true);
    try {
      const record = await createRecord({
        title: form.title,
        description: form.description,
        date: form.date,
        type: form.type,
        file: uploadedFile ?? undefined,
      });
      setRecords((current) => [record, ...current]);
      setOpen(false);
      resetForm();
      toast.success(record.aiSummary ? "Record saved with AI summary" : "Record added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save record.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Health Records" subtitle="Upload reports, prescriptions, and consultations with AI-generated summaries.">
      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total records</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">{records.length}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft">
              <FileHeart className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Files attached</p>
              <p className="mt-1 text-2xl font-extrabold text-foreground">{recordsWithFiles}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-soft">
              <Paperclip className="h-5 w-5 text-accent" />
            </div>
          </div>
        </div>
        <Button variant="hero" className="h-full min-h-24 justify-start rounded-lg px-5 text-left md:justify-center" onClick={() => setOpen(true)}>
          <Plus className="h-5 w-5" />
          Add report or prescription
        </Button>
      </section>

      {records.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-soft sm:p-12">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-primary-soft">
            <FileUp className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">No records uploaded yet</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Add lab reports, prescriptions, consultation notes, or vaccination documents. AI will create a concise summary whenever readable document text or notes are available.
          </p>
          <Button variant="hero" className="mt-5" onClick={() => setOpen(true)}>
            <UploadCloud className="h-4 w-4" />
            Upload first record
          </Button>
        </div>
      ) : (
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          {records.map((record) => (
            <article key={record.id} className="flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-card transition-smooth hover:-translate-y-0.5 sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-bold text-foreground" title={record.title}>{record.title}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{typeLabel(record.type)}</span>
                      <span>•</span>
                      <span>{new Date(record.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                  {record.aiSummary ? "AI summarized" : "Saved"}
                </span>
              </div>

              <p className="text-sm leading-6 text-muted-foreground">{record.description}</p>

              {record.fileUrl && (
                <a
                  href={getRecordFileDownloadUrl(record.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3 text-sm transition-smooth hover:border-primary/40 hover:bg-primary-soft"
                >
                  <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
                    <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{record.fileName}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    {formatBytes(record.fileSize)}
                    <Download className="h-4 w-4" />
                  </span>
                </a>
              )}

              {record.aiSummary && (
                <div className="mt-4 rounded-lg border border-primary/15 bg-primary-soft/60 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-primary">
                    <Brain className="h-4 w-4" />
                    AI summary
                  </div>
                  <p className="whitespace-pre-line text-sm leading-6 text-foreground">{record.aiSummary}</p>
                </div>
              )}

              <div className="mt-auto flex items-center gap-1.5 border-t border-border pt-4 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Added {new Date(record.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </article>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 p-4 backdrop-blur-sm md:items-center" onClick={closeDialog}>
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-elevated sm:p-6 md:p-8" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">Add medical record</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Upload a report, prescription, or consultation document. AI summary is generated after saving.
                </p>
              </div>
              <button onClick={closeDialog} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-lg border border-dashed border-border bg-surface p-4">
                <Label htmlFor="record-file" className="flex cursor-pointer flex-col items-center justify-center rounded-lg px-4 py-6 text-center transition-smooth hover:bg-primary-soft">
                  <UploadCloud className="mb-3 h-8 w-8 text-primary" />
                  <span className="font-bold text-foreground">Choose report or prescription file</span>
                  <span className="mt-1 text-xs text-muted-foreground">PDF, image, text, CSV, JSON, DOC, or DOCX up to 6 MB</span>
                  <Input
                    id="record-file"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.csv,.json,.doc,.docx,application/pdf,image/*,text/*"
                    className="sr-only"
                    onChange={handleFileChange}
                    disabled={filePreparing || loading}
                  />
                </Label>

                {uploadedFile && (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{uploadedFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(uploadedFile.size)} {uploadedFile.extractedText ? "• readable text found" : "• file attached"}
                        </p>
                      </div>
                    </div>
                    <button type="button" onClick={() => setUploadedFile(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove file">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="title">Record title *</Label>
                  <Input id="title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Complete blood count report" className="h-11 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Record date *</Label>
                  <Input id="date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="h-11 rounded-lg" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Record type *</Label>
                  <select id="type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} aria-label="Record type" className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm">
                    {recordTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="desc">Notes for AI summary</Label>
                <Textarea
                  id="desc"
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Add visible findings, doctor's advice, medication notes, or anything important from the document."
                  className="resize-none rounded-lg"
                />
              </div>

              <div className="rounded-lg border border-primary/15 bg-primary-soft/70 p-4">
                <div className="flex items-start gap-3 text-sm text-primary">
                  <Brain className="mt-0.5 h-4 w-4 shrink-0" />
                  <p className="leading-6">
                    AI summary will use readable uploaded text and your notes. It will not diagnose or prescribe medicines.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Button type="button" variant="outline" className="flex-1" onClick={closeDialog} disabled={loading || filePreparing}>Cancel</Button>
                <Button type="submit" variant="hero" className="flex-1" disabled={loading || filePreparing}>
                  {loading || filePreparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}
                  {filePreparing ? "Preparing file..." : loading ? "Generating summary..." : "Save record"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function RecordsPage() {
  return (
    <ProtectedRoute>
      <RecordsContent />
    </ProtectedRoute>
  );
}
