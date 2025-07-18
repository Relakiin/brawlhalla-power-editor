import React, { useState, useEffect } from "react";
import { Power } from "../../types/Power";
import { Direction } from "../../enums/Direction";
import { ActiveInput } from "../../types/ActiveInput";
import { ComboTree } from "../../types/ComboTree";

interface PowerListProps {
  powers: Power[] | null;
  selectedPower: Power | null;
  onSelectPower: (power: Power) => void;
}

interface PowerNode {
  power: Power;
  children: {
    normal?: PowerNode;
    if_hit?: PowerNode;
    if_release?: PowerNode;
    if_wall?: PowerNode;
    if_button?: PowerNode;
    if_dir?: { direction: Direction; node: PowerNode }[];
    if_interrupt?: PowerNode;
  };
  expanded: boolean;
}

interface GroupedPowers {
  [key: string]: PowerNode[];
}

const PowerList: React.FC<PowerListProps> = ({
  powers,
  selectedPower,
  onSelectPower,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<{[key: string]: boolean}>({});
  const [groupedPowerNodes, setGroupedPowerNodes] = useState<GroupedPowers>({});
  const [ungroupedPowerNodes, setUngroupedPowerNodes] = useState<PowerNode[]>([]);

  // Find a power by name
  const findPowerByName = (name?: string): Power | undefined => {
    if (!name || !powers) return undefined;
    return powers.find(
      (p) => p.power_name?.toLowerCase() === name.toLowerCase()
    );
  };

  // Find active input powers
  const findActiveInputPowers = (inputString?: string): ActiveInput[] | undefined => {
    if (!inputString) return undefined;
    const inputs = inputString.split(",");
    const activeInputs: ActiveInput[] = inputs
      .map((input) => {
        const data = input.split(":"); // DIRECTION:PowerName
        if (data.length !== 2) return null;
        
        const directionKey = data[0].toUpperCase();
        const powerName = data[1];
        const direction = Direction[directionKey as keyof typeof Direction];
        if (!direction) return null;
        
        const combo = findPowerByName(powerName);
        if (!combo) return null;
        
        return { direction, combo };
      })
      .filter((input): input is ActiveInput => input !== null);
    
    return activeInputs.length > 0 ? activeInputs : undefined;
  };

  // Get combo tree for a power
  const getComboTreeForPower = (power: Power): ComboTree | null => {
    const tree: ComboTree = {
      normal: findPowerByName(power.combo_name || undefined),
      if_hit: findPowerByName(power.combo_override_if_hit || undefined),
      if_release: findPowerByName(power.combo_override_if_release || undefined),
      if_wall: findPowerByName(power.combo_override_if_wall || undefined),
      if_button: findPowerByName(power.combo_override_if_button || undefined),
      if_dir: findActiveInputPowers(power.combo_override_if_dir || undefined),
      if_interrupt: findPowerByName(
        power.combo_override_if_interrupt || undefined
      ),
    };
    
    const allEmpty = Object.values(tree).every((v) => v === undefined);
    return allEmpty ? null : tree;
  };

  // Build the power tree structure
  useEffect(() => {
    if (!powers) return;

    // Create initial nodes
    const nodes: PowerNode[] = powers.map(power => ({
      power,
      children: {},
      expanded: false
    }));

    // Build relationships
    nodes.forEach(node => {
      const comboTree = getComboTreeForPower(node.power);
      if (!comboTree) return;

      // Add normal combo
      if (comboTree.normal) {
        const targetNode = nodes.find(n => n.power.power_id === comboTree.normal?.power_id);
        if (targetNode) node.children.normal = targetNode;
      }

      // Add if_hit combo
      if (comboTree.if_hit) {
        const targetNode = nodes.find(n => n.power.power_id === comboTree.if_hit?.power_id);
        if (targetNode) node.children.if_hit = targetNode;
      }

      // Add if_release combo
      if (comboTree.if_release) {
        const targetNode = nodes.find(n => n.power.power_id === comboTree.if_release?.power_id);
        if (targetNode) node.children.if_release = targetNode;
      }

      // Add if_wall combo
      if (comboTree.if_wall) {
        const targetNode = nodes.find(n => n.power.power_id === comboTree.if_wall?.power_id);
        if (targetNode) node.children.if_wall = targetNode;
      }

      // Add if_button combo
      if (comboTree.if_button) {
        const targetNode = nodes.find(n => n.power.power_id === comboTree.if_button?.power_id);
        if (targetNode) node.children.if_button = targetNode;
      }

      // Add if_interrupt combo
      if (comboTree.if_interrupt) {
        const targetNode = nodes.find(n => n.power.power_id === comboTree.if_interrupt?.power_id);
        if (targetNode) node.children.if_interrupt = targetNode;
      }

      // Add if_dir combos
      if (comboTree.if_dir && comboTree.if_dir.length > 0) {
        node.children.if_dir = comboTree.if_dir.map(input => {
          const targetNode = nodes.find(n => n.power.power_id === input.combo.power_id);
          return targetNode ? { direction: input.direction, node: targetNode } : null;
        }).filter((item): item is { direction: Direction; node: PowerNode } => item !== null);
      }
    });

    // Update nodes with combo relationships

    // Group by parent_item
    const grouped: GroupedPowers = {};
    const ungrouped: PowerNode[] = [];

    nodes.forEach((node) => {
      const parentItem = node.power.parent_item || "";
      
      if (parentItem.trim() === "") {
        ungrouped.push(node);
      } else {
        if (!grouped[parentItem]) {
          grouped[parentItem] = [];
        }
        grouped[parentItem].push(node);
      }
    });

    setGroupedPowerNodes(grouped);
    setUngroupedPowerNodes(ungrouped);
  }, [powers]);

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleNode = (node: PowerNode) => {
    // Find the node in either grouped or ungrouped collections and toggle its expanded state
    const updateNodes = (nodes: PowerNode[]): PowerNode[] => {
      return nodes.map(n => {
        if (n.power.power_id === node.power.power_id) {
          return { ...n, expanded: !n.expanded };
        }
        return n;
      });
    };

    // Update in grouped nodes
    setGroupedPowerNodes(prevGrouped => {
      const newGrouped = { ...prevGrouped };
      for (const key in newGrouped) {
        newGrouped[key] = updateNodes(newGrouped[key]);
      }
      return newGrouped;
    });

    // Update in ungrouped nodes
    setUngroupedPowerNodes(prevUngrouped => updateNodes(prevUngrouped));
  };

  // Render a power node with its children
  const renderPowerNode = (node: PowerNode, depth: number = 0) => {
    const hasChildren = Object.values(node.children).some(child => 
      child !== undefined && (Array.isArray(child) ? child.length > 0 : true)
    );

    return (
      <li key={node.power.power_id} className="menu-item">
        <div 
          className={`flex items-center justify-between cursor-pointer py-1 px-2 hover:bg-base-300 ${selectedPower?.power_id === node.power.power_id ? "bg-primary text-white" : ""}`}
          onClick={() => {
            onSelectPower(node.power);
            if (hasChildren) toggleNode(node);
          }}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-xs">{node.power.power_name}</span>
          {hasChildren && (
            <span>{node.expanded ? '▼' : '►'}</span>
          )}
        </div>

        {node.expanded && hasChildren && (
          <ul>
            {node.children.normal && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>normal:</div>
                {renderPowerNode(node.children.normal, depth + 1)}
              </li>
            )}
            {node.children.if_hit && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_hit:</div>
                {renderPowerNode(node.children.if_hit, depth + 1)}
              </li>
            )}
            {node.children.if_release && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_release:</div>
                {renderPowerNode(node.children.if_release, depth + 1)}
              </li>
            )}
            {node.children.if_wall && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_wall:</div>
                {renderPowerNode(node.children.if_wall, depth + 1)}
              </li>
            )}
            {node.children.if_button && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_button:</div>
                {renderPowerNode(node.children.if_button, depth + 1)}
              </li>
            )}
            {node.children.if_interrupt && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_interrupt:</div>
                {renderPowerNode(node.children.if_interrupt, depth + 1)}
              </li>
            )}
            {node.children.if_dir && node.children.if_dir.length > 0 && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_dir:</div>
                <ul>
                  {node.children.if_dir.map((dirNode, idx) => (
                    <li key={`${node.power.power_id}-dir-${idx}`} className="pl-2">
                      <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 2) * 12 + 8}px` }}>{dirNode.direction}:</div>
                      {renderPowerNode(dirNode.node, depth + 2)}
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  if (!powers) return null;

  return (
    <aside className="sticky top-0 h-screen w-64 bg-base-200 border-r border-gray-300 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold mb-4">Powers</h2>
      <ul className="menu-xs bg-base-100 rounded-box">
        {/* Render grouped powers */}
        {Object.keys(groupedPowerNodes).map((groupName) => (
          <li key={groupName} className="menu-item">
            <div 
              className="flex items-center justify-between cursor-pointer py-1 px-2 hover:bg-base-300"
              onClick={() => toggleGroup(groupName)}
            >
              <span className="font-medium">{groupName}</span>
              <span>{expandedGroups[groupName] ? '▼' : '►'}</span>
            </div>
            {expandedGroups[groupName] && (
              <ul className="pl-2">
                {groupedPowerNodes[groupName].map((node) => renderPowerNode(node))}
              </ul>
            )}
          </li>
        ))}
        
        {/* Render ungrouped powers */}
        {ungroupedPowerNodes.length > 0 && (
          <li className="menu-item">
            <div 
              className="flex items-center justify-between cursor-pointer py-1 px-2 hover:bg-base-300"
              onClick={() => toggleGroup("Ungrouped")}
            >
              <span className="font-medium">Ungrouped</span>
              <span>{expandedGroups["Ungrouped"] ? '▼' : '►'}</span>
            </div>
            {expandedGroups["Ungrouped"] && (
              <ul className="pl-2">
                {ungroupedPowerNodes.map((node) => renderPowerNode(node))}
              </ul>
            )}
          </li>
        )}
      </ul>
    </aside>
  );
};

export default PowerList;