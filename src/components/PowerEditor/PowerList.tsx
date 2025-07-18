import React, { useState } from "react";
import { Power } from "../../types/Power";

interface PowerListProps {
  powers: Power[] | null;
  selectedPower: Power | null;
  onSelectPower: (power: Power) => void;
}

interface GroupedPowers {
  [key: string]: Power[];
}

const PowerList: React.FC<PowerListProps> = ({
  powers,
  selectedPower,
  onSelectPower,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<{[key: string]: boolean}>({});

  if (!powers) return null;

  // Group powers by parent_item
  const groupedPowers: GroupedPowers = {};
  const ungroupedPowers: Power[] = [];

  powers.forEach((power) => {
    const parentItem = power.parent_item || "";
    
    if (parentItem.trim() === "") {
      ungroupedPowers.push(power);
    } else {
      if (!groupedPowers[parentItem]) {
        groupedPowers[parentItem] = [];
      }
      groupedPowers[parentItem].push(power);
    }
  });

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  return (
    <aside className="sticky top-0 h-screen w-64 bg-base-200 border-r border-gray-300 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Powers</h2>
      <ul className="menu-xs bg-base-100 rounded-box">
        {/* Render grouped powers */}
        {Object.keys(groupedPowers).map((groupName) => (
          <li key={groupName} className="menu-item">
            <div 
              className="flex items-center justify-between cursor-pointer py-1 px-2 hover:bg-base-300"
              onClick={() => toggleGroup(groupName)}
            >
              <span className="font-medium">{groupName}</span>
              <span>{expandedGroups[groupName] ? '▼' : '►'}</span>
            </div>
            {expandedGroups[groupName] && (
              <ul className="pl-4">
                {groupedPowers[groupName].map((power) => (
                  <li
                    key={power.power_id}
                    onClick={() => onSelectPower(power)}
                    className={`cursor-pointer text-xs py-1 px-2 ${selectedPower?.power_id === power.power_id ? "bg-primary text-white" : ""}`}
                  >
                    {power.power_name}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        
        {/* Render ungrouped powers */}
        {ungroupedPowers.length > 0 && (
          <li className="menu-item">
            <div 
              className="flex items-center justify-between cursor-pointer py-1 px-2 hover:bg-base-300"
              onClick={() => toggleGroup("Ungrouped")}
            >
              <span className="font-medium">Ungrouped</span>
              <span>{expandedGroups["Ungrouped"] ? '▼' : '►'}</span>
            </div>
            {expandedGroups["Ungrouped"] && (
              <ul className="pl-4">
                {ungroupedPowers.map((power) => (
                  <li
                    key={power.power_id}
                    onClick={() => onSelectPower(power)}
                    className={`cursor-pointer text-xs py-1 px-2 ${selectedPower?.power_id === power.power_id ? "bg-primary text-white" : ""}`}
                  >
                    {power.power_name}
                  </li>
                ))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </aside>
  );
};

export default PowerList;