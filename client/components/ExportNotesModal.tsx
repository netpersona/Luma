import { useState } from "react";
import { Download, FileText, FileJson, File } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ExportNotesModalProps {
  bookId?: string;
  bookTitle?: string;
  trigger?: React.ReactNode;
}

type ExportFormat = 'json' | 'markdown' | 'text';

const formatOptions: { value: ExportFormat; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Best for note-taking apps like Obsidian, Notion, or printing',
    icon: <FileText className="h-5 w-5" />,
  },
  {
    value: 'text',
    label: 'Plain Text',
    description: 'Simple format that works everywhere',
    icon: <File className="h-5 w-5" />,
  },
  {
    value: 'json',
    label: 'JSON',
    description: 'For developers or importing into other apps',
    icon: <FileJson className="h-5 w-5" />,
  },
];

export function ExportNotesModal({ bookId, bookTitle, trigger }: ExportNotesModalProps) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (bookId) {
        params.set('bookId', bookId);
      }

      const response = await fetch(`/api/exports/notes?${params}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `reading-notes.${format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json'}`;
      
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="([^"]+)"/);
        if (match) {
          filename = match[1];
        }
      }

      if (bookTitle) {
        const safeTitle = bookTitle.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 50);
        filename = `${safeTitle}-notes.${format === 'markdown' ? 'md' : format === 'text' ? 'txt' : 'json'}`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export complete",
        description: `Your notes have been exported as ${format.toUpperCase()}`,
      });
      setOpen(false);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was a problem exporting your notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" data-testid="button-export-notes">
            <Download className="h-4 w-4 mr-2" />
            Export Notes
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Reading Notes</DialogTitle>
          <DialogDescription>
            {bookId
              ? `Export highlights and notes from "${bookTitle || 'this book'}"`
              : 'Export all your highlights and notes from your entire library'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
            {formatOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate cursor-pointer"
                onClick={() => setFormat(option.value)}
              >
                <RadioGroupItem
                  value={option.value}
                  id={option.value}
                  className="mt-1"
                  data-testid={`radio-format-${option.value}`}
                />
                <div className="flex-1">
                  <Label
                    htmlFor={option.value}
                    className="flex items-center gap-2 cursor-pointer font-medium"
                  >
                    {option.icon}
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            ))}
          </RadioGroup>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="button-cancel-export"
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            data-testid="button-confirm-export"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
