import { Cast } from "./Cast";
import { parseHitboxes } from "./Hitbox";
import { Power } from "./Power";

export type VisualizerData = {
  casts: Cast[];
  error?: string;
};

export const getVisualizerData = (power: Power): VisualizerData => {
  if (!power) return { casts: [], error: "Undefined power" };
  const castTimes = power.cast_time?.split(",") || [];
  const castImpulsesX = power.cast_impulse_x?.split(",") || [];
  const castImpulsesY = power.cast_impulse_y?.split(",") || [];
  const fireImpulsesX = power.fire_impulse_x?.split(",") || [];
  const fireImpulsesY = power.fire_impulse_y?.split(",") || [];
  const baseDamages = power.base_damage?.split(",") || [];
  const varImpulses = power.variable_impulse?.split(",") || [];
  const fixImpulses = power.fixed_impulse?.split(",") || [];
  const impulseX = power.impulse_offset_x?.split(",") || [];
  const impulseY = power.impulse_offset_y?.split(",") || [];

  const hitboxes = parseHitboxes(
    power.aoe_radius_x,
    power.aoe_radius_y,
    power.center_offset_x,
    power.center_offset_y
  );

  // determine the max length of the arrays to ensure all casts are mapped
  const length = Math.max(
    castTimes.length,
    castImpulsesX.length,
    castImpulsesY.length,
    fireImpulsesX.length,
    fireImpulsesY.length,
    baseDamages.length,
    varImpulses.length,
    fixImpulses.length,
    impulseX.length,
    impulseY.length,
    hitboxes.length
  );

  // create casts
  const casts: Cast[] = [];
  for (let i = 0; i < length; i++) {
    const castTimeSplit = castTimes[i]?.split("@")[0].split(":") || [];
    const castTimeUnit = castTimes[i]
      ? {
          startup: Number(castTimeSplit[0]) || 0,
          active: (Number(castTimeSplit[1]) || 0) + 1,
        }
      : undefined;

    casts.push({
      cast_time: castTimeUnit,
      cast_impulse_x: castImpulsesX[i] || undefined,
      cast_impulse_y: castImpulsesY[i] || undefined,
      fire_impulse_x: fireImpulsesX[i] || undefined,
      fire_impulse_y: fireImpulsesY[i] || undefined,
      base_damage: baseDamages[i] || undefined,
      variable_impulse: varImpulses[i] || undefined,
      fixed_impulse: fixImpulses[i] || undefined,
      impulse_offset_x: impulseX[i] || undefined,
      impulse_offset_y: impulseY[i] || undefined,
      hitboxes: hitboxes[i] || undefined,
    });
  }
  return { casts };
};
