# Game rules

This page records the upstream game interface and the mechanics the application relies on. The upstream API remains authoritative; qualitative task labels are clues, not numeric probabilities.

## Upstream interface

The game API supports starting a game, reading messages, tasks and shop offers, solving tasks, buying items, and reading reputation. Game state includes lives, gold, level, score, and turn. Tasks include a reward, a qualitative success outlook, and an expiry value. Actions return updated game state; the application refreshes the board after an action.

The API is documented at [dragonsofmugloar.com/doc](https://dragonsofmugloar.com/doc/). The assignment description is available at [dragonsofmugloar.com/assets/texts.js](https://dragonsofmugloar.com/assets/texts.js).

## Mechanics used by the application

- A task solve or shop purchase consumes a turn. Failed solves can cost a life.
- A healing potion (`hpot`) costs 50 gold and restores one life in the observed game behavior used by the policy.
- Upgrade items train the dragon. The policy recognizes 100-gold upgrades as one level and 300-gold upgrades as two levels.
- The success outlooks have an observed easy-to-hard ordering: `Sure thing`, `Piece of cake`, `Walk in the park`, `Quite likely`, `Hmmm....`, `Gamble`, `Risky`, `Rather detrimental`, `Playing with fire`, `Suicide mission`. These labels are not converted into probabilities.
- Tasks containing `Steal super awesome diamond` are treated as a danger marker by the recommendation policy.
- The reputation endpoint reports people, State, and underworld values. Initial readings are treated as zero; a recommendation can request a fresh reading when recorded actions do not support safely updating it.

Other task effects, item effects on actual solve success, and hidden task-generation rules are not assumed by the application.
