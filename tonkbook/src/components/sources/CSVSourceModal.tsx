import React, { useState } from "react";
import { Source } from "../../types/source";
import { writeDoc } from "@tonk/keepsync";

interface CSVSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSource: (source: Omit<Source, "id">) => void;
}

const CSVSourceModal: React.FC<CSVSourceModalProps> = ({
  isOpen,
  onClose,
  onAddSource,
}) => {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][]; totalRows: number } | null>(null);

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

    // Simple CSV parsing (handles basic cases)
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1, 6).map(line => parseCSVLine(line)); // Preview first 5 rows
    const totalRows = lines.length - 1; // Subtract header row

    return { headers, rows, totalRows };
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "text/csv" || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
        
        // Auto-populate title with filename if title is empty
        if (!title.trim()) {
          const fileName = selectedFile.name.replace(/\.csv$/i, "");
          setTitle(fileName);
        }

        // Generate preview
        try {
          const text = await selectedFile.text();
          const parsedData = parseCSV(text);
          setPreview(parsedData);
        } catch (err) {
          setError("Failed to read CSV file");
          setPreview(null);
        }
      } else {
        setError("Please select a CSV file");
        setFile(null);
        setPreview(null);
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

      // Read CSV content
      const csvText = await file.text();
      const parsedData = parseCSV(csvText);

      // Create formatted content for storage
      let formattedContent = `CSV Data: ${file.name}\n`;
      formattedContent += `Rows: ${parsedData.totalRows}\n`;
      formattedContent += `Columns: ${parsedData.headers.length}\n\n`;
      
      // Add headers
      formattedContent += `Headers:\n${parsedData.headers.join(', ')}\n\n`;
      
      // Add sample data (first few rows)
      if (parsedData.rows.length > 0) {
        formattedContent += `Sample Data:\n`;
        parsedData.rows.forEach((row, index) => {
          formattedContent += `Row ${index + 1}: ${row.join(', ')}\n`;
        });
      }

      // Store original CSV content and parsed data
      const sourceContent = {
        title: trimmedTitle,
        content: formattedContent,
        rawCsvContent: csvText,
        parsedData: {
          headers: parsedData.headers,
          totalRows: parsedData.totalRows,
          columnCount: parsedData.headers.length
        },
        metadata: {
          type: "csv",
          createdAt: new Date().toISOString(),
          mimeType: file.type || "text/csv",
          fileName: file.name,
          fileSize: file.size,
        },
      };

      // Write the content to keepsync
      await writeDoc(sourcePath, sourceContent);

      // Create the source reference for the store
      const sourceReference: Omit<Source, "id"> = {
        title: trimmedTitle,
        path: sourcePath,
        metadata: {
          type: "csv",
          createdAt: new Date().toISOString(),
        },
      };

      onAddSource(sourceReference);
      setTitle("");
      setFile(null);
      setPreview(null);
      onClose();
    } catch (err) {
      console.error("Error processing CSV:", err);
      setError("Failed to process CSV file. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    setTitle("");
    setFile(null);
    setPreview(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">CSV Source</h3>
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
                placeholder="Enter a title for your CSV source"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV File
              </label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {file && (
                <div className="mt-2 text-sm text-gray-600">
                  <p>Selected: {file.name}</p>
                  <p>Size: {(file.size / 1024).toFixed(2)} KB</p>
                </div>
              )}
            </div>

            {preview && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">CSV Preview</h4>
                <div className="text-sm text-gray-600 mb-3">
                  <p>Total Rows: {preview.totalRows}</p>
                  <p>Columns: {preview.headers.length}</p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.headers.map((header, index) => (
                          <th key={index} className="px-3 py-2 border-b border-gray-200 text-left text-xs font-medium text-gray-700 uppercase">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-gray-200">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 text-sm text-gray-900 max-w-32 truncate">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {preview.totalRows > 5 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Showing first 5 rows of {preview.totalRows} total rows
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                {error}
              </div>
            )}

            {isProcessing && (
              <div className="text-blue-600 text-sm bg-blue-50 p-3 rounded-lg">
                Processing CSV...
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
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : "Add CSV Source"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CSVSourceModal;