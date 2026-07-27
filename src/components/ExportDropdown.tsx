import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Download, FileText, FileSpreadsheet, ChevronDown, Check } from "lucide-react";

interface ExportDropdownProps {
  onExportPDF: () => void;
  onExportExcel: () => void;
  label?: string;
  disabled?: boolean;
}

export function ExportDropdown({
  onExportPDF,
  onExportExcel,
  label = "Export",
  disabled = false,
}: ExportDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(type);
    try {
      if (type === "pdf") {
        await onExportPDF();
      } else {
        await onExportExcel();
      }
    } finally {
      setTimeout(() => {
        setExporting(null);
        setIsOpen(false);
      }, 500);
    }
  };

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="gap-2"
      >
        <Download className={`w-4 h-4 ${exporting ? "animate-bounce" : ""}`} />
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-48 bg-card rounded-xl border border-border shadow-lg z-50 overflow-hidden"
            >
              <div className="p-1">
                <button
                  onClick={() => handleExport("pdf")}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {exporting === "pdf" ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <FileText className="w-4 h-4 text-red-500" />
                  )}
                  <div className="text-left">
                    <p className="font-medium">Export as PDF</p>
                    <p className="text-xs text-muted-foreground">Formatted report</p>
                  </div>
                </button>
                <button
                  onClick={() => handleExport("excel")}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {exporting === "excel" ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  )}
                  <div className="text-left">
                    <p className="font-medium">Export as Excel</p>
                    <p className="text-xs text-muted-foreground">Spreadsheet data</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
