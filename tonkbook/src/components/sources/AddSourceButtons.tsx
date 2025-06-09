import React from "react";
import { PlusIcon, FileTextIcon } from "lucide-react";

interface AddSourceButtonsProps {
  onAddText: () => void;
  onAddPdf: () => void;
}

const AddSourceButtons: React.FC<AddSourceButtonsProps> = ({
  onAddText,
  onAddPdf,
}) => {
  return (
    <div className="mb-3 space-y-2">
      <button
        onClick={onAddText}
        className="w-full flex items-center justify-center gap-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-full border border-green-200 transition-colors"
      >
        <PlusIcon size={16} />
        Add Text
      </button>
      <button
        onClick={onAddPdf}
        className="w-full flex items-center justify-center gap-2 text-sm bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-full border border-red-200 transition-colors"
      >
        <FileTextIcon size={16} />
        Add PDF
      </button>
    </div>
  );
};

export default AddSourceButtons;

