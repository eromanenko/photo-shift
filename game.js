class PhotoShiftGame {
    constructor(containerId, options) {
        this.container = document.getElementById(containerId);
        this.size = parseInt(options.difficulty) || 3;
        this.imageSrc = options.imageSrc;
        this.imgW = options.imgW || 800;
        this.imgH = options.imgH || 800;
        this.onMoveCallback = options.onMove || (() => {});
        this.onWinCallback = options.onWin || (() => {});
        this.onSnapCallback = options.onSnap || (() => {});
        
        this.moves = 0;
        this.tiles = [];
        this.isPlaying = false;
        this.isStarting = false;
        
        // Solve Hint state
        this.solutions = null;
        this.solveHintEnabled = false;
        this.solveAlgorithm = null;
        this.solveStates = [];
        this.solveMoves = [];
        this.hintArrowEl = null;
        
        // Drag state
        this.isDragging = false;
        this.dragType = null; // 'row' or 'col'
        this.dragIndex = -1;
        this.startPos = { x: 0, y: 0 };
        this.currentOffset = 0;
        this.activeTiles = [];
        this.activeClones = null;
        
        // Find or create wrapper element
        if (this.container.parentElement.classList.contains('game-wrapper')) {
            this.gameWrapper = this.container.parentElement;
            const oldControls = this.gameWrapper.querySelectorAll('.desktop-controls');
            oldControls.forEach(c => c.remove());
            const oldHints = this.gameWrapper.querySelectorAll('.hint-overlay');
            oldHints.forEach(h => h.remove());
        } else {
            const parentContainer = this.container.parentElement;
            this.gameWrapper = document.createElement('div');
            this.gameWrapper.className = 'game-wrapper';
            parentContainer.insertBefore(this.gameWrapper, this.container);
            this.gameWrapper.appendChild(this.container);
        }

        this.init();
        this.loadSolutions();
    }

    async loadSolutions() {
        if (this.size !== 4 && this.size !== 5) return;
        try {
            const fileName = this.size === 4 ? 'solutions4x4.json' : 'solutions5x5.json';
            const response = await fetch(fileName);
            this.solutions = await response.json();
            this.updateSolveHintUI();
        } catch (err) {
            console.error('Failed to load solutions', err);
        }
    }

    async init() {
        this.container.innerHTML = ''; // clear board
        
        const isDesktop = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
        const controlSpace = isDesktop ? 80 : 0; // 40px each side
        
        const parentContainer = this.gameWrapper.parentElement;
        
        // Temporarily hide the wrapper to measure true available space 
        // without feedback loop from previous explicit heights
        this.gameWrapper.style.display = 'none';
        
        const computedStyle = window.getComputedStyle(parentContainer);
        const paddingX = (parseFloat(computedStyle.paddingLeft) || 0) + (parseFloat(computedStyle.paddingRight) || 0);
        const paddingY = (parseFloat(computedStyle.paddingTop) || 0) + (parseFloat(computedStyle.paddingBottom) || 0);
        
        // Use offsetWidth/offsetHeight instead of getBoundingClientRect()
        // to get the true layout size, ignoring CSS scale() transitions
        const availableWidth = parentContainer.offsetWidth - paddingX - controlSpace;
        const availableHeight = parentContainer.offsetHeight - paddingY - controlSpace;
        
        this.gameWrapper.style.display = '';
        
        const imgAspect = this.imgW / this.imgH;
        let boardW = availableWidth;
        let boardH = boardW / imgAspect;
        
        if (boardH > availableHeight) {
            boardH = availableHeight;
            boardW = boardH * imgAspect;
        }
        
        this.boardWidth = boardW;
        this.boardHeight = boardH;
        
        this.container.style.width = `${boardW}px`;
        this.container.style.height = `${boardH}px`;
        
        this.gameWrapper.style.width = `${boardW}px`;
        this.gameWrapper.style.height = `${boardH}px`;
        this.gameWrapper.style.position = 'relative';
        
        this.container.innerHTML = ''; // clear board

        // Create or reset hint overlay inside game-board for perfect alignment
        this.hintOverlay = document.createElement('div');
        this.hintOverlay.className = 'hint-overlay hidden';
        this.container.appendChild(this.hintOverlay);

        this.tileW = this.boardWidth / this.size;
        this.tileH = this.boardHeight / this.size;

        // Initialize tiles array
        let idCount = 0;
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                const tileEl = document.createElement('div');
                tileEl.className = 'tile';
                tileEl.style.width = `${this.tileW}px`;
                tileEl.style.height = `${this.tileH}px`;
                tileEl.style.backgroundImage = `url(${this.imageSrc})`;
                tileEl.style.backgroundSize = `${this.boardWidth}px ${this.boardHeight}px`;
                
                // Original background positions
                const bgX = -c * this.tileW;
                const bgY = -r * this.tileH;
                tileEl.style.backgroundPosition = `${bgX}px ${bgY}px`;
                
                this.container.appendChild(tileEl);

                this.tiles.push({
                    id: idCount++,
                    correctRow: r,
                    correctCol: c,
                    row: r,
                    col: c,
                    el: tileEl
                });
            }
        }
        
        this.updateVisuals(false);
        this.setupEvents();
        
        if (isDesktop) {
            this.createDesktopControls();
        }
        
        this.createStartOverlay();
    }

    createDesktopControls() {
        const svgArrowLeft = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
        const svgArrowRight = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
        const svgArrowUp = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
        const svgArrowDown = `<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

        const createContainer = (className) => {
            const el = document.createElement('div');
            el.className = `desktop-controls ${className}`;
            this.gameWrapper.appendChild(el);
            return el;
        };

        const leftControls = createContainer('controls-left');
        const rightControls = createContainer('controls-right');
        const topControls = createContainer('controls-top');
        const bottomControls = createContainer('controls-bottom');

        const triggerMove = (type, index, amount) => {
            if (!this.isPlaying || this.isDragging) return;
            
            this.isDragging = true;
            this.dragType = type;
            this.dragIndex = index;
            if (type === 'row') {
                this.activeTiles = this.tiles.filter(t => t.row === index);
            } else {
                this.activeTiles = this.tiles.filter(t => t.col === index);
            }
            this.createClones();
            
            const targetOffset = type === 'row' ? amount * this.tileW : amount * this.tileH;
            let startTime = null;
            const duration = 200; // ms
            
            const animate = (timestamp) => {
                if (!startTime) startTime = timestamp;
                const progress = Math.min((timestamp - startTime) / duration, 1);
                
                // Ease out quad
                const ease = 1 - (1 - progress) * (1 - progress);
                this.currentOffset = targetOffset * ease;
                
                this.renderDrag();
                
                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    this.currentOffset = targetOffset;
                    this.finalizeDrag(amount);
                    
                    this.isDragging = false;
                    this.dragType = null;
                    this.activeTiles = [];
                    this.updateVisuals(true);
                }
            };
            requestAnimationFrame(animate);
        };

        for (let i = 0; i < this.size; i++) {
            const leftBtn = document.createElement('button');
            leftBtn.className = 'control-arrow vertical-btn';
            leftBtn.innerHTML = svgArrowLeft;
            leftBtn.style.height = `${this.tileH}px`;
            leftBtn.addEventListener('click', () => triggerMove('row', i, -1));
            leftControls.appendChild(leftBtn);
            
            const rightBtn = document.createElement('button');
            rightBtn.className = 'control-arrow vertical-btn';
            rightBtn.innerHTML = svgArrowRight;
            rightBtn.style.height = `${this.tileH}px`;
            rightBtn.addEventListener('click', () => triggerMove('row', i, 1));
            rightControls.appendChild(rightBtn);
            
            const topBtn = document.createElement('button');
            topBtn.className = 'control-arrow horizontal-btn';
            topBtn.innerHTML = svgArrowUp;
            topBtn.style.width = `${this.tileW}px`;
            topBtn.addEventListener('click', () => triggerMove('col', i, -1));
            topControls.appendChild(topBtn);
            
            const bottomBtn = document.createElement('button');
            bottomBtn.className = 'control-arrow horizontal-btn';
            bottomBtn.innerHTML = svgArrowDown;
            bottomBtn.style.width = `${this.tileW}px`;
            bottomBtn.addEventListener('click', () => triggerMove('col', i, 1));
            bottomControls.appendChild(bottomBtn);
        }
    }

    createStartOverlay() {
        this.startOverlay = document.createElement('div');
        this.startOverlay.className = 'play-overlay glass-panel';
        this.startOverlay.innerHTML = '<button class="primary-btn huge">SHUFFLE & PLAY</button>';
        this.container.appendChild(this.startOverlay);
        
        const playBtn = this.startOverlay.querySelector('button');
        
        const handleStart = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (this.isStarting) return;
            this.isStarting = true;
            
            this.startOverlay.style.opacity = '0';
            setTimeout(() => this.startOverlay.remove(), 300);
            
            await this.shuffle();
            this.isPlaying = true;
            this.isStarting = false;
        };

        // Use pointerup for instant response on mobile
        playBtn.addEventListener('pointerup', handleStart);
        // Fallback for some browsers
        playBtn.addEventListener('click', (e) => {
            if (!this.isStarting) handleStart(e);
        });
    }

    updateVisuals(animate = false) {
        this.tiles.forEach(tile => {
            if (this.isDragging && this.activeTiles.includes(tile)) {
                // If dragging, position is dynamically handled
                return; 
            }
            if (animate) {
                tile.el.style.transition = 'transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
            } else {
                tile.el.style.transition = 'none';
            }
            const x = tile.col * this.tileW;
            const y = tile.row * this.tileH;
            tile.el.style.transform = `translate(${x}px, ${y}px)`;
        });
    }

    setupEvents() {
        this._boundPointerDown = this.onPointerDown.bind(this);
        this._boundPointerMove = this.onPointerMove.bind(this);
        this._boundPointerUp = this.onPointerUp.bind(this);
        this._boundTouchStart = e => { if (this.isPlaying) e.preventDefault(); };

        // Pointer events for uniform touch/mouse handling
        this.container.addEventListener('pointerdown', this._boundPointerDown);
        window.addEventListener('pointermove', this._boundPointerMove);
        window.addEventListener('pointerup', this._boundPointerUp);
        window.addEventListener('pointercancel', this._boundPointerUp);
        
        // Prevent default touch actions like scrolling only when actively playing/dragging
        this.container.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    }

    destroy() {
        this.isPlaying = false;
        if (this._boundPointerDown) {
            this.container.removeEventListener('pointerdown', this._boundPointerDown);
            window.removeEventListener('pointermove', this._boundPointerMove);
            window.removeEventListener('pointerup', this._boundPointerUp);
            window.removeEventListener('pointercancel', this._boundPointerUp);
            this.container.removeEventListener('touchstart', this._boundTouchStart);
        }
    }

    getTileAtEvent(e) {
        const boardRect = this.container.getBoundingClientRect();
        const x = e.clientX - boardRect.left;
        const y = e.clientY - boardRect.top;
        
        const col = Math.floor(x / this.tileW);
        const row = Math.floor(y / this.tileH);
        
        if (col >= 0 && col < this.size && row >= 0 && row < this.size) {
            return this.tiles.find(t => t.row === row && t.col === col);
        }
        return null;
    }

    onPointerDown(e) {
        if (!this.isPlaying || this.isDragging) return;
        
        const tile = this.getTileAtEvent(e);
        if (!tile) return;
        
        this.isDragging = true;
        this.dragType = null;
        this.startPos = { x: e.clientX, y: e.clientY };
        this.currentOffset = 0;
        this.dragOriginTile = tile;
        
        // Remove transitions for smooth dragging
        this.tiles.forEach(t => t.el.style.transition = 'none');
    }

    onPointerMove(e) {
        if (!this.isDragging) return;
        
        const dx = e.clientX - this.startPos.x;
        const dy = e.clientY - this.startPos.y;
        
        // Lock axis if moved sufficiently (threshold e.g. 5px)
        if (!this.dragType) {
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                if (Math.abs(dx) > Math.abs(dy)) {
                    this.dragType = 'row';
                    this.dragIndex = this.dragOriginTile.row;
                    this.activeTiles = this.tiles.filter(t => t.row === this.dragIndex);
                } else {
                    this.dragType = 'col';
                    this.dragIndex = this.dragOriginTile.col;
                    this.activeTiles = this.tiles.filter(t => t.col === this.dragIndex);
                }
                this.createClones();
            } else {
                return; // Not moved enough to lock
            }
        }
        
        // Calculate offset and visual wrapping
        // Clamp currentOffset to prevent visual dragging beyond 1 tile
        if (this.dragType === 'row') {
            this.currentOffset = Math.max(-this.tileW, Math.min(this.tileW, dx));
        } else {
            this.currentOffset = Math.max(-this.tileH, Math.min(this.tileH, dy));
        }
        
        this.renderDrag();
    }

    createClones() {
        this.activeClones = [];
        this.activeTiles.forEach(t => {
            const clone = t.el.cloneNode(true);
            clone.style.transition = 'none';
            this.container.appendChild(clone);
            this.activeClones.push({ tile: t, el: clone });
        });
    }

    renderDrag() {
        const maxXOffset = this.boardWidth;
        const maxYOffset = this.boardHeight;
        
        this.activeTiles.forEach((tile, index) => {
            let originalX = tile.col * this.tileW;
            let originalY = tile.row * this.tileH;
            
            let cloneInfo = this.activeClones ? this.activeClones[index] : null;
            let clone = cloneInfo ? cloneInfo.el : null;
            
            if (this.dragType === 'row') {
                let realX = originalX + this.currentOffset;
                tile.el.style.transform = `translate(${realX}px, ${originalY}px)`;
                
                if (clone) {
                    let offsetMod = this.currentOffset % maxXOffset;
                    let cloneX = realX;
                    if (offsetMod > 0) cloneX -= maxXOffset;
                    else cloneX += maxXOffset;
                    clone.style.transform = `translate(${cloneX}px, ${originalY}px)`;
                }
            } else {
                let realY = originalY + this.currentOffset;
                tile.el.style.transform = `translate(${originalX}px, ${realY}px)`;
                
                if (clone) {
                    let offsetMod = this.currentOffset % maxYOffset;
                    let cloneY = realY;
                    if (offsetMod > 0) cloneY -= maxYOffset;
                    else cloneY += maxYOffset;
                    clone.style.transform = `translate(${originalX}px, ${cloneY}px)`;
                }
            }
        });
    }

    finalizeDrag(shiftAmount) {
        if (this.activeClones) {
            this.activeClones.forEach(c => c.el.remove());
            this.activeClones = null;
        }

        let oldColRow = this.activeTiles.map(t => ({ t, col: t.col, row: t.row }));
        
        if (shiftAmount !== 0) {
            if (this.dragType === 'row') this.shiftRow(this.dragIndex, shiftAmount);
            else this.shiftCol(this.dragIndex, shiftAmount);
        }

        // Snap Healing
        this.activeTiles.forEach((t, i) => {
            let old = oldColRow[i];
            t.el.style.transition = 'none';
            
            if (this.dragType === 'row') {
                let realX = old.col * this.tileW + this.currentOffset;
                let offsetMod = this.currentOffset % this.boardWidth;
                let cloneX = realX;
                if (offsetMod > 0) cloneX -= this.boardWidth;
                else cloneX += this.boardWidth;
                
                let newX = t.col * this.tileW;
                let preSnapX = Math.abs(realX - newX) < Math.abs(cloneX - newX) ? realX : cloneX;
                
                t.el.style.transform = `translate(${preSnapX}px, ${t.row * this.tileH}px)`;
            } else {
                let realY = old.row * this.tileH + this.currentOffset;
                let offsetMod = this.currentOffset % this.boardHeight;
                let cloneY = realY;
                if (offsetMod > 0) cloneY -= this.boardHeight;
                else cloneY += this.boardHeight;
                
                let newY = t.row * this.tileH;
                let preSnapY = Math.abs(realY - newY) < Math.abs(cloneY - newY) ? realY : cloneY;
                
                t.el.style.transform = `translate(${t.col * this.tileW}px, ${preSnapY}px)`;
            }
            
            void t.el.offsetWidth; // Force reflow
        });
        
        if (shiftAmount !== 0) {
            this.onSnapCallback();
            this.moves++;
            this.onMoveCallback(this.moves);
            this.updateSolveHintUI();
            this.checkWin();
        }
    }

    // --- Solve Hint Logic ---
    toggleSolveHint() {
        this.solveHintEnabled = !this.solveHintEnabled;
        if (!this.solveHintEnabled) {
            this.hideHintArrow();
        } else {
            this.updateSolveHintUI();
        }
    }

    updateSolveHintUI() {
        const btn = document.getElementById('btn-solve-hint');
        const overlay = this.hintOverlay;
        if (!btn || !overlay) return;

        if ((this.size !== 4 && this.size !== 5) || !this.isPlaying) {
            btn.classList.add('hidden');
            overlay.classList.add('hidden');
            return;
        }

        const isTopSolved = this.isTopRowsSolved();
        
        // Show button if top rows solved or we are in the middle of an algorithm
        if (isTopSolved || this.solveAlgorithm) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
            this.solveHintEnabled = false;
            btn.classList.remove('active');
        }

        if (this.solveHintEnabled) {
            this.processHint();
        } else {
            this.hideHintArrow();
        }
    }

    isTopRowsSolved() {
        const tilesToCheck = this.size === 4 ? 12 : 20; // 3 rows for 4x4, 4 rows for 5x5
        for (let i = 0; i < tilesToCheck; i++) {
            const tile = this.tiles.find(t => t.id === i);
            if (!tile || tile.row !== tile.correctRow || tile.col !== tile.correctCol) return false;
        }
        return true;
    }

    getGridState() {
        const grid = Array.from({length: this.size}, () => Array(this.size).fill(-1));
        this.tiles.forEach(t => {
            grid[t.row][t.col] = t.id;
        });
        return grid.map(row => row.join(',')).join(';');
    }

    async setupSolveAlgorithm() {
        if (!this.solutions) return;

        // Get last row state
        const lastRowTiles = [];
        const lastRowIdx = this.size - 1;
        for (let c = 0; c < this.size; c++) {
            const tile = this.tiles.find(t => t.row === lastRowIdx && t.col === c);
            lastRowTiles.push(tile);
        }

        const tileToChar = this.size === 4 
            ? { 12: 'M', 13: 'N', 14: 'O', 15: 'P' }
            : { 20: 'U', 21: 'V', 22: 'W', 23: 'X', 24: 'Y' };
            
        const solvedState = this.size === 4 ? 'MNOP' : 'UVWXY';
        const state = lastRowTiles.map(t => tileToChar[t.id] || '?').join('');

        if (state === solvedState || state.includes('?')) {
            this.solveAlgorithm = null;
            return;
        }

        const moves = this.solutions[state];
        if (!moves) return;

        this.solveAlgorithm = state;
        this.solveMoves = moves;
        this.solveStates = [];

        // Simulate states
        let virtualGrid = Array.from({length: this.size}, () => Array(this.size).fill(0));
        this.tiles.forEach(t => virtualGrid[t.row][t.col] = t.id);

        const getGridStr = (grid) => grid.map(r => r.join(',')).join(';');
        const shiftVirtual = (grid, type, idx, amt) => {
            const size = this.size;
            amt = ((amt % size) + size) % size;
            if (type === 0) { // row
                const row = grid[idx];
                const newRow = new Array(size);
                for (let i = 0; i < size; i++) newRow[(i + amt) % size] = row[i];
                grid[idx] = newRow;
            } else { // col
                const col = grid.map(r => r[idx]);
                const newCol = new Array(size);
                for (let i = 0; i < size; i++) newCol[(i + amt) % size] = col[i];
                for (let i = 0; i < size; i++) grid[i][idx] = newCol[i];
            }
        };

        this.solveStates.push(getGridStr(virtualGrid));
        for (const move of moves) {
            shiftVirtual(virtualGrid, move[0], move[1], move[2]);
            this.solveStates.push(getGridStr(virtualGrid));
        }
    }

    processHint() {
        if (this.size !== 4 && this.size !== 5) return;

        // If not already in an algorithm, try to start one
        if (!this.solveAlgorithm && this.isTopRowsSolved()) {
            this.setupSolveAlgorithm();
        }

        if (!this.solveAlgorithm) {
            this.hideHintArrow();
            return;
        }

        const currentState = this.getGridState();
        const stepIndex = this.solveStates.indexOf(currentState);

        if (stepIndex !== -1 && stepIndex < this.solveMoves.length) {
            this.showHintArrow(this.solveMoves[stepIndex]);
        } else {
            this.hideHintArrow();
            // If top rows solved again and we aren't at the start/middle of the old alg, clear it
            if (this.isTopRowsSolved()) {
                this.solveAlgorithm = null;
                this.updateSolveHintUI(); // try to re-detect
            }
        }
    }

    showHintArrow(move) {
        const [axis, index, dir] = move;
        const overlay = this.hintOverlay;
        if (!overlay) return;

        overlay.classList.remove('hidden');
        overlay.innerHTML = '';

        const arrow = document.createElement('div');
        arrow.className = 'hint-arrow';
        
        if (axis === 0) { // row
            arrow.style.width = `${this.boardWidth}px`;
            arrow.style.height = `${this.tileH}px`;
            arrow.style.top = `${index * this.tileH}px`;
            arrow.style.left = '0';
        } else { // col
            arrow.style.width = `${this.tileW}px`;
            arrow.style.height = `${this.boardHeight}px`;
            arrow.style.top = '0';
            arrow.style.left = `${index * this.tileW}px`;
        }

        const svgArrow = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                ${axis === 0 
                    ? (dir > 0 ? '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>' : '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>')
                    : (dir > 0 ? '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>' : '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>')
                }
            </svg>
        `;
        arrow.innerHTML = svgArrow;
        overlay.appendChild(arrow);
    }

    hideHintArrow() {
        const overlay = this.hintOverlay;
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.innerHTML = '';
        }
    }

    onPointerUp(e) {
        if (!this.isDragging) return;
        
        if (this.dragType) {
            // Determine how many grid units we shifted
            let shiftAmount = 0;
            const snapThreshold = 0.25; // Only 25% drag required to snap to the next tile
            
            if (this.dragType === 'row') {
                let ratio = this.currentOffset / this.tileW;
                shiftAmount = Math.sign(ratio) * Math.floor(Math.abs(ratio) + (1 - snapThreshold));
            } else {
                let ratio = this.currentOffset / this.tileH;
                shiftAmount = Math.sign(ratio) * Math.floor(Math.abs(ratio) + (1 - snapThreshold));
            }
            
            // Clamp shift amount to maximum 1 tile
            shiftAmount = Math.max(-1, Math.min(1, shiftAmount));
            
            this.finalizeDrag(shiftAmount);
        }
        
        this.isDragging = false;
        this.dragType = null;
        this.activeTiles = [];
        this.updateVisuals(true); // animate snap to grid
    }

    shiftRow(row, amount) {
        // Handle negative shifts
        amount = amount % this.size;
        if (amount < 0) amount += this.size;
        
        const rowTiles = this.tiles.filter(t => t.row === row);
        rowTiles.forEach(t => {
            t.col = (t.col + amount) % this.size;
        });
    }

    shiftCol(col, amount) {
        amount = amount % this.size;
        if (amount < 0) amount += this.size;
        
        const colTiles = this.tiles.filter(t => t.col === col);
        colTiles.forEach(t => {
            t.row = (t.row + amount) % this.size;
        });
    }

    async shuffle() {
        const moves = this.size * 4; // Number of random shifts
        const delay = ms => new Promise(res => setTimeout(res, ms));
        
        for (let i = 0; i < moves; i++) {
            const isRow = Math.random() > 0.5;
            const index = Math.floor(Math.random() * this.size);
            const dir = Math.random() > 0.5 ? 1 : -1;
            
            if (isRow) this.shiftRow(index, dir);
            else this.shiftCol(index, dir);
            
            this.updateVisuals(true);
            await delay(150); // visual delay to show shuffling
        }
        this.moves = 0;
        this.onMoveCallback(0);
    }

    checkWin() {
        const isWin = this.tiles.every(t => t.row === t.correctRow && t.col === t.correctCol);
        if (isWin && this.isPlaying) {
            this.isPlaying = false;
            setTimeout(() => this.onWinCallback(this.moves), 300); // slight delay for snap animation
        }
    }
}
