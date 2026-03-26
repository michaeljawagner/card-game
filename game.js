(function () {
  const root = document.getElementById("card-game");
  if (!root) return;

  const DEFAULT_PLAYERS = [
    {
      id: 1,
      name: "Leadoff Spark",
      contact: 78,
      power: 42,
      fielding: 74,
      speed: 86,
      trait: "Table Setter",
      traitText: "+8 single chance with empty bases"
    },
    {
      id: 2,
      name: "Gap Hunter",
      contact: 72,
      power: 58,
      fielding: 65,
      speed: 68,
      trait: "Rally Bat",
      traitText: "+10 double chance with runners on"
    },
    {
      id: 3,
      name: "Cleanup Crusher",
      contact: 64,
      power: 92,
      fielding: 56,
      speed: 42,
      trait: "Moonshot",
      traitText: "+12 HR chance with Power Swing"
    },
    {
      id: 4,
      name: "Patient Vet",
      contact: 66,
      power: 48,
      fielding: 88,
      speed: 39,
      trait: "Professional AB",
      traitText: "+10 walk chance"
    },
    {
      id: 5,
      name: "Speed Demon",
      contact: 61,
      power: 35,
      fielding: 52,
      speed: 95,
      trait: "Pressure",
      traitText: "Singles can stretch harder"
    },
    {
      id: 6,
      name: "Pull Power",
      contact: 57,
      power: 84,
      fielding: 46,
      speed: 41,
      trait: "Dead Red",
      traitText: "+8 HR chance first pitch style swings"
    }
  ];

  const PLAYERS = Array.isArray(window.BASEBALL_CARD_PLAYERS) && window.BASEBALL_CARD_PLAYERS.length
    ? window.BASEBALL_CARD_PLAYERS
    : DEFAULT_PLAYERS;

  const DRAFT_POOL_SIZE = 10;

  const DRAFT_TIER_WEIGHTS = {
  Common: 50,
  Uncommon: 27,
  Rare: 15,
  Epic: 7,
  Legendary: 1
};

const LEGENDARY_PITY_START = 5;
const LEGENDARY_PITY_CAP = 8;

const POWERUPS = [
    {
      id: "moneyball",
      name: "Moneyball",
      desc: "+8 walk chance for every hitter",
      modifyWeights: function (weights) {
        weights.walk += 6;
      }
    },
    {
      id: "launch-angle",
      name: "Launch Angle Revolution",
      desc: "+10 HR chance, -6 single chance",
      modifyWeights: function (weights) {
        weights.homer += 7;
        weights.single -= 4;
      }
    },
    {
      id: "small-ball",
      name: "Small Ball",
      desc: "+10 single chance, singles push runners harder",
      modifyWeights: function (weights) {
        weights.single += 6;
        weights.double += 1;
      }
    },
    {
      id: "green-light",
      name: "Green Light",
      desc: "+speed pressure, extra triples and singles",
      modifyWeights: function (weights, context) {
        weights.single += 3;
        weights.triple += 3;
        if (context.player && context.player.speed >= 80) {
          weights.double += 2;
        }
      }
    },
    {
      id: "two-strike",
      name: "Two-Strike Approach",
      desc: "Fewer strikeouts, more contact",
      modifyWeights: function (weights) {
        weights.strikeout -= 8;
        weights.single += 4;
        weights.walk += 2;
      }
    },
    {
      id: "gap-hunting",
      name: "Gap Hunting",
      desc: "Extra doubles and triples into the alleys",
      modifyWeights: function (weights) {
        weights.double += 6;
        weights.triple += 1.5;
        weights.homer -= 2;
      }
    },
    {
      id: "rally-time",
      name: "Rally Time",
      desc: "Big boost with runners on base",
      modifyWeights: function (weights, context) {
        if (context.bases[0] || context.bases[1] || context.bases[2]) {
          weights.single += 4;
          weights.double += 3;
          weights.homer += 5;
        }
      }
    },
    {
      id: "first-pitch",
      name: "First Pitch Hunter",
      desc: "Aggressive ambush power",
      modifyWeights: function (weights, context) {
        if (context.modifierId === "aggressive") {
          weights.homer += 10;
          weights.strikeout += 4;
        } else {
          weights.homer += 4;
        }
      }
    }
  ];

  const MODIFIERS = [
    {
      id: "normal",
      name: "Balanced Swing",
      desc: "Steady approach"
    },
    {
      id: "aggressive",
      name: "Power Swing",
      desc: "+12 HR, +8 strikeout, -8 walk"
    },
    {
      id: "patient",
      name: "Patient Approach",
      desc: "+12 walk, +6 single, -10 HR"
    },
    {
      id: "bunt",
      name: "Bunt",
      desc: "Sacrifice style play"
    }
  ];

  const state = {
    draftPool: [],
    lineupSlots: Array.from({ length: 6 }, function () {
      return { playerId: null, powerupId: null };
    }),
    selectedAssignPowerupId: null,
    runsWithoutLegendary: 0,
    buildModalScrollTop: 0,
    isBuildModalOpen: true,
    currentView: "build",
    buildScreen: "draft",
    gameStarted: false,
    inning: 1,
    outs: 0,
    arcadeScore: 0,
    score: 0,
    enemyScore: 0,
    bases: [false, false, false],
    batterIndex: 0,
    arcadeCombo: 0,
    runStats: {},
    gameStats: {},
    modifier: "normal",
    log: ["Draft up to 6 hitters and assign gamebreakers under each card."],
    lastOutcome: null,
    teamName: "Indians",
    matchup: "Game 2 vs Dodgers",
    opponentName: "Clayton Kershaw",
    opponentStatLine: "3.45 ERA / 23 K",
    opponentToday: "3 ER, 4 K Today",
    draftPackLabel: "Standard Pack"
  };

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function getTierWeightTable() {
    const weights = {
      Common: DRAFT_TIER_WEIGHTS.Common,
      Uncommon: DRAFT_TIER_WEIGHTS.Uncommon,
      Rare: DRAFT_TIER_WEIGHTS.Rare,
      Epic: DRAFT_TIER_WEIGHTS.Epic,
      Legendary: DRAFT_TIER_WEIGHTS.Legendary
    };

    const runsWithoutLegendary = state.runsWithoutLegendary || 0;

    if (runsWithoutLegendary >= LEGENDARY_PITY_START) {
      const pitySteps = Math.min(
        runsWithoutLegendary - LEGENDARY_PITY_START + 1,
        LEGENDARY_PITY_CAP - LEGENDARY_PITY_START + 1
      );

      weights.Legendary += pitySteps * 2;
      weights.Common = Math.max(34, weights.Common - pitySteps);
      weights.Uncommon = Math.max(18, weights.Uncommon - pitySteps);
    }

    return weights;
  }

function getPlayersByTier() {
  const buckets = {
    Common: [],
    Uncommon: [],
    Rare: [],
    Epic: [],
    Legendary: []
  };

  for (let i = 0; i < PLAYERS.length; i++) {
    const player = PLAYERS[i];
    const tier = getPlayerRarity(player);
    if (!buckets[tier]) buckets[tier] = [];
    buckets[tier].push(player);
  }

  return buckets;
}

function pickTierFromWeights(weights, availableBuckets) {
  const weighted = [];
  const order = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];

  for (let i = 0; i < order.length; i++) {
    const tier = order[i];
    if (availableBuckets[tier] && availableBuckets[tier].length) {
      weighted.push({ key: tier, weight: weights[tier] || 0 });
    }
  }

  if (!weighted.length) return null;
  return pickWeighted(weighted);
}

function removeRandomPlayerFromBucket(bucket) {
  if (!bucket || !bucket.length) return null;
  const index = Math.floor(Math.random() * bucket.length);
  const picked = bucket[index];
  bucket.splice(index, 1);
  return picked;
}

function buildDraftPool() {
  const buckets = getPlayersByTier();
  const weights = getTierWeightTable();
  const pack = [];

  for (let i = 0; i < DRAFT_POOL_SIZE; i++) {
    const tier = pickTierFromWeights(weights, buckets);
    if (!tier) break;

    const player = removeRandomPlayerFromBucket(buckets[tier]);
    if (!player) continue;
    pack.push(player);
  }

  return shuffle(pack);
}

function updateLegendaryDraftState() {
  let hasLegendary = false;

  for (let i = 0; i < state.draftPool.length; i++) {
    if (getPlayerRarity(state.draftPool[i]) === "Legendary") {
      hasLegendary = true;
      break;
    }
  }

  if (hasLegendary) {
    state.runsWithoutLegendary = 0;
  } else {
    state.runsWithoutLegendary += 1;
  }
}

  function getArcadePoints(result, runs, combo) {
    let points = 0;
    let label = "";
    const runCount = runs || 0;
    const comboCount = combo || 0;

    if (result === "walk") {
      points = 75;
      label = "Walk Bonus";
    } else if (result === "single") {
      points = 125;
      label = "Single";
    } else if (result === "double") {
      points = 225;
      label = "Double";
    } else if (result === "triple") {
      points = 350;
      label = "Triple";
    } else if (result === "homer") {
      points = 500;
      label = runCount === 4 ? "Grand Slam" : runCount === 3 ? "3-Run Home Run" : runCount === 2 ? "2-Run Home Run" : "Solo Home Run";
    } else if (result === "strikeout") {
      points = 25;
      label = "Strikeout";
    } else if (result === "out") {
      points = 50;
      label = "Out";
    }

    const runBonus = runCount * 150;
    let comboBonus = 0;

    if (comboCount >= 2 && (result === "single" || result === "double" || result === "triple" || result === "homer" || result === "walk")) {
      comboBonus = comboCount * 40;
    }

    if (result === "double" || result === "triple" || result === "homer") {
      comboBonus += 35;
    }

    if (runCount >= 2) {
      comboBonus += runCount * 50;
    }

    return {
      total: points + runBonus + comboBonus,
      base: points,
      runBonus: runBonus,
      comboBonus: comboBonus,
      label: label
    };
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function pickWeighted(weights) {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i].weight;
    let roll = Math.random() * total;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i].weight;
      if (roll <= 0) return weights[i].key;
    }
    return weights[weights.length - 1].key;
  }

  function getPlayerById(id) {
    return PLAYERS.find(function (player) {
      return player.id === id;
    }) || null;
  }

  function getPowerupById(id) {
    return POWERUPS.find(function (powerup) {
      return powerup.id === id;
    }) || null;
  }

    function createEmptyPlayerStats() {
    return {
      atBats: 0,
      hits: 0,
      singles: 0,
      doubles: 0,
      triples: 0,
      homeRuns: 0,
      walks: 0,
      strikeouts: 0,
      outs: 0,
      rbi: 0
    };
  }

  function ensurePlayerStats(store, playerId) {
    if (!store[playerId]) {
      store[playerId] = createEmptyPlayerStats();
    }
    return store[playerId];
  }

  function updatePlayerStatsForResult(playerId, result, rbi) {
    const stores = [
      ensurePlayerStats(state.runStats, playerId),
      ensurePlayerStats(state.gameStats, playerId)
    ];

    for (let i = 0; i < stores.length; i++) {
      const stats = stores[i];
      stats.rbi += rbi || 0;

      if (result === "walk") {
        stats.walks += 1;
        continue;
      }

      stats.atBats += 1;

      if (result === "single") {
        stats.hits += 1;
        stats.singles += 1;
      } else if (result === "double") {
        stats.hits += 1;
        stats.doubles += 1;
      } else if (result === "triple") {
        stats.hits += 1;
        stats.triples += 1;
      } else if (result === "homer") {
        stats.hits += 1;
        stats.homeRuns += 1;
      } else if (result === "strikeout") {
        stats.strikeouts += 1;
        stats.outs += 1;
      } else if (result === "out") {
        stats.outs += 1;
      }
    }
  }

  function getRunStatsForPlayer(playerId) {
    return ensurePlayerStats(state.runStats, playerId);
  }

  function getGameStatsForPlayer(playerId) {
    return ensurePlayerStats(state.gameStats, playerId);
  }

  function formatAvg(stats) {
    if (!stats.atBats) return ".000";
    return "." + String(Math.round((stats.hits / stats.atBats) * 1000)).padStart(3, "0");
  }

  function formatRunStatLine(playerId) {
    const stats = getRunStatsForPlayer(playerId);
    return formatAvg(stats) + " AVG / " + stats.rbi + " RBI";
  }

  function formatGameStatLine(playerId) {
    const stats = getGameStatsForPlayer(playerId);
    const parts = [];

    if (stats.singles) parts.push(stats.singles + " 1B");
    if (stats.doubles) parts.push(stats.doubles + " 2B");
    if (stats.triples) parts.push(stats.triples + " 3B");
    if (stats.homeRuns) parts.push(stats.homeRuns + " HR");
    if (stats.walks) parts.push(stats.walks + " BB");
    if (stats.strikeouts) parts.push(stats.strikeouts + " K");
    if (stats.rbi) parts.push(stats.rbi + " RBI");

    if (!parts.length) return "No game stats yet";
    return parts.join(" • ");
  }

  function lineupPlayers() {
    return state.lineupSlots
      .map(function (slot, slotIndex) {
        if (!slot.playerId) return null;
        const player = getPlayerById(slot.playerId);
        if (!player) return null;
        return {
          slotIndex: slotIndex,
          player: player,
          powerupId: slot.powerupId || null
        };
      })
      .filter(Boolean);
  }

  function currentBatter() {
    const players = lineupPlayers();
    if (!players.length) return null;
    return players[state.batterIndex % players.length].player;
  }

  function buildOutcomeWeights(player, modifierId, bases, inning) {
    const hitting = getHittingStat(player);
    const speed = getSpeedStat(player);

    let walk = 5;
    let single = 18 + (hitting - 50) * 0.14;
    let double = 6 + hitting * 0.045 + speed * 0.015;
    let triple = 1 + speed * 0.035;
    let homer = 2.5 + (player.power - 50) * 0.16 + (hitting - 50) * 0.04;
    let strikeout = 24 - (hitting - 50) * 0.11;
    let out = 36;

    const runnersOn = bases[0] || bases[1] || bases[2];
    const basesEmpty = !bases[0] && !bases[1] && !bases[2];

    if (player.trait === "Table Setter" && basesEmpty) single += 5;
    if (player.trait === "Rally Bat" && runnersOn) double += 6;
    if (player.trait === "Professional AB") {
      walk += 5;
      strikeout -= 3;
      single += 2;
    }
    if (player.trait === "Pressure") {
      single += 5;
      triple += 3;
    }
    if (player.trait === "Dead Red" && modifierId === "aggressive") homer += 8;
    if (player.trait === "Moonshot" && modifierId === "aggressive") homer += 12;

    if (modifierId === "aggressive") {
      homer += 8;
      strikeout += 10;
      walk -= 6;
      single -= 3;
    }

    if (modifierId === "patient") {
      walk += 10;
      single += 4;
      homer -= 8;
      strikeout -= 4;
    }

    if (modifierId === "bunt") {
      single = 7;
      double = 0.5;
      triple = 0.2;
      homer = 0;
      walk = 2;
      strikeout = 6;
      out = 48;
    }

    const activePowerup = getCurrentBatterPowerup();
    if (activePowerup && typeof activePowerup.modifyWeights === "function") {
      const weightState = {
        walk: walk,
        single: single,
        double: double,
        triple: triple,
        homer: homer,
        strikeout: strikeout,
        out: out
      };

      activePowerup.modifyWeights(weightState, {
        player: player,
        modifierId: modifierId,
        bases: bases,
        inning: inning
      });

      walk = weightState.walk;
      single = weightState.single;
      double = weightState.double;
      triple = weightState.triple;
      homer = weightState.homer;
      strikeout = weightState.strikeout;
      out = weightState.out;
    }

    if (inning >= 8 && runnersOn) {
      single += 2;
      homer += 2;
    }

    walk = clamp(walk, 1, 28);
    single = clamp(single, 1, 32);
    double = clamp(double, 0.5, 16);
    triple = clamp(triple, 0.2, 6);
    homer = clamp(homer, 0.2, 18);
    strikeout = clamp(strikeout, 8, 42);
    out = clamp(out, 18, 52);

    return [
      { key: "walk", weight: walk },
      { key: "single", weight: single },
      { key: "double", weight: double },
      { key: "triple", weight: triple },
      { key: "homer", weight: homer },
      { key: "strikeout", weight: strikeout },
      { key: "out", weight: out }
    ];
  }

  function advanceRunners(bases, result) {
    let first = bases[0];
    let second = bases[1];
    let third = bases[2];
    let runs = 0;
    let text = "";

    const smallBallBoost = hasPowerup("small-ball");

    if (result === "walk") {
      const loaded = first && second && third;
      if (loaded) runs += 1;
      third = third || second;
      second = loaded ? true : (second || first);
      first = true;
      text = "Walk";
      return { bases: [first, second, third], runs: runs, text: text };
    }

    if (result === "single") {
      const hadFirst = first;
      const hadSecond = second;
      const hadThird = third;

      if (hadThird) runs += 1;
      if (hadSecond && smallBallBoost) runs += 1;

      first = true;
      second = hadFirst;
      third = hadSecond && !smallBallBoost;

      text = smallBallBoost ? "Single — pressure on the bases" : "Single";
      return { bases: [first, second, third], runs: runs, text: text };
    }

    if (result === "double") {
      const hadFirst = first;
      const hadSecond = second;
      const hadThird = third;

      if (hadThird) runs += 1;
      if (hadSecond) runs += 1;

      first = false;
      second = true;
      third = hadFirst;

      text = hadFirst ? "Double — runner to third" : "Double";
      return { bases: [first, second, third], runs: runs, text: text };
    }

    if (result === "triple") {
      runs += (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0);
      first = false;
      second = false;
      third = true;
      text = "Triple";
      return { bases: [first, second, third], runs: runs, text: text };
    }

    if (result === "homer") {
      runs += (first ? 1 : 0) + (second ? 1 : 0) + (third ? 1 : 0) + 1;
      first = false;
      second = false;
      third = false;

      if (runs === 1) text = "Solo Home Run";
      else if (runs === 2) text = "2-Run Home Run";
      else if (runs === 3) text = "3-Run Home Run";
      else text = "Grand Slam";

      return { bases: [first, second, third], runs: runs, text: text };
    }

    if (result === "out") {
      text = "Ball in play — out";
      return { bases: [first, second, third], runs: 0, text: text };
    }

    if (result === "strikeout") {
      text = "Strikeout";
      return { bases: [first, second, third], runs: 0, text: text };
    }

    return { bases: [first, second, third], runs: 0, text: "Out" };
  }

  function getHittingStat(player) {
    if (typeof player.hitting === "number") return player.hitting;
    return Math.round((player.contact * 0.55) + (player.power * 0.45));
  }

  function getSpeedStat(player) {
    return typeof player.speed === "number" ? player.speed : 50;
  }

  function getFieldingStat(player) {
    if (typeof player.fielding === "number") return player.fielding;
    if (typeof player.defense === "number") return player.defense;
    return 50;
  }

  function getOverall(player) {
    return Math.round((getHittingStat(player) + getSpeedStat(player) + getFieldingStat(player)) / 3);
  }

  function getLineupDefenseRating() {
    const players = lineupPlayers();
    if (!players.length) return 50;

    let total = 0;
    for (let i = 0; i < players.length; i++) {
      total += getFieldingStat(players[i].player);
    }
    return Math.round(total / players.length);
  }

  function getOpponentRunsForHalfInning() {
    const defense = getLineupDefenseRating();
    const defenseMod = (defense - 50) / 50;
    const roll = Math.random();

    let chance0 = 0.42 + (defenseMod * 0.14);
    let chance1 = 0.34 - (defenseMod * 0.06);
    let chance2 = 0.17 - (defenseMod * 0.05);
    let chance3 = 0.06 - (defenseMod * 0.02);
    let chance4 = 0.01 - (defenseMod * 0.01);

    chance0 = clamp(chance0, 0.18, 0.72);
    chance1 = clamp(chance1, 0.14, 0.42);
    chance2 = clamp(chance2, 0.04, 0.24);
    chance3 = clamp(chance3, 0.01, 0.12);
    chance4 = clamp(chance4, 0, 0.04);

    const total = chance0 + chance1 + chance2 + chance3 + chance4;
    chance0 /= total;
    chance1 /= total;
    chance2 /= total;
    chance3 /= total;
    chance4 /= total;

    if (roll < chance0) return 0;
    if (roll < chance0 + chance1) return 1;
    if (roll < chance0 + chance1 + chance2) return 2;
    if (roll < chance0 + chance1 + chance2 + chance3) return 3;
    return 4;
  }

  function getPlayerRarity(player) {
    if (player && typeof player.tier === "string" && player.tier.trim()) {
      return player.tier.trim();
    }

    const overall = getOverall(player);
    if (overall >= 68) return "Legendary";
    if (overall >= 62) return "Rare";
    return "Common";
  }

  function getPlayerArtClass(player) {
    if (player.power >= 80) return "is-slugger";
    if (getSpeedStat(player) >= 85) return "is-speed";
    if (getHittingStat(player) >= 75) return "is-contact";
    return "is-balanced";
  }

  function statPips(value) {
    const filled = Math.max(1, Math.min(5, Math.round(value / 20)));
    let html = "";
    for (let i = 0; i < 5; i++) {
      html += '<span class="bbg-pip ' + (i < filled ? 'is-on' : '') + '"></span>';
    }
    return html;
  }

  function getPlayerImageStyle(player) {
    if (!player || !player.image) return "";
    return "background-image:url('" + player.image + "');background-size:cover;background-position:center;";
  }

  function currentPitcherChallenge() {
    if (hasPowerup("launch-angle")) return "Fastball Elevated";
    if (hasPowerup("moneyball")) return "Working The Count";
    if (hasPowerup("small-ball")) return "Infield In";
    return "Standard Delivery";
  }

  function currentBatterPowerupId() {
    const players = lineupPlayers();
    if (!players.length) return null;
    const active = players[state.batterIndex % players.length];
    return active ? active.powerupId : null;
  }

  function getCurrentBatterPowerup() {
    const powerupId = currentBatterPowerupId();
    return powerupId ? getPowerupById(powerupId) : null;
  }

  function hasPowerup(id) {
    return currentBatterPowerupId() === id;
  }

  function currentLineupSlot() {
    const players = lineupPlayers();
    if (!players.length) return -1;
    return players[state.batterIndex % players.length].slotIndex;
  }

  function basesText() {
    const active = [];
    if (state.bases[0]) active.push("1B");
    if (state.bases[1]) active.push("2B");
    if (state.bases[2]) active.push("3B");
    return active.length ? active.join(" • ") : "Bases Empty";
  }

  function assignedPowerupCount() {
    return state.lineupSlots.filter(function (slot) {
      return !!slot.powerupId;
    }).length;
  }

  function powerupAssignedToAnotherSlot(powerupId, slotIndex) {
    return state.lineupSlots.some(function (slot, index) {
      return index !== slotIndex && slot.powerupId === powerupId;
    });
  }

  function assignSelectedPowerupToSlot(slotIndex) {
    const slot = state.lineupSlots[slotIndex];
    if (!slot || !slot.playerId || !state.selectedAssignPowerupId) return;
    if (powerupAssignedToAnotherSlot(state.selectedAssignPowerupId, slotIndex)) return;
    slot.powerupId = state.selectedAssignPowerupId;
    state.selectedAssignPowerupId = null;
  }

  function clearPowerupFromSlot(slotIndex) {
    const slot = state.lineupSlots[slotIndex];
    if (!slot) return;
    slot.powerupId = null;
  }

    function switchBuildScreen(screen) {
  if (screen === "assign" && lineupPlayers().length < 6) return;
  state.buildScreen = screen;
  render();
}

