# Strategy

Manual recommendations and autoplay use the same shared heuristic policy. It ranks available actions and explains its reasons; its scores are ranks, not probabilities or expected values. Players can choose any available task or item.

## Task recommendations

The policy plans over the tasks currently visible on the board and replans after every action. It uses the qualitative success outlook ordering in [GAME_RULES.md](GAME_RULES.md), task reward, and expiry to choose a feasible sequence. It generally gives the four most favorable outlooks a shared comparison band so reward and expiry can guide the choice. When plans have similar value, it favors more favorable outlooks and earlier deadlines. It puts `Steal super awesome diamond` tasks behind other tasks and treats unfamiliar labels conservatively. Explanations describe the ranking and danger cues without presenting them as success chances.

## Shop recommendations

The policy prioritizes healing at one life when a potion is affordable. At two lives, it may recommend taking a valuable, favorable task first when shopping would make that task expire. It preserves 50 gold for healing before selecting an upgrade.

Upgrade recommendations use task wording to choose a matching family: books for writing, planning, and intelligence tasks; claws or plating for combat and defense; wings for travel; and fuel only for a narrow set of open-terrain matches. Fuel matching is thematic guidance, not a measured success bonus. The policy may favor an upgrade with a stronger recorded task-label improvement signal, then uses training gained and cost to break ties. It defers an upgrade when its turn would displace one of the first two planned tasks with two or fewer turns remaining, and recommends a task between consecutive upgrades.

The policy uses visible state and its item/task label-transition table. It does not model numeric task probabilities, guarantee outcomes, or treat a changed success label as proof that an item improves actual solve success.
