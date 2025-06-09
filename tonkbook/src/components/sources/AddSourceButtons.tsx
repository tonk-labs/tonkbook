import React from "react";
import { PlusIcon } from "lucide-react";

interface AddSourceButtonsProps {
  onAddText: () => void;
}

const AddSourceButtons: React.FC<AddSourceButtonsProps> = ({
  onAddText,
}) => {
  return (
    <div className="mb-3">
      <button
        onClick={onAddText}
        className="w-full flex items-center justify-center gap-2 text-sm bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-full border border-green-200 transition-colors"
      >
        <PlusIcon size={16} />
        Add Text
      </button>
    </div>
  );
};

export default AddSourceButtons;

