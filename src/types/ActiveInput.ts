import { Direction } from "../enums/Direction";
import { Power } from "./Power";

export type ActiveInput = {
  direction: Direction;
  combo: Power;
};
