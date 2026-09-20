/**
 * The Ecosystem and Glider boards, run forward.
 *
 * Neither has a describe block of its own -- nothing beyond "no board ends
 * dead" is claimed about them -- so they share a suite rather than each having
 * a file with one check in it.
 */

import { checkNoBoardEndsDead, presetsFor } from "./preset-sim.js"

checkNoBoardEndsDead(presetsFor("Presets.ecosystem-glider.test.js"))
