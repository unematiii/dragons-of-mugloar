import type { UpstreamMessage } from '../upstream/types.js';

export type UpgradeFamily = 'book' | 'claw' | 'plating' | 'wings' | 'fuel';

const OPEN_FUEL_TERRAIN = /^(?:plains|rocky plains|peninsula)$/i;
const FUEL_HAZARD_MATERIAL = /^(?:house|clothes|wagon|chariot|weed|beer mug)$/i;

function travelDetails(message: string): { terrain: string; material: string } | null {
  // These patterns match the saved upstream templates. They extract only explicit site and
  // material words; "village" and "thrift shoppe" are not assumed to mean indoors.
  const transport = /^Help .+ to transport a magic (.+?) to (.+?) in .+$/i.exec(message);
  if (transport?.[1] !== undefined && transport[2] !== undefined)
    return { material: transport[1], terrain: transport[2] };

  const escort = /^Escort .+? to (.+?) in .+? where they can meet with their long lost (.+)$/i.exec(
    message,
  );
  if (escort?.[1] !== undefined && escort[2] !== undefined)
    return { terrain: escort[1], material: escort[2] };

  return null;
}

export function matchingUpgradeFamilies(task: UpstreamMessage): readonly UpgradeFamily[] {
  const message = task.message;

  const defend = /^Help defending (.+?) in .+ from the intruders$/i.exec(message);
  if (defend?.[1] !== undefined)
    return OPEN_FUEL_TERRAIN.test(defend[1]) ? ['plating', 'claw', 'fuel'] : ['plating', 'claw'];

  if (/^(?:Rescue|Kill)\b/i.test(message)) return ['claw', 'plating'];

  if (
    /^Create an advertisement campaign\b/i.test(message) ||
    /^Investigate\b/i.test(message) ||
    /^Infiltrate\b/i.test(message) ||
    /to write their biographical novel|to reach an agreement/i.test(message)
  )
    return ['book'];

  const travel = travelDetails(message);
  if (travel !== null) {
    // Fuel matching is deliberately narrower than wing matching. Dry/inhabited terrain,
    // flammable-looking cargo, and uncertain sites fall back to wings. This is thematic
    // caution, not a measured fuel failure rule: the recorded terrain outcomes conflict.
    const fuelMatch =
      OPEN_FUEL_TERRAIN.test(travel.terrain) && !FUEL_HAZARD_MATERIAL.test(travel.material);

    return fuelMatch ? ['wings', 'fuel'] : ['wings'];
  }

  if (/^Steal (?!super awesome diamond\b).+ delivery to /i.test(message)) return ['wings', 'claw'];

  return [];
}
