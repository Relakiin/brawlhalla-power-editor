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

  // Update nodes when powers change
  useEffect(() => {
    if (!powers) {
      setGroupedPowerNodes({});
      setUngroupedPowerNodes([]);
      return;
    }

    // Create initial nodes
    const nodes: PowerNode[] = powers.map(power => ({
      power,
      children: {},
      expanded: false,
      parentPaths: new Set<string>()
    }));

    // Create a map for quick lookup by power_name
    const nameMap = new Map<string, PowerNode>();
    nodes.forEach(node => {
      if (node.power.power_name) {
        // Store with lowercase key for case-insensitive lookup
        nameMap.set(node.power.power_name.toLowerCase(), node);
      }
    });

    // Also create a map by power_id for reference tracking
    const idMap = new Map<string, PowerNode>();
    nodes.forEach(node => {
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
    const buildComboTree = (node: PowerNode, processedIds = new Set<string>()) => {
      if (!node.power.power_id) return;
      
      // Prevent infinite recursion by tracking processed nodes
      if (processedIds.has(node.power.power_id)) return;
      processedIds.add(node.power.power_id);
      
      const comboTree = getComboTreeForPower(node.power);
      if (!comboTree) return;

      // Helper function to add parent-child relationship
      const addParentRelationship = (parentNode: PowerNode, childNode: PowerNode) => {
        if (parentNode.power.power_id && typeof parentNode.power.power_id === 'string') {
          // Add this parent to the child's parent paths
          childNode.parentPaths.add(parentNode.power.power_id);
          console.log(`Added parent ${parentNode.power.power_name} (${parentNode.power.power_id}) to child ${childNode.power.power_name}'s parent paths`);
          
          // Also add all ancestors of the parent to the child's parent paths
          parentNode.parentPaths.forEach(ancestorId => {
            childNode.parentPaths.add(ancestorId);
            console.log(`Added ancestor ${ancestorId} to child ${childNode.power.power_name}'s parent paths`);
          });
          
          // Log the current parent paths for this child
          console.log(`${childNode.power.power_name}'s parent paths:`, [...childNode.parentPaths]);
        }
      };

      // Add normal combo
      if (comboTree.normal) {
        const targetNode = findNodeByPowerName(comboTree.normal.power_name);
        if (targetNode && targetNode.power.power_id) {
          node.children.normal = targetNode;
          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          buildComboTree(targetNode, new Set(processedIds));
        }
      }

      // Add if_hit combo
      if (comboTree.if_hit) {
        const targetNode = findNodeByPowerName(comboTree.if_hit.power_name);
        if (targetNode && targetNode.power.power_id) {
          node.children.if_hit = targetNode;
          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          buildComboTree(targetNode, new Set(processedIds));
        }
      }

      // Add if_release combo
      if (comboTree.if_release) {
        const targetNode = findNodeByPowerName(comboTree.if_release.power_name);
        if (targetNode && targetNode.power.power_id) {
          node.children.if_release = targetNode;
          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          buildComboTree(targetNode, new Set(processedIds));
        }
      }

      // Add if_wall combo
      if (comboTree.if_wall) {
        const targetNode = findNodeByPowerName(comboTree.if_wall.power_name);
        if (targetNode && targetNode.power.power_id) {
          node.children.if_wall = targetNode;
          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          buildComboTree(targetNode, new Set(processedIds));
        }
      }

      // Add if_button combo
      if (comboTree.if_button) {
        const targetNode = findNodeByPowerName(comboTree.if_button.power_name);
        if (targetNode && targetNode.power.power_id) {
          node.children.if_button = targetNode;
          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          buildComboTree(targetNode, new Set(processedIds));
        }
      }

      // Add if_interrupt combo
      if (comboTree.if_interrupt) {
        const targetNode = findNodeByPowerName(comboTree.if_interrupt.power_name);
        if (targetNode && targetNode.power.power_id) {
          node.children.if_interrupt = targetNode;
          // Mark this node as referenced in a combo tree
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          buildComboTree(targetNode, new Set(processedIds));
        }
      }

      // Add if_dir combos
      if (comboTree.if_dir && comboTree.if_dir.length > 0) {
        node.children.if_dir = comboTree.if_dir.map(input => {
          const targetNode = findNodeByPowerName(input.combo.power_name);
          if (!targetNode || !targetNode.power.power_id) return null;
          
          // Mark this node as referenced in a combo tree
          // Ensure power_id is a string before adding to the Set
          const powerId = targetNode.power.power_id;
          if (typeof powerId === 'string') {
            referencedNodes.add(powerId);
            // Add parent relationship
            addParentRelationship(node, targetNode);
          }
          
          // Recursively build the tree for this direction node
          buildComboTree(targetNode, new Set(processedIds));
          
          return { direction: input.direction, node: targetNode };
        }).filter((item): item is { direction: Direction; node: PowerNode } => item !== null);
      }
    };

    // Build the full combo tree for each node
    nodes.forEach(node => {
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
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const toggleNode = (node: PowerNode) => {
    // Recursive function to update nodes and their children
    const updateNodesRecursively = (nodes: PowerNode[]): PowerNode[] => {
      return nodes.map(n => {
        // If this is the node we want to toggle
        if (n.power.power_id === node.power.power_id) {
          return { ...n, expanded: !n.expanded };
        }
        
        // Check children recursively
        const updatedChildren: typeof n.children = {};
        let hasUpdatedChildren = false;
        
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
          const updatedDirNodes = n.children.if_dir.map(dirNode => {
            const updatedNode = updateNodeRecursively(dirNode.node);
            if (updatedNode !== dirNode.node) {
              return { ...dirNode, node: updatedNode };
            }
            return dirNode;
          });
          
          if (updatedDirNodes.some((dirNode, i) => dirNode !== n.children.if_dir?.[i])) {
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
              ...updatedChildren
            }
          };
        }
        
        // Otherwise return the original node
        return n;
      });
    };
    
    // Helper function to update a single node recursively
    const updateNodeRecursively = (n: PowerNode): PowerNode => {
      if (n.power.power_id === node.power.power_id) {
        return { ...n, expanded: !n.expanded };
      }
      
      // Check children recursively
      const updatedChildren: typeof n.children = {};
      let hasUpdatedChildren = false;
      
      // Check all child types (normal, if_hit, etc.)
      Object.entries(n.children).forEach(([key, child]) => {
        if (!child) return;
        
        if (key === 'if_dir' && Array.isArray(child)) {
          const updatedDirNodes = child.map(dirNode => {
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
        } else if (key !== 'if_dir') {
          // Type-safe way to handle the different child types
          switch(key) {
            case 'normal':
              if (n.children.normal) {
                const updatedNode = updateNodeRecursively(n.children.normal);
                if (updatedNode !== n.children.normal) {
                  updatedChildren.normal = updatedNode;
                  hasUpdatedChildren = true;
                }
              }
              break;
            case 'if_hit':
              if (n.children.if_hit) {
                const updatedNode = updateNodeRecursively(n.children.if_hit);
                if (updatedNode !== n.children.if_hit) {
                  updatedChildren.if_hit = updatedNode;
                  hasUpdatedChildren = true;
                }
              }
              break;
            case 'if_release':
              if (n.children.if_release) {
                const updatedNode = updateNodeRecursively(n.children.if_release);
                if (updatedNode !== n.children.if_release) {
                  updatedChildren.if_release = updatedNode;
                  hasUpdatedChildren = true;
                }
              }
              break;
            case 'if_wall':
              if (n.children.if_wall) {
                const updatedNode = updateNodeRecursively(n.children.if_wall);
                if (updatedNode !== n.children.if_wall) {
                  updatedChildren.if_wall = updatedNode;
                  hasUpdatedChildren = true;
                }
              }
              break;
            case 'if_button':
              if (n.children.if_button) {
                const updatedNode = updateNodeRecursively(n.children.if_button);
                if (updatedNode !== n.children.if_button) {
                  updatedChildren.if_button = updatedNode;
                  hasUpdatedChildren = true;
                }
              }
              break;
            case 'if_interrupt':
              if (n.children.if_interrupt) {
                const updatedNode = updateNodeRecursively(n.children.if_interrupt);
                if (updatedNode !== n.children.if_interrupt) {
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
          ...n,
          children: {
            ...n.children,
            ...updatedChildren
          }
        };
      }
      
      // Otherwise return the original node
      return n;
    };

    // Update in grouped nodes
    setGroupedPowerNodes(prevGrouped => {
      const newGrouped = { ...prevGrouped };
      for (const key in newGrouped) {
        newGrouped[key] = updateNodesRecursively(newGrouped[key]);
      }
      return newGrouped;
    });

    // Update in ungrouped nodes
    setUngroupedPowerNodes(prevUngrouped => updateNodesRecursively(prevUngrouped));
  };

  // Render a power node with its children
  const renderPowerNode = (node: PowerNode, depth: number = 0, visitedIds: Set<string> = new Set()) => {
    // Prevent infinite recursion by tracking visited nodes
    if (!node.power.power_id || visitedIds.has(node.power.power_id)) {
      return (
        <li key={`cycle-${Math.random()}`} className="menu-item">
          <div className="text-xs text-gray-500 italic pl-4" style={{ paddingLeft: `${depth * 12 + 8}px` }}>
            (Circular reference detected)
          </div>
        </li>
      );
    }
    
    // Add this node to visited set for this branch
    const newVisitedIds = new Set(visitedIds);
    if (node.power.power_id) {
      newVisitedIds.add(node.power.power_id);
    }
    
    const hasChildren = Object.values(node.children).some(child => 
      child !== undefined && (Array.isArray(child) ? child.length > 0 : true)
    );

    // Check if this node is the selected power or a parent of the selected power
    const isSelected = selectedPower?.power_id === node.power.power_id;
    
    // Check if this node is a parent of the selected power
    let isParentOfSelected = false;
    
    // Use a more direct approach to check if this node is in the path to the selected node
    const isNodeInPathToSelected = (currentNode: PowerNode, targetPowerId: string, visited = new Set<string>()): boolean => {
      // Prevent infinite recursion
      if (!currentNode.power.power_id || visited.has(currentNode.power.power_id)) {
        return false;
      }
      visited.add(currentNode.power.power_id);
      
      // Check all children
      // Check normal combo
      if (currentNode.children.normal) {
        if (currentNode.children.normal.power.power_id === targetPowerId) {
          return true;
        }
        if (isNodeInPathToSelected(currentNode.children.normal, targetPowerId, new Set(visited))) {
          return true;
        }
      }
      
      // Check if_hit combo
      if (currentNode.children.if_hit) {
        if (currentNode.children.if_hit.power.power_id === targetPowerId) {
          return true;
        }
        if (isNodeInPathToSelected(currentNode.children.if_hit, targetPowerId, new Set(visited))) {
          return true;
        }
      }
      
      // Check if_release combo
      if (currentNode.children.if_release) {
        if (currentNode.children.if_release.power.power_id === targetPowerId) {
          return true;
        }
        if (isNodeInPathToSelected(currentNode.children.if_release, targetPowerId, new Set(visited))) {
          return true;
        }
      }
      
      // Check if_wall combo
      if (currentNode.children.if_wall) {
        if (currentNode.children.if_wall.power.power_id === targetPowerId) {
          return true;
        }
        if (isNodeInPathToSelected(currentNode.children.if_wall, targetPowerId, new Set(visited))) {
          return true;
        }
      }
      
      // Check if_button combo
      if (currentNode.children.if_button) {
        if (currentNode.children.if_button.power.power_id === targetPowerId) {
          return true;
        }
        if (isNodeInPathToSelected(currentNode.children.if_button, targetPowerId, new Set(visited))) {
          return true;
        }
      }
      
      // Check if_interrupt combo
      if (currentNode.children.if_interrupt) {
        if (currentNode.children.if_interrupt.power.power_id === targetPowerId) {
          return true;
        }
        if (isNodeInPathToSelected(currentNode.children.if_interrupt, targetPowerId, new Set(visited))) {
          return true;
        }
      }
      
      // Check if_dir combos
      if (currentNode.children.if_dir) {
        for (const dirCombo of currentNode.children.if_dir) {
          if (dirCombo.node.power.power_id === targetPowerId) {
            return true;
          }
          if (isNodeInPathToSelected(dirCombo.node, targetPowerId, new Set(visited))) {
            return true;
          }
        }
      }
      
      return false;
    };
    
    if (selectedPower?.power_id && node.power.power_id && node.power.power_id !== selectedPower.power_id) {
      isParentOfSelected = isNodeInPathToSelected(node, selectedPower.power_id);
    }
    
    // Determine the appropriate highlight class
    let highlightClass = "";
    if (isSelected) {
      highlightClass = "bg-primary text-white";
    } else if (isParentOfSelected) {
      highlightClass = "bg-accent-focus text-white border-l-4 border-accent";
    }
    
    return (
      <li key={node.power.power_id || `node-${Math.random()}`} className="menu-item">
        <div 
          className={`flex items-center justify-between cursor-pointer py-1 px-2 hover:bg-base-300 ${highlightClass}`}
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
                {renderPowerNode(node.children.normal, depth + 1, newVisitedIds)}
              </li>
            )}
            {node.children.if_hit && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_hit:</div>
                {renderPowerNode(node.children.if_hit, depth + 1, newVisitedIds)}
              </li>
            )}
            {node.children.if_release && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_release:</div>
                {renderPowerNode(node.children.if_release, depth + 1, newVisitedIds)}
              </li>
            )}
            {node.children.if_wall && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_wall:</div>
                {renderPowerNode(node.children.if_wall, depth + 1, newVisitedIds)}
              </li>
            )}
            {node.children.if_button && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_button:</div>
                {renderPowerNode(node.children.if_button, depth + 1, newVisitedIds)}
              </li>
            )}
            {node.children.if_interrupt && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_interrupt:</div>
                {renderPowerNode(node.children.if_interrupt, depth + 1, newVisitedIds)}
              </li>
            )}
            {node.children.if_dir && node.children.if_dir.length > 0 && (
              <li className="pl-2">
                <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 1) * 12 + 8}px` }}>if_dir:</div>
                <ul>
                  {node.children.if_dir.map((dirNode, idx) => (
                    <li key={`${node.power.power_id || 'dir'}-dir-${idx}`} className="pl-2">
                      <div className="text-xs text-gray-500 pl-4" style={{ paddingLeft: `${(depth + 2) * 12 + 8}px` }}>{dirNode.direction}:</div>
                      {renderPowerNode(dirNode.node, depth + 2, newVisitedIds)}
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