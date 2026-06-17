import { layouts } from "./layouts.js";

document.addEventListener('DOMContentLoaded', () => {
  const scoreDisplay = document.getElementById('score');
  const levelDisplay = document.getElementById('level');

  const sounds = {
    waka: new Audio('./soundfile/Pac-Man Waka Waka Seamless Loop 4.mp3'),
    death: new Audio('./soundfile/PacMan Death - Sound Effect HD.mp3'),
    scared: new Audio('./soundfile/Pac man scared ghost sound 4.mp3'),
    start: new Audio('./soundfile/Pac-Man Theme Original.mp3'),
  };

  sounds.waka.loop = true;
  sounds.scared.loop = true;

  const width = 28;
  const grid = document.querySelector('.grid');

  let score = 0;
  let level = 1
  let highScore = 0;
  let gameActive = false;
  let startupTimeout = null;

  // ── Overlay ──────────────────────────────────────────────────────
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub = document.getElementById('overlay-subtitle');
  const overlayScore = document.getElementById('overlay-score');

  function showOverlay(title, subtitle, scoreText) {
    overlayTitle.textContent = title;
    overlaySub.textContent = subtitle;
    overlayScore.textContent = scoreText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // ── Board ────────────────────────────────────────────────────────
  let layout, dots, collected, squares, pacmanCurrentIndex, pacmanDirection, pacmanTimer;

  function createBoard() {
    grid.innerHTML = '';
    squares = [];
    collected = 0;
    pacmanDirection = null;
    pacmanCurrentIndex = 490;

    layout = layouts[Math.floor(Math.random() * layouts.length)];
    dots = layout.filter(cell => cell === 0);

    const tunnelRow = 13;
    const rowStart = tunnelRow * width;
    const rowEnd = rowStart + width

    let tunnelLeft = null;
    let tunnelRight = null;

    for (let i = rowStart; i < rowEnd; i++) {
      if (layout[i] !== 1) {
        if (tunnelLeft === null) tunnelLeft = i;
        tunnelRight = i;
      }
    }

    window._tunnelLeft = tunnelLeft;
    window._tunnelRight = tunnelRight;

    for (let i = 0; i < layout.length; i++) {
      const square = document.createElement('div');
      square.id = i;
      grid.appendChild(square);
      squares.push(square);

      if (layout[i] === 0) square.classList.add('pac-dot');
      if (layout[i] === 1) square.classList.add('wall');
      if (layout[i] === 2) square.classList.add('ghost-lair');
      if (layout[i] === 3) square.classList.add('power-pellet');
    }

    squares[pacmanCurrentIndex].classList.add('pac-man');
  }

  // ── Startup ──────────────────────────────────────────────────────
  const STARTUP_DELAY = 5000;

  function startSequence() {
    if (startupTimeout !== null) return;

    gameActive = false;
    clearInterval(pacmanTimer);

    createBoard();
    initGhosts();

    if (level === 1) {
      sounds.start.currentTime = 0;
      sounds.start.play();
    }

    showOverlay('GET READY!', '', '');

    startupTimeout = setTimeout(() => {
      startupTimeout = null;
      sounds.start.pause();
      sounds.start.currentTime = 0
      hideOverlay();
      gameActive = true;
      pacmanTimer = setInterval(movePacman, 200);
      ghosts.forEach(ghost => moveGhost(ghost));
    }, STARTUP_DELAY);
  }

  // ── Pac-Man ──────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    switch (e.key) {
      case 'ArrowLeft': case 'a': pacmanDirection = -1; break;
      case 'ArrowRight': case 'd': pacmanDirection = 1; break;
      case 'ArrowUp': case 'w': pacmanDirection = -width; break;
      case 'ArrowDown': case 's': pacmanDirection = width; break;
    }
  });

  function movePacman() {
    if (!gameActive || pacmanDirection === null) return;

    const next = pacmanCurrentIndex + pacmanDirection;
    const tunnelLeft = window._tunnelLeft;
    const tunnelRight = window._tunnelRight;

    const canMove =
      (pacmanCurrentIndex === tunnelRight && pacmanDirection === 1) ||
      (pacmanCurrentIndex === tunnelLeft && pacmanDirection === -1) ||
      (next >= 0 && next < squares.length &&
        !squares[next].classList.contains('wall') &&
        !squares[next].classList.contains('ghost-lair'));

    if (canMove) {
      sounds.waka.play();
    } else {
      sounds.waka.pause();
    }

    function leaveCurrent() {
      squares[pacmanCurrentIndex].classList.remove('pac-man');
      squares[pacmanCurrentIndex].style.backgroundImage = '';  // ← clear image
      squares[pacmanCurrentIndex].style.backgroundColor = '';
    }


    if (pacmanCurrentIndex === tunnelRight && pacmanDirection === 1) {
      leaveCurrent();
      pacmanCurrentIndex = tunnelLeft;
      squares[pacmanCurrentIndex].classList.add('pac-man');
    } else if (pacmanCurrentIndex === tunnelLeft && pacmanDirection === -1) {
      leaveCurrent();
      pacmanCurrentIndex = tunnelRight;
      squares[pacmanCurrentIndex].classList.add('pac-man');
    } else if (
      next >= 0 &&
      next < squares.length &&
      !squares[next].classList.contains('wall') &&
      !squares[next].classList.contains('ghost-lair')
    ) {
      leaveCurrent();
      pacmanCurrentIndex = next;
      squares[pacmanCurrentIndex].classList.add('pac-man');
    }

    updatePacmanImage()
    pacDotEaten();
    powerPelletEaten();
    checkForScaredGhostEaten();
    checkForGameOver();
  }

  // ── Dots & pellets ───────────────────────────────────────────────
  function pacDotEaten() {
    if (squares[pacmanCurrentIndex].classList.contains('pac-dot')) {
      score += 100;
      collected++;
      scoreDisplay.innerHTML = score;
      squares[pacmanCurrentIndex].classList.remove('pac-dot');
      checkForWin();
    }
  }

  function powerPelletEaten() {
    if (squares[pacmanCurrentIndex].classList.contains('power-pellet')) {
      score += 1000;
      scoreDisplay.innerHTML = score;
      ghosts.forEach(ghost => {
        ghost.isScared = true;
        updateGhostImage(ghost)
      });
      sounds.waka.pause()
      sounds.scared.currentTime = 0
      sounds.scared.play()
      setTimeout(unScareGhosts, 10000);
      squares[pacmanCurrentIndex].classList.remove('power-pellet');
    }
  }

  function unScareGhosts() {
    ghosts.forEach(ghost => {
      ghost.isScared = false
      updateGhostImage(ghost)
    });
    sounds.scared.pause()
    sounds.scared.currentTime = 0
  }

  // ── Ghosts ───────────────────────────────────────────────────────
  class Ghost {
    constructor(className, startIndex, speed, personality) {
      this.className = className;
      this.startIndex = startIndex;
      this.speed = speed;
      this.currentIndex = startIndex;
      this.isScared = false;
      this.isReturning = false;
      this.timerId = NaN;
      this.personality = personality;
      this.direction = 1;
    }
  }

  let ghosts = [];

  function initGhosts() {
    ghosts.forEach(g => clearInterval(g.timerId));
    const s = Math.max(0.5, Math.pow(0.9, level - 1));
    ghosts = [
      new Ghost('blinky', 348, 250 * s, 'chase'),
      new Ghost('pinky',  376, 400 * s, 'random'),
      new Ghost('inky',   351, 300 * s, 'intercept'),
      new Ghost('clyde',  379, 500 * s, 'random'),
      new Ghost('licky',  347, 250 * s, 'chase'),
      new Ghost('sneaky', 349, 650 * s, 'intercept'),
      new Ghost('sticky', 375, 850 * s, 'blocker'),
      new Ghost('tike',   378, 1000 * s, 'blocker'),
    ];
  }

  function getDistance(a, b) {
    const ax = a % width, ay = Math.floor(a / width);
    const bx = b % width, by = Math.floor(b / width);
    return Math.abs(ax - bx) + Math.abs(ay - by);
  }

  function getBestDirection(ghost, targetIndex) {
    const opposite = -ghost.direction;
    const directions = [-1, 1, width, -width];
    const preferred = directions.filter(d => d !== opposite);

    let bestDir = null;
    let bestDist = Infinity;

    for (const d of preferred) {
      const next = ghost.currentIndex + d;
      if (
        next >= 0 &&
        !squares[next].classList.contains('wall') &&
        !squares[next].classList.contains('ghost')
      ) {
        const dist = getDistance(next, targetIndex);
        if (dist < bestDist) {
          bestDist = dist;
          bestDir = d;
        }
      }
    }

    if (bestDir === null) {
      for (const d of directions) {
        const next = ghost.currentIndex + d;
        if (
          next >= 0 &&
          !squares[next].classList.contains('wall') &&
          !squares[next].classList.contains('ghost')
        ) {
          const dist = getDistance(next, targetIndex);
          if (dist < bestDist) {
            bestDist = dist;
            bestDir = d;
          }
        }
      }
    }

    return bestDir ?? ghost.direction;
  }

  function getInterceptTarget() {
    if (!pacmanDirection) return pacmanCurrentIndex;
    let target = pacmanCurrentIndex;
    for (let i = 0; i < 4; i++) {
      const next = target + pacmanDirection;
      if (next < 0 || next >= squares.length || squares[next].classList.contains('wall')) break;
      target = next;
    }
    return target;
  }

  function getBlockerTarget(ghost) {
    const tunnelLeft = window._tunnelLeft;
    const tunnelRight = window._tunnelRight;
    const distLeft = getDistance(pacmanCurrentIndex, tunnelLeft);
    const distRight = getDistance(pacmanCurrentIndex, tunnelRight);
    return distLeft < distRight ? tunnelLeft : tunnelRight;
  }

  function getRandomDirection(ghost) {
    const opposite = -ghost.direction;
    const directions = [-1, 1, width, -width];
    const preferred = directions.filter(d => {
      if (d === opposite) return false;
      const next = ghost.currentIndex + d;
      return (
        next >= 0 &&
        next < squares.length &&
        !squares[next].classList.contains('wall') &&
        !squares[next].classList.contains('ghost')
      );
    });

    if (preferred.length > 0) {
      return preferred[Math.floor(Math.random() * preferred.length)];
    }

    const fallback = directions.filter(d => {
      const next = ghost.currentIndex + d;
      return (
        next >= 0 &&
        next < squares.length &&
        !squares[next].classList.contains('wall') &&
        !squares[next].classList.contains('ghost')
      );
    });

    return fallback.length > 0
      ? fallback[Math.floor(Math.random() * fallback.length)]
      : ghost.direction;
  }

  function showPointsPopup(cellIndex, points) {
    const container = document.querySelector('.game-container');
    const containerRect = container.getBoundingClientRect();
    const cellRect = squares[cellIndex].getBoundingClientRect();
    const popup = document.createElement('div');
    popup.className = 'points-popup';
    popup.textContent = `+${points}`;
    popup.style.left = (cellRect.left - containerRect.left + cellRect.width / 2) + 'px';
    popup.style.top  = (cellRect.top  - containerRect.top) + 'px';
    container.appendChild(popup);
    setTimeout(() => popup.remove(), 800);
  }

  function eatGhost(ghost) {
    squares[ghost.currentIndex].classList.remove('scared-ghost');
    squares[ghost.currentIndex].classList.add('returning-ghost');
    ghost.isScared = false;
    ghost.isReturning = true;
    score += 200;
    scoreDisplay.innerHTML = score;
    showPointsPopup(ghost.currentIndex, 200);
    updateGhostImage(ghost);
  }

  function checkForScaredGhostEaten() {
    ghosts.forEach(ghost => {
      if (ghost.isScared && ghost.currentIndex === pacmanCurrentIndex) {
        eatGhost(ghost);
      }
    });
  }

  function moveGhost(ghost) {

    squares[ghost.currentIndex].classList.add(ghost.className, 'ghost')
    updateGhostImage(ghost);

    ghost.timerId = setInterval(function () {
      if (!gameActive) return;

      // ── Eyes returning to base ────────────────────────────────────
      if (ghost.isReturning) {
        if (ghost.currentIndex === ghost.startIndex) {
          ghost.isReturning = false;
          squares[ghost.currentIndex].classList.remove('returning-ghost');
          updateGhostImage(ghost);
          return;
        }

        const dirs = [-1, 1, width, -width];
        const opposite = -ghost.direction;
        let bestDir = null, bestDist = Infinity;

        for (const d of dirs) {
          if (d === opposite) continue;
          const n = ghost.currentIndex + d;
          if (n >= 0 && n < squares.length && !squares[n].classList.contains('wall')) {
            const dist = getDistance(n, ghost.startIndex);
            if (dist < bestDist) { bestDist = dist; bestDir = d; }
          }
        }
        if (bestDir === null) {
          for (const d of dirs) {
            const n = ghost.currentIndex + d;
            if (n >= 0 && n < squares.length && !squares[n].classList.contains('wall')) {
              const dist = getDistance(n, ghost.startIndex);
              if (dist < bestDist) { bestDist = dist; bestDir = d; }
            }
          }
        }

        if (bestDir !== null) {
          const n = ghost.currentIndex + bestDir;
          squares[ghost.currentIndex].classList.remove(ghost.className, 'ghost', 'returning-ghost');
          squares[ghost.currentIndex].style.backgroundImage = '';
          squares[ghost.currentIndex].style.backgroundColor = '';
          ghost.direction = bestDir;
          ghost.currentIndex = n;
          squares[ghost.currentIndex].classList.add(ghost.className, 'ghost', 'returning-ghost');
          updateGhostImage(ghost);
        }
        return;
      }

      // ── Normal movement ───────────────────────────────────────────
      let chosenDir;

      if (ghost.isScared) {
        const opposite = -ghost.direction;
        const directions = [-1, 1, width, -width];
        const preferred = directions.filter(d => d !== opposite);
        let worstDir = null;
        let worstDist = -1;
        for (const d of preferred) {
          const next = ghost.currentIndex + d;
          if (
            next >= 0 &&
            next < squares.length &&
            !squares[next].classList.contains('wall') &&
            !squares[next].classList.contains('ghost')
          ) {
            const dd = getDistance(next, pacmanCurrentIndex);
            if (dd > worstDist) { worstDist = dd; worstDir = d; }
          }
        }
        if (worstDir === null) {
          for (const d of directions) {
            const next = ghost.currentIndex + d;
            if (
              next >= 0 &&
              next < squares.length &&
              !squares[next].classList.contains('wall') &&
              !squares[next].classList.contains('ghost')
            ) {
              const dd = getDistance(next, pacmanCurrentIndex);
              if (dd > worstDist) { worstDist = dd; worstDir = d; }
            }
          }
        }
        chosenDir = worstDir ?? ghost.direction;
      } else {
        switch (ghost.personality) {
          case 'chase':
            chosenDir = getBestDirection(ghost, pacmanCurrentIndex);
            break;
          case 'intercept':
            chosenDir = getBestDirection(ghost, getInterceptTarget());
            break;
          case 'blocker':
            chosenDir = getBestDirection(ghost, getBlockerTarget(ghost));
            break;
          default: // 'random'
            chosenDir = getRandomDirection(ghost);
            break;
        }
      }

      const next = ghost.currentIndex + chosenDir;
      if (
        next >= 0 &&
        next < squares.length &&
        !squares[next].classList.contains('wall') &&
        !squares[next].classList.contains('ghost')
      ) {
        squares[ghost.currentIndex].classList.remove(ghost.className, 'ghost', 'scared-ghost');
        squares[ghost.currentIndex].style.backgroundImage = '';
        squares[ghost.currentIndex].style.backgroundColor = '';
        ghost.direction = chosenDir;
        ghost.currentIndex = next;
        squares[ghost.currentIndex].classList.add(ghost.className, 'ghost');
      } else {
        ghost.direction = getRandomDirection(ghost);
      }

      if (ghost.isScared) {
        squares[ghost.currentIndex].classList.add('scared-ghost');
      }

      if (ghost.isScared && squares[ghost.currentIndex].classList.contains('pac-man')) {
        eatGhost(ghost);
      }

      updateGhostImage(ghost);
      checkForGameOver();
    }, ghost.speed)

  }

  function directionName(d) {
    if (d === -1) return 'left';
    if (d === 1) return 'right';
    if (d === -width) return 'up';
    if (d === width) return 'down';
    return 'right';
  }

  function updatePacmanImage() {
    const dir = directionName(pacmanDirection);
    squares[pacmanCurrentIndex].style.backgroundImage =
      `url('pictures/pacman-${dir}.png')`;
    squares[pacmanCurrentIndex].style.backgroundSize = 'cover';
    squares[pacmanCurrentIndex].style.backgroundColor = 'transparent';
  }

  function updateGhostImage(ghost) {
    const el = squares[ghost.currentIndex];
    if (ghost.isReturning) {
      el.style.backgroundImage = '';
      el.style.backgroundColor = '';
    } else if (ghost.isScared) {
      el.style.backgroundImage = `url('pictures/sarce-ghost.png')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundColor = 'transparent';
    } else {
      const dir = directionName(ghost.direction);
      el.style.backgroundImage = `url('pictures/${ghost.className}-${dir}.png')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundColor = 'transparent';
    }
  }


  // ── End conditions ───────────────────────────────────────────────
  function stopGame() {
    gameActive = false;
    clearInterval(pacmanTimer);
    ghosts.forEach(ghost => clearInterval(ghost.timerId));
    sounds.waka.pause();
    sounds.scared.pause();
    sounds.waka.currentTime = 0;
    sounds.scared.currentTime = 0;
  }

  function checkForGameOver() {
    if (
      squares[pacmanCurrentIndex].classList.contains('ghost') &&
      !squares[pacmanCurrentIndex].classList.contains('scared-ghost') &&
      !squares[pacmanCurrentIndex].classList.contains('returning-ghost')
    ) {
      stopGame();
      sounds.waka.pause()
      sounds.scared.pause()
      sounds.death.currentTime = 0
      sounds.death.play()
      if (score > highScore) highScore = score;
      score = 0;
      level = 1;
      levelDisplay.innerHTML = level;
      scoreDisplay.innerHTML = score;
      showOverlay('GAME OVER', 'Press Space to try again', `High Score: ${highScore}`);
    }
  }

  function checkForWin() {
    if (collected === dots.length) {
      stopGame();
      if (score > highScore) highScore = score;
      showOverlay('YOU WIN!', 'Press Space to play again (score carries over)', `Score: ${score}  |  High Score: ${highScore}`);
      level++
      levelDisplay.innerHTML = level
    }
  }

  // ── Play again ───────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (
      e.key === ' ' &&
      !overlay.classList.contains('hidden') &&
      startupTimeout === null
    ) {
      startSequence();
    }
  });

  // ── Kick off ─────────────────────────────────────────────────────
  startSequence();
});