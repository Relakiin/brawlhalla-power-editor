import { ActiveInput } from "./ActiveInput"
import { Power } from "./Power"

export type ComboTree = {
    normal?: Power,
    //the combo naturally proceeds to this power unless other conditions are met
    if_hit?: Power,
    //if the power hits, it proceeds to this power
    if_release?: Power,
    //TODO: document if release
    if_wall?: Power,
    //if the power enters contact with a wall (example: thatch cannonballs exploding on walls)
    if_button?: Power,
    //if the player pushes an attack button again before the power ends
    if_dir?: ActiveInput[],
    //if the player is holding a direction, it will proceed to the next power based on direction held
    if_interrupt?: Power
    //if the power is interrupted (example: caster is hit) before ending, this next power is called (usually to fizzle out projectiles)
}