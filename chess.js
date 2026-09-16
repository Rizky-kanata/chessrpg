(() => {
  const PIECES = {
    K: { w: '\u2654', b: '\u265A', val: 900 },
    Q: { w: '\u2655', b: '\u265B', val: 90 },
    R: { w: '\u2656', b: '\u265C', val: 50 },
    B: { w: '\u2657', b: '\u265D', val: 33 },
    N: { w: '\u2658', b: '\u265E', val: 32 },
    P: { w: '\u2659', b: '\u265F', val: 10 }
  };

  const FILES = 'abcdefgh';
  const INIT_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  let board = [];
  let turn = 'w';
  let castling = { K: true, Q: true, k: true, q: true };
  let enPassant = null;
  let halfMove = 0;
  let fullMove = 1;
  let selected = null;
  let legalMoves = [];
  let history = [];
  let moveList = [];
  let gameOver = false;
  let mode = 'ai';
  let difficulty = 'medium';
  let timeLimit = 600;
  let whiteTime = 600;
  let blackTime = 600;
  let timerInterval = null;
  let flipped = false;
  let lastMove = null;
  let pendingPromotion = null;
  let battleInProgress = false;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  const PIECE_RPG = {
    K: { name: 'Raja', hp: 100, atk: 40, def: 50, speed: 3, skills: ['Royal Strike', 'Crown Shield'] },
    Q: { name: 'Ratu', hp: 120, atk: 55, def: 35, speed: 5, skills: ['Queen Wrath', 'Arcane Blast'] },
    R: { name: 'Benteng', hp: 150, atk: 45, def: 60, speed: 2, skills: ['Siege Slam', 'Fortress Wall'] },
    B: { name: 'Gajah', hp: 80, atk: 50, def: 25, speed: 6, skills: ['Diagonal Slash', 'Holy Light'] },
    N: { name: 'Kuda', hp: 90, atk: 48, def: 30, speed: 7, skills: ['Cavalry Charge', 'Leap Strike'] },
    P: { name: 'Pion', hp: 50, atk: 25, def: 15, speed: 4, skills: ['Spear Thrust', 'Shield Bash'] }
  };

  function sfx(type) {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'battleStart') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.15);
      osc.frequency.linearRampToValueAtTime(800, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.35);
      osc.start(now); osc.stop(now + 0.35);
    } else if (type === 'attack') {
      osc.type = 'square'; osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(150, now + 0.1);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.12);
      osc.start(now); osc.stop(now + 0.12);
      const noise = audioCtx.createBufferSource();
      const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.08, audioCtx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
      noise.buffer = buf;
      const ng = audioCtx.createGain();
      ng.gain.setValueAtTime(0.1, now);
      ng.gain.linearRampToValueAtTime(0, now + 0.08);
      noise.connect(ng); ng.connect(audioCtx.destination);
      noise.start(now); noise.stop(now + 0.08);
    } else if (type === 'crit') {
      osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now);
      osc.frequency.linearRampToValueAtTime(200, now + 0.15);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
      const o2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      o2.type = 'square'; o2.frequency.setValueAtTime(1200, now);
      o2.frequency.linearRampToValueAtTime(400, now + 0.12);
      g2.gain.setValueAtTime(0.1, now);
      g2.gain.linearRampToValueAtTime(0, now + 0.15);
      o2.connect(g2); g2.connect(audioCtx.destination);
      o2.start(now); o2.stop(now + 0.15);
    } else if (type === 'defeat') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.4);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);
      osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'victory') {
      osc.type = 'sine';
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => {
        osc.frequency.setValueAtTime(f, now + i * 0.12);
      });
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.55);
      osc.start(now); osc.stop(now + 0.55);
    } else if (type === 'move') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(600, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.06);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.08);
      osc.start(now); osc.stop(now + 0.08);
    } else if (type === 'select') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(550, now + 0.04);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.07);
      osc.start(now); osc.stop(now + 0.07);
    }
  }

  function showDamagePopup(el, dmg, isCrit) {
    const popup = document.createElement('div');
    popup.className = 'damage-popup' + (isCrit ? ' crit' : '');
    popup.textContent = isCrit ? `${dmg} CRIT!` : `-${dmg}`;
    el.style.position = 'relative';
    el.appendChild(popup);
    setTimeout(() => popup.remove(), 600);
  }

  function runBattle(attacker, defender, attackerColor, defenderColor, onComplete) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    battleInProgress = true;
    stopTimer();
    const overlay = $('battleOverlay');
    overlay.classList.add('active');

    const aStats = { ...PIECE_RPG[attacker.type] };
    const dStats = { ...PIECE_RPG[defender.type] };

    const variance = () => 0.8 + Math.random() * 0.4;
    let aHP = aStats.hp;
    let dHP = dStats.hp;

    $('battleTitle').textContent = 'BATTLE!';
    $('attackerPiece').textContent = PIECES[attacker.type][attackerColor];
    $('defenderPiece').textContent = PIECES[defender.type][defenderColor];
    $('attackerName').textContent = `${aStats.name} (${attackerColor === 'w' ? 'Putih' : 'Hitam'})`;
    $('defenderName').textContent = `${dStats.name} (${defenderColor === 'w' ? 'Putih' : 'Hitam'})`;
    $('attackerStats').textContent = `ATK:${aStats.atk} DEF:${aStats.def} SPD:${aStats.speed}`;
    $('defenderStats').textContent = `ATK:${dStats.atk} DEF:${dStats.def} SPD:${dStats.speed}`;
    $('battleLog').textContent = 'Pertarungan dimulai!';

    function updateBars() {
      const aPct = Math.max(0, aHP / aStats.hp * 100);
      const dPct = Math.max(0, dHP / dStats.hp * 100);
      $('attackerHP').style.width = aPct + '%';
      $('defenderHP').style.width = dPct + '%';
      $('attackerHP').classList.toggle('low', aPct < 30);
      $('defenderHP').classList.toggle('low', dPct < 30);
      $('attackerHPText').textContent = `${Math.max(0, Math.round(aHP))}/${aStats.hp}`;
      $('defenderHPText').textContent = `${Math.max(0, Math.round(dHP))}/${dStats.hp}`;
    }

    updateBars();
    sfx('battleStart');

    const rounds = [];
    let tmpAHP = aHP, tmpDHP = dHP;
    let roundNum = 0;

    while (tmpAHP > 0 && tmpDHP > 0 && roundNum < 10) {
      roundNum++;
      const aGoesFirst = aStats.speed + Math.random() * 3 >= dStats.speed + Math.random() * 3;
      const doRound = (atkS, defS, atkHPRef, defHPRef, isAttacker) => {
        const isCrit = Math.random() < 0.2;
        const skillIdx = Math.floor(Math.random() * atkS.skills.length);
        const skill = atkS.skills[skillIdx];
        let dmg = Math.max(1, Math.round((atkS.atk * variance() - defS.def * 0.4) * (isCrit ? 1.8 : 1)));
        const newHP = Math.max(0, defHPRef - dmg);
        return { dmg, isCrit, skill, newDefHP: newHP, isAttacker };
      };

      if (aGoesFirst) {
        const r1 = doRound(aStats, dStats, tmpAHP, tmpDHP, true);
        tmpDHP = r1.newDefHP;
        rounds.push(r1);
        if (tmpDHP > 0) {
          const r2 = doRound(dStats, aStats, tmpDHP, tmpAHP, false);
          tmpAHP = r2.newDefHP;
          rounds.push(r2);
        }
      } else {
        const r1 = doRound(dStats, aStats, tmpDHP, tmpAHP, false);
        tmpAHP = r1.newDefHP;
        rounds.push(r1);
        if (tmpAHP > 0) {
          const r2 = doRound(aStats, dStats, tmpAHP, tmpDHP, true);
          tmpDHP = r2.newDefHP;
          rounds.push(r2);
        }
      }
    }

    const attackerWins = tmpDHP <= 0 || tmpAHP > tmpDHP;

    let i = 0;
    function playNext() {
      if (i >= rounds.length) {
        finishBattle();
        return;
      }
      const r = rounds[i];
      const isAtkSide = r.isAttacker;
      const atkEl = isAtkSide ? $('attackerSide') : $('defenderSide');
      const defEl = isAtkSide ? $('defenderSide') : $('attackerSide');
      const atkName = isAtkSide ? aStats.name : dStats.name;

      atkEl.classList.remove('attack-left', 'attack-right', 'hit');
      defEl.classList.remove('attack-left', 'attack-right', 'hit');

      void atkEl.offsetWidth;

      atkEl.classList.add(isAtkSide ? 'attack-left' : 'attack-right');
      sfx(r.isCrit ? 'crit' : 'attack');

      $('battleLog').textContent = `${atkName} menggunakan ${r.skill}! ${r.isCrit ? 'CRITICAL HIT! ' : ''}Damage: ${r.dmg}`;

      setTimeout(() => {
        defEl.classList.add('hit');
        showDamagePopup(defEl, r.dmg, r.isCrit);
        if (isAtkSide) { dHP = r.newDefHP; }
        else { aHP = r.newDefHP; }
        updateBars();
      }, 200);

      i++;
      setTimeout(playNext, 900);
    }

    function finishBattle() {
      const winnerName = attackerWins ? aStats.name : dStats.name;
      const winnerSide = attackerWins ? 'Penyerang' : 'Bertahan';
      const loserEl = attackerWins ? $('defenderSide') : $('attackerSide');

      $('battleTitle').textContent = `${winnerName} MENANG!`;
      $('battleLog').textContent = `${winnerSide} menang! ${winnerName} bertahan hidup!`;

      sfx('defeat');
      loserEl.classList.add('defeated');

      setTimeout(() => sfx('victory'), 500);

      setTimeout(() => {
        overlay.classList.remove('active');
        loserEl.classList.remove('defeated');
        $('attackerSide').classList.remove('attack-left', 'attack-right', 'hit');
        $('defenderSide').classList.remove('attack-left', 'attack-right', 'hit');
        battleInProgress = false;
        startTimer();
        onComplete(attackerWins);
      }, 2000);
    }

    setTimeout(playNext, 800);
  }

  const $ = id => document.getElementById(id);
  const boardEl = $('chessboard');
  const statusEl = $('gameStatus');
  const historyEl = $('moveHistory');
  const modalOverlay = $('modalOverlay');
  const promotionOverlay = $('promotionOverlay');

  function parseFEN(fen) {
    const parts = fen.split(' ');
    const rows = parts[0].split('/');
    const b = [];
    for (let r = 0; r < 8; r++) {
      b[r] = [];
      let c = 0;
      for (const ch of rows[r]) {
        if (ch >= '1' && ch <= '8') {
          for (let i = 0; i < +ch; i++) b[r][c++] = null;
        } else {
          const color = ch === ch.toUpperCase() ? 'w' : 'b';
          b[r][c++] = { type: ch.toUpperCase(), color };
        }
      }
    }
    turn = parts[1];
    castling = { K: parts[2].includes('K'), Q: parts[2].includes('Q'), k: parts[2].includes('k'), q: parts[2].includes('q') };
    enPassant = parts[3] === '-' ? null : { col: FILES.indexOf(parts[3][0]), row: 8 - +parts[3][1] };
    halfMove = +parts[4];
    fullMove = +parts[5];
    return b;
  }

  function pieceAt(r, c) {
    if (r < 0 || r > 7 || c < 0 || c > 7) return undefined;
    return board[r][c];
  }

  function cloneBoard(b) {
    return b.map(row => row.map(cell => cell ? { ...cell } : null));
  }

  function findKing(color, b) {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (b[r][c] && b[r][c].type === 'K' && b[r][c].color === color)
          return { r, c };
    return null;
  }

  function isAttacked(r, c, byColor, b) {
    const dirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dr, dc] of dirs) {
      for (let i = 1; i < 8; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
        const p = b[nr][nc];
        if (p) {
          if (p.color === byColor) {
            if (p.type === 'Q') return true;
            if (p.type === 'R' && (dr === 0 || dc === 0)) return true;
            if (p.type === 'B' && dr !== 0 && dc !== 0) return true;
            if (p.type === 'K' && i === 1) return true;
          }
          break;
        }
      }
    }
    const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
    for (const [dr, dc] of knightMoves) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        const p = b[nr][nc];
        if (p && p.color === byColor && p.type === 'N') return true;
      }
    }
    const pawnDir = byColor === 'w' ? 1 : -1;
    for (const dc of [-1, 1]) {
      const nr = r + pawnDir, nc = c + dc;
      if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
        const p = b[nr][nc];
        if (p && p.color === byColor && p.type === 'P') return true;
      }
    }
    return false;
  }

  function inCheck(color, b) {
    const king = findKing(color, b);
    if (!king) return false;
    return isAttacked(king.r, king.c, color === 'w' ? 'b' : 'w', b);
  }

  function generatePseudoMoves(color, b, ep) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p || p.color !== color) continue;
        const add = (tr, tc, extra) => {
          moves.push({ fr: r, fc: c, tr, tc, piece: p, captured: b[tr]?.[tc] || null, ...extra });
        };
        if (p.type === 'P') {
          const dir = color === 'w' ? -1 : 1;
          const startRow = color === 'w' ? 6 : 1;
          const promoRow = color === 'w' ? 0 : 7;
          if (b[r + dir]?.[c] === null) {
            if (r + dir === promoRow) {
              for (const pt of ['Q','R','B','N']) add(r + dir, c, { promotion: pt });
            } else {
              add(r + dir, c);
              if (r === startRow && b[r + 2 * dir]?.[c] === null) add(r + 2 * dir, c, { double: true });
            }
          }
          for (const dc of [-1, 1]) {
            const nc = c + dc, nr = r + dir;
            if (nc < 0 || nc > 7) continue;
            if (b[nr]?.[nc] && b[nr][nc].color !== color) {
              if (nr === promoRow) {
                for (const pt of ['Q','R','B','N']) add(nr, nc, { promotion: pt });
              } else {
                add(nr, nc);
              }
            }
            if (ep && ep.row === nr && ep.col === nc) {
              add(nr, nc, { enPassant: true, captured: b[r][nc] });
            }
          }
        } else if (p.type === 'N') {
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
            if (b[nr][nc] && b[nr][nc].color === color) continue;
            add(nr, nc);
          }
        } else if (p.type === 'K') {
          for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
            if (b[nr][nc] && b[nr][nc].color === color) continue;
            add(nr, nc);
          }
        } else {
          const dirs = p.type === 'R' ? [[0,1],[0,-1],[1,0],[-1,0]] :
                       p.type === 'B' ? [[-1,-1],[-1,1],[1,-1],[1,1]] :
                       [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
          for (const [dr, dc] of dirs) {
            for (let i = 1; i < 8; i++) {
              const nr = r + dr * i, nc = c + dc * i;
              if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
              if (b[nr][nc]) {
                if (b[nr][nc].color !== color) add(nr, nc);
                break;
              }
              add(nr, nc);
            }
          }
        }
      }
    }
    return moves;
  }

  function addCastlingMoves(color, b, cas) {
    const moves = [];
    const row = color === 'w' ? 7 : 0;
    const enemy = color === 'w' ? 'b' : 'w';
    if (inCheck(color, b)) return moves;
    const kSide = color === 'w' ? 'K' : 'k';
    const qSide = color === 'w' ? 'Q' : 'q';
    if (cas[kSide] && !b[row][5] && !b[row][6] && b[row][7]?.type === 'R' &&
        !isAttacked(row, 5, enemy, b) && !isAttacked(row, 6, enemy, b)) {
      moves.push({ fr: row, fc: 4, tr: row, tc: 6, piece: b[row][4], castle: 'K' });
    }
    if (cas[qSide] && !b[row][3] && !b[row][2] && !b[row][1] && b[row][0]?.type === 'R' &&
        !isAttacked(row, 3, enemy, b) && !isAttacked(row, 2, enemy, b)) {
      moves.push({ fr: row, fc: 4, tr: row, tc: 2, piece: b[row][4], castle: 'Q' });
    }
    return moves;
  }

  function getLegalMoves(color, b, cas, ep) {
    let pseudo = generatePseudoMoves(color, b, ep);
    pseudo = pseudo.concat(addCastlingMoves(color, b, cas));
    return pseudo.filter(m => {
      const nb = cloneBoard(b);
      applyMoveOnBoard(nb, m);
      return !inCheck(color, nb);
    });
  }

  function applyMoveOnBoard(b, m) {
    b[m.tr][m.tc] = b[m.fr][m.fc];
    b[m.fr][m.fc] = null;
    if (m.promotion) b[m.tr][m.tc] = { type: m.promotion, color: m.piece.color };
    if (m.enPassant) b[m.fr][m.tc] = null;
    if (m.castle) {
      const row = m.fr;
      if (m.castle === 'K') { b[row][5] = b[row][7]; b[row][7] = null; }
      else { b[row][3] = b[row][0]; b[row][0] = null; }
    }
  }

  function makeMove(m, skipRender) {
    const state = {
      board: cloneBoard(board), turn, castling: { ...castling },
      enPassant: enPassant ? { ...enPassant } : null, halfMove, fullMove, lastMove
    };
    history.push(state);

    const captured = m.enPassant ? board[m.fr][m.tc] : board[m.tr][m.tc];
    applyMoveOnBoard(board, m);

    if (m.piece.type === 'K') {
      if (m.piece.color === 'w') { castling.K = false; castling.Q = false; }
      else { castling.k = false; castling.q = false; }
    }
    if (m.piece.type === 'R') {
      if (m.fr === 7 && m.fc === 0) castling.Q = false;
      if (m.fr === 7 && m.fc === 7) castling.K = false;
      if (m.fr === 0 && m.fc === 0) castling.q = false;
      if (m.fr === 0 && m.fc === 7) castling.k = false;
    }
    if (m.tr === 0 && m.tc === 7) castling.k = false;
    if (m.tr === 0 && m.tc === 0) castling.q = false;
    if (m.tr === 7 && m.tc === 7) castling.K = false;
    if (m.tr === 7 && m.tc === 0) castling.Q = false;

    enPassant = m.double ? { row: (m.fr + m.tr) / 2, col: m.fc } : null;
    halfMove = (m.piece.type === 'P' || captured) ? 0 : halfMove + 1;
    if (turn === 'b') fullMove++;

    lastMove = { fr: m.fr, fc: m.fc, tr: m.tr, tc: m.tc };
    const notation = moveNotation(m, captured);
    if (turn === 'w') {
      moveList.push({ num: fullMove, w: notation, b: '' });
    } else {
      if (moveList.length) moveList[moveList.length - 1].b = notation;
    }

    turn = turn === 'w' ? 'b' : 'w';

    if (!skipRender) {
      selected = null;
      legalMoves = [];
      render();
      renderHistory();
      checkGameState();
    }
  }

  function moveNotation(m, captured) {
    if (m.castle === 'K') return 'O-O';
    if (m.castle === 'Q') return 'O-O-O';
    let n = '';
    if (m.piece.type !== 'P') n += m.piece.type;
    if (captured) {
      if (m.piece.type === 'P') n += FILES[m.fc];
      n += 'x';
    }
    n += FILES[m.tc] + (8 - m.tr);
    if (m.promotion) n += '=' + m.promotion;
    const nb = cloneBoard(board);
    const opp = m.piece.color === 'w' ? 'b' : 'w';
    if (inCheck(opp, nb)) {
      const oppMoves = getLegalMoves(opp, nb, castling, enPassant);
      n += oppMoves.length === 0 ? '#' : '+';
    }
    return n;
  }

  function undoMove() {
    if (!history.length || gameOver) return;
    const s = history.pop();
    board = s.board;
    turn = s.turn;
    castling = s.castling;
    enPassant = s.enPassant;
    halfMove = s.halfMove;
    fullMove = s.fullMove;
    lastMove = s.lastMove;
    if (moveList.length) {
      const last = moveList[moveList.length - 1];
      if (last.b) last.b = '';
      else moveList.pop();
    }
    selected = null;
    legalMoves = [];
    render();
    renderHistory();
    updateStatus();
  }

  function checkGameState() {
    const moves = getLegalMoves(turn, board, castling, enPassant);
    if (moves.length === 0) {
      gameOver = true;
      stopTimer();
      if (inCheck(turn, board)) {
        const winner = turn === 'w' ? 'Hitam' : 'Putih';
        showModal('Skakmat!', `${winner} menang!`);
      } else {
        showModal('Stalemate!', 'Permainan seri.');
      }
      return;
    }
    if (halfMove >= 100) {
      gameOver = true;
      stopTimer();
      showModal('Seri!', '50 langkah tanpa pion/tangkapan.');
      return;
    }
    if (isInsufficientMaterial()) {
      gameOver = true;
      stopTimer();
      showModal('Seri!', 'Material tidak cukup.');
      return;
    }
    updateStatus();
  }

  function isInsufficientMaterial() {
    const pieces = { w: [], b: [] };
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c]) pieces[board[r][c].color].push(board[r][c].type);
    if (pieces.w.length === 1 && pieces.b.length === 1) return true;
    if (pieces.w.length === 1 && pieces.b.length === 2 && (pieces.b.includes('B') || pieces.b.includes('N'))) return true;
    if (pieces.b.length === 1 && pieces.w.length === 2 && (pieces.w.includes('B') || pieces.w.includes('N'))) return true;
    return false;
  }

  function updateStatus() {
    const t = turn === 'w' ? 'Putih' : 'Hitam';
    let s = `Giliran: ${t}`;
    if (inCheck(turn, board)) s += ' (Skak!)';
    statusEl.textContent = s;
    statusEl.style.background = inCheck(turn, board) ? 'var(--danger)' : 'var(--accent)';

    const wp = $('whitePlayerCard');
    const bp = $('blackPlayerCard');
    wp.classList.toggle('active', turn === 'w');
    bp.classList.toggle('active', turn === 'b');
  }

  function showModal(title, msg) {
    $('modalTitle').textContent = title;
    $('modalMessage').textContent = msg;
    modalOverlay.classList.add('active');
    statusEl.textContent = `${title} ${msg}`;
  }

  function render() {
    boardEl.innerHTML = '';
    const kingPos = findKing(turn, board);
    const inChk = inCheck(turn, board);

    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 8; ci++) {
        const r = flipped ? 7 - ri : ri;
        const c = flipped ? 7 - ci : ci;
        const sq = document.createElement('div');
        sq.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
        sq.dataset.r = r;
        sq.dataset.c = c;

        if (lastMove && ((r === lastMove.fr && c === lastMove.fc) || (r === lastMove.tr && c === lastMove.tc))) {
          sq.classList.add('last-move');
        }

        if (selected && r === selected.r && c === selected.c) sq.classList.add('selected');

        if (inChk && kingPos && r === kingPos.r && c === kingPos.c) sq.classList.add('check');

        const isLegal = legalMoves.some(m => m.tr === r && m.tc === c && (!m.promotion || m.promotion === 'Q'));
        if (isLegal) {
          sq.classList.add('legal');
          if (board[r][c]) sq.classList.add('has-piece');
        }

        if (board[r][c]) {
          const span = document.createElement('span');
          span.className = 'piece';
          span.textContent = PIECES[board[r][c].type][board[r][c].color];
          sq.appendChild(span);
        }

        if (ci === 7) {
          const rank = document.createElement('span');
          rank.className = 'coord rank';
          rank.textContent = 8 - r;
          sq.appendChild(rank);
        }
        if (ri === 7) {
          const file = document.createElement('span');
          file.className = 'coord file';
          file.textContent = FILES[c];
          sq.appendChild(file);
        }

        sq.addEventListener('click', () => {
          if (onlineMode && turn !== myColor) return;
          onSquareClick(r, c);
        });
        boardEl.appendChild(sq);
      }
    }
    updateCaptured();
  }

  function updateCaptured() {
    const initial = { w: { P: 8, R: 2, N: 2, B: 2, Q: 1, K: 1 }, b: { P: 8, R: 2, N: 2, B: 2, Q: 1, K: 1 } };
    const current = { w: { P: 0, R: 0, N: 0, B: 0, Q: 0, K: 0 }, b: { P: 0, R: 0, N: 0, B: 0, Q: 0, K: 0 } };
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (board[r][c]) current[board[r][c].color][board[r][c].type]++;

    let wCap = '', bCap = '';
    for (const t of ['Q','R','B','N','P']) {
      const wLost = initial.w[t] - current.w[t];
      const bLost = initial.b[t] - current.b[t];
      for (let i = 0; i < bLost; i++) wCap += PIECES[t].b;
      for (let i = 0; i < wLost; i++) bCap += PIECES[t].w;
    }
    $('whiteCaptured').textContent = wCap;
    $('blackCaptured').textContent = bCap;
  }

  function renderHistory() {
    historyEl.innerHTML = '';
    for (const m of moveList) {
      const row = document.createElement('div');
      row.className = 'move-row';
      row.innerHTML = `<span class="move-number">${m.num}.</span><span class="move-white">${m.w}</span><span class="move-black">${m.b}</span>`;
      historyEl.appendChild(row);
    }
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function onSquareClick(r, c) {
    if (gameOver || battleInProgress) return;
    if (mode === 'ai' && turn === 'b') return;

    const piece = board[r][c];

    if (selected) {
      const move = legalMoves.find(m => m.tr === r && m.tc === c);
      if (move) {
        if (move.promotion || (move.piece.type === 'P' && (r === 0 || r === 7))) {
          const promoMove = legalMoves.find(m => m.tr === r && m.tc === c && m.promotion === 'Q') || move;
          showPromotionDialog(promoMove);
          return;
        }
        executeMoveWithBattle(move);
        return;
      }
      if (piece && piece.color === turn) {
        selectPiece(r, c);
        return;
      }
      selected = null;
      legalMoves = [];
      render();
      return;
    }

    if (piece && piece.color === turn) {
      selectPiece(r, c);
    }
  }

  function executeMoveWithBattle(move) {
    const captured = move.enPassant ? board[move.fr][move.tc] : board[move.tr][move.tc];
    if (captured && captured.type !== 'K') {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const attacker = move.piece;
      const defender = captured;
      const attackerColor = attacker.color;
      const defenderColor = defender.color;

      runBattle(attacker, defender, attackerColor, defenderColor, (attackerWins) => {
        if (attackerWins) {
          makeMove(move);
        } else {
          const state = {
            board: cloneBoard(board), turn, castling: { ...castling },
            enPassant: enPassant ? { ...enPassant } : null, halfMove, fullMove, lastMove
          };
          history.push(state);

          board[move.fr][move.fc] = null;

          lastMove = { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc };
          const notation = `${PIECE_RPG[attacker.type].name}x${FILES[move.tc]}${8 - move.tr}?`;
          if (turn === 'w') {
            moveList.push({ num: fullMove, w: notation, b: '' });
          } else {
            if (moveList.length) moveList[moveList.length - 1].b = notation;
          }
          halfMove = 0;
          if (turn === 'b') fullMove++;
          turn = turn === 'w' ? 'b' : 'w';

          selected = null;
          legalMoves = [];
          render();
          renderHistory();
          checkGameState();
        }
        if (mode === 'ai' && !gameOver && turn === 'b') setTimeout(aiMove, 400);
      });
    } else {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      sfx('move');
      makeMove(move);
      if (mode === 'ai' && !gameOver) setTimeout(aiMove, 300);
    }
  }

  function selectPiece(r, c) {
    selected = { r, c };
    legalMoves = getLegalMoves(turn, board, castling, enPassant).filter(m => m.fr === r && m.fc === c);
    if (audioCtx.state === 'suspended') audioCtx.resume();
    sfx('select');
    render();
  }

  function showPromotionDialog(baseMove) {
    pendingPromotion = baseMove;
    const choices = $('promotionChoices');
    choices.innerHTML = '';
    for (const pt of ['Q', 'R', 'B', 'N']) {
      const btn = document.createElement('button');
      btn.textContent = PIECES[pt][turn];
      btn.addEventListener('click', () => {
        promotionOverlay.classList.remove('active');
        const move = legalMoves.find(m => m.tr === baseMove.tr && m.tc === baseMove.tc && m.promotion === pt);
        if (move) {
          sfx('move');
          makeMove(move);
          if (mode === 'ai' && !gameOver) setTimeout(aiMove, 300);
        }
      });
      choices.appendChild(btn);
    }
    promotionOverlay.classList.add('active');
  }

  // --- AI ---
  const PST = {
    P: [
      [0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],
      [5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],
      [5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]
    ],
    N: [
      [-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],
      [-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],
      [-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],
      [-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    B: [
      [-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
      [-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],
      [-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],
      [-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    R: [
      [0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],
      [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]
    ],
    Q: [
      [-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],
      [-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],
      [0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],
      [-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]
    ],
    K: [
      [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],
      [20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]
    ]
  };

  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = b[r][c];
        if (!p) continue;
        const val = PIECES[p.type].val;
        const pst = p.color === 'w' ? PST[p.type][r][c] : PST[p.type][7 - r][c];
        score += p.color === 'w' ? (val + pst) : -(val + pst);
      }
    }
    return score;
  }

  function orderMoves(moves) {
    return moves.sort((a, b) => {
      let sa = 0, sb = 0;
      if (a.captured) sa += PIECES[a.captured.type].val * 10 - PIECES[a.piece.type].val;
      if (b.captured) sb += PIECES[b.captured.type].val * 10 - PIECES[b.piece.type].val;
      if (a.promotion) sa += PIECES[a.promotion].val;
      if (b.promotion) sb += PIECES[b.promotion].val;
      return sb - sa;
    });
  }

  function minimax(b, depth, alpha, beta, maximizing, cas, ep) {
    const color = maximizing ? 'w' : 'b';
    const moves = getLegalMoves(color, b, cas, ep);
    if (depth === 0 || moves.length === 0) {
      if (moves.length === 0) {
        if (inCheck(color, b)) return maximizing ? -9999 : 9999;
        return 0;
      }
      return evaluate(b);
    }
    orderMoves(moves);
    if (maximizing) {
      let maxEval = -Infinity;
      for (const m of moves) {
        const nb = cloneBoard(b);
        const nc = { ...cas };
        applyMoveOnBoard(nb, m);
        if (m.piece.type === 'K') { if (color === 'w') { nc.K = false; nc.Q = false; } else { nc.k = false; nc.q = false; } }
        const nep = m.double ? { row: (m.fr + m.tr) / 2, col: m.fc } : null;
        const ev = minimax(nb, depth - 1, alpha, beta, false, nc, nep);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const m of moves) {
        const nb = cloneBoard(b);
        const nc = { ...cas };
        applyMoveOnBoard(nb, m);
        if (m.piece.type === 'K') { if (color === 'w') { nc.K = false; nc.Q = false; } else { nc.k = false; nc.q = false; } }
        const nep = m.double ? { row: (m.fr + m.tr) / 2, col: m.fc } : null;
        const ev = minimax(nb, depth - 1, alpha, beta, true, nc, nep);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function aiMove() {
    if (gameOver || turn !== 'b') return;
    const depth = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;
    const moves = getLegalMoves('b', board, castling, enPassant);
    if (!moves.length) return;

    let bestMove = moves[0];
    let bestScore = Infinity;

    orderMoves(moves);
    for (const m of moves) {
      const nb = cloneBoard(board);
      const nc = { ...castling };
      applyMoveOnBoard(nb, m);
      if (m.piece.type === 'K') { nc.k = false; nc.q = false; }
      const nep = m.double ? { row: (m.fr + m.tr) / 2, col: m.fc } : null;
      const score = minimax(nb, depth - 1, -Infinity, Infinity, true, nc, nep);
      if (score < bestScore || (score === bestScore && Math.random() < 0.3)) {
        bestScore = score;
        bestMove = m;
      }
    }

    if (bestMove.piece.type === 'P' && (bestMove.tr === 0 || bestMove.tr === 7)) {
      bestMove.promotion = 'Q';
    }

    const captured = bestMove.enPassant ? board[bestMove.fr][bestMove.tc] : board[bestMove.tr][bestMove.tc];
    if (captured && captured.type !== 'K') {
      const attacker = bestMove.piece;
      const defender = captured;
      runBattle(attacker, defender, 'b', 'w', (attackerWins) => {
        if (attackerWins) {
          makeMove(bestMove);
        } else {
          const state = {
            board: cloneBoard(board), turn, castling: { ...castling },
            enPassant: enPassant ? { ...enPassant } : null, halfMove, fullMove, lastMove
          };
          history.push(state);
          board[bestMove.fr][bestMove.fc] = null;
          lastMove = { fr: bestMove.fr, fc: bestMove.fc, tr: bestMove.tr, tc: bestMove.tc };
          const notation = `${PIECE_RPG[attacker.type].name}x${FILES[bestMove.tc]}${8 - bestMove.tr}?`;
          if (moveList.length) moveList[moveList.length - 1].b = notation;
          halfMove = 0;
          fullMove++;
          turn = 'w';
          selected = null;
          legalMoves = [];
          render();
          renderHistory();
          checkGameState();
        }
      });
    } else {
      sfx('move');
      makeMove(bestMove);
    }
  }

  // --- Timer ---
  function startTimer() {
    stopTimer();
    if (timeLimit === 0) return;
    timerInterval = setInterval(() => {
      if (gameOver) { stopTimer(); return; }
      if (turn === 'w') {
        whiteTime--;
        if (whiteTime <= 0) { whiteTime = 0; gameOver = true; stopTimer(); showModal('Waktu Habis!', 'Hitam menang!'); }
      } else {
        blackTime--;
        if (blackTime <= 0) { blackTime = 0; gameOver = true; stopTimer(); showModal('Waktu Habis!', 'Putih menang!'); }
      }
      renderTimers();
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  }

  function renderTimers() {
    const fmt = s => {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${m}:${sec.toString().padStart(2, '0')}`;
    };
    $('whiteTimer').textContent = timeLimit === 0 ? '\u221E' : fmt(whiteTime);
    $('blackTimer').textContent = timeLimit === 0 ? '\u221E' : fmt(blackTime);
    $('whiteTimer').classList.toggle('low', whiteTime <= 30 && timeLimit > 0);
    $('blackTimer').classList.toggle('low', blackTime <= 30 && timeLimit > 0);
  }

  // --- Init & Events ---
  let currentUser = null;
  let onlineMode = false;
  let myColor = 'w';
  let lobbyId = null;
  let ws = null;

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
  }

  function getWsUrl() {
    if (location.protocol === 'file:') {
      return 'ws://localhost:3000';
    }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${location.host}`;
  }

  function connectWs() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    try {
      ws = new WebSocket(getWsUrl());
    } catch {
      return;
    }

    ws.onopen = () => {
      if (currentUser) {
        sendWs({ type: 'relogin', username: currentUser.username });
      }
      while (wsQueue.length) {
        ws.send(JSON.stringify(wsQueue.shift()));
      }
    };

    ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      switch (msg.type) {
        case 'registerResult':
          if (msg.ok) {
            $('regError').style.color = 'var(--success)';
            $('regError').textContent = 'Registrasi berhasil!';
            const regName = $('regUser').value.trim();
            const regPass = $('regPass').value;
            setTimeout(() => {
              $('regError').style.color = '';
              $('regError').textContent = '';
              sendWs({ type: 'login', username: regName, password: regPass });
            }, 800);
          } else {
            $('regError').textContent = msg.error;
          }
          break;

        case 'loginResult':
          if (msg.ok) {
            currentUser = { username: msg.username };
            localStorage.setItem('chessgg_user', msg.username);
            enterLobby();
          } else {
            $('loginError').textContent = msg.error;
          }
          break;

        case 'lobbyList':
          renderLobbyList(msg.lobbies);
          break;

        case 'lobbyCreated':
          lobbyId = msg.lobbyId;
          $('lobbyIdDisplay').textContent = lobbyId;
          $('lobbyWaiting').style.display = '';
          document.querySelector('.lobby-modes').style.display = 'none';
          break;

        case 'joinResult':
          if (!msg.ok) {
            alert(msg.error);
          }
          break;

        case 'gameStart':
          startOnlineGame(msg.host, msg.guest, msg.color, msg.lobbyId);
          break;

        case 'move':
          receiveOnlineMove(msg);
          break;

        case 'chat':
          addChatMessage(msg.username, msg.text);
          break;

        case 'opponentLeft':
          alert(`${msg.username} telah meninggalkan permainan.`);
          if (onlineMode) {
            leaveLobby();
            enterLobby();
          }
          break;
      }
    };

    ws.onclose = () => {
      setTimeout(connectWs, 2000);
    };
  }

  let wsQueue = [];
  function sendWs(data) {
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(data));
    } else {
      wsQueue.push(data);
    }
  }

  connectWs();

  $('showRegister').addEventListener('click', e => { e.preventDefault(); $('loginCard').style.display = 'none'; $('registerCard').style.display = ''; });
  $('showLogin').addEventListener('click', e => { e.preventDefault(); $('registerCard').style.display = 'none'; $('loginCard').style.display = ''; });

  $('btnRegister').addEventListener('click', () => {
    const user = $('regUser').value.trim();
    const pass = $('regPass').value;
    const pass2 = $('regPass2').value;
    $('regError').textContent = '';
    if (user.length < 3) { $('regError').textContent = 'Username minimal 3 karakter'; return; }
    if (pass.length < 4) { $('regError').textContent = 'Password minimal 4 karakter'; return; }
    if (pass !== pass2) { $('regError').textContent = 'Password tidak cocok'; return; }
    sendWs({ type: 'register', username: user, password: pass });
  });

  $('btnLogin').addEventListener('click', () => {
    const user = $('loginUser').value.trim();
    const pass = $('loginPass').value;
    $('loginError').textContent = '';
    if (!user || !pass) { $('loginError').textContent = 'Isi semua field'; return; }
    sendWs({ type: 'login', username: user, password: pass });
  });

  function enterLobby() {
    $('lobbyUsername').textContent = currentUser.username;
    showScreen('lobbyScreen');
    sendWs({ type: 'getLobbies' });
  }

  $('btnLogout').addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('chessgg_user');
    leaveLobby();
    showScreen('authScreen');
  });

  $('btnPlayOffline').addEventListener('click', () => {
    onlineMode = false;
    $('onlineBadge').style.display = 'none';
    $('modeSection').style.display = '';
    $('difficultySection').style.display = mode === 'ai' ? '' : 'none';
    $('onlineChatSection').style.display = 'none';
    $('btnUndo').style.display = '';
    $('whitePlayerName').textContent = currentUser ? currentUser.username + ' (Putih)' : 'Putih (Kamu)';
    showScreen('gameScreen');
    newGame();
  });

  $('btnCreateLobby').addEventListener('click', () => {
    sendWs({ type: 'createLobby' });
  });

  $('btnCopyLobby').addEventListener('click', () => {
    navigator.clipboard.writeText(lobbyId).catch(() => {});
    $('btnCopyLobby').textContent = 'Copied!';
    setTimeout(() => $('btnCopyLobby').textContent = 'Copy', 1500);
  });

  $('btnCancelLobby').addEventListener('click', () => {
    sendWs({ type: 'cancelLobby' });
    leaveLobby();
    $('lobbyWaiting').style.display = 'none';
    document.querySelector('.lobby-modes').style.display = '';
  });

  $('btnJoinLobby').addEventListener('click', () => {
    const id = $('joinLobbyInput').value.trim().toUpperCase();
    if (!id) return;
    sendWs({ type: 'joinLobby', lobbyId: id });
  });

  function renderLobbyList(lobbies) {
    const list = $('roomsList');
    list.innerHTML = '';
    if (!lobbies || lobbies.length === 0) {
      list.innerHTML = '<p style="color:var(--text2);text-align:center;padding:16px">Belum ada lobby aktif</p>';
      return;
    }
    for (const lobby of lobbies) {
      const div = document.createElement('div');
      div.className = 'room-item';
      div.innerHTML = `<div class="room-item-info"><span class="room-item-name">${lobby.host}</span><span class="room-item-id">ID: ${lobby.id}</span></div><button class="btn action-btn primary btn-sm" data-id="${lobby.id}">Join</button>`;
      div.querySelector('button').addEventListener('click', () => {
        $('joinLobbyInput').value = lobby.id;
        $('btnJoinLobby').click();
      });
      list.appendChild(div);
    }
  }

  function leaveLobby() {
    sendWs({ type: 'leaveLobby' });
    lobbyId = null;
  }

  function startOnlineGame(hostName, guestName, color, id) {
    onlineMode = true;
    myColor = color;
    lobbyId = id;
    mode = 'online';
    flipped = myColor === 'b';

    $('onlineBadge').style.display = '';
    $('modeSection').style.display = 'none';
    $('difficultySection').style.display = 'none';
    $('onlineChatSection').style.display = '';
    $('btnUndo').style.display = 'none';
    $('chatMessages').innerHTML = '';

    $('whitePlayerName').textContent = hostName + ' (Putih)';
    $('blackPlayerName').textContent = guestName + ' (Hitam)';

    showScreen('gameScreen');
    newGame();
    addChatMessage('System', `Game dimulai! ${hostName} vs ${guestName}`);
  }

  function sendOnlineMove(move) {
    if (!onlineMode) return;
    sendWs({
      type: 'move',
      fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc,
      promotion: move.promotion || null
    });
  }

  function receiveOnlineMove(msg) {
    const moves = getLegalMoves(turn, board, castling, enPassant);
    const move = moves.find(m => m.fr === msg.fr && m.fc === msg.fc && m.tr === msg.tr && m.tc === msg.tc && (m.promotion || null) === msg.promotion);
    if (!move) return;

    const captured = move.enPassant ? board[move.fr][move.tc] : board[move.tr][move.tc];
    if (captured && captured.type !== 'K') {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      runBattle(move.piece, captured, move.piece.color, captured.color, (attackerWins) => {
        if (attackerWins) {
          makeMove(move);
        } else {
          const state = {
            board: cloneBoard(board), turn, castling: { ...castling },
            enPassant: enPassant ? { ...enPassant } : null, halfMove, fullMove, lastMove
          };
          history.push(state);
          board[move.fr][move.fc] = null;
          lastMove = { fr: move.fr, fc: move.fc, tr: move.tr, tc: move.tc };
          halfMove = 0;
          if (turn === 'b') fullMove++;
          turn = turn === 'w' ? 'b' : 'w';
          selected = null;
          legalMoves = [];
          render();
          renderHistory();
          checkGameState();
        }
      });
    } else {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      sfx('move');
      makeMove(move);
    }
  }

  function addChatMessage(username, text) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-msg-user">${username}:</span><span class="chat-msg-text">${text}</span>`;
    $('chatMessages').appendChild(div);
    $('chatMessages').scrollTop = $('chatMessages').scrollHeight;
  }

  $('btnSendChat').addEventListener('click', sendChat);
  $('chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  function sendChat() {
    const text = $('chatInput').value.trim();
    if (!text) return;
    sendWs({ type: 'chat', text });
    $('chatInput').value = '';
  }

  $('btnBackToLobby').addEventListener('click', () => {
    if (onlineMode) leaveLobby();
    onlineMode = false;
    stopTimer();
    gameOver = true;
    enterLobby();
  });

  // --- Modify executeMoveWithBattle for online ---
  const _origExecute = executeMoveWithBattle;
  executeMoveWithBattle = function(move) {
    if (onlineMode) {
      sendOnlineMove(move);
    }
    _origExecute(move);
  };

  function newGame() {
    board = parseFEN(INIT_FEN);
    gameOver = false;
    selected = null;
    legalMoves = [];
    history = [];
    moveList = [];
    lastMove = null;
    pendingPromotion = null;
    whiteTime = timeLimit;
    blackTime = timeLimit;
    modalOverlay.classList.remove('active');
    promotionOverlay.classList.remove('active');
    render();
    renderHistory();
    renderTimers();
    updateStatus();
    startTimer();
  }

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (onlineMode) return;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
      $('difficultySection').style.display = mode === 'ai' ? '' : 'none';
      $('blackPlayerName').textContent = mode === 'ai' ? 'Hitam (AI)' : 'Hitam (Pemain 2)';
      newGame();
    });
  });

  document.querySelectorAll('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      difficulty = btn.dataset.diff;
    });
  });

  document.querySelectorAll('.time-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timeLimit = +btn.dataset.time;
      newGame();
    });
  });

  $('btnNewGame').addEventListener('click', () => {
    if (onlineMode) return;
    newGame();
  });
  $('btnUndo').addEventListener('click', () => {
    if (onlineMode) return;
    undoMove();
    if (mode === 'ai' && turn === 'b' && history.length) undoMove();
  });
  $('btnFlip').addEventListener('click', () => { flipped = !flipped; render(); });
  $('modalBtnRestart').addEventListener('click', () => {
    if (onlineMode) {
      modalOverlay.classList.remove('active');
      enterLobby();
    } else {
      newGame();
    }
  });

  // --- Session check ---
  const savedUser = localStorage.getItem('chessgg_user');
  if (savedUser) {
    currentUser = { username: savedUser };
    enterLobby();
  } else {
    showScreen('authScreen');
  }
})();
