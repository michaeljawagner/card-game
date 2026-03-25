(function () {
  const root = document.getElementById("card-game");
  if (!root) return;

  const PLAYERS = [
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
    draftPool: shuffle(PLAYERS.slice()),
    lineup: [],
    selectedPowerups: [],
    gameStarted: false,
    inning: 1,
    outs: 0,
    score: 0,
    enemyScore: 0,
    bases: [false, false, false],
    batterIndex: 0,
    modifier: "normal",
    log: ["Draft 4 hitters and choose up to 2 power-ups."],
    lastOutcome: null
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

  function currentBatter() {
    if (!state.lineup.length) return null;
    return state.lineup[state.batterIndex % state.lineup.length];
  }

  function hasPowerup(id) {
    return state.selectedPowerups.indexOf(id) > -1;
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
      text = "Home Run";
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

  function baseEmoji(on) {
    return on ? "🟦" : "⬜";
  }

  function resetRun() {
    state.draftPool = shuffle(PLAYERS.slice());
    state.lineup = [];
    state.selectedPowerups = [];
    state.gameStarted = false;
    state.inning = 1;
    state.outs = 0;
    state.score = 0;
    state.enemyScore = 0;
    state.bases = [false, false, false];
    state.batterIndex = 0;
    state.modifier = "normal";
    state.log = ["New run started. Draft 4 hitters and choose up to 2 power-ups."];
    state.lastOutcome = null;
    render();
  }

  function addLog(text) {
    state.log.unshift(text);
    if (state.log.length > 14) state.log.length = 14;
  }

  function addToLineup(playerId) {
    if (state.lineup.length >= 4) return;
    for (let i = 0; i < state.lineup.length; i++) {
      if (state.lineup[i].id === playerId) return;
    }
    const player = state.draftPool.find(function (p) {
      return p.id === playerId;
    });
    if (!player) return;
    state.lineup.push(player);
    render();
  }

  function togglePowerup(id) {
    const index = state.selectedPowerups.indexOf(id);
    if (index > -1) {
      state.selectedPowerups.splice(index, 1);
    } else {
      if (state.selectedPowerups.length >= 2) return;
      state.selectedPowerups.push(id);
    }
    render();
  }

  function startGame() {
    if (state.lineup.length !== 4) return;
    state.gameStarted = true;
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

    if (result === "out" || result === "strikeout") {
      state.outs += 1;
    }

    state.batterIndex += 1;
    state.lastOutcome = {
      batter: batter.name,
      text: advanced.text,
      runs: advanced.runs
    };

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
      .map(function (player) {
        const drafted = state.lineup.some(function (p) {
          return p.id === player.id;
        });

        return (
          '<div class="bbg-player-card">' +
            '<div class="bbg-player-top">' +
              '<div>' +
                '<div class="bbg-player-name">' + player.name + '</div>' +
                '<div class="bbg-player-trait">' + player.trait + " • " + player.traitText + "</div>" +
              "</div>" +
              '<button class="bbg-btn ' + (drafted ? "is-muted" : "") + '" data-action="draft" data-id="' + player.id + '"' +
                (drafted || state.lineup.length >= 4 ? " disabled" : "") +
              ">" +
                (drafted ? "Drafted" : "Draft") +
              "</button>" +
            "</div>" +
            '<div class="bbg-stat-grid">' +
              '<div class="bbg-stat-box">Contact <strong>' + player.contact + "</strong></div>" +
              '<div class="bbg-stat-box">Power <strong>' + player.power + "</strong></div>" +
              '<div class="bbg-stat-box">Discipline <strong>' + player.discipline + "</strong></div>" +
              '<div class="bbg-stat-box">Speed <strong>' + player.speed + "</strong></div>" +
            "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderPowerups() {
    return POWERUPS
      .map(function (powerup) {
        const active = state.selectedPowerups.indexOf(powerup.id) > -1;
        return (
          '<button class="bbg-powerup ' + (active ? "is-active" : "") + '" data-action="powerup" data-id="' + powerup.id + '">' +
            '<div class="bbg-powerup-name">' + powerup.name + "</div>" +
            '<div class="bbg-powerup-desc">' + powerup.desc + "</div>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderLineup() {
    if (!state.lineup.length) {
      return '<div class="bbg-empty">No hitters drafted yet.</div>';
    }

    return state.lineup
      .map(function (player, i) {
        return (
          '<div class="bbg-lineup-row">' +
            '<div>' +
              '<div class="bbg-lineup-name">' + (i + 1) + ". " + player.name + "</div>" +
              '<div class="bbg-lineup-trait">' + player.trait + "</div>" +
            "</div>" +
            '<div class="bbg-badge">OVR ' + getOverall(player) + "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderModifierButtons() {
    return MODIFIERS
      .map(function (m) {
        const active = state.modifier === m.id;
        return (
          '<button class="bbg-modifier ' + (active ? "is-active" : "") + '" data-action="modifier" data-id="' + m.id + '">' +
            '<div class="bbg-modifier-name">' + m.name + "</div>" +
            '<div class="bbg-modifier-desc">' + m.desc + "</div>" +
          "</button>"
        );
      })
      .join("");
  }

  function renderActiveBuild() {
    if (!state.selectedPowerups.length) {
      return '<div class="bbg-empty">No power-ups selected yet.</div>';
    }

    return state.selectedPowerups
      .map(function (id) {
        const p = POWERUPS.find(function (item) {
          return item.id === id;
        });
        if (!p) return "";
        return (
          '<div class="bbg-build-card">' +
            '<div class="bbg-build-name">' + p.name + "</div>" +
            '<div class="bbg-build-desc">' + p.desc + "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderLog() {
    return state.log
      .map(function (entry) {
        return '<div class="bbg-log-row">' + entry + "</div>";
      })
      .join("");
  }

  function render() {
    const batter = currentBatter();
    const gameOver = state.inning > 9;
    const canStart = state.lineup.length === 4;

    root.innerHTML =
      '<div class="bbg-shell">' +
        '<div class="bbg-main">' +
          '<div class="bbg-section">' +
            '<div class="bbg-header">' +
              '<div>' +
                '<div class="bbg-kicker">Baseball Roguelike Prototype</div>' +
                '<h2 class="bbg-title">Balatro-Style Baseball Card Game</h2>' +
                '<p class="bbg-subtitle">Draft hitters, lock in power-ups, and play through a 9 inning run.</p>' +
              "</div>" +
              '<button class="bbg-btn" data-action="new-run">New Run</button>' +
            "</div>" +
          "</div>" +

          '<div class="bbg-grid">' +
            '<div class="bbg-left">' +
              '<div class="bbg-section">' +
                '<div class="bbg-section-title">Draft Pool</div>' +
                '<div class="bbg-stack">' + renderDraftPool() + "</div>" +
              "</div>" +
            "</div>" +

            '<div class="bbg-right">' +
              '<div class="bbg-section">' +
                '<div class="bbg-section-title">Power-Ups</div>' +
                '<div class="bbg-stack">' + renderPowerups() + '</div>' +
                '<div class="bbg-note">Choose up to 2.</div>' +
              "</div>" +

              '<div class="bbg-section">' +
                '<div class="bbg-section-title">Your Lineup</div>' +
                '<div class="bbg-stack">' + renderLineup() + "</div>" +
                '<button class="bbg-btn bbg-btn-full" data-action="start-game"' + (canStart && !state.gameStarted ? "" : " disabled") + '>Start 9 Inning Run</button>' +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>" +

        '<div class="bbg-sidebar">' +
          '<div class="bbg-section">' +
            '<div class="bbg-section-title">Game Board</div>' +
            '<div class="bbg-mini-grid">' +
              '<div class="bbg-mini-card">' +
                '<div class="bbg-mini-label">Inning</div>' +
                '<div class="bbg-mini-value">' + (gameOver ? "Final" : state.inning) + "</div>" +
              "</div>" +
              '<div class="bbg-mini-card">' +
                '<div class="bbg-mini-label">Outs</div>' +
                '<div class="bbg-mini-value">' + state.outs + "</div>" +
              "</div>" +
            "</div>" +

            '<div class="bbg-scoreboard">' +
              '<div class="bbg-score-label">Score</div>' +
              '<div class="bbg-score-value">You ' + state.score + " - " + state.enemyScore + " CPU</div>" +
              '<div class="bbg-bases">' +
                '<div class="bbg-base">1B ' + baseEmoji(state.bases[0]) + "</div>" +
                '<div class="bbg-base">2B ' + baseEmoji(state.bases[1]) + "</div>" +
                '<div class="bbg-base">3B ' + baseEmoji(state.bases[2]) + "</div>" +
              "</div>" +
            "</div>" +

            (!state.gameStarted
              ? '<div class="bbg-empty-card">Draft 4 hitters and start the run.</div>'
              : gameOver
                ? '<div class="bbg-result-card"><div class="bbg-result-kicker">Run Complete</div><div class="bbg-result-text">' + gameResultText() + "</div></div>"
                : batter
                  ? '<div class="bbg-batter-card">' +
                      '<div class="bbg-mini-label">Current Batter</div>' +
                      '<div class="bbg-batter-name">' + batter.name + "</div>" +
                      '<div class="bbg-batter-trait">' + batter.traitText + "</div>" +
                      '<div class="bbg-modifier-grid">' + renderModifierButtons() + "</div>" +
                      '<button class="bbg-btn bbg-btn-full" data-action="take-at-bat">Take At-Bat</button>' +
                    "</div>"
                  : "") +

            (state.lastOutcome
              ? '<div class="bbg-last-play">' +
                  '<div class="bbg-mini-label">Last play</div>' +
                  '<div class="bbg-last-name">' + state.lastOutcome.batter + "</div>" +
                  '<div class="bbg-last-text">' + state.lastOutcome.text + (state.lastOutcome.runs ? " • " + state.lastOutcome.runs + " run" + (state.lastOutcome.runs > 1 ? "s" : "") : "") + "</div>" +
                "</div>"
              : "") +
          "</div>" +

          '<div class="bbg-section">' +
            '<div class="bbg-section-title">Active Build</div>' +
            '<div class="bbg-stack">' + renderActiveBuild() + "</div>" +
          "</div>" +

          '<div class="bbg-section">' +
            '<div class="bbg-section-title">Play Log</div>' +
            '<div class="bbg-log">' + renderLog() + "</div>" +
          "</div>" +
        "</div>" +
      "</div>";

    bindEvents();
  }

  function bindEvents() {
    const actionEls = root.querySelectorAll("[data-action]");
    for (let i = 0; i < actionEls.length; i++) {
      actionEls[i].addEventListener("click", function () {
        const action = this.getAttribute("data-action");
        const id = this.getAttribute("data-id");

        if (action === "new-run") resetRun();
        if (action === "draft") addToLineup(Number(id));
        if (action === "powerup") togglePowerup(id);
        if (action === "start-game") startGame();
        if (action === "modifier") {
          state.modifier = id;
          render();
        }
        if (action === "take-at-bat") takeAtBat();
      });
    }
  }

  render();
})();
