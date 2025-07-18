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
  // Track all possible paths to this node (for highlighting parent nodes)
  parentPaths: Set<string>;
}

interface GroupedPowers {
  [key: string]: PowerNode[];
}

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

      // Process all standard combo types
      processComboRelationship("normal", "normal");
      processComboRelationship("if_hit", "if_hit");
      processComboRelationship("if_release", "if_release");
      processComboRelationship("if_wall", "if_wall");
      processComboRelationship("if_button", "if_button");
      processComboRelationship("if_interrupt", "if_interrupt");

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

  const toggleNode = (node: PowerNode) => {
    // Recursive function to update nodes and their children
    const updateNodesRecursively = (nodes: PowerNode[]): PowerNode[] => {
      return nodes.map((n) => {
        // If this is the node we want to toggle
        if (n.power.power_id === node.power.power_id) {
          return { ...n, expanded: !n.expanded };
        }

        // Check children recursively
        const updatedChildren: typeof n.children = {};
        let hasUpdatedChildren = false;

        // Helper function to update a single node recursively
        const updateNodeRecursively = (childNode: PowerNode): PowerNode => {
          if (childNode.power.power_id === node.power.power_id) {
            return { ...childNode, expanded: !childNode.expanded };
          }

          // Check children recursively
          const updatedChildren: typeof childNode.children = {};
          let hasUpdatedChildren = false;

          // Check all child types (normal, if_hit, etc.)
          Object.entries(childNode.children).forEach(([key, child]) => {
            if (!child) return;

            if (key === "if_dir" && Array.isArray(child)) {
              const updatedDirNodes = child.map((dirNode) => {
                const updatedNode = updateNodeRecursively(dirNode.node);
                if (updatedNode !== dirNode.node) {
                  return { ...dirNode, node: updatedNode };
                }
                return dirNode;
              });

              if (updatedDirNodes.some((dirNode, i) => dirNode !== child[i])) {
                updatedChildren.if_dir = updatedDirNodes;
                hasUpdatedChildren = true;
              }
            } else if (key !== "if_dir") {
              // Type-safe way to handle the different child types
              switch (key) {
                case "normal":
                  if (childNode.children.normal) {
                    const updatedNode = updateNodeRecursively(
                      childNode.children.normal
                    );
                    if (updatedNode !== childNode.children.normal) {
                      updatedChildren.normal = updatedNode;
                      hasUpdatedChildren = true;
                    }
                  }
                  break;
                case "if_hit":
                  if (childNode.children.if_hit) {
                    const updatedNode = updateNodeRecursively(
                      childNode.children.if_hit
                    );
                    if (updatedNode !== childNode.children.if_hit) {
                      updatedChildren.if_hit = updatedNode;
                      hasUpdatedChildren = true;
                    }
                  }
                  break;
                case "if_release":
                  if (childNode.children.if_release) {
                    const updatedNode = updateNodeRecursively(
                      childNode.children.if_release
                    );
                    if (updatedNode !== childNode.children.if_release) {
                      updatedChildren.if_release = updatedNode;
                      hasUpdatedChildren = true;
                    }
                  }
                  break;
                case "if_wall":
                  if (childNode.children.if_wall) {
                    const updatedNode = updateNodeRecursively(
                      childNode.children.if_wall
                    );
                    if (updatedNode !== childNode.children.if_wall) {
                      updatedChildren.if_wall = updatedNode;
                      hasUpdatedChildren = true;
                    }
                  }
                  break;
                case "if_button":
                  if (childNode.children.if_button) {
                    const updatedNode = updateNodeRecursively(
                      childNode.children.if_button
                    );
                    if (updatedNode !== childNode.children.if_button) {
                      updatedChildren.if_button = updatedNode;
                      hasUpdatedChildren = true;
                    }
                  }
                  break;
                case "if_interrupt":
                  if (childNode.children.if_interrupt) {
                    const updatedNode = updateNodeRecursively(
                      childNode.children.if_interrupt
                    );
                    if (updatedNode !== childNode.children.if_interrupt) {
                      updatedChildren.if_interrupt = updatedNode;
                      hasUpdatedChildren = true;
                    }
                  }
                  break;
              }
            }
          });

          // If any children were updated, return a new node with updated children
          if (hasUpdatedChildren) {
            return {
              ...childNode,
              children: {
                ...childNode.children,
                ...updatedChildren,
              },
            };
          }

          // Otherwise return the original node
          return childNode;
        };

        // Check normal child
        if (n.children.normal) {
          const updatedNode = updateNodeRecursively(n.children.normal);
          if (updatedNode !== n.children.normal) {
            updatedChildren.normal = updatedNode;
            hasUpdatedChildren = true;
          }
        }

        // Check if_hit child
        if (n.children.if_hit) {
          const updatedNode = updateNodeRecursively(n.children.if_hit);
          if (updatedNode !== n.children.if_hit) {
            updatedChildren.if_hit = updatedNode;
            hasUpdatedChildren = true;
          }
        }

        // Check if_release child
        if (n.children.if_release) {
          const updatedNode = updateNodeRecursively(n.children.if_release);
          if (updatedNode !== n.children.if_release) {
            updatedChildren.if_release = updatedNode;
            hasUpdatedChildren = true;
          }
        }

        // Check if_wall child
        if (n.children.if_wall) {
          const updatedNode = updateNodeRecursively(n.children.if_wall);
          if (updatedNode !== n.children.if_wall) {
            updatedChildren.if_wall = updatedNode;
            hasUpdatedChildren = true;
          }
        }

        // Check if_button child
        if (n.children.if_button) {
          const updatedNode = updateNodeRecursively(n.children.if_button);
          if (updatedNode !== n.children.if_button) {
            updatedChildren.if_button = updatedNode;
            hasUpdatedChildren = true;
          }
        }

        // Check if_interrupt child
        if (n.children.if_interrupt) {
          const updatedNode = updateNodeRecursively(n.children.if_interrupt);
          if (updatedNode !== n.children.if_interrupt) {
            updatedChildren.if_interrupt = updatedNode;
            hasUpdatedChildren = true;
          }
        }

        // Check if_dir children
        if (n.children.if_dir && n.children.if_dir.length > 0) {
          const updatedDirNodes = n.children.if_dir.map((dirNode) => {
            const updatedNode = updateNodeRecursively(dirNode.node);
            if (updatedNode !== dirNode.node) {
              return { ...dirNode, node: updatedNode };
            }
            return dirNode;
          });

          if (
            updatedDirNodes.some(
              (dirNode, i) => dirNode !== n.children.if_dir?.[i]
            )
          ) {
            updatedChildren.if_dir = updatedDirNodes;
            hasUpdatedChildren = true;
          }
        }

        // If any children were updated, return a new node with updated children
        if (hasUpdatedChildren) {
          return {
            ...n,
            children: {
              ...n.children,
              ...updatedChildren,
            },
          };
        }

        // Otherwise return the original node
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

    // Check if node has any children
    const hasChildren = Object.values(node.children).some(
      (child) =>
        child !== undefined && (Array.isArray(child) ? child.length > 0 : true)
    );

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

      // Check all standard combo types
      if (checkChild(currentNode.children.normal)) return true;
      if (checkChild(currentNode.children.if_hit)) return true;
      if (checkChild(currentNode.children.if_release)) return true;
      if (checkChild(currentNode.children.if_wall)) return true;
      if (checkChild(currentNode.children.if_button)) return true;
      if (checkChild(currentNode.children.if_interrupt)) return true;

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
      <li key={node.power.power_id || `node-${depth}`} className="mb-1">
        <div
          className={`flex items-center justify-between px-2 py-1 rounded-md ${highlightClass}`}
          style={{
            fontSize: `${fontSize}px`,
            paddingLeft: `${depth * 8 + 8}px`,
          }}
          onClick={() => {
            onSelectPower(node.power);
            toggleNode(node);
          }}
        >
          <div className="flex-1 truncate" title={node.power.power_name || ""}>
            {node.power.power_name}
          </div>
        </div>

        {hasChildren && node.expanded && (
          <ul className="border-l border-base-300 ml-2">
            {node.children.normal && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  normal:
                </div>
                {renderPowerNode(node.children.normal, depth + 1, newVisited)}
              </li>
            )}
            {node.children.if_hit && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  if_hit:
                </div>
                {renderPowerNode(node.children.if_hit, depth + 1, newVisited)}
              </li>
            )}
            {node.children.if_release && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  if_release:
                </div>
                {renderPowerNode(
                  node.children.if_release,
                  depth + 1,
                  newVisited
                )}
              </li>
            )}
            {node.children.if_wall && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  if_wall:
                </div>
                {renderPowerNode(node.children.if_wall, depth + 1, newVisited)}
              </li>
            )}
            {node.children.if_button && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  if_button:
                </div>
                {renderPowerNode(
                  node.children.if_button,
                  depth + 1,
                  newVisited
                )}
              </li>
            )}
            {node.children.if_interrupt && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  if_interrupt:
                </div>
                {renderPowerNode(
                  node.children.if_interrupt,
                  depth + 1,
                  newVisited
                )}
              </li>
            )}
            {node.children.if_dir && node.children.if_dir.length > 0 && (
              <li>
                <div
                  className="text-xs text-gray-500 pl-2 py-1"
                  style={{ paddingLeft: `${depth * 8 + 10}px` }}
                >
                  if_dir:
                </div>
                <ul className="border-l border-base-300 ml-2">
                  {node.children.if_dir.map((dirNode, idx) => (
                    <li key={`${node.power.power_id || "dir"}-dir-${idx}`}>
                      <div
                        className="text-xs text-gray-500 pl-2 py-1"
                        style={{ paddingLeft: `${depth * 8 + 16}px` }}
                      >
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

  // Render the component
  return (
    <aside className="h-[calc(100vh-2rem)] w-64 flex-shrink-0 overflow-hidden flex flex-col border rounded-md shadow-sm">
      <div className="p-2 bg-base-200 font-bold border-b sticky top-0 z-10">
        Power List
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <ul className="menu menu-compact p-2">
          {/* Render grouped powers */}
          {Object.entries(groupedPowerNodes).map(([groupName, nodes]) => (
            <li key={groupName} className="mb-4">
              <div
                className="font-bold text-lg sticky top-0 bg-base-100 z-10 flex justify-between items-center p-2 border-b border-base-300"
                onClick={() => toggleGroup(groupName)}
              >
                <span>{groupName}</span>
                <button className="btn btn-xs btn-ghost">
                  {expandedGroups[groupName] ? "\u2212" : "+"}
                </button>
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
`;

// Add the styles to the document head
if (typeof document !== "undefined") {
  const styleElement = document.createElement("style");
  styleElement.textContent = scrollbarStyles;
  document.head.appendChild(styleElement);
}

export default PowerList;
