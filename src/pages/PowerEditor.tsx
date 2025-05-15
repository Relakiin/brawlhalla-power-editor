import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import PowerList from "../components/PowerEditor/PowerList";
import PowerDetails from "../components/PowerEditor/PowerDetails";
import ComboTreeViewer from "../components/PowerEditor/ComboTreeViewer";
import WelcomeMessage from "../components/PowerEditor/WelcomeMessage";
import PowerEditorNavbar from "../components/PowerEditor/PowerEditorNavbar";
import { Power } from "../types/Power";
import { ComboTree } from "../types/ComboTree";
import { NotifMode, notify } from "../utils/notify";
import { ActiveInput } from "../types/ActiveInput";
import { Direction } from "../enums/Direction";
import PowerVisualizer from "../components/PowerEditor/PowerVisualizer";
import { getVisualizerData } from "../types/VisualizerData";

const PowerEditor: React.FC = () => {
  const [powers, setPowers] = useState<Power[] | null>(null);
  const [filteredPowers, setFilteredPowers] = useState<Power[]>([]);
  const [selectedPower, setSelectedPower] = useState<Power | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});

  useEffect(() => {
    //searchbar list filtering
    if (!powers) return;
    if (searchQuery === "") {
      setFilteredPowers(powers);
      return;
    }
    setFilteredPowers(
      powers.filter((p) =>
        p.power_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [searchQuery, powers]);

  useEffect(() => {
    //load descriptions json from rust
    const loadDescriptions = async () => {
      const loadedDescriptions = await invoke<Record<string, string>>(
        "get_descriptions"
      );
      setDescriptions(loadedDescriptions);
    };
    loadDescriptions();
  }, []);

  const handlePowerChange = (updatedPower: Power) => {
    setSelectedPower(updatedPower);
    setPowers((prevPowers) =>
      (prevPowers ?? []).map((power) =>
        power.power_id === updatedPower.power_id ? updatedPower : power
      )
    );
  };

  const handleLoadFile = async () => {
    try {
      const filePath = await open({
        filters: [{ name: "powerTypes File", extensions: ["csv"] }],
      });
      if (filePath) {
        notify(`Loading powers...`, NotifMode.INFO);
        //let rust load and parse the power list
        const loadedPowers = await invoke<Power[]>("load_powers_from_path", {
          filePath,
        });
        setPowers(loadedPowers);
        setCurrentFilePath(filePath);
        notify(`Powers loaded successfully!`, NotifMode.SUCCESS);
        setSelectedPower(null);
      }
    } catch (error) {
      notify(`Error loading file: ${error}`, NotifMode.ERROR);
    }
  };

  const handleWriteFile = async () => {
    if (!currentFilePath) {
      notify("No file selected to save to!", NotifMode.ERROR);
      return;
    }

    try {
      await invoke("save_power_list_to_path", {
        filePath: currentFilePath,
        updatedList: powers,
      });
      notify("File saved successfully!", NotifMode.SUCCESS);
    } catch (error) {
      notify(`Error saving file: ${error}`, NotifMode.ERROR);
    }
  };

  const createEmptyPower = (): Power => {
    if (!powers) return {} as Power;
    //cycle through template power's keys to instantiate an empty power object
    //trying to set every property to null just returns an object with no properties...
    const empty: Partial<Record<keyof Power, null>> = {};
    for (const key in powers[0]) {
      empty[key as keyof Power] = null;
    }
    return empty as Power;
  };

  const handleCreatePower = () => {
    if (!powers) {
      notify("No power list loaded!", NotifMode.ERROR);
      return;
    }

    const emptyPower = createEmptyPower();
    emptyPower.power_id = "" + (powers.length + 1);
    emptyPower.power_name = "New Power " + emptyPower.power_id;

    setPowers((prevPowers) => {
      if (!prevPowers) return [emptyPower];

      //add power next to currently selected one
      //TODO: implement reordering powers
      const selectedIndex = selectedPower
        ? prevPowers.findIndex(
            (power) => power.power_id === selectedPower.power_id
          )
        : -1;

      const updatedPowers = [...prevPowers];
      if (selectedIndex !== -1) {
        updatedPowers.splice(selectedIndex + 1, 0, emptyPower);
      } else {
        updatedPowers.push(emptyPower);
      }

      return updatedPowers;
    });

    setSelectedPower(emptyPower);
  };

  const handleDeletePower = () => {
    if (!selectedPower) {
      notify("No power selected!", NotifMode.ERROR);
      return;
    }
    const updatedPowers = powers?.filter(
      (power) => power.power_id !== selectedPower.power_id
    );
    if (!updatedPowers) return;
    setPowers(updatedPowers);
    setSelectedPower(null);
    notify(`Power deleted successfully!`, NotifMode.SUCCESS);
  };

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

  const getReverseComboTreeForPower = (target: Power): ComboTree | null => {
    //check other powers to see if they combo into this one
    const name = target.power_name?.toLowerCase();
    if (!name) return null;

    const findMatching = (key: keyof Power) =>
      powers!.filter((p) => p[key]?.toLowerCase() === name);

    const ifDirMatches: ActiveInput[] = powers!.flatMap((power) => {
      if (!power.combo_override_if_dir) return [];
      return power.combo_override_if_dir
        .split(",")
        .map((input) => {
          const [dirKey, powerName] = input.split(":");
          if (!dirKey || !powerName || powerName.toLowerCase() !== name)
            return null;

          const direction =
            Direction[dirKey.toUpperCase() as keyof typeof Direction];
          if (!direction) return null;

          return { direction, combo: power };
        })
        .filter((x): x is ActiveInput => x !== null);
    });

    const tree: ComboTree = {
      normal: findMatching("combo_name")[0],
      if_hit: findMatching("combo_override_if_hit")[0],
      if_release: findMatching("combo_override_if_release")[0],
      if_wall: findMatching("combo_override_if_wall")[0],
      if_button: findMatching("combo_override_if_button")[0],
      if_interrupt: findMatching("combo_override_if_interrupt")[0],
      if_dir: ifDirMatches.length > 0 ? ifDirMatches : undefined,
    };

    const allEmpty = Object.values(tree).every((v) => v === undefined);
    return allEmpty ? null : tree;
  };

  const findPowerByName = (name?: string): Power | undefined => {
    if (!name) return;
    return powers!.filter(
      (p) => p.power_name?.toLowerCase() === name.toLowerCase()
    )[0];
  };

  const findActiveInputPowers = (
    inputString?: string
  ): ActiveInput[] | undefined => {
    if (!inputString) return;
    const inputs = inputString.split(",");
    const activeInputs: ActiveInput[] = inputs
      .map((input) => {
        const data = input.split(":"); //DIRECTION:PowerName
        if (data.length !== 2) {
          console.error(`Invalid input format: ${input}`);
          return null;
        }
        const directionKey = data[0].toUpperCase();
        const powerName = data[1];
        const direction = Direction[directionKey as keyof typeof Direction];
        if (!direction) {
          console.error(`Invalid direction: ${directionKey}`);
          return null;
        }
        const combo = findPowerByName(powerName);
        if (!combo) {
          return null;
        }
        return { direction, combo };
      })
      .filter((input): input is ActiveInput => input !== null);
    return activeInputs.length > 0 ? activeInputs : undefined;
  };

  return (
    <div className="flex">
      <PowerList
        powers={filteredPowers}
        selectedPower={selectedPower}
        onSelectPower={setSelectedPower}
      />
      <div className="flex-1">
        <PowerEditorNavbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLoadFile={handleLoadFile}
          onWriteFile={handleWriteFile}
          onCreatePower={handleCreatePower}
          onDeletePower={handleDeletePower}
        />
        <main className="p-4 mb-5">
          {selectedPower ? (
            <>
              <ComboTreeViewer
                comboTree={getComboTreeForPower(selectedPower)}
                reverseComboTree={getReverseComboTreeForPower(selectedPower)}
                onSelectPower={setSelectedPower}
              />
              <PowerVisualizer visualizerData={getVisualizerData(selectedPower)} powerId={selectedPower.power_id ?? ""} />
              <PowerDetails
                power={selectedPower}
                descriptions={descriptions}
                onPowerChange={handlePowerChange}
              />
            </>
          ) : (
            <WelcomeMessage />
          )}
        </main>
      </div>
    </div>
  );
};

export default PowerEditor;
