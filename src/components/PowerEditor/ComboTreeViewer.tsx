import React from "react";
import { ComboTree } from "../../types/ComboTree";
import { Power } from "../../types/Power";
import { ActiveInput } from "../../types/ActiveInput";

interface ComboTreeViewerProps {
  comboTree: ComboTree | null;
  reverseComboTree: ComboTree | null;
  onSelectPower: (power: Power) => void;
}

const ComboTreeViewer: React.FC<ComboTreeViewerProps> = ({
  comboTree,
  reverseComboTree,
  onSelectPower,
}) => {
  const renderComboSection = (
    title: string,
    combo: Power[] | ActiveInput[] | undefined
  ) => {
    if (!combo || !Array.isArray(combo) || combo.length === 0) return null;

    return (
      <div className="grid grid-cols-2">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <ul className="list-disc pl-4">
          {combo.map((item, index) => {
            if ("power_name" in item) {
              const power = item as Power;
              return (
                <li
                  key={index}
                  className="cursor-pointer text-blue-500 hover:underline"
                  onClick={() => onSelectPower(power)}
                >
                  {power.power_name}
                </li>
              );
            } else {
              const activeInput = item as ActiveInput;
              {
                return renderActiveInput(activeInput);
              }
            }
          })}
        </ul>
      </div>
    );
  };

  const renderActiveInput = (input: ActiveInput) => {
    return (
      <li key={input.direction}>
        {input.direction}:{" "}
        {input.combo && (
          <span
            className="cursor-pointer text-blue-500 hover:underline"
            onClick={() => onSelectPower(input.combo)}
          >
            {input.combo.power_name}
          </span>
        )}
      </li>
    );
  };

  const renderComboContainer = (tree: ComboTree | null) => {
    if (!tree) return;
    return (
      <>
        {renderComboSection("Normal", tree.normal ? [tree.normal] : undefined)}
        {renderComboSection("If Hit", tree.if_hit ? [tree.if_hit] : undefined)}
        {renderComboSection(
          "If Release",
          tree.if_release ? [tree.if_release] : undefined
        )}
        {renderComboSection(
          "If Wall",
          tree.if_wall ? [tree.if_wall] : undefined
        )}
        {renderComboSection(
          "If Button",
          tree.if_button ? [tree.if_button] : undefined
        )}
        {renderComboSection("If Direction", tree.if_dir)}
        {renderComboSection(
          "If Interrupt",
          tree.if_interrupt ? [tree.if_interrupt] : undefined
        )}
      </>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-10 mb-5">
      <div className="border border-gray-300 rounded-lg p-4 flex flex-col h-40 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Previous Combos</h2>
        {renderComboContainer(reverseComboTree)}
      </div>
      <div className="border border-gray-300 rounded-lg p-4 flex flex-col h-40 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Next Combos</h2>
        {renderComboContainer(comboTree)}
      </div>
    </div>
  );
};

export default ComboTreeViewer;
