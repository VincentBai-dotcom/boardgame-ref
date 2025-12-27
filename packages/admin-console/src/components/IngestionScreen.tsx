import { useState } from "react";
import { Layout } from "./Layout";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { BookOpen, Upload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { client } from "@/lib/client";
import { useProtectedApi } from "@/hooks/useProtectedApi";

type IngestionStatus = "idle" | "loading" | "success" | "error";

export function IngestionScreen() {
  const { withRetry } = useProtectedApi();
  const [status, setStatus] = useState<IngestionStatus>("idle");
  const [result, setResult] = useState<{
    gameId?: string;
    rulebookId?: string;
    chunksCreated?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    boardgameName: "",
    yearPublished: new Date().getFullYear(),
    bggId: 0,
    rulebookTitle: "",
    rulebookType: "base" as
      | "base"
      | "expansion"
      | "quickstart"
      | "reference"
      | "faq"
      | "other",
    language: "en",
  });
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setError("Please select a PDF file");
      return;
    }

    setStatus("loading");
    setError(null);
    setResult(null);

    try {
      const response = await withRetry(async () => {
        return await client.local.ingestion.game.post({
          boardgameName: formData.boardgameName,
          yearPublished: formData.yearPublished,
          bggId: formData.bggId,
          rulebookTitle: formData.rulebookTitle,
          rulebookPdfFile: file,
          rulebookType: formData.rulebookType,
          language: formData.language,
        });
      });

      if (response.error) {
        console.log(response.error.value);
        throw new Error(response.error.value?.error || "Failed to ingest game");
      }

      setStatus("success");
      setResult(response.data);

      // Reset form
      setFormData({
        boardgameName: "",
        yearPublished: new Date().getFullYear(),
        bggId: 0,
        rulebookTitle: "",
        rulebookType: "base",
        language: "en",
      });
      setFile(null);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".pdf")) {
        setError("Only PDF files are supported");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  return (
    <Layout>
      <div className="flex items-start justify-center p-4 pt-20">
        <Card className="w-full max-w-2xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-neutral-900 dark:bg-neutral-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-neutral-50 dark:text-neutral-900" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">
                  Game Ingestion
                </CardTitle>
                <CardDescription>
                  Upload a rulebook PDF to process and ingest into the system
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {status === "success" && result && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900 dark:text-green-100">
                      Successfully ingested!
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      Game ID: {result.gameId}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Rulebook ID: {result.rulebookId}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Chunks created: {result.chunksCreated}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {status === "error" && error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 dark:text-red-100">
                      Error occurred
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="boardgameName">Board Game Name*</Label>
                  <Input
                    id="boardgameName"
                    required
                    value={formData.boardgameName}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        boardgameName: e.target.value,
                      })
                    }
                    disabled={status === "loading"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="yearPublished">Year Published*</Label>
                  <Input
                    id="yearPublished"
                    type="number"
                    required
                    min="1900"
                    max={new Date().getFullYear()}
                    value={formData.yearPublished}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        yearPublished: Number(e.target.value),
                      })
                    }
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bggId">BoardGameGeek ID*</Label>
                  <Input
                    id="bggId"
                    type="number"
                    required
                    min="1"
                    value={formData.bggId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        bggId: Number(e.target.value),
                      })
                    }
                    disabled={status === "loading"}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rulebookTitle">Rulebook Title*</Label>
                  <Input
                    id="rulebookTitle"
                    required
                    value={formData.rulebookTitle}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        rulebookTitle: e.target.value,
                      })
                    }
                    disabled={status === "loading"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rulebookType">Rulebook Type</Label>
                  <Select
                    value={formData.rulebookType}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        rulebookType: value as typeof formData.rulebookType,
                      })
                    }
                    disabled={status === "loading"}
                  >
                    <SelectTrigger id="rulebookType">
                      <SelectValue placeholder="Select rulebook type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="base">Base Game</SelectItem>
                      <SelectItem value="expansion">Expansion</SelectItem>
                      <SelectItem value="quickstart">Quickstart</SelectItem>
                      <SelectItem value="reference">Reference</SelectItem>
                      <SelectItem value="faq">FAQ</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={formData.language}
                    onValueChange={(value) =>
                      setFormData({ ...formData, language: value })
                    }
                    disabled={status === "loading"}
                  >
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="it">Italian</SelectItem>
                      <SelectItem value="pt">Portuguese</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                      <SelectItem value="ko">Korean</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Rulebook PDF*</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf"
                    required
                    onChange={handleFileChange}
                    disabled={status === "loading"}
                    className="flex-1"
                  />
                  {file && (
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {file.name}
                    </span>
                  )}
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={status === "loading"}
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing... This may take a while
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Start Ingestion
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
