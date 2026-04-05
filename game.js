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
        } else {
            const parentContainer = this.container.parentElement;
            this.gameWrapper = document.createElement('div');
            this.gameWrapper.className = 'game-wrapper';
            parentContainer.insertBefore(this.gameWrapper, this.container);
            this.gameWrapper.appendChild(this.container);
        }

        this.init();
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
            this.checkWin();
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
