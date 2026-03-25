(function () {
  const root = document.getElementById("card-game");
  if (!root) return;

  // ---------- STATE ----------
  let state = {
    inning: 1,
    outs: 0,
    score: 0,
    enemyScore: 0,
    bases: [false, false, false],
    lineup: [],
    batterIndex: 0,
    log: [],
    powerups: []
  };

  const players = [
    { name: "Slugger", contact: 60, power: 90 },
    { name: "Contact Bat", contact: 85, power: 40 },
    { name: "Balanced", contact: 70, power: 70 },
    { name: "Speed Guy", contact: 65, power: 35 }
  ];

  const powerups = [
    { id: "launch", name: "Launch Angle (+HR)" },
    { id: "moneyball", name: "Moneyball (+Walk)" }
  ];

  // ---------- UI ----------
  function render() {
    root.innerHTML = `
      <div class="bbg-wrap">
        <h2>⚾ Baseball Card Game</h2>

        <div class="bbg-score">
          You ${state.score} - ${state.enemyScore} CPU
        </div>

        <div>Inning: ${state.inning} | Outs: ${state.outs}</div>

        <div class="bbg-bases">
          1B ${state.bases[0] ? "🟦" : "⬜"}
          2B ${state.bases[1] ? "🟦" : "⬜"}
          3B ${state.bases[2] ? "🟦" : "⬜"}
        </div>

        ${
          state.lineup.length === 0
            ? `<button id="draft">Draft Lineup</button>`
            : `
              <div>Current Batter: ${getCurrentBatter().name}</div>
              <button id="swing">Swing</button>
            `
        }

        <div class="bbg-log">
          ${state.log.map(l => `<div>${l}</div>`).join("")}
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const draftBtn = document.getElementById("draft");
    if (draftBtn) draftBtn.onclick = draftLineup;

    const swingBtn = document.getElementById("swing");
    if (swingBtn) swingBtn.onclick = takeAtBat;
  }

  // ---------- GAME ----------
  function draftLineup() {
    state.lineup = [...players];
    state.log.unshift("Lineup drafted.");
    render();
  }

  function getCurrentBatter() {
    return state.lineup[state.batterIndex % state.lineup.length];
  }

  function takeAtBat() {
    const batter = getCurrentBatter();

    let roll = Math.random();

    let result;

    if (roll < batter.power / 200) result = "HR";
    else if (roll < 0.4) result = "Single";
    else if (roll < 0.7) result = "Out";
    else result = "Strikeout";

    resolve(result, batter.name);
    state.batterIndex++;

    render();
  }

  function resolve(result, name) {
    if (result === "HR") {
      let runs = state.bases.filter(b => b).length + 1;
      state.score += runs;
      state.bases = [false, false, false];
      state.log.unshift(`${name} hits a HR (+${runs})`);
    }

    if (result === "Single") {
      if (state.bases[2]) state.score++;
      state.bases = [true, state.bases[0], state.bases[1]];
      state.log.unshift(`${name} hits a single`);
    }

    if (result === "Out" || result === "Strikeout") {
      state.outs++;
      state.log.unshift(`${name} ${result}`);

      if (state.outs >= 3) {
        nextInning();
      }
    }
  }

  function nextInning() {
    state.outs = 0;
    state.bases = [false, false, false];
    state.enemyScore += Math.floor(Math.random() * 3);
    state.inning++;

    state.log.unshift("New inning.");
  }

  // ---------- INIT ----------
  render();
})();