function goToGamebreakerStep() {
  if (lineupPlayers().length < 6) return;
  state.buildScreen = "assign";
  state.draftPool = [];
  render();
}

  function selectedPowerupAssignedSlotIndex() {
    if (!state.selectedAssignPowerupId) return -1;
    return state.lineupSlots.findIndex(function (slot) {
      return slot.powerupId === state.selectedAssignPowerupId;
    });
  }

    function openBuildModal() {
  state.isBuildModalOpen = true;
  render();
}

  function closeBuildModal() {
  const modal = root.querySelector('.bbg-build-modal');
  if (modal) {
    state.buildModalScrollTop = modal.scrollTop || 0;
  }
  state.isBuildModalOpen = false;
  render();
}


  function baseEmoji(on) {
    return on ? "🟦" : "⬜";
  }

  function renderScorebugTeams() {
    return (
      '<div class="bbg-scorebug-teams">' +
        '<div class="bbg-scorebug-team-row">' +
          '<div class="bbg-scorebug-logo">CLE</div>' +
          '<div class="bbg-scorebug-team-score">' + state.score + '</div>' +
        '</div>' +
        '<div class="bbg-scorebug-team-row">' +
          '<div class="bbg-scorebug-logo">LA</div>' +
          '<div class="bbg-scorebug-team-score">' + state.enemyScore + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderScorebugInning() {
    const isFinal = state.inning > 9;
    const inningLabel = isFinal ? 'F' : state.inning;

    return (
        '<div class="bbg-scorebug-inning">' +
            '<div class="bbg-scorebug-arrow ' + (isFinal ? 'is-muted' : 'is-active') + '">▲</div>' +
            '<div class="bbg-scorebug-inning-value">' + inningLabel + '</div>' +
            '<div class="bbg-scorebug-arrow is-muted">▼</div>' +
        '</div>'
    );
  }

  function renderScorebugBases() {
    return (
      '<div class="bbg-scorebug-bases">' +
        '<div class="bbg-scorebug-base bbg-scorebug-base-2 ' + (state.bases[1] ? 'is-on' : '') + '"></div>' +
        '<div class="bbg-scorebug-base bbg-scorebug-base-3 ' + (state.bases[2] ? 'is-on' : '') + '"></div>' +
        '<div class="bbg-scorebug-base bbg-scorebug-base-1 ' + (state.bases[0] ? 'is-on' : '') + '"></div>' +
      '</div>'
    );
  }

  function renderScorebugOuts() {
    let html = '';
    for (let i = 0; i < 3; i++) {
      html += '<span class="bbg-scorebug-out ' + (i < state.outs ? 'is-on' : '') + '"></span>';
    }
    return '<div class="bbg-scorebug-outs">' + html + '</div>';
  }

  function renderScorebug() {
    return (
      '<div class="bbg-scorebug">' +
        renderScorebugTeams() +
        '<div class="bbg-scorebug-state">' +
          renderScorebugInning() +
          '<div class="bbg-scorebug-diamond-wrap">' +
            renderScorebugBases() +
            renderScorebugOuts() +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function resetRun() {
    state.draftPool = buildDraftPool();
    updateLegendaryDraftState();
    state.lineupSlots = Array.from({ length: 6 }, function () {
      return { playerId: null, powerupId: null };
    });
    state.selectedAssignPowerupId = null;
    state.isBuildModalOpen = true;
    state.currentView = "build";
    state.buildScreen = "draft";
    state.gameStarted = false;
    state.inning = 1;
    state.outs = 0;
    state.arcadeScore = 0;
    state.score = 0;
    state.enemyScore = 0;
    state.bases = [false, false, false];
    state.batterIndex = 0;
    state.arcadeCombo = 0;
    state.runStats = {};
    state.gameStats = {};
    state.modifier = "normal";
    state.log = ["New run started. Opened a 10-card draft pack. Draft up to 6 hitters and assign gamebreakers under each card."];
    state.lastOutcome = null;
    render();
  }

  function addLog(text) {
    state.log.unshift(text);
    if (state.log.length > 14) state.log.length = 14;
  }

  function addToLineup(playerId) {
    const alreadyInLineup = state.lineupSlots.some(function (slot) {
      return slot.playerId === playerId;
    });
    if (alreadyInLineup) return;

    const emptySlot = state.lineupSlots.find(function (slot) {
      return !slot.playerId;
    });
    if (!emptySlot) return;

    emptySlot.playerId = playerId;

const modal = root.querySelector('.bbg-build-modal');
if (modal) {
  state.buildModalScrollTop = modal.scrollTop || 0;
}
render();
  }

  function togglePowerup(id) {
  state.selectedAssignPowerupId = state.selectedAssignPowerupId === id ? null : id;
  const modal = root.querySelector('.bbg-build-modal');
  if (modal) {
    state.buildModalScrollTop = modal.scrollTop || 0;
  }
  render();
}

  function startGame() {
    if (lineupPlayers().length < 6) return;
    state.gameStarted = true;
    state.currentView = "play";
    addLog("Game start. Top 1st.");
    render();
  }

  function nextInning() {
    const opponentRuns = getOpponentRunsForHalfInning();
    const defense = getLineupDefenseRating();

    state.enemyScore += opponentRuns;
    addLog("Bottom " + state.inning + ": opponent scores " + opponentRuns + ". Team fielding " + defense + ".");
    state.inning += 1;
    state.outs = 0;
    state.bases = [false, false, false];
    state.lastOutcome = null;
  }

  function takeAtBat() {
    if (!state.gameStarted) return;
    if (state.inning > 9) return;

    const batter = currentBatter();
    if (!batter) return;

    const weights = buildOutcomeWeights(batter, state.modifier, state.bases, state.inning);
    const result = pickWeighted(weights);
    const advanced = advanceRunners(state.bases, result);

    if (state.modifier === "bunt" && result === "out") {
      const first = state.bases[0];
      const second = state.bases[1];
      const third = state.bases[2];
      state.bases = [false, first, second || third];
    } else {
      state.bases = advanced.bases;
    }

    const isPositiveOutcome = result === "walk" || result === "single" || result === "double" || result === "triple" || result === "homer";
    if (isPositiveOutcome) {
      state.arcadeCombo += 1;
    } else {
      state.arcadeCombo = 0;
    }

    const arcadePoints = getArcadePoints(result, advanced.runs, state.arcadeCombo);

    state.score += advanced.runs;
    state.arcadeScore += arcadePoints.total;

    if (result === "out" || result === "strikeout") {
      state.outs += 1;
    }

    state.batterIndex += 1;
    state.lastOutcome = {
      batter: batter.name,
      text: advanced.text,
      runs: advanced.runs,
      points: arcadePoints.total,
      combo: state.arcadeCombo,
      pointsLabel: arcadePoints.label,
      pointsBreakdown: arcadePoints
    };
    updatePlayerStatsForResult(batter.id, result, advanced.runs);

    addLog(
      batter.name +
        ": " +
        advanced.text +
        (advanced.runs > 0 ? " +" + advanced.runs + " run" + (advanced.runs > 1 ? "s" : "") : "") +
        " • " + arcadePoints.total + " pts" +
        (arcadePoints.comboBonus > 0 ? " • combo bonus" : "")
    );

    if (state.outs >= 3) {
      nextInning();
    }

    render();
  }

  function renderDraftPool() {
  return state.draftPool
    .filter(function (player) {
      return !state.lineupSlots.some(function (slot) {
        return slot.playerId === player.id;
      });
    })
    .map(function (player) {
      const overall = getOverall(player);
      const rarity = getPlayerRarity(player);
      const artClass = getPlayerArtClass(player);

      return (
        '<button class="bbg-draft-card bbg-rarity-' + rarity.toLowerCase() + '" data-action="draft" data-id="' + player.id + '"' +
          (lineupPlayers().length >= 6 ? ' disabled' : '') +
        '>' +
          '<div class="bbg-draft-card-inner">' +
            '<div class="bbg-player-art ' + artClass + '" style="' + getPlayerImageStyle(player) + '">' +
              '<div class="bbg-player-image-badge">' + rarity + '</div>' +
              '<div class="bbg-player-ovr-badge">' + overall + '</div>' +
            '</div>' +
            '<div class="bbg-player-info">' +
              '<div class="bbg-player-board-name">' + player.name + '</div>' +
              '<div class="bbg-player-pips">' +
                '<div class="bbg-pip-row"><span>HIT</span><div>' + statPips(getHittingStat(player)) + '</div></div>' +
                '<div class="bbg-pip-row"><span>SPD</span><div>' + statPips(getSpeedStat(player)) + '</div></div>' +
                '<div class="bbg-pip-row"><span>FLD</span><div>' + statPips(getFieldingStat(player)) + '</div></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</button>'
      );
    })
    .join("");
}

  function renderPowerups() {
    return POWERUPS
      .map(function (powerup) {
        const selected = state.selectedAssignPowerupId === powerup.id;
        const assigned = state.lineupSlots.some(function (slot) {
          return slot.powerupId === powerup.id;
        });
        return (
          '<button class="bbg-perk-card ' + (selected ? 'is-active' : '') + (assigned ? ' is-assigned' : '') + '" data-action="powerup" data-id="' + powerup.id + '">' +
            '<div class="bbg-perk-rarity">Gamebreaker</div>' +
            '<div class="bbg-perk-name">' + powerup.name + '</div>' +
            '<div class="bbg-perk-desc">' + powerup.desc + '</div>' +
            '<div class="bbg-perk-desc">' + (assigned ? 'Assigned' : selected ? 'Selected — click a slot below a player' : 'Available') + '</div>' +
          '</button>'
        );
      })
      .join("");
  }

  function renderLineup() {
    let html = '';
    const activeSlot = currentLineupSlot();

    for (let i = 0; i < 6; i++) {
      const slot = state.lineupSlots[i];
      const player = slot.playerId ? getPlayerById(slot.playerId) : null;
      const powerup = slot.powerupId ? getPowerupById(slot.powerupId) : null;

      if (!player) {
        html += (
          '<div class="bbg-board-slot is-empty">' +
            '<div class="bbg-empty-plus">+</div>' +
          '</div>' +
          '<button class="bbg-power-slot is-empty" data-action="assign-powerup-slot" data-slot-index="' + i + '" disabled>' +
            '<div class="bbg-empty-plus">+</div>' +
          '</button>'
        );
        continue;
      }

      const rarity = getPlayerRarity(player);
      const artClass = getPlayerArtClass(player);
      const isActive = state.gameStarted && !(state.inning > 9) && i === activeSlot;

      html += (
        '<div class="bbg-board-slot bbg-rarity-' + rarity.toLowerCase() + (isActive ? ' is-active' : '') + '">' +
          '<div class="bbg-player-board-card">' +
            '<div class="bbg-player-art ' + artClass + '" style="' + getPlayerImageStyle(player) + '">' +
              '<div class="bbg-player-image-badge">' + rarity + '</div>' +
              '<div class="bbg-player-ovr-badge">' + getOverall(player) + '</div>' +
            '</div>' +
            '<div class="bbg-player-info">' +
              '<div class="bbg-player-board-name">' + player.name + '</div>' +
              '<div class="bbg-player-pips">' +
                '<div class="bbg-pip-row"><span>HIT</span><div>' + statPips(getHittingStat(player)) + '</div></div>' +
                '<div class="bbg-pip-row"><span>SPD</span><div>' + statPips(getSpeedStat(player)) + '</div></div>' +
                '<div class="bbg-pip-row"><span>FLD</span><div>' + statPips(getFieldingStat(player)) + '</div></div>' +
              '</div>' +
              '<div class="bbg-player-tag">' + (isActive ? 'At Bat • ' + formatRunStatLine(player.id) : formatRunStatLine(player.id)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="bbg-power-slot bbg-rarity-' + rarity.toLowerCase() + (powerup ? ' has-powerup' : '') + (state.selectedAssignPowerupId && state.buildScreen === 'assign' ? ' is-assigning' : '') + '" data-action="assign-powerup-slot" data-slot-index="' + i + '"' + (state.buildScreen === 'assign' ? '' : ' disabled') + '>' +
          (powerup
            ? '<div class="bbg-power-slot-rarity">Attached</div><div class="bbg-power-slot-name">' + powerup.name + '</div><div class="bbg-power-slot-desc">' + powerup.desc + '</div>'
            : '<div class="bbg-power-slot-rarity">Power Up Slot</div><div class="bbg-power-slot-name">' + (state.selectedAssignPowerupId ? 'Click To Attach' : '+') + '</div><div class="bbg-power-slot-desc">' + (state.selectedAssignPowerupId ? 'Assign selected gamebreaker to ' + player.name : 'Select a gamebreaker first') + '</div>') +
        '</button>'
      );
    }

    return html;
  }

  function renderActiveBuild() {
    return POWERUPS
      .slice(0, 3)
      .map(function (powerup) {
        const selected = state.selectedAssignPowerupId === powerup.id;
        const assigned = state.lineupSlots.some(function (slot) {
          return slot.powerupId === powerup.id;
        });
        return (
          '<button class="bbg-perk-card ' + (selected ? 'is-active' : '') + (assigned ? ' is-assigned' : '') + '" data-action="powerup" data-id="' + powerup.id + '">' +
            '<div class="bbg-perk-rarity">Gamebreaker</div>' +
            '<div class="bbg-perk-name">' + powerup.name + '</div>' +
            '<div class="bbg-perk-desc">' + powerup.desc + '</div>' +
            '<div class="bbg-perk-desc">' + (assigned ? 'Assigned' : selected ? 'Selected — click a slot below a player' : 'Available') + '</div>' +
          '</button>'
        );
      })
      .join("");
  }

  function renderLog() {
    return state.log
      .slice(0, 6)
      .map(function (entry) {
        return '<div class="bbg-feed-row">' + entry + '</div>';
      })
      .join("");
  }

  function renderStatsTable() {
  const players = lineupPlayers();

  if (!players.length) {
    return '<div class="bbg-feed-row">No lineup stats yet.</div>';
  }

  let rows = '';

  for (let i = 0; i < players.length; i++) {
    const player = players[i].player;
    const stats = getGameStatsForPlayer(player.id);

    rows += (
      '<tr>' +
        '<td>' + player.name + '</td>' +
        '<td>' + stats.atBats + '</td>' +
        '<td>' + stats.hits + '</td>' +
        '<td>' + stats.rbi + '</td>' +
        '<td>' + stats.walks + '</td>' +
        '<td>' + stats.strikeouts + '</td>' +
        '<td>' + formatAvg(stats) + '</td>' +
      '</tr>'
    );
  }

  return (
    '<div class="bbg-stats-table-wrap">' +
      '<table class="bbg-stats-table">' +
        '<thead>' +
          '<tr>' +
            '<th>Player</th>' +
            '<th>AB</th>' +
            '<th>H</th>' +
            '<th>RBI</th>' +
            '<th>BB</th>' +
            '<th>K</th>' +
            '<th>AVG</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>'
  );
}

    function renderBuildTabs() {
  const lineupFull = lineupPlayers().length >= 6;

  return (
    '<div class="bbg-build-tabs">' +
      '<button class="bbg-build-tab ' + (state.buildScreen === 'draft' ? 'is-active' : '') + '" data-action="switch-build-screen" data-screen="draft">1. Draft Players</button>' +
      '<button class="bbg-build-tab ' + (state.buildScreen === 'assign' ? 'is-active' : '') + '" data-action="switch-build-screen" data-screen="assign"' + (lineupFull ? '' : ' disabled') + '>2. Assign Gamebreakers</button>' +
    '</div>'
  );
}

  function renderBuildScreen() {
  const playerCount = lineupPlayers().length;
  const selectedAssignedSlot = selectedPowerupAssignedSlotIndex();
  const lineupFull = playerCount >= 6;

  if (state.buildScreen === 'assign') {
    return (
      '<div class="bbg-build-panel">' +
        '<div class="bbg-build-panel-header">' +
          '<div class="bbg-build-panel-title">Step 2: Assign Gamebreakers</div>' +
          '<div class="bbg-build-panel-copy">Your lineup is locked in. Select a gamebreaker below, then click the slot beneath a player card to attach it.</div>' +
        '</div>' +
        '<div class="bbg-board-area">' +
          '<div class="bbg-lineup-grid is-setup-grid">' + renderLineup() + '</div>' +
        '</div>' +
        '<div class="bbg-build-panel-footer">' +
          '<div class="bbg-build-panel-copy">' +
            (state.selectedAssignPowerupId
              ? 'Selected gamebreaker: ' + (getPowerupById(state.selectedAssignPowerupId) ? getPowerupById(state.selectedAssignPowerupId).name : '') + (selectedAssignedSlot > -1 ? ' — currently attached to slot ' + (selectedAssignedSlot + 1) : '')
              : 'No gamebreaker selected. Click one in the Gamebreakers panel below.') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  return (
    '<div class="bbg-build-panel">' +
      '<div class="bbg-build-panel-header">' +
        '<div class="bbg-build-panel-title">Step 1: Draft Players</div>' +
        '<div class="bbg-build-panel-copy">Fill all 6 lineup slots from your 10-card draft pack before moving to gamebreakers.</div>' +
      '</div>' +
      '<div class="bbg-board-area">' +
        '<div class="bbg-lineup-grid is-setup-grid">' + renderLineup() + '</div>' +
      '</div>' +
      '<div class="bbg-build-panel-footer">' +
        '<div class="bbg-build-panel-copy">Current lineup: ' + playerCount + ' / 6 players</div>' +
        (lineupFull
          ? '<button class="bbg-btn" data-action="go-to-gamebreaker-step">Continue To Gamebreakers</button>'
          : '<div class="bbg-build-panel-copy">Draft all 6 players to unlock Step 2.</div>') +
      '</div>' +
    '</div>'
  );
}

    function renderBuildSummary() {
  const playerCount = lineupPlayers().length;
  return (
    '<div class="bbg-build-summary">' +
      '<div class="bbg-build-summary-copy">' +
        '<div class="bbg-build-summary-title">Set Lineup</div>' +
        '<div class="bbg-build-summary-text">' + playerCount + ' / 6 players • ' + assignedPowerupCount() + ' gamebreakers attached • ' + (state.buildScreen === 'assign' ? 'Step 2 of 2' : 'Step 1 of 2') + '</div>' +
      '</div>' +
      (state.gameStarted ? '' : '<button class="bbg-btn" data-action="open-build-modal">Edit Lineup</button>') +
    '</div>'
  );
}

  function renderLineupPreview() {
    let html = '';
    const activeSlot = currentLineupSlot();

    for (let i = 0; i < 6; i++) {
      const slot = state.lineupSlots[i];
      const player = slot.playerId ? getPlayerById(slot.playerId) : null;
      const powerup = slot.powerupId ? getPowerupById(slot.powerupId) : null;

      if (!player) {
        html += (
          '<div class="bbg-board-slot is-empty">' +
            '<div class="bbg-empty-plus">+</div>' +
          '</div>' +
          '<div class="bbg-power-slot is-empty">' +
            '<div class="bbg-empty-plus">+</div>' +
          '</div>'
        );
        continue;
      }

      const rarity = getPlayerRarity(player);
      const artClass = getPlayerArtClass(player);
      const isActive = state.gameStarted && !(state.inning > 9) && i === activeSlot;

      html += (
        '<div class="bbg-board-slot bbg-rarity-' + rarity.toLowerCase() + (isActive ? ' is-active' : '') + '">' +
          '<div class="bbg-player-board-card">' +
            '<div class="bbg-player-art ' + artClass + '" style="' + getPlayerImageStyle(player) + '">' +
              '<div class="bbg-player-image-badge">' + rarity + '</div>' +
              '<div class="bbg-player-ovr-badge">' + getOverall(player) + '</div>' +
            '</div>' +
            '<div class="bbg-player-info">' +
              '<div class="bbg-player-board-name">' + player.name + '</div>' +
              '<div class="bbg-player-pips">' +
                '<div class="bbg-pip-row"><span>HIT</span><div>' + statPips(getHittingStat(player)) + '</div></div>' +
                '<div class="bbg-pip-row"><span>SPD</span><div>' + statPips(getSpeedStat(player)) + '</div></div>' +
                '<div class="bbg-pip-row"><span>FLD</span><div>' + statPips(getFieldingStat(player)) + '</div></div>' +
              '</div>' +
                '<div class="bbg-player-tag">' + (isActive ? 'At Bat • ' + formatRunStatLine(player.id) : formatRunStatLine(player.id)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (powerup
  ? '<div class="bbg-power-slot bbg-rarity-' + rarity.toLowerCase() + ' has-powerup"><div class="bbg-power-slot-rarity">Attached</div><div class="bbg-power-slot-name">' + powerup.name + '</div><div class="bbg-power-slot-desc">' + powerup.desc + '</div></div>'
  : '<div class="bbg-power-slot bbg-rarity-' + rarity.toLowerCase() + '"><div class="bbg-power-slot-rarity">Power Up Slot</div><div class="bbg-power-slot-name">+</div><div class="bbg-power-slot-desc">No gamebreaker attached</div></div>')
      );
    }

    return (
      '<div class="bbg-board-area">' +
        '<div class="bbg-lineup-grid is-setup-grid">' + html + '</div>' +
      '</div>'
    );
  }

  function renderBuildModal() {
    if (!state.isBuildModalOpen) return '';

    return (
      '<div class="bbg-build-modal-backdrop" data-action="close-build-modal">' +
        '<div class="bbg-build-modal" data-modal-root="true">' +
          '<div class="bbg-build-modal-top">' +
            '<div>' +
              '<div class="bbg-build-modal-kicker">Build Mode</div>' +
              '<div class="bbg-build-modal-title">Create Your Lineup</div>' +
            '</div>' +
            '<button class="bbg-btn" data-action="close-build-modal">Done</button>' +
          '</div>' +
          renderBuildTabs() +

          (state.buildScreen === 'draft'
            ? '<div class="bbg-build-modal-body is-draft-step">' +
                renderBuildScreen() +
              '</div>' +
              '<div class="bbg-build-modal-bottom">' +
                '<div class="bbg-footer-box">' +
                  '<div class="bbg-lineup-header">Draft Pack • 10 Cards</div>' +
                  '<div class="bbg-build-panel-copy">Legendary cards are rare pulls. Some runs will not have one.</div>' +
                  '<div class="bbg-draft-scroll">' + renderDraftPool() + '</div>' +
                '</div>' +
              '</div>'
            : '<div class="bbg-build-modal-body">' +
                renderBuildScreen() +
                '<div class="bbg-build-modal-side">' +
                  '<div class="bbg-footer-box is-gamebreaker-step">' +
                    '<div class="bbg-lineup-header">Gamebreakers</div>' +
                    '<div class="bbg-build-panel-copy">Your lineup is locked. Assign one gamebreaker per player.</div>' +
                    '<div class="bbg-perk-grid">' + renderActiveBuild() + '</div>' +
                  '</div>' +
                '</div>' +
              '</div>') +

          '<div class="bbg-build-modal-actions">' +
            '<button class="bbg-btn" data-action="close-build-modal">Close Builder</button>' +
            '<button class="bbg-btn bbg-btn-full" data-action="start-game"' + (lineupPlayers().length >= 6 && !state.gameStarted ? '' : ' disabled') + '>Start Game</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderScorePanel() {
    return (
      '<div class="bbg-left-rail">' +
        '<div class="bbg-team-panel">' +
          '<div class="bbg-team-name">' + state.teamName + '</div>' +
          '<div class="bbg-team-matchup">' + state.matchup + '</div>' +
        '</div>' +
        '<div class="bbg-total-score">' +
          '<div class="bbg-total-label">Total Score</div>' +
                    '<div class="bbg-total-value">' + state.arcadeScore.toLocaleString() + '</div>' +
        '</div>' +
        renderScorebug() +
        '<div class="bbg-callout">' +
                    '<div class="bbg-callout-value">' + (state.lastOutcome && typeof state.lastOutcome.points === "number" ? state.lastOutcome.points : '') + '</div>' +
                    '<div class="bbg-callout-text">' + (state.lastOutcome ? state.lastOutcome.batter + ' • ' + state.lastOutcome.text + (state.lastOutcome.combo >= 2 ? ' • Combo x' + state.lastOutcome.combo : '') : !state.gameStarted ? 'Set your lineup to start' : state.outs === 0 ? 'Top ' + state.inning + ' • ' + basesText() : 'Next batter up') + '</div>' +
        '</div>' +
        '<button class="bbg-menu-btn">Buy Packs ($25)</button>' +
        '<button class="bbg-menu-btn">Gamebreakers (' + assignedPowerupCount() + ')</button>' +
        '<button class="bbg-menu-btn">View Box Score</button>' +
        '<div class="bbg-menu-row">' +
          '<button class="bbg-menu-btn is-half">Stats</button>' +
          '<button class="bbg-menu-btn is-half">Options</button>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAtBatPanel() {
    const batter = currentBatter();
    const resultText = state.lastOutcome ? state.lastOutcome.text : 'Spin For Result';
    const batterStats = batter
      ? formatRunStatLine(batter.id)
      : 'Set your lineup to begin';
    const batterToday = batter
      ? formatGameStatLine(batter.id)
      : 'No plate appearance yet';

    return (
      '<div class="bbg-atbat-panel">' +
        '<div class="bbg-atbat-art is-batter" style="' + getPlayerImageStyle(batter) + '"></div>' +
        '<div class="bbg-atbat-center">' +
          '<div class="bbg-atbat-name">' + (batter ? batter.name : 'No Batter') + '</div>' +
          '<div class="bbg-atbat-line">' + batterStats + '</div>' +
          '<div class="bbg-atbat-divider"></div>' +
          '<div class="bbg-atbat-today">' + batterToday + '</div>' +
          '<div class="bbg-status-row">' +
            '<div class="bbg-status-pill">TOP ' + (state.inning > 9 ? 'F' : state.inning) + '</div>' +
            '<div class="bbg-status-pill">OUTS ' + state.outs + '</div>' +
            '<div class="bbg-status-pill">' + basesText() + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bbg-atbat-actions">' +
          '<div class="bbg-count-boxes">' +
            '<div class="bbg-count-box">Spin Mode</div>' +
            '<div class="bbg-count-box">' + currentPitcherChallenge() + '</div>' +
          '</div>' +
          '<button class="bbg-result-btn" data-action="take-at-bat">' + (state.gameStarted ? 'Spin' : lineupPlayers().length >= 6 ? 'Start Run' : 'Set Lineup') + '</button>' +
        '</div>' +
        '<div class="bbg-atbat-right">' +
          '<div class="bbg-atbat-name is-right">' + state.opponentName + '</div>' +
          '<div class="bbg-atbat-line is-right">' + state.opponentStatLine + '</div>' +
          '<div class="bbg-atbat-divider"></div>' +
          '<div class="bbg-atbat-today is-right">' + state.opponentToday + '</div>' +
          '<div class="bbg-pitcher-challenge">' + currentPitcherChallenge() + '</div>' +
        '</div>' +
        '<div class="bbg-atbat-art is-pitcher"></div>' +
      '</div>'
    );
  }

  function render() {
    const gameOver = state.inning > 9;
    const canStart = lineupPlayers().length >= 6;

    root.innerHTML =
      '<div class="bbg-arcade-shell">' +
        renderScorePanel() +
        '<div class="bbg-arcade-main">' +
            renderAtBatPanel() +
            renderBuildSummary() +
        renderLineupPreview() +
          '<div class="bbg-bottom-row">' +
            '<div class="bbg-spin-wrap">' +
              '<button class="bbg-spin-btn" data-action="take-at-bat"' + (gameOver ? ' disabled' : '') + '>' + (state.gameStarted ? 'SPIN' : canStart ? 'START RUN' : 'SET LINEUP') + '</button>' +
            '</div>' +
          '</div>' +
            '<div class="bbg-footer-panels">' +
  '<div class="bbg-footer-box">' +
    '<div class="bbg-lineup-header">Feed</div>' +
    '<div class="bbg-feed">' + renderLog() + '</div>' +
    '<button class="bbg-btn bbg-btn-full" data-action="new-run">New Run</button>' +
  '</div>' +
  '<div class="bbg-footer-box">' +
    '<div class="bbg-lineup-header">Box Score</div>' +
    renderStatsTable() +
  '</div>' +
'</div>' +
          renderBuildModal() +
        '</div>' +
      '</div>';

    bindEvents();

if (state.isBuildModalOpen) {
  const modal = root.querySelector('.bbg-build-modal');
  if (modal) {
    modal.scrollTop = state.buildModalScrollTop || 0;
  }
}
  }

  function bindEvents() {
    const actionEls = root.querySelectorAll("[data-action]");
    for (let i = 0; i < actionEls.length; i++) {
      actionEls[i].addEventListener("click", function (event) {
        const action = this.getAttribute("data-action");
        const id = this.getAttribute("data-id");
        const slotIndex = this.getAttribute("data-slot-index");
        const screen = this.getAttribute("data-screen");
        const isModalRoot = this.getAttribute("data-modal-root");

        if (action === "close-build-modal") {
          if (isModalRoot) return;
          if (this.classList.contains("bbg-build-modal-backdrop") && event.target !== this) return;
          closeBuildModal();
          return;
        }

        if (action === "new-run") resetRun();
        if (action === "switch-build-screen") switchBuildScreen(screen);
        if (action === "go-to-gamebreaker-step") goToGamebreakerStep();
        if (action === "open-build-modal") openBuildModal();
        if (action === "draft") addToLineup(Number(id));
        if (action === "powerup") togglePowerup(id);
        if (action === "assign-powerup-slot") {
  const parsedSlotIndex = Number(slotIndex);
  if (state.selectedAssignPowerupId) {
    assignSelectedPowerupToSlot(parsedSlotIndex);
  } else {
    clearPowerupFromSlot(parsedSlotIndex);
  }
  const modal = root.querySelector('.bbg-build-modal');
  if (modal) {
    state.buildModalScrollTop = modal.scrollTop || 0;
  }
  render();
}
        if (action === "start-game") {
          startGame();
          if (state.gameStarted) closeBuildModal();
        }
        if (action === "modifier") {
          render();
        }
        if (action === "take-at-bat") {
          if (!state.gameStarted) {
            if (lineupPlayers().length >= 6) {
              startGame();
            } else {
              openBuildModal();
            }
            return;
          }
          takeAtBat();
        }
      });
    }
  }

  state.draftPool = buildDraftPool();
  updateLegendaryDraftState();
  render();
})();
