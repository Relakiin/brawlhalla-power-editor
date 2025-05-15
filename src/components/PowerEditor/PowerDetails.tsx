import React, { useState } from "react";
import { Power } from "../../types/Power";
import { notify, NotifMode } from "../../utils/notify";

interface PowerDetailsProps {
  power: Power;
  descriptions: Record<string, string>;
  onPowerChange: (updatedPower: Power) => void;
}

const PowerDetails: React.FC<PowerDetailsProps> = ({
  power,
  descriptions,
  onPowerChange,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const handleInputChange = (key: string, value: string) => {
    const updatedPower = { ...power, [key]: value };
    onPowerChange(updatedPower);
  };

  const handleCopyProperties = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(power, null, 2));
      notify("Power properties copied to clipboard!", NotifMode.SUCCESS);
    } catch (error) {
      console.error("Failed to copy properties:", error);
      notify("Failed to copy properties.", NotifMode.ERROR);
    }
  };

  const handlePasteProperties = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      const parsedProperties: Power = JSON.parse(clipboardText);

      if (typeof parsedProperties === "object" && parsedProperties !== null) {
        const updatedPower = { ...parsedProperties };
        onPowerChange(updatedPower);
        notify("Power properties pasted successfully!", NotifMode.SUCCESS);
      } else {
        notify("Invalid properties in clipboard.", NotifMode.ERROR);
      }
    } catch (error) {
      console.error("Failed to paste properties:", error);
      notify("Failed to paste properties.", NotifMode.ERROR);
    }
  };

  const filteredProperties = Object.entries(power).filter(([key]) =>
    key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-base-100 border border-gray-300 rounded-lg p-4 collapse collapse-arrow">
      <input type="checkbox" />
      <div className="grid grid-cols-2 gap-2 items-center w-full collapse-title">
        <div>
          <h1 className="text-2xl font-bold">{power.power_name}</h1>
          <p className="text-sm text-gray-500">ID: {power.power_id}</p>
          <p className="text-sm text-gray-500">Dev Notes: {power.dev_notes}</p>
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleCopyProperties}
          >
            Copy properties
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handlePasteProperties}
          >
            Paste properties
          </button>
        </div>
      </div>

      {/* properties form */}
      <form className="mt-4 collapse-content">
        <div className="mt-2 mb-5">
          <input
            type="text"
            placeholder="Search properties..."
            className="input input-bordered w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-6 gap-4">
          {filteredProperties.map(([key, value]) => (
            <React.Fragment key={key}>
              <div className="flex items-center gap-2">
                <label htmlFor={key} className="font-semibold">
                  {key}
                </label>
                {descriptions[key] && (
                  <div
                    className="tooltip tooltip-right"
                    data-tip={descriptions[key]}
                  >
                    <button
                      type="button"
                      className="btn btn-xs btn-circle btn-ghost"
                      aria-label={`Description for ${key}`}
                    >
                      ?
                    </button>
                  </div>
                )}
              </div>
              <input
                id={key}
                type="text"
                value={value || ""}
                className="input input-bordered"
                onChange={(e) => handleInputChange(key, e.target.value)}
              />
            </React.Fragment>
          ))}
        </div>
      </form>
    </div>
  );
};

export default PowerDetails;
