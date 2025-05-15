import React from "react";
import { Power } from "../../types/Power";

interface PowerListProps {
  powers: Power[] | null;
  selectedPower: Power | null;
  onSelectPower: (power: Power) => void;
}

const PowerList: React.FC<PowerListProps> = ({
  powers,
  selectedPower,
  onSelectPower,
}) => {
  return powers ? (
    <aside className="sticky top-0 h-screen w-64 bg-base-200 border-r border-gray-300 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Powers</h2>
      <ul className="menu-xs bg-base-100 rounded-box">
        {powers.map((power) => (
          <li
            key={power.power_id}
            onClick={() => onSelectPower(power)}
            className={`cursor-pointer text-xs ${
              selectedPower?.power_id === power.power_id ? "bg-primary text-white" : ""
            }`}
          >
            {power.power_name}
          </li>
        ))}
      </ul>
    </aside>
  ) : null;
};

export default PowerList;