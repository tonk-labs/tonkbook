import React, { useState } from "react";
import { Source } from "../../types/source";
import { writeDoc } from "@tonk/keepsync";
import * as pdfjsLib from "pdfjs-dist";

interface PDFSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: Omit<Source, "id" | "noteId">) => void;
}

const PDFSourceModal: React.FC<PDFSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
}) => {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/pdf") {
        setFile(selectedFile);
        setError(null);
        // Auto-populate title with filename if title is empty
        if (!title.trim()) {
          const fileName = selectedFile.name.replace(/\.pdf$/i, "");
          setTitle(fileName);
        }
      } else {
        setError("Please select a PDF file");
        setFile(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const trimmedTitle = title.trim();
      const sourcePath = `tonkbook/data/${trimmedTitle}`;

      // Read file as array buffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Set up PDF.js worker - use public path
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

      // Extract text from PDF using pdf.js (use a copy to avoid buffer detachment)
      const pdfDataCopy = new Uint8Array(uint8Array);
      const loadingTask = pdfjsLib.getDocument({ data: pdfDataCopy });
      const pdf = await loadingTask.promise;

      let extractedText = "";
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        extractedText += pageText + "\n";
      }

      // Create the source content document with metadata and extracted text
      // Note: We don't store the binary data in keepsync as it causes issues with large files
      const sourceContent = {
        title: trimmedTitle,
        content: extractedText.trim(),
        metadata: {
          type: "pdf",
          createdAt: new Date().toISOString(),
          mimeType: file.type,
          fileName: file.name,
          fileSize: file.size,
        },
      };

      // Write the content to keepsync
      await writeDoc(sourcePath, sourceContent);

      // Create the source reference for the store
      const sourceReference: Omit<Source, "id" | "noteId"> = {
        title: trimmedTitle,
        path: sourcePath,
        metadata: {
          type: "pdf",
          createdAt: new Date().toISOString(),
        },
      };

      onAddSource(sourceReference);
      setTitle("");
      setFile(null);
      onClose();
    } catch (err) {
      console.error("Error processing PDF:", err);
      setError("Failed to process PDF file. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setFile(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">PDF Source</h3>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your PDF source"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF File
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>Selected: {file.name}</p>
                  <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              )}
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            {isProcessing && (
              <div className="text-blue-600 text-sm bg-blue-50 p-3 rounded-lg">
                Processing PDF and extracting text...
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || !file || isProcessing}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : "Add PDF Source"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFSourceModal;

