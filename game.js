(function () {
  const root = document.getElementById("card-game");
  if (!root) return;

  const DEFAULT_PLAYERS = [
    {
      id: 1,
      name: "Leadoff Spark",
      contact: 78,
      power: 42,
      discipline: 74,
      speed: 86,
      trait: "Table Setter",
      traitText: "+8 single chance with empty bases"
    },
    {
      id: 2,
      name: "Gap Hunter",
      contact: 72,
      power: 58,
      discipline: 65,
      speed: 68,
      trait: "Rally Bat",
      traitText: "+10 double chance with runners on"
    },
    {
      id: 3,
      name: "Cleanup Crusher",
      contact: 64,
      power: 92,
      discipline: 56,
      speed: 42,
      trait: "Moonshot",
      traitText: "+12 HR chance with Power Swing"
    },
    {
      id: 4,
      name: "Patient Vet",
      contact: 66,
      power: 48,
      discipline: 88,
      speed: 39,
      trait: "Professional AB",
      traitText: "+10 walk chance"
    },
    {
      id: 5,
      name: "Speed Demon",
      contact: 61,
      power: 35,
      discipline: 52,
      speed: 95,
      trait: "Pressure",
      traitText: "Singles can stretch harder"
    },
    {
      id: 6,
      name: "Pull Power",
      contact: 57,
      power: 84,
      discipline: 46,
      speed: 41,
      trait: "Dead Red",
      traitText: "+8 HR chance first pitch style swings"
    }
  ];

  const PLAYERS = Array.isArray(window.BASEBALL_CARD_PLAYERS) && window.BASEBALL_CARD_PLAYERS.length
    ? window.BASEBALL_CARD_PLAYERS
    : DEFAULT_PLAYERS;

  const DRAFT_POOL_SIZE = 12;

  const POWERUPS = [
    {
      id: "moneyball",
      name: "Moneyball",
      desc: "+8 walk chance for every hitter"
    },
    {
      id: "launch-angle",
      name: "Launch Angle Revolution",
      desc: "+10 HR chance, -6 single chance"
    },
    {
      id: "small-ball",
      name: "Small Ball",
      desc: "+10 single chance, singles push runners harder"
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
    draftPool: buildDraftPool(),
    lineupSlots: Array.from({ length: 6 }, function () {
      return { playerId: null, powerupId: null };
    }),
    selectedAssignPowerupId: null,
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
    opponentQueue: [
      { name: "Kike Hernandez", line: "1-1, HR, RBI" },
      { name: "Mookie Betts", line: "0-1" },
      { name: "Shohei Ohtani", line: "BB" }
    ]
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

  function buildDraftPool() {
    return shuffle(PLAYERS.slice()).slice(0, Math.min(DRAFT_POOL_SIZE, PLAYERS.length));
  }

  function getArcadePoints(result, runs) {
    let points = 0;

    if (result === "walk") points = 75;
    else if (result === "single") points = 125;
    else if (result === "double") points = 225;
    else if (result === "triple") points = 350;
    else if (result === "homer") points = 500;
    else if (result === "strikeout") points = 25;
    else if (result === "out") points = 50;

    points += (runs || 0) * 150;
    return points;
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
    let walk = 5 + (player.discipline - 50) * 0.16;
    let single = 18 + (player.contact - 50) * 0.18;
    let double = 6 + player.power * 0.05 + player.contact * 0.03;
    let triple = 1 + player.speed * 0.03;
    let homer = 2.5 + (player.power - 50) * 0.16;
    let strikeout = 24 - (player.contact - 50) * 0.1 - (player.discipline - 50) * 0.04;
    let out = 36;

    const runnersOn = bases[0] || bases[1] || bases[2];
    const basesEmpty = !bases[0] && !bases[1] && !bases[2];

    if (player.trait === "Table Setter" && basesEmpty) single += 5;
    if (player.trait === "Rally Bat" && runnersOn) double += 6;
    if (player.trait === "Professional AB") walk += 7;
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

    if (hasPowerup("moneyball")) walk += 6;
    if (hasPowerup("launch-angle")) {
      homer += 7;
      single -= 4;
    }
    if (hasPowerup("small-ball")) {
      single += 6;
      double += 1;
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

  function getOverall(player) {
    return Math.round((player.contact + player.power + player.discipline + player.speed) / 4);
  }

  function getPlayerRarity(player) {
    const overall = getOverall(player);
    if (overall >= 68) return "Legendary";
    if (overall >= 62) return "Rare";
    return "Common";
  }

  function getPlayerPosition(player, index) {
    const positions = ["INF", "OF", "C", "FLEX"];
    return positions[index] || "UTIL";
  }

  function getPlayerArtClass(player) {
    if (player.power >= 80) return "is-slugger";
    if (player.speed >= 85) return "is-speed";
    if (player.contact >= 75) return "is-contact";
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

  function currentModifierLabel() {
    const found = MODIFIERS.find(function (m) {
      return m.id === state.modifier;
    });
    return found ? found.name : "Balanced Swing";
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
    state.buildScreen = screen;
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
    state.isBuildModalOpen = false;
    render();
  }

  function baseEmoji(on) {
    return on ? "🟦" : "⬜";
  }

  function resetRun() {
    state.draftPool = buildDraftPool();
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
    state.runStats = {};
    state.gameStats = {};
    state.modifier = "normal";
    state.log = ["New run started. Draft up to 6 hitters and assign gamebreakers under each card."];
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
    render();
  }

  function togglePowerup(id) {
    state.selectedAssignPowerupId = state.selectedAssignPowerupId === id ? null : id;
    render();
  }

  function startGame() {
    if (lineupPlayers().length < 4) return;
    state.gameStarted = true;
    state.currentView = "play";
    addLog("Game start. Bottom 1st.");
    render();
  }

  function nextInning() {
    const roll = Math.random();
    let opponentRuns = 0;

    if (roll > 0.65) opponentRuns = 1;
    if (roll > 0.9) opponentRuns = 2;
    if (roll > 0.98) opponentRuns = 3;

    state.enemyScore += opponentRuns;
    addLog("Top " + state.inning + ": opponent scores " + opponentRuns + ".");
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

    state.score += advanced.runs;
    state.arcadeScore += getArcadePoints(result, advanced.runs);

    if (result === "out" || result === "strikeout") {
      state.outs += 1;
    }

        state.batterIndex += 1;
    const arcadePoints = getArcadePoints(result, advanced.runs);
    state.lastOutcome = {
      batter: batter.name,
      text: advanced.text,
      runs: advanced.runs,
      points: arcadePoints
    };
    updatePlayerStatsForResult(batter.id, result, advanced.runs);

    addLog(
      batter.name +
        ": " +
        advanced.text +
        (advanced.runs > 0 ? " +" + advanced.runs + " run" + (advanced.runs > 1 ? "s" : "") : "")
    );

    if (state.outs >= 3) {
      nextInning();
    }

    render();
  }

  function gameResultText() {
    if (state.score > state.enemyScore) return "You win the series opener.";
    if (state.score === state.enemyScore) return "Tie game. Extra innings can come later.";
    return "Tough loss. Reload the roster.";
  }

  function renderDraftPool() {
    return state.draftPool
      .filter(function (player) {
        return !state.lineupSlots.some(function (slot) {
          return slot.playerId === player.id;
        });
      })
      .map(function (player, index) {
        const overall = getOverall(player);
        const rarity = getPlayerRarity(player);
        const position = getPlayerPosition(player, index);

        return (
          '<div class="bbg-draft-tile">' +
            '<div class="bbg-draft-top">' +
              '<div>' +
                '<div class="bbg-draft-name">' + player.name + '</div>' +
                '<div class="bbg-draft-meta">' + rarity + ' • ' + position + '</div>' +
              '</div>' +
              '<button class="bbg-btn" data-action="draft" data-id="' + player.id + '"' +
                (lineupPlayers().length >= 6 ? ' disabled' : '') +
              '>Add To Lineup</button>' +
            '</div>' +
            '<div class="bbg-draft-stats">' +
              '<div class="bbg-draft-stat">CON <strong>' + player.contact + '</strong></div>' +
              '<div class="bbg-draft-stat">POW <strong>' + player.power + '</strong></div>' +
              '<div class="bbg-draft-stat">DIS <strong>' + player.discipline + '</strong></div>' +
              '<div class="bbg-draft-stat">SPD <strong>' + player.speed + '</strong></div>' +
              '<div class="bbg-draft-stat">OVR <strong>' + overall + '</strong></div>' +
            '</div>' +
            '<div class="bbg-draft-trait">' + player.trait + ' — ' + player.traitText + '</div>' +
          '</div>'
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
      const position = getPlayerPosition(player, i);
      const artClass = getPlayerArtClass(player);
      const isActive = state.gameStarted && !(state.inning > 9) && i === activeSlot;

      html += (
        '<div class="bbg-board-slot' + (isActive ? ' is-active' : '') + '">' +
          '<div class="bbg-player-board-card">' +
            '<div class="bbg-player-art ' + artClass + '"></div>' +
            '<div class="bbg-player-info">' +
              '<div class="bbg-player-topline">' +
                '<div class="bbg-player-position">' + position + '</div>' +
                '<div class="bbg-player-rarity">' + rarity + '</div>' +
              '</div>' +
              '<div class="bbg-player-board-name">' + player.name + '</div>' +
              '<div class="bbg-player-pips">' +
                '<div class="bbg-pip-row"><span>CON</span><div>' + statPips(player.contact) + '</div></div>' +
                '<div class="bbg-pip-row"><span>POW</span><div>' + statPips(player.power) + '</div></div>' +
                '<div class="bbg-pip-row"><span>SPD</span><div>' + statPips(player.speed) + '</div></div>' +
              '</div>' +
              '<div class="bbg-player-tag">' + (isActive ? 'At Bat • ' + formatRunStatLine(player.id) : player.trait + ' • ' + formatRunStatLine(player.id)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="bbg-power-slot' + (powerup ? ' has-powerup' : '') + (state.selectedAssignPowerupId ? ' is-assigning' : '') + '" data-action="assign-powerup-slot" data-slot-index="' + i + '">' +
          (powerup
            ? '<div class="bbg-power-slot-rarity">Attached</div><div class="bbg-power-slot-name">' + powerup.name + '</div><div class="bbg-power-slot-desc">' + powerup.desc + '</div>'
            : '<div class="bbg-power-slot-rarity">Power Up Slot</div><div class="bbg-power-slot-name">' + (state.selectedAssignPowerupId ? 'Click To Attach' : '+') + '</div><div class="bbg-power-slot-desc">' + (state.selectedAssignPowerupId ? 'Assign selected gamebreaker to ' + player.name : 'Select a gamebreaker first') + '</div>') +
        '</button>'
      );
    }

    return html;
  }

    function renderModifierButtons() {
    return '';
  }

  function renderActiveBuild() {
    return renderPowerups();
  }

  function renderLog() {
    return state.log
      .slice(0, 6)
      .map(function (entry) {
        return '<div class="bbg-feed-row">' + entry + '</div>';
      })
      .join("");
  }

    function renderBuildTabs() {
    return (
      '<div class="bbg-build-tabs">' +
        '<button class="bbg-build-tab ' + (state.buildScreen === 'draft' ? 'is-active' : '') + '" data-action="switch-build-screen" data-screen="draft">Draft Players</button>' +
        '<button class="bbg-build-tab ' + (state.buildScreen === 'assign' ? 'is-active' : '') + '" data-action="switch-build-screen" data-screen="assign">Assign Gamebreakers</button>' +
      '</div>'
    );
  }

  function renderBuildScreen() {
    const playerCount = lineupPlayers().length;
    const selectedAssignedSlot = selectedPowerupAssignedSlotIndex();

    if (state.buildScreen === 'assign') {
      return (
        '<div class="bbg-build-panel">' +
          '<div class="bbg-build-panel-header">' +
            '<div class="bbg-build-panel-title">Assign Gamebreakers</div>' +
            '<div class="bbg-build-panel-copy">Select a gamebreaker below, then click the slot beneath a player card to attach it.</div>' +
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
          '<div class="bbg-build-panel-title">Draft Players</div>' +
          '<div class="bbg-build-panel-copy">Fill up to 6 lineup slots. You need at least 4 hitters before you can start the run.</div>' +
        '</div>' +
        '<div class="bbg-board-area">' +
          '<div class="bbg-lineup-grid is-setup-grid">' + renderLineup() + '</div>' +
        '</div>' +
        '<div class="bbg-build-panel-footer">' +
          '<div class="bbg-build-panel-copy">Current lineup: ' + playerCount + ' / 6 players</div>' +
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
          '<div class="bbg-build-summary-text">' + playerCount + ' / 6 players • ' + assignedPowerupCount() + ' gamebreakers attached</div>' +
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
      const position = getPlayerPosition(player, i);
      const artClass = getPlayerArtClass(player);
      const isActive = state.gameStarted && !(state.inning > 9) && i === activeSlot;

      html += (
        '<div class="bbg-board-slot' + (isActive ? ' is-active' : '') + '">' +
          '<div class="bbg-player-board-card">' +
            '<div class="bbg-player-art ' + artClass + '"></div>' +
            '<div class="bbg-player-info">' +
              '<div class="bbg-player-topline">' +
                '<div class="bbg-player-position">' + position + '</div>' +
                '<div class="bbg-player-rarity">' + rarity + '</div>' +
              '</div>' +
              '<div class="bbg-player-board-name">' + player.name + '</div>' +
              '<div class="bbg-player-pips">' +
                '<div class="bbg-pip-row"><span>CON</span><div>' + statPips(player.contact) + '</div></div>' +
                '<div class="bbg-pip-row"><span>POW</span><div>' + statPips(player.power) + '</div></div>' +
                '<div class="bbg-pip-row"><span>SPD</span><div>' + statPips(player.speed) + '</div></div>' +
              '</div>' +
                '<div class="bbg-player-tag">' + (isActive ? 'At Bat • ' + formatRunStatLine(player.id) : player.trait + ' • ' + formatRunStatLine(player.id)) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (powerup
          ? '<div class="bbg-power-slot has-powerup"><div class="bbg-power-slot-rarity">Attached</div><div class="bbg-power-slot-name">' + powerup.name + '</div><div class="bbg-power-slot-desc">' + powerup.desc + '</div></div>'
          : '<div class="bbg-power-slot"><div class="bbg-power-slot-rarity">Power Up Slot</div><div class="bbg-power-slot-name">+</div><div class="bbg-power-slot-desc">No gamebreaker attached</div></div>')
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
          '<div class="bbg-build-modal-body">' +
            renderBuildScreen() +
            '<div class="bbg-build-modal-side">' +
              '<div class="bbg-footer-box">' +
                '<div class="bbg-lineup-header">Draft Pool</div>' +
                '<div class="bbg-draft-grid">' + renderDraftPool() + '</div>' +
              '</div>' +
              '<div class="bbg-footer-box">' +
                '<div class="bbg-lineup-header">Gamebreakers</div>' +
                '<div class="bbg-perk-grid">' + renderActiveBuild() + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="bbg-build-modal-actions">' +
            '<button class="bbg-btn" data-action="close-build-modal">Close Builder</button>' +
            '<button class="bbg-btn bbg-btn-full" data-action="start-game"' + (lineupPlayers().length >= 4 && !state.gameStarted ? '' : ' disabled') + '>Start Game</button>' +
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
        '<div class="bbg-mini-scoreboard">' +
          '<div class="bbg-mini-team"><span>LAD</span><strong>' + state.enemyScore + '</strong></div>' +
          '<div class="bbg-mini-team"><span>CLE</span><strong>' + state.score + '</strong></div>' +
          '<div class="bbg-mini-meta">' +
            '<div>IN ' + (state.inning > 9 ? 'F' : state.inning) + '</div>' +
            '<div>OUTS ' + state.outs + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bbg-bases-box">' +
          '<div>' + baseEmoji(state.bases[0]) + '</div>' +
          '<div>' + baseEmoji(state.bases[1]) + '</div>' +
          '<div>' + baseEmoji(state.bases[2]) + '</div>' +
        '</div>' +
        '<div class="bbg-callout">' +
                    '<div class="bbg-callout-value">' + (state.lastOutcome && typeof state.lastOutcome.points === "number" ? state.lastOutcome.points : '') + '</div>' +
                    '<div class="bbg-callout-text">' + (state.lastOutcome ? state.lastOutcome.batter + ' • ' + state.lastOutcome.text : !state.gameStarted ? 'Set your lineup to start' : state.outs === 0 ? 'Bottom ' + state.inning + ' • ' + basesText() : 'Next batter up') + '</div>' +
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
        '<div class="bbg-atbat-art is-batter"></div>' +
        '<div class="bbg-atbat-center">' +
          '<div class="bbg-atbat-name">' + (batter ? batter.name : 'No Batter') + '</div>' +
          '<div class="bbg-atbat-line">' + batterStats + '</div>' +
          '<div class="bbg-atbat-divider"></div>' +
          '<div class="bbg-atbat-today">' + batterToday + '</div>' +
          '<div class="bbg-status-row">' +
            '<div class="bbg-status-pill">IN ' + (state.inning > 9 ? 'F' : state.inning) + '</div>' +
            '<div class="bbg-status-pill">OUTS ' + state.outs + '</div>' +
            '<div class="bbg-status-pill">' + basesText() + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="bbg-atbat-actions">' +
          '<div class="bbg-count-boxes">' +
            '<div class="bbg-count-box">Spin Mode</div>' +
            '<div class="bbg-count-box">' + currentPitcherChallenge() + '</div>' +
          '</div>' +
          '<button class="bbg-result-btn" data-action="take-at-bat">' + (state.gameStarted ? 'Spin' : lineupPlayers().length >= 4 ? 'Start Run' : 'Set Lineup') + '</button>' +
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

    function renderOpponentQueue() {
    return '';
  }

  function render() {
    const gameOver = state.inning > 9;
    const canStart = lineupPlayers().length >= 4;

    root.innerHTML =
      '<div class="bbg-arcade-shell">' +
        renderScorePanel() +
        '<div class="bbg-arcade-main">' +
            renderAtBatPanel() +
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
          '</div>' +
          renderBuildModal() +
        '</div>' +
      '</div>';

    bindEvents();
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
            if (lineupPlayers().length >= 4) {
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

  render();
})();
