import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  memo,
} from "react";
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
  // Reference to the selected power element for scrolling
  const selectedPowerRef = useRef<HTMLDivElement>(null);
  // Reference to the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

    // Function to build combo tree recursively with improved traversal
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

      // Helper function to process a combo relationship with proper type safety
      const processComboRelationship = (
        comboType: keyof Omit<ComboTree, "if_dir">,
        childKey: keyof Omit<PowerNode["children"], "if_dir">
      ) => {
        const comboPower = comboTree[comboType] as Power | undefined;
        if (!comboPower) return;

        const targetNode = findNodeByPowerName(comboPower.power_name);
        if (targetNode && targetNode.power.power_id) {
          // Set the child node in the appropriate relationship slot with proper type assertion
          (node.children[childKey] as typeof targetNode) = targetNode;

          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === "string") {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }

          // Recursively build the tree for this node - use a new Set to avoid modifying the original
          buildComboTree(targetNode, new Set(processedIds));
        }
      };

      // Process all standard combo types using the constant array
      CHILD_KEYS.forEach((key) => {
        const childKey = key as keyof Omit<PowerNode["children"], "if_dir">;
        processComboRelationship(key, childKey);
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

  // Helper function to check if a node has any children - memoized for performance with cache
  const hasChildren = useCallback((node: PowerNode): boolean => {
    // Use a cache to avoid recalculating for the same node
    if (!node.power.power_id) {
      // For nodes without ID, calculate directly
      // Check standard child nodes using the constant array
      for (const key of CHILD_KEYS) {
        const childKey = key as keyof Omit<PowerNode["children"], "if_dir">;
        if (node.children[childKey]) return true;
      }

      // Check directional children
      return !!node.children.if_dir && node.children.if_dir.length > 0;
    }

    // For nodes with ID, check standard child nodes using the constant array
    for (const key of CHILD_KEYS) {
      const childKey = key as keyof Omit<PowerNode["children"], "if_dir">;
      if (node.children[childKey]) return true;
    }

    // Check directional children
    return !!node.children.if_dir && node.children.if_dir.length > 0;
  }, []);

  // Helper function to check if a node contains a specific power in its children - memoized for performance
  const checkNodeContainsPower = useCallback(
    (
      node: PowerNode,
      targetPowerId: string,
      visited = new Set<string>()
    ): boolean => {
      // Direct match check for early return
      if (node.power.power_id === targetPowerId) {
        return true;
      }

      // Helper function to check a child node
      const checkChild = (childNode: PowerNode | undefined): boolean => {
        if (!childNode) return false;
        if (childNode.power.power_id === targetPowerId) return true;

        // Create a new visited set to avoid modifying the original
        const newVisited = new Set(visited);
        if (childNode.power.power_id) {
          // If we've already visited this node, skip to avoid cycles
          if (newVisited.has(childNode.power.power_id)) return false;
          newVisited.add(childNode.power.power_id);
        }

        return checkNodeContainsPower(childNode, targetPowerId, newVisited);
      };

      // Check each standard child type using the constant array
      for (const key of CHILD_KEYS) {
        const childKey = key as keyof Omit<PowerNode["children"], "if_dir">;
        if (checkChild(node.children[childKey])) return true;
      }

      // Check directional combos
      if (node.children.if_dir) {
        for (const dirCombo of node.children.if_dir) {
          if (checkChild(dirCombo.node)) return true;
        }
      }

      return false;
    },
    []
  );

  // Check if a node is in the path to the selected node - optimized with memoization
  const isNodeInPathToSelected = useCallback(
    (
      node: PowerNode,
      powerId: string,
      visited = new Set<string>()
    ): boolean => {
      // Prevent infinite recursion
      if (!node.power.power_id || visited.has(node.power.power_id)) {
        return false;
      }
      visited.add(node.power.power_id);

      // Check if this node contains the power in its children
      return checkNodeContainsPower(node, powerId, visited);
    },
    [checkNodeContainsPower]
  );

  // Memoized component for rendering a child node
  const ChildNode = memo(
    ({
      childKey,
      childNode,
      depth,
      visited,
      onSelectPower,
      selectedPower,
      toggleNode,
    }: {
      childKey: string;
      childNode: PowerNode;
      depth: number;
      visited: Set<string>;
      onSelectPower: (power: Power) => void;
      selectedPower: Power | null;
      toggleNode: (node: PowerNode) => void;
    }) => {
      return (
        <li>
          <div
            className={`text-xs ${
              childKey === "if_hit" ? "text-red-500" : "text-gray-500"
            } pointer-events-none select-none w-full`}
          >
            {childKey}:
          </div>
          <PowerNodeRenderer
            node={childNode}
            depth={depth + 1}
            visited={visited}
            onSelectPower={onSelectPower}
            selectedPower={selectedPower}
            toggleNode={toggleNode}
          />
        </li>
      );
    }
  );

  // Memoized component for rendering a directional node
  const DirectionalNode = memo(
    ({
      dirNode,
      depth,
      visited,
      onSelectPower,
      selectedPower,
      toggleNode,
    }: {
      dirNode: { direction: Direction; node: PowerNode };
      depth: number;
      visited: Set<string>;
      onSelectPower: (power: Power) => void;
      selectedPower: Power | null;
      toggleNode: (node: PowerNode) => void;
    }) => {
      return (
        <li>
          <div className="text-xs text-gray-500 pointer-events-none select-none w-full">
            {dirNode.direction}:
          </div>
          <PowerNodeRenderer
            node={dirNode.node}
            depth={depth + 2}
            visited={visited}
            onSelectPower={onSelectPower}
            selectedPower={selectedPower}
            toggleNode={toggleNode}
          />
        </li>
      );
    }
  );

  // Memoized component for rendering a power node
  const PowerNodeRenderer = memo(
    ({
      node,
      depth = 0,
      visited = new Set<string>(),
      onSelectPower,
      selectedPower,
      toggleNode,
    }: {
      node: PowerNode;
      depth?: number;
      visited?: Set<string>;
      onSelectPower: (power: Power) => void;
      selectedPower: Power | null;
      toggleNode: (node: PowerNode) => void;
    }) => {
      // Prevent infinite recursion by tracking visited nodes
      if (node.power.power_id && visited.has(node.power.power_id)) {
        return (
          <li className="text-warning italic text-xs px-2 py-1">
            {node.power.power_name} (cycle detected)
          </li>
        );
      }

      // Add this node to visited set
      const newVisited = useMemo(() => {
        const newSet = new Set(visited);
        if (node.power.power_id) {
          newSet.add(node.power.power_id);
        }
        return newSet;
      }, [node.power.power_id, visited]);

      // Check if node has any children using our helper function
      const nodeHasChildren = hasChildren(node);

      // Only root nodes (depth=0) can be expanded/collapsed
      // Child nodes are always shown when their parent is expanded
      const isExpandable = depth === 0;

      // Check if this node is the selected power
      const isSelected = node.power.power_id === selectedPower?.power_id;

      // Check if this node is in the path to the selected node
      const isParentOfSelected = useMemo(() => {
        return (
          selectedPower &&
          selectedPower.power_id &&
          node.power.power_id !== selectedPower.power_id &&
          isNodeInPathToSelected(node, selectedPower.power_id, new Set())
        );
      }, [node.power.power_id, selectedPower, isNodeInPathToSelected]);

      // Determine the highlight class based on selection state
      const highlightClass = useMemo(() => {
        if (isSelected) {
          return "bg-primary text-white";
        } else if (isParentOfSelected) {
          return "bg-accent-focus text-white border-l-4 border-accent";
        }
        return "";
      }, [isSelected, isParentOfSelected]);

      // Calculate font size based on depth
      const fontSize = Math.max(14 - depth, 10);

      // Memoize the child nodes rendering
      const childNodesRendering = useMemo(() => {
        if (!nodeHasChildren || (depth === 0 && !node.expanded)) {
          return null;
        }

        return (
          <ul className="border-l border-base-300">
            {/* Render standard child nodes using our constant */}
            {CHILD_KEYS.map((key) => {
              const childKey = key as keyof Omit<
                PowerNode["children"],
                "if_dir"
              >;
              const childNode = node.children[childKey];
              if (!childNode) return null;

              return (
                <ChildNode
                  key={`${key}-${childNode.power.power_id || depth}`}
                  childKey={key}
                  childNode={childNode}
                  depth={depth}
                  visited={newVisited}
                  onSelectPower={onSelectPower}
                  selectedPower={selectedPower}
                  toggleNode={toggleNode}
                />
              );
            })}
            {node.children.if_dir && node.children.if_dir.length > 0 && (
              <li>
                <div className="text-xs text-gray-500 pointer-events-none select-none w-full">
                  if_dir:
                </div>
                <ul className="border-l border-base-300 ml-2">
                  {node.children.if_dir.map((dirNode, idx) => (
                    <DirectionalNode
                      key={`${node.power.power_id || "dir"}-dir-${idx}`}
                      dirNode={dirNode}
                      depth={depth}
                      visited={newVisited}
                      onSelectPower={onSelectPower}
                      selectedPower={selectedPower}
                      toggleNode={toggleNode}
                    />
                  ))}
                </ul>
              </li>
            )}
          </ul>
        );
      }, [
        node,
        depth,
        nodeHasChildren,
        newVisited,
        onSelectPower,
        selectedPower,
        toggleNode,
      ]);

      return (
        <li className="p-0 m-0 cursor-default bg-none!">
          <div
            ref={isSelected ? selectedPowerRef : undefined}
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

          {childNodesRendering}
        </li>
      );
    },
    (prevProps, nextProps) => {
      // Custom comparison function to determine if the component should re-render
      return (
        prevProps.node.power.power_id === nextProps.node.power.power_id &&
        prevProps.node.expanded === nextProps.node.expanded &&
        prevProps.depth === nextProps.depth &&
        prevProps.selectedPower?.power_id === nextProps.selectedPower?.power_id
      );
    }
  );

  // Note: We've inlined the PowerGroup and UngroupedPowers components directly into the renderedContent
  // useMemo below for better performance and to avoid unused component warnings

  // Render the main component
  // Effect to expand parents when a power is selected
  const expandParentsForPower = useCallback(
    (powerId: string | undefined) => {
      if (!powerId) return;

      // Helper function to update node expansion state
      const updateNodeExpansion = (nodes: PowerNode[]): PowerNode[] => {
        return nodes.map((node) => {
          // Check if this node contains the selected power
          if (
            node.power.power_id &&
            checkNodeContainsPower(node, powerId, new Set())
          ) {
            // Expand this node
            return { ...node, expanded: true };
          }
          return node;
        });
      };

      // Update grouped nodes
      setGroupedPowerNodes((prevGrouped) => {
        const newGrouped = { ...prevGrouped };
        for (const key in newGrouped) {
          newGrouped[key] = updateNodeExpansion(newGrouped[key]);
        }
        return newGrouped;
      });

      // Update ungrouped nodes
      setUngroupedPowerNodes((prevUngrouped) =>
        updateNodeExpansion(prevUngrouped)
      );
    },
    [checkNodeContainsPower]
  );

  // Effect to expand parent nodes when a power is selected
  useEffect(() => {
    if (selectedPower?.power_id) {
      // Expand all parent groups for this power
      expandParentsForPower(selectedPower.power_id);

      // Scroll to the selected power after a short delay to allow rendering
      setTimeout(() => {
        if (selectedPowerRef.current && scrollContainerRef.current) {
          selectedPowerRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);
    }
  }, [selectedPower?.power_id, expandParentsForPower]);

  // State for resize handle
  const [isDragging, setIsDragging] = useState(false);

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      // These variables will be used in the future implementation of resizing
      // We're keeping them here as placeholders for the resize functionality
      // that would be implemented in the handleMouseMove function
      const _startX = e.clientX;
      const _startWidth = document.documentElement.clientWidth;

      const handleMouseMove = (_e: MouseEvent) => {
        if (!isDragging) return;

        // Resize implementation would go here
        // Example implementation (commented out):
        // const delta = _e.clientX - _startX;
        // const newWidth = Math.max(200, Math.min(400, _startWidth + delta));
        // Apply the new width to the appropriate element
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isDragging]
  );

  // Memoize the main content rendering for better performance
  const renderedContent = useMemo(() => {
    return (
      <>
        <ul className="menu p-0 m-0">
          {groupedPowerNodes &&
            Object.entries(groupedPowerNodes).map(([group, nodes]) => (
              <li key={group} className="mb-2">
                <div
                  className="flex items-center cursor-pointer p-1 hover:bg-base-200 rounded-md"
                  onClick={() => toggleGroup(group)}
                >
                  <div className="mr-1">
                    {expandedGroups[group] ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="font-medium">{group}</div>
                  <div className="ml-2 text-xs text-gray-500">
                    {nodes.length}
                  </div>
                </div>
                {expandedGroups[group] && (
                  <ul className="menu ml-4 mt-1">
                    {nodes.map((node) => (
                      <PowerNodeRenderer
                        key={
                          node.power.power_id || `node-${node.power.power_name}`
                        }
                        node={node}
                        depth={0}
                        visited={new Set()}
                        onSelectPower={onSelectPower}
                        selectedPower={selectedPower}
                        toggleNode={toggleNode}
                      />
                    ))}
                  </ul>
                )}
              </li>
            ))}
          {ungroupedPowerNodes && ungroupedPowerNodes.length > 0 && (
            <li className="mb-2">
              <div className="font-medium p-1">Ungrouped</div>
              <ul className="menu ml-4 mt-1">
                {ungroupedPowerNodes.map((node) => (
                  <PowerNodeRenderer
                    key={node.power.power_id || `node-${node.power.power_name}`}
                    node={node}
                    depth={0}
                    visited={new Set()}
                    onSelectPower={onSelectPower}
                    selectedPower={selectedPower}
                    toggleNode={toggleNode}
                  />
                ))}
              </ul>
            </li>
          )}
        </ul>
      </>
    );
  }, [
    groupedPowerNodes,
    ungroupedPowerNodes,
    expandedGroups,
    toggleGroup,
    onSelectPower,
    selectedPower,
    toggleNode,
  ]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar p-2"
      >
        {renderedContent}
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
    </div>
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
