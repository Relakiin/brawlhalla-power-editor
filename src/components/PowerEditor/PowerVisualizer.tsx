import React, { useState, useEffect, useRef } from "react";
import { VisualizerData } from "../../types/VisualizerData";
import HitboxUnit from "../PowerVisualizer/HitboxUnit";

interface PowerVisualizerProps {
  visualizerData: VisualizerData;
  powerId: string;
}

const PowerVisualizer: React.FC<PowerVisualizerProps> = ({
  visualizerData,
  powerId,
}) => {
  const [currentCastIndex, setCurrentCastIndex] = useState(0);

  const previousPowerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousPowerIdRef.current !== powerId) {
      setCurrentCastIndex(0);
      previousPowerIdRef.current = powerId;
    }
  }, [powerId]);

  const handleNext = () => {
    if (currentCastIndex < visualizerData.casts.length - 1) {
      setCurrentCastIndex(currentCastIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentCastIndex > 0) {
      setCurrentCastIndex(currentCastIndex - 1);
    }
  };

  const getHitboxDataWithFallback = (currentIndex: number) => {
    const currentHitbox = visualizerData.casts[currentIndex]?.hitboxes;
    const firstHitbox = visualizerData.casts[0]?.hitboxes;

    // brawlhalla syntax: if data is defined only once over multiple casts, reuse it
    return {
      aoe_radius_x:
        (currentHitbox?.aoe_radius_x ?? []).length > 0
          ? currentHitbox!.aoe_radius_x
          : firstHitbox?.aoe_radius_x || [],
      aoe_radius_y:
        (currentHitbox?.aoe_radius_y ?? []).length > 0
          ? currentHitbox!.aoe_radius_y
          : firstHitbox?.aoe_radius_y || [],
      center_offset_x:
        (currentHitbox?.center_offset_x ?? []).length > 0
          ? currentHitbox!.center_offset_x
          : firstHitbox?.center_offset_x || [],
      center_offset_y:
        (currentHitbox?.center_offset_y ?? []).length > 0
          ? currentHitbox!.center_offset_y
          : firstHitbox?.center_offset_y || [],
    };
  };

  const getCastDataWithFallback = (currentIndex: number) => {
    const currentCast = visualizerData.casts[currentIndex];
    const firstCast = visualizerData.casts[0];

    // brawlhalla syntax: if data is defined only once over multiple casts, reuse it
    return {
      base_damage:
        (currentCast?.base_damage ?? "").length > 0
          ? currentCast.base_damage
          : firstCast?.base_damage || "0",
      variable_impulse:
        (currentCast?.variable_impulse ?? "").length > 0
          ? currentCast.variable_impulse
          : firstCast?.variable_impulse || "0",
      fixed_impulse:
        (currentCast?.fixed_impulse ?? "").length > 0
          ? currentCast.fixed_impulse
          : firstCast?.fixed_impulse || "0",
      impulse_offset_x:
        (currentCast?.impulse_offset_x ?? "").length > 0
          ? currentCast.impulse_offset_x
          : firstCast?.impulse_offset_x || undefined,
      impulse_offset_y:
        (currentCast?.impulse_offset_y ?? "").length > 0
          ? currentCast.impulse_offset_y
          : firstCast?.impulse_offset_y || undefined,
    };
  };

  const hitbox = getHitboxDataWithFallback(currentCastIndex);
  const cast = getCastDataWithFallback(currentCastIndex);

  //TODO: read the hurtboxes file to be more accurate instead of imagining a player
  const playerX = 200;
  const playerY = 300;
  const playerWidth = 100;
  const playerHeight = 100;

  return (
    <div className="collapse collapse-arrow bg-base-100 border border-gray-300 rounded-lg p-4 relative mb-5">
      <input type="checkbox" />
      <div className="collapse-title text-2xl font-bold">Hitbox Visualizer</div>
      <div className="collapse-content text-sm">
        {visualizerData.error ? (
          <h3>Error: {visualizerData.error}</h3>
        ) : (
          <>
            <div className="flex justify-between mb-4">
              <button
                className="btn btn-primary"
                onClick={handlePrevious}
                disabled={currentCastIndex === 0}
              >
                Previous
              </button>
              <span>
                Cast {currentCastIndex + 1} of {visualizerData.casts.length}
              </span>
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={currentCastIndex === visualizerData.casts.length - 1}
              >
                Next
              </button>
            </div>
            <svg
              width="100%"
              height="500"
              viewBox={`0 ${playerY - 500} 400 1000`}
              className="border border-gray-300 rounded-lg"
            >
              {/* ground */}
              <line
                x1="0"
                y1={playerY}
                x2="400"
                y2={playerY}
                stroke="black"
                strokeWidth="2"
              />

              {/* player */}
              <ellipse
                cx={playerX}
                cy={playerY - playerHeight / 2}
                rx={playerWidth / 2}
                ry={playerHeight / 2}
                fill="yellow"
                stroke="black"
                strokeWidth="2"
              />

              {/* hitboxes */}
              {visualizerData.casts[currentCastIndex] &&
              visualizerData.casts[currentCastIndex].base_damage == "0" ? (
                <></>
              ) : (
                <>
                  {(hitbox.aoe_radius_x ?? []).map((rx, index) => {
                    const ry = (hitbox.aoe_radius_y ?? [])[index];
                    const cx =
                      playerX +
                      parseFloat((hitbox.center_offset_x ?? [])[index] || "0");
                    const cy =
                      playerY -
                      playerHeight / 2 +
                      parseFloat((hitbox.center_offset_y ?? [])[index] || "0");

                    const impulseX = cast.impulse_offset_x;
                    const impulseY = cast.impulse_offset_y;

                    if (rx && ry) {
                      return (
                        <HitboxUnit
                          key={index}
                          rx={parseFloat(rx)}
                          ry={parseFloat(ry)}
                          cx={cx}
                          cy={cy}
                          fill="red"
                          vx={impulseX}
                          vy={impulseY}
                        />
                      );
                    }
                    return null;
                  })}
                </>
              )}
            </svg>
          </>
        )}
      </div>
    </div>
  );
};

export default PowerVisualizer;
