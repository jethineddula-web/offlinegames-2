   if (window.__TTT_BOOTED) { /* already running */ }
    else {
    window.__TTT_BOOTED = true;
    var AD_CLIENT = "ca-pub-4203857211510947";
    var AD_SLOT_BANNER = "7417753724";

    (function loadAds() {
      var s = document.createElement("script");
      s.async = true;
      s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CLIENT;
      s.crossOrigin = "anonymous";
      s.onerror = function () {
        document.getElementById("adFallback").style.display = "flex";
      };
      document.head.appendChild(s);
      s.onload = function () {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (e) {
          document.getElementById("adFallback").style.display = "flex";
        }
      };
      setTimeout(function () {
        var ins = document.querySelector(".adsbygoogle");
        if (ins && ins.offsetHeight < 20) {
          document.getElementById("adFallback").style.display = "flex";
        }
      }, 2500);
    })();

    const logo = document.getElementById("logoTitle");
    "TICTACTOE".split("").forEach((ch, i) => {
      const s = document.createElement("span");
      if (i === 3 || i === 6) {
        const g = document.createElement("span");
        g.className = "gap";
        logo.appendChild(g);
      }
      s.textContent = ch;
      logo.appendChild(s);
    });

    const floatBox = document.getElementById("floatMarks");
    for (let i = 0; i < 10; i++) {
      const el = document.createElement("div");
      el.className = "float-mark";
      el.textContent = i % 2 ? "O" : "X";
      el.style.left = (6 + Math.random() * 88) + "%";
      el.style.fontSize = (28 + Math.random() * 50) + "px";
      el.style.animationDuration = (14 + Math.random() * 12) + "s";
      el.style.animationDelay = (-Math.random() * 16) + "s";
      floatBox.appendChild(el);
    }

    const Sound = {
      ctx: null,
      enabled: true,
      init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      },
      resume() {
        this.init();
        if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      },
      tone(freq, dur, type, gain, slide) {
        if (!this.enabled) return;
        this.resume();
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || "sine";
        o.frequency.value = freq;
        if (slide) o.frequency.exponentialRampToValueAtTime(slide, this.ctx.currentTime + dur);
        g.gain.value = gain || 0.08;
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.connect(g); g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + dur);
      },
      click() { this.tone(520, 0.07, "triangle", 0.05); },
      place(isX) { this.tone(isX ? 440 : 330, 0.12, "square", 0.05); },
      win() {
        this.tone(523, 0.12, "sine", 0.08);
        setTimeout(() => this.tone(659, 0.12, "sine", 0.08), 90);
        setTimeout(() => this.tone(784, 0.22, "sine", 0.09, 980), 180);
      },
      draw() { this.tone(240, 0.28, "sawtooth", 0.04, 160); },
      start() { this.tone(392, 0.1, "triangle", 0.06); setTimeout(() => this.tone(523, 0.16, "triangle", 0.06), 100); }
    };

    const state = {
      mode: "pvp",
      difficulty: "medium",
      board: Array(9).fill(""),
      turn: "X",
      locked: false,
      scores: { X: 0, O: 0, D: 0 },
      sound: true
    };

    try {
      const saved = JSON.parse(localStorage.getItem("ttt_v1") || "null");
      if (saved) {
        state.scores = saved.scores || state.scores;
        state.sound = saved.sound !== false;
        state.difficulty = saved.difficulty || "medium";
      }
    } catch (e) {}

    function persist() {
      localStorage.setItem("ttt_v1", JSON.stringify({
        scores: state.scores,
        sound: state.sound,
        difficulty: state.difficulty
      }));
    }

    const els = {
      start: document.getElementById("startScreen"),
      game: document.getElementById("gameScreen"),
      board: document.getElementById("board"),
      wrap: document.getElementById("boardWrap"),
      status: document.getElementById("status"),
      scoreX: document.getElementById("scoreX"),
      scoreO: document.getElementById("scoreO"),
      scoreD: document.getElementById("scoreD"),
      labelX: document.getElementById("labelX"),
      labelO: document.getElementById("labelO"),
      overlay: document.getElementById("overlay"),
      modalTitle: document.getElementById("modalTitle"),
      modalText: document.getElementById("modalText"),
      toast: document.getElementById("toast"),
      diffBox: document.getElementById("diffBox"),
      soundToggle: document.getElementById("soundToggle"),
      confetti: document.getElementById("confetti")
    };

    function showToast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add("show");
      setTimeout(() => els.toast.classList.remove("show"), 1600);
    }

    function setSoundUI() {
      els.soundToggle.classList.toggle("on", state.sound);
      Sound.enabled = state.sound;
    }
    setSoundUI();

    document.querySelectorAll("[data-diff]").forEach(btn => {
      if (btn.dataset.diff === state.difficulty) {
        document.querySelectorAll("[data-diff]").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
      }
      btn.addEventListener("click", () => {
        Sound.click();
        document.querySelectorAll("[data-diff]").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        state.difficulty = btn.dataset.diff;
        persist();
      });
    });

    els.soundToggle.addEventListener("click", () => {
      state.sound = !state.sound;
      setSoundUI();
      persist();
      if (state.sound) Sound.click();
    });

    document.getElementById("btnPvp").addEventListener("click", () => startGame("pvp"));
    document.getElementById("btnAi").addEventListener("click", () => {
      Sound.click();
      els.diffBox.classList.toggle("show");
    });
    document.getElementById("btnStartAi").addEventListener("click", () => startGame("ai"));
    document.getElementById("btnMenu").addEventListener("click", goMenu);
    document.getElementById("btnRestart").addEventListener("click", () => { Sound.click(); newRound(); });
    document.getElementById("btnResetScores").addEventListener("click", () => {
      Sound.click();
      state.scores = { X: 0, O: 0, D: 0 };
      persist();
      renderScores();
      showToast("Scores reset");
    });
    document.getElementById("modalAgain").addEventListener("click", () => {
      Sound.click();
      els.overlay.classList.remove("show");
      newRound();
    });
    document.getElementById("modalMenu").addEventListener("click", () => {
      Sound.click();
      els.overlay.classList.remove("show");
      goMenu();
    });

    function goMenu() {
      els.game.classList.remove("active");
      els.start.classList.add("active");
    }

    function startGame(mode) {
      Sound.start();
      state.mode = mode;
      if (mode === "pvp") {
        els.labelX.textContent = "Player X";
        els.labelO.textContent = "Player O";
      } else {
        els.labelX.textContent = "You (X)";
        els.labelO.textContent = "CPU (O)";
      }
      els.start.classList.remove("active");
      els.game.classList.add("active");
      newRound(true);
      renderScores();
    }

    function newRound(keepScores) {
      state.board = Array(9).fill("");
      state.turn = "X";
      state.locked = false;
      els.wrap.querySelectorAll(".win-line").forEach(n => n.remove());
      renderBoard();
      setStatus(state.mode === "ai" ? "Your turn" : "X to play", "x");
    }

    function renderScores() {
      els.scoreX.textContent = state.scores.X;
      els.scoreO.textContent = state.scores.O;
      els.scoreD.textContent = state.scores.D;
    }

    function setStatus(text, cls) {
      els.status.textContent = text;
      els.status.className = "status " + (cls || "");
    }

    function renderBoard() {
      els.board.innerHTML = "";
      state.board.forEach((v, i) => {
        const c = document.createElement("button");
        c.className = "cell" + (v ? " " + v.toLowerCase() : "");
        c.type = "button";
        c.setAttribute("aria-label", "Cell " + (i + 1));
        if (v) {
          const m = document.createElement("span");
          m.className = "mark";
          m.textContent = v;
          c.appendChild(m);
        }
        c.addEventListener("click", () => onCell(i));
        els.board.appendChild(c);
      });
    }

    const WINS = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];

    function winner(board) {
      for (const [a,b,c] of WINS) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
          return { player: board[a], line: [a,b,c] };
        }
      }
      if (board.every(Boolean)) return { player: "D", line: null };
      return null;
    }

    function onCell(i) {
      if (state.locked || state.board[i]) return;
      if (state.mode === "ai" && state.turn !== "X") return;
      place(i, state.turn);
    }

    function place(i, mark) {
      state.board[i] = mark;
      Sound.place(mark === "X");
      renderBoard();
      const res = winner(state.board);
      if (res) {
        finish(res);
        return;
      }
      state.turn = mark === "X" ? "O" : "X";
      if (state.mode === "ai") {
        if (state.turn === "O") {
          setStatus("Computer thinking…", "o");
          state.locked = true;
          setTimeout(aiMove, state.difficulty === "hard" ? 280 : 420);
        } else {
          setStatus("Your turn", "x");
        }
      } else {
        setStatus(state.turn + " to play", state.turn.toLowerCase());
      }
    }

    function finish(res) {
      state.locked = true;
      if (res.player === "D") {
        state.scores.D++;
        setStatus("It's a draw", "");
        Sound.draw();
        persist();
        renderScores();
        openModal("Draw", "Nobody takes this round.");
      } else {
        state.scores[res.player]++;
        highlight(res.line);
        drawWinLine(res.line);
        persist();
        renderScores();
        const youWin = state.mode === "ai" ? res.player === "X" : true;
        if (state.mode === "ai") {
          if (res.player === "X") {
            setStatus("You win!", "win");
            Sound.win();
            burst();
            openModal("You Win!", "Clean three in a row.");
          } else {
            setStatus("Computer wins", "o");
            Sound.draw();
            openModal("You Lose", "The CPU found the line.");
          }
        } else {
          setStatus(res.player + " wins!", "win");
          Sound.win();
          burst();
          openModal(res.player + " Wins!", "Three in a row.");
        }
      }
    }

    function highlight(line) {
      const cells = els.board.children;
      line.forEach(i => cells[i].classList.add("win"));
    }

    function drawWinLine(line) {
      const map = {
        "0,1,2": { t: "16.6%", l: "6%", w: "88%", r: "0deg" },
        "3,4,5": { t: "50%", l: "6%", w: "88%", r: "0deg" },
        "6,7,8": { t: "83.4%", l: "6%", w: "88%", r: "0deg" },
        "0,3,6": { t: "6%", l: "16.6%", w: "88%", r: "90deg" },
        "1,4,7": { t: "6%", l: "50%", w: "88%", r: "90deg" },
        "2,5,8": { t: "6%", l: "83.4%", w: "88%", r: "90deg" },
        "0,4,8": { t: "8%", l: "8%", w: "118%", r: "45deg" },
        "2,4,6": { t: "8%", l: "92%", w: "118%", r: "135deg" }
      };
      const key = line.join(",");
      const spec = map[key];
      if (!spec) return;
      const lineEl = document.createElement("div");
      lineEl.className = "win-line";
      lineEl.style.top = spec.t;
      lineEl.style.left = spec.l;
      lineEl.style.width = spec.w;
      lineEl.style.transform = "rotate(" + spec.r + ")";
      els.wrap.appendChild(lineEl);
    }

    function openModal(title, text) {
      els.modalTitle.textContent = title;
      els.modalText.textContent = text;
      setTimeout(() => els.overlay.classList.add("show"), 420);
    }

    function burst() {
      const box = els.confetti;
      box.innerHTML = "";
      const colors = ["#6cf0ff", "#ff5ad8", "#ffb86b", "#7dffb3", "#ffffff"];
      for (let i = 0; i < 42; i++) {
        const p = document.createElement("div");
        p.className = "piece";
        p.style.left = Math.random() * 100 + "%";
        p.style.background = colors[i % colors.length];
        p.style.animationDuration = (1.2 + Math.random() * 1.4) + "s";
        p.style.transform = "rotate(" + (Math.random() * 180) + "deg)";
        box.appendChild(p);
      }
      setTimeout(() => { box.innerHTML = ""; }, 2800);
    }

    function emptyCells(board) {
      return board.map((v, i) => v ? null : i).filter(v => v !== null);
    }

    function aiMove() {
      let idx;
      const empties = emptyCells(state.board);
      if (!empties.length) { state.locked = false; return; }
      if (state.difficulty === "easy") {
        idx = empties[Math.floor(Math.random() * empties.length)];
      } else if (state.difficulty === "medium") {
        idx = findWinningMove(state.board, "O");
        if (idx == null) idx = findWinningMove(state.board, "X");
        if (idx == null) {
          if (state.board[4] === "") idx = 4;
          else idx = empties[Math.floor(Math.random() * empties.length)];
        }
      } else {
        idx = minimaxMove(state.board);
      }
      state.locked = false;
      place(idx, "O");
    }

    function findWinningMove(board, mark) {
      for (const i of emptyCells(board)) {
        const copy = board.slice();
        copy[i] = mark;
        const res = winner(copy);
        if (res && res.player === mark) return i;
      }
      return null;
    }

    function minimaxMove(board) {
      let best = -Infinity, move = emptyCells(board)[0];
      for (const i of emptyCells(board)) {
        const copy = board.slice();
        copy[i] = "O";
        const score = minimax(copy, false);
        if (score > best) { best = score; move = i; }
      }
      return move;
    }

    function minimax(board, isMax) {
      const res = winner(board);
      if (res) {
        if (res.player === "O") return 10;
        if (res.player === "X") return -10;
        return 0;
      }
      if (isMax) {
        let best = -Infinity;
        for (const i of emptyCells(board)) {
          const copy = board.slice();
          copy[i] = "O";
          best = Math.max(best, minimax(copy, false));
        }
        return best;
      }
      let best = Infinity;
      for (const i of emptyCells(board)) {
        const copy = board.slice();
        copy[i] = "X";
        best = Math.min(best, minimax(copy, true));
      }
      return best;
    }

    document.addEventListener("pointerdown", () => Sound.resume(), { once: true });

    renderBoard();
    }