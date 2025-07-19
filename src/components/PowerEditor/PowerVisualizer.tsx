import React, { useState, useEffect, useRef } from "react";
import { VisualizerData } from "../../types/VisualizerData";
import HitboxUnit from "../PowerVisualizer/HitboxUnit";
import PillShape from "../PowerVisualizer/PillShape";

interface PowerVisualizerProps {
  visualizerData: VisualizerData;
  powerId: string;
}

const PowerVisualizer: React.FC<PowerVisualizerProps> = ({
  visualizerData,
  powerId,
}) => {
  const [currentCastIndex, setCurrentCastIndex] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showOutlineOnly, setShowOutlineOnly] = useState(false);

  const previousPowerIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (previousPowerIdRef.current !== powerId) {
      setCurrentCastIndex(0);
      setCurrentFrame(0);
      previousPowerIdRef.current = powerId;
    }
  }, [powerId]);

  // Calculate the total frames for a specific cast
  const getTotalFramesForCast = (castIndex: number) => {
    const cast = visualizerData.casts[castIndex];
    const startup = cast?.cast_time?.startup || 0;
    const active = cast?.cast_time?.active || 0;
    
    // Special case: if there's startup but only 1 active frame, treat as just 1 frame total
    if (startup > 0 && active === 1) {
      return 1;
    }
    
    return startup + active;
  };

  // Calculate the cumulative frames up to a specific cast
  const getCumulativeFrames = (upToCastIndex: number) => {
    let totalFrames = 0;
    for (let i = 0; i < upToCastIndex; i++) {
      totalFrames += getTotalFramesForCast(i);
    }
    return totalFrames;
  };

  // Get the current cast and frame within that cast based on the global frame count
  const getCurrentCastAndFrame = (globalFrame: number) => {
    let remainingFrames = globalFrame;
    let castIndex = 0;
    
    while (castIndex < visualizerData.casts.length) {
      const castFrames = getTotalFramesForCast(castIndex);
      if (remainingFrames < castFrames) {
        return { castIndex, frameWithinCast: remainingFrames };
      }
      remainingFrames -= castFrames;
      castIndex++;
    }
    
    // If we've gone beyond all casts, return the last cast and its last frame
    const lastCastIndex = Math.max(0, visualizerData.casts.length - 1);
    return { 
      castIndex: lastCastIndex, 
      frameWithinCast: getTotalFramesForCast(lastCastIndex) - 1 
    };
  };

  // Get total frames across all casts
  const getTotalFramesAllCasts = () => {
    return getCumulativeFrames(visualizerData.casts.length);
  };

  const handleNext = () => {
    if (currentCastIndex < visualizerData.casts.length - 1) {
      const nextCastIndex = currentCastIndex + 1;
      setCurrentCastIndex(nextCastIndex);
      
      // Update frame to the first frame of the next cast
      const newFrame = getCumulativeFrames(nextCastIndex);
      setCurrentFrame(newFrame);
    }
  };

  const handlePrevious = () => {
    if (currentCastIndex > 0) {
      const prevCastIndex = currentCastIndex - 1;
      setCurrentCastIndex(prevCastIndex);
      
      // Update frame to the first frame of the previous cast
      const newFrame = getCumulativeFrames(prevCastIndex);
      setCurrentFrame(newFrame);
    }
  };
  
  const handleNextFrame = () => {
    const totalFramesAllCasts = getTotalFramesAllCasts();
    if (currentFrame < totalFramesAllCasts - 1) {
      const nextFrame = currentFrame + 1;
      setCurrentFrame(nextFrame);
      
      // Update cast index if we've moved to the next cast
      const { castIndex } = getCurrentCastAndFrame(nextFrame);
      if (castIndex !== currentCastIndex) {
        setCurrentCastIndex(castIndex);
      }
    }
  };

  const handlePreviousFrame = () => {
    if (currentFrame > 0) {
      const prevFrame = currentFrame - 1;
      setCurrentFrame(prevFrame);
      
      // Update cast index if we've moved to the previous cast
      const { castIndex } = getCurrentCastAndFrame(prevFrame);
      if (castIndex !== currentCastIndex) {
        setCurrentCastIndex(castIndex);
      }
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
  const playerWidth = 145;
  const playerHeight = 160;

  return (
    <div className="collapse collapse-arrow bg-base-100 border border-gray-300 rounded-lg p-4 relative mb-5">
      <input type="checkbox" />
      <div className="collapse-title text-2xl font-bold">Hitbox Visualizer</div>
      <div className="collapse-content text-sm">
        {visualizerData.error ? (
          <h3>Error: {visualizerData.error}</h3>
        ) : (
          <>
            {/* Cast controls row */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={handlePrevious}
                  disabled={currentCastIndex === 0}
                >
                  Previous Cast
                </button>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex gap-2 items-center">
                  <span>
                    Cast {currentCastIndex + 1} of {visualizerData.casts.length}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  onClick={handleNext}
                  disabled={currentCastIndex === visualizerData.casts.length - 1}
                >
                  Next Cast
                </button>
              </div>
            </div>
            
            {/* Frame controls row */}
            <div className="flex justify-between items-center mb-4">
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={handlePreviousFrame}
                  disabled={currentFrame === 0}
                >
                  Previous Frame
                </button>
              </div>
              <div className="flex flex-col items-center">
                <div className="flex gap-2 items-center">
                  <span className="px-2 py-1 bg-base-200 rounded-md">
                    Total Frame {currentFrame + 1} of {getTotalFramesAllCasts()}
                  </span>
                  <div className="px-3 py-1 bg-blue-500 text-white rounded-md">
                    Cast Frame {getCurrentCastAndFrame(currentFrame).frameWithinCast + 1} / {getTotalFramesForCast(currentCastIndex)}
                  </div>
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text mr-2">Outline Only</span>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={showOutlineOnly}
                      onChange={(e) => setShowOutlineOnly(e.target.checked)}
                    />
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-secondary"
                  onClick={handleNextFrame}
                  disabled={currentFrame >= getTotalFramesAllCasts() - 1}
                >
                  Next Frame
                </button>
              </div>
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
              <PillShape
                cx={playerX}
                cy={playerY - playerHeight / 2}
                rx={playerWidth / 2}
                ry={playerHeight / 2}
                fill="yellow"
                stroke="black"
                strokeWidth={2}
                fillOpacity={1}
              />

              {/* hitboxes */}
              {visualizerData.casts[currentCastIndex] &&
              visualizerData.casts[currentCastIndex].base_damage == "0" ? (
                <></>
              ) : (
                <>
                  {/* Show hitboxes only after startup frames and during active frames */}
                  {visualizerData.casts[currentCastIndex]?.cast_time && 
                   (() => {
                     const { frameWithinCast } = getCurrentCastAndFrame(currentFrame);
                     const startup = visualizerData.casts[currentCastIndex]?.cast_time?.startup || 0;
                     const active = visualizerData.casts[currentCastIndex]?.cast_time?.active || 0;
                     
                     // Special case: if there's startup but only 1 active frame, show hitbox on the single frame
                     if (startup > 0 && active === 1) {
                       return frameWithinCast === 0; // Show on the only frame (index 0)
                     }
                     
                     // Normal case: show after startup and during active frames
                     return frameWithinCast >= startup && frameWithinCast < (startup + active);
                   })() && 
                   (hitbox.aoe_radius_x ?? []).map((rx, index) => {
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
                          fill="rgba(255, 0, 0, 0.7)"
                          vx={impulseX}
                          vy={impulseY}
                          outlineOnly={showOutlineOnly}
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
