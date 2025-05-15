export type Hitbox = {
  aoe_radius_x?: string[];
  aoe_radius_y?: string[];
  center_offset_x?: string[];
  center_offset_y?: string[];
};

export const parseHitboxes = (
    rx: string | null | undefined,
    ry: string | null | undefined,
    cx: string | null | undefined,
    cy: string | null | undefined
  ): Hitbox[] => {
    const partsRx = rx ? rx.split(",").map((s) => s.split("&")) : [];
    const partsRy = ry ? ry.split(",").map((s) => s.split("&")) : [];
    const partsCx = cx ? cx.split(",").map((s) => s.split("&")) : [];
    const partsCy = cy ? cy.split(",").map((s) => s.split("&")) : [];
  
    const length = Math.max(
      partsRx.length,
      partsRy.length,
      partsCx.length,
      partsCy.length
    );
  
    const result: Hitbox[] = [];
  
    for (let i = 0; i < length; i++) {
      result.push({
        aoe_radius_x: partsRx[i] || [],
        aoe_radius_y: partsRy[i] || [],
        center_offset_x: partsCx[i] || [],
        center_offset_y: partsCy[i] || [],
      });
    }
  
    return result;
  };