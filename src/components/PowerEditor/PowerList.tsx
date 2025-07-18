import React, { useState, useEffect, useRef, useCallback } from "react";
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
  // Track all possible paths to this node (for highlighting parent nodes)
  parentPaths: Set<string>;
}

interface GroupedPowers {
  [key: string]: PowerNode[];
}

// Define child keys as a constant to be reused throughout the component
const CHILD_KEYS = [
  "normal",
  "if_hit",
  "if_release",
  "if_wall",
  "if_button",
  "if_interrupt",
] as const;

const PowerList: React.FC<PowerListProps> = ({
  powers,
  selectedPower,
  onSelectPower,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<{
    [key: string]: boolean;
  }>({});
  const [groupedPowerNodes, setGroupedPowerNodes] = useState<GroupedPowers>({});
  const [ungroupedPowerNodes, setUngroupedPowerNodes] = useState<PowerNode[]>(
    []
  );

  // Find a power by name
  const findPowerByName = (name?: string): Power | undefined => {
    if (!name || !powers) return undefined;
    return powers.find(
      (p) => p.power_name?.toLowerCase() === name.toLowerCase()
    );
  };

  // Find active input powers
  const findActiveInputPowers = (
    inputString?: string
  ): ActiveInput[] | undefined => {
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

  // Update nodes when powers change
  useEffect(() => {
    if (!powers) {
      setGroupedPowerNodes({});
      setUngroupedPowerNodes([]);
      return;
    }

    // Create initial nodes
    const nodes: PowerNode[] = powers.map((power) => ({
      power,
      children: {},
      expanded: false,
      parentPaths: new Set<string>(),
    }));

    // Create a map for quick lookup by power_name
    const nameMap = new Map<string, PowerNode>();
    nodes.forEach((node) => {
      if (node.power.power_name) {
        // Store with lowercase key for case-insensitive lookup
        nameMap.set(node.power.power_name.toLowerCase(), node);
      }
    });

    // Also create a map by power_id for reference tracking
    const idMap = new Map<string, PowerNode>();
    nodes.forEach((node) => {
      if (node.power.power_id) {
        idMap.set(node.power.power_id, node);
      }
    });

    // Track which nodes are referenced in combo trees
    const referencedNodes = new Set<string>();

    // Function to find a node by power name - now using the map for O(1) lookup
    const findNodeByPowerName = (name?: string): PowerNode | undefined => {
      if (!name) return undefined;
      return nameMap.get(name.toLowerCase());
    };

    // Function to build combo tree recursively
    const buildComboTree = (
      node: PowerNode,
      processedIds = new Set<string>()
    ) => {
      if (!node.power.power_id) return;

      // Prevent infinite recursion by tracking processed nodes
      if (processedIds.has(node.power.power_id)) return;
      processedIds.add(node.power.power_id);

      const comboTree = getComboTreeForPower(node.power);
      if (!comboTree) return;

      // Helper function to add parent-child relationship
      const addParentRelationship = (
        parentNode: PowerNode,
        childNode: PowerNode
      ) => {
        if (
          parentNode.power.power_id &&
          typeof parentNode.power.power_id === "string"
        ) {
          // Add this parent to the child's parent paths
          childNode.parentPaths.add(parentNode.power.power_id);

          // Also add all ancestors of the parent to the child's parent paths
          parentNode.parentPaths.forEach((ancestorId) => {
            childNode.parentPaths.add(ancestorId);
          });
        }
      };

      // Helper function to process a combo relationship
      const processComboRelationship = (
        comboType: keyof ComboTree,
        childKey: keyof PowerNode["children"]
      ) => {
        const comboPower = comboTree[comboType] as Power | undefined;
        if (!comboPower) return;

        const targetNode = findNodeByPowerName(comboPower.power_name);
        if (targetNode && targetNode.power.power_id) {
          // Set the child node in the appropriate relationship slot
          (node.children[childKey] as any) = targetNode;

          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === "string") {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }

          // Recursively build the tree for this node
          buildComboTree(targetNode, new Set(processedIds));
        }
      };

      // Process all standard combo types using the constant

      // Process each combo relationship
      CHILD_KEYS.forEach((key) => {
        processComboRelationship(key, key);
      });

      // Process directional combos separately as they have a different structure
      if (comboTree.if_dir && comboTree.if_dir.length > 0) {
        node.children.if_dir = comboTree.if_dir
          .map((input) => {
            const targetNode = findNodeByPowerName(input.combo.power_name);
            if (!targetNode || !targetNode.power.power_id) return null;

            // Mark this node as referenced in a combo tree
            const powerId = targetNode.power.power_id;
            if (typeof powerId === "string") {
              referencedNodes.add(powerId);
              // Add parent relationship
              addParentRelationship(node, targetNode);
            }

            // Recursively build the tree for this direction node
            buildComboTree(targetNode, new Set(processedIds));

            return { direction: input.direction, node: targetNode };
          })
          .filter(
            (item): item is { direction: Direction; node: PowerNode } =>
              item !== null
          );
      }
    };

    // Build the full combo tree for each node
    nodes.forEach((node) => {
      buildComboTree(node);
    });

    // Group by parent_item, but exclude referenced nodes from root level
    const grouped: GroupedPowers = {};
    const ungrouped: PowerNode[] = [];

    nodes.forEach((node) => {
      // Skip nodes that are referenced in combo trees
      if (node.power.power_id && referencedNodes.has(node.power.power_id)) {
        return;
      }

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
    setExpandedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  // No longer needed - removed helper function for processing directional children

  // Simple function to toggle a node's expanded state
  const toggleNodeExpansion = (node: PowerNode): PowerNode => {
    return { ...node, expanded: !node.expanded };
  };

  const toggleNode = (node: PowerNode) => {
    // Simple function to toggle expansion state of root nodes only
    const updateNodesRecursively = (nodes: PowerNode[]): PowerNode[] => {
      return nodes.map((n) => {
        // If this is the node we want to toggle
        if (n.power.power_id === node.power.power_id) {
          return toggleNodeExpansion(n);
        }
        return n;
      });
    };

    // Update in grouped nodes
    setGroupedPowerNodes((prevGrouped) => {
      const newGrouped = { ...prevGrouped };
      for (const key in newGrouped) {
        newGrouped[key] = updateNodesRecursively(newGrouped[key]);
      }
      return newGrouped;
    });

    // Update in ungrouped nodes
    setUngroupedPowerNodes((prevUngrouped) =>
      updateNodesRecursively(prevUngrouped)
    );
  };

  // Helper function to check if a node has any children
  const hasChildren = (node: PowerNode): boolean => {
    // Check standard child nodes
    for (const key of CHILD_KEYS) {
      if (node.children[key]) return true;
    }

    // Check directional children
    if (node.children.if_dir && node.children.if_dir.length > 0) {
      return true;
    }

    return false;
  };

  // Render a power node with its children
  const renderPowerNode = (
    node: PowerNode,
    depth = 0,
    visited = new Set<string>()
  ): JSX.Element => {
    // Prevent infinite recursion by tracking visited nodes
    if (node.power.power_id && visited.has(node.power.power_id)) {
      return (
        <li
          key={`cycle-${node.power.power_id}`}
          className="text-warning italic text-xs px-2 py-1"
        >
          {node.power.power_name} (cycle detected)
        </li>
      );
    }

    // Add this node to visited set
    const newVisited = new Set(visited);
    if (node.power.power_id) {
      newVisited.add(node.power.power_id);
    }

    // Check if node has any children using our helper function
    const nodeHasChildren = hasChildren(node);

    // Only root nodes (depth=0) can be expanded/collapsed
    // Child nodes are always shown when their parent is expanded
    const isExpandable = depth === 0;

    // Check if this node is the selected power or a parent of the selected power
    const isSelected = selectedPower?.power_id === node.power.power_id;

    // Use a more direct approach to check if this node is in the path to the selected node
    const isNodeInPathToSelected = (
      currentNode: PowerNode,
      targetPowerId: string,
      visited = new Set<string>()
    ): boolean => {
      // Prevent infinite recursion
      if (
        !currentNode.power.power_id ||
        visited.has(currentNode.power.power_id)
      ) {
        return false;
      }
      visited.add(currentNode.power.power_id);

      // Helper function to check a child node
      const checkChild = (childNode: PowerNode | undefined): boolean => {
        if (!childNode) return false;
        if (childNode.power.power_id === targetPowerId) return true;
        return isNodeInPathToSelected(
          childNode,
          targetPowerId,
          new Set(visited)
        );
      };

      // Check all standard combo types using our constant

      // Check each child type
      for (const key of CHILD_KEYS) {
        if (checkChild(currentNode.children[key])) return true;
      }

      // Check directional combos
      if (currentNode.children.if_dir) {
        for (const dirCombo of currentNode.children.if_dir) {
          if (checkChild(dirCombo.node)) return true;
        }
      }

      return false;
    };

    let isParentOfSelected = false;
    if (
      selectedPower?.power_id &&
      node.power.power_id &&
      node.power.power_id !== selectedPower.power_id
    ) {
      isParentOfSelected = isNodeInPathToSelected(node, selectedPower.power_id);
    }

    // Determine the highlight class based on selection state
    let highlightClass = "";
    if (isSelected) {
      highlightClass = "bg-primary text-white";
    } else if (isParentOfSelected) {
      highlightClass = "bg-accent-focus text-white border-l-4 border-accent";
    }

    // Calculate font size based on depth
    const fontSize = Math.max(14 - depth, 10);

    return (
      <li
        key={node.power.power_id || `node-${depth}`}
        className="p-0 m-0 cursor-default bg-none!"
      >
        <div
          className={`flex rounded-md w-full ${highlightClass}`}
          style={{
            fontSize: `${fontSize}px`,
          }}
          onClick={() => {
            onSelectPower(node.power);
            // Only toggle expansion for root nodes
            if (isExpandable) {
              toggleNode(node);
            }
          }}
        >
          <div className="truncate w-full">{node.power.power_name}</div>
        </div>

        {nodeHasChildren && (depth === 0 ? node.expanded : true) && (
          <ul className="border-l border-base-300">
            {/* Render standard child nodes using our constant */}
            {CHILD_KEYS.map((key) => {
              const childNode = node.children[key];
              if (!childNode) return null;

              return (
                <li key={`${key}-${childNode.power.power_id || depth}`}>
                  <div
                    className={`text-xs ${
                      key === "if_hit" ? "text-red-500" : "text-gray-500"
                    } pointer-events-none select-none w-full`}
                  >
                    {key}:
                  </div>
                  {renderPowerNode(childNode, depth + 1, newVisited)}
                </li>
              );
            })}
            {node.children.if_dir && node.children.if_dir.length > 0 && (
              <li className="">
                <div className="text-xs text-gray-500 pointer-events-none select-none w-full">
                  if_dir:
                </div>
                <ul className="border-l border-base-300 ml-2">
                  {node.children.if_dir.map((dirNode, idx) => (
                    <li key={`${node.power.power_id || "dir"}-dir-${idx}`}>
                      <div className="text-xs text-gray-500 pointer-events-none select-none w-full">
                        {dirNode.direction}:
                      </div>
                      {renderPowerNode(dirNode.node, depth + 2, newVisited)}
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

  // State for sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(256); // Default width (64 * 4 = 256px)
  const [isDragging, setIsDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const minWidth = 200; // Minimum width in pixels
  const maxWidth = 500; // Maximum width in pixels

  // Handle mouse down on the drag handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !sidebarRef.current) return;

      const newWidth = e.clientX;
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  // Render the component
  return (
    <aside
      ref={sidebarRef}
      className="h-[calc(100vh-2rem)] flex-shrink-0 overflow-hidden flex flex-col border rounded-md shadow-sm relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="p-2 bg-base-200 font-bold border-b sticky top-0 z-10">
        Power List
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ul className="menu menu-compact w-full">
          {/* Render grouped powers */}
          {Object.entries(groupedPowerNodes).map(([groupName, nodes]) => (
            <li key={groupName} className="mb-4">
              <div
                className="font-bold text-lg text-sky-400 sticky top-0 bg-base-100 z-10 flex items-center p-2 border-b border-base-300"
                onClick={() => toggleGroup(groupName)}
              >
                <span>{groupName}</span>
              </div>
              {expandedGroups[groupName] && (
                <ul className="ml-2 mt-2">
                  {nodes.map((node) => renderPowerNode(node))}
                </ul>
              )}
            </li>
          ))}

          {/* Render ungrouped powers */}
          {ungroupedPowerNodes.length > 0 && (
            <li className="mb-4">
              <div className="font-bold text-lg sticky top-0 bg-base-100 z-10 p-2 border-b border-base-300">
                Ungrouped Powers
              </div>
              <ul className="ml-2 mt-2">
                {ungroupedPowerNodes.map((node) => renderPowerNode(node))}
              </ul>
            </li>
          )}
        </ul>
      </div>
      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-ew-resize hover:bg-sky-400 active:bg-sky-600 transition-colors"
        onMouseDown={handleMouseDown}
        style={{
          opacity: isDragging ? 1 : 0.5,
          backgroundColor: isDragging
            ? "rgb(14, 165, 233)"
            : "rgba(100, 100, 100, 0.3)",
        }}
      />
    </aside>
  );
};

// Add custom scrollbar styles
const scrollbarStyles = `
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(100, 100, 100, 0.5);
    border-radius: 20px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(100, 100, 100, 0.8);
  }
  
  /* Styles for resize handle interaction */
  .resize-handle {
    transition: background-color 0.2s ease;
  }
  .resize-handle:hover {
    background-color: rgb(14, 165, 233, 0.5);
  }
  .resize-handle:active {
    background-color: rgb(14, 165, 233);
  }
`;

// Add the styles to the document head
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = scrollbarStyles;
  document.head.appendChild(styleElement);
}

export default PowerList;
