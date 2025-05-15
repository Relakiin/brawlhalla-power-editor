import { Hitbox } from "./Hitbox";

export type Cast = {
  cast_time?: string;
  hitboxes?: Hitbox;
  cast_impulse_x?: string;
  cast_impulse_y?: string;
  fire_impulse_x?: string;
  fire_impulse_y?: string;
  base_damage?: string;
  variable_impulse?: string;
  fixed_impulse?: string;
  impulse_offset_x?: string;
  impulse_offset_y?: string;
};