import React from "react";

interface PowerEditorNavbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onLoadFile: () => void;
  onWriteFile: () => void;
  onCreatePower: () => void;
  onDeletePower: () => void;
}

const PowerEditorNavbar: React.FC<PowerEditorNavbarProps> = ({
  searchQuery,
  onSearchChange,
  onLoadFile,
  onWriteFile,
  onCreatePower,
  onDeletePower,
}) => {
  return (
    <header className="sticky top-0 bg-base-200 p-4 grid grid-cols-6 gap-4 items-center shadow-md z-50">
      <button className="btn btn-primary" onClick={onLoadFile}>
        Load File
      </button>
      <button className="btn btn-primary" onClick={onWriteFile}>
        Write to File
      </button>
      <input
        type="text"
        placeholder="Search powers by name..."
        className="input input-bordered w-full col-span-2"
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <button className="btn btn-success" onClick={onCreatePower}>
        Add new Power
      </button>
      <button className="btn btn-warning" onClick={onDeletePower}>
        Delete Power
      </button>
    </header>
  );
};

export default PowerEditorNavbar;