class PhotoShiftGame {
    constructor(containerId, options) {
        this.container = document.getElementById(containerId);
        this.size = parseInt(options.difficulty) || 3;
        this.imageSrc = options.imageSrc;
        this.imgW = options.imgW || 800;
        this.imgH = options.imgH || 800;
        this.onMoveCallback = options.onMove || (() => {});
        this.onWinCallback = options.onWin || (() => {});
        
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
        
        this.init();
    }

    async init() {
        this.container.innerHTML = ''; // clear board
        
        // Calculate dynamic dimensions preserving aspect ratio
        // Maximize dimensions for mobile
        const parentRect = this.container.parentElement.getBoundingClientRect();
        const availableWidth = parentRect.width;
        const availableHeight = parentRect.height;
        
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
        
        this.createStartOverlay();
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
        // Pointer events for uniform touch/mouse handling
        this.container.addEventListener('pointerdown', this.onPointerDown.bind(this));
        window.addEventListener('pointermove', this.onPointerMove.bind(this));
        window.addEventListener('pointerup', this.onPointerUp.bind(this));
        window.addEventListener('pointercancel', this.onPointerUp.bind(this));
        
        // Prevent default touch actions like scrolling only when actively playing/dragging
        this.container.addEventListener('touchstart', e => {
            if (this.isPlaying) e.preventDefault();
        }, { passive: false });
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
            } else {
                return; // Not moved enough to lock
            }
        }
        
        // Calculate offset and visual wrapping
        if (this.dragType === 'row') {
            this.currentOffset = dx;
        } else {
            this.currentOffset = dy;
        }
        
        this.renderDrag();
    }

    renderDrag() {
        const maxXOffset = this.boardWidth;
        const maxYOffset = this.boardHeight;
        
        this.activeTiles.forEach(tile => {
            let x = tile.col * this.tileW;
            let y = tile.row * this.tileH;
            
            if (this.dragType === 'row') {
                let offset = this.currentOffset % maxXOffset;
                x += offset;
                // Wrapping visuals
                if (x >= this.boardWidth) x -= this.boardWidth;
                else if (x < 0) x += this.boardWidth;
                
                // Extra wrap check for smooth continuous drag of extreme tiles
                if (offset > 0 && tile.col === this.size - 1 && x > this.boardWidth - this.tileW) {
                   x -= this.boardWidth; 
                }
                if (offset < 0 && tile.col === 0 && x < 0) {
                   x += this.boardWidth;
                }
            } else {
                let offset = this.currentOffset % maxYOffset;
                y += offset;
                if (y >= this.boardHeight) y -= this.boardHeight;
                else if (y < 0) y += this.boardHeight;
                
                if (offset > 0 && tile.row === this.size - 1 && y > this.boardHeight - this.tileH) {
                   y -= this.boardHeight;
                }
                if (offset < 0 && tile.row === 0 && y < 0) {
                   y += this.boardHeight;
                }
            }
            
            tile.el.style.transform = `translate(${x}px, ${y}px)`;
        });
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
                if (shiftAmount !== 0) {
                    this.shiftRow(this.dragIndex, shiftAmount);
                }
            } else {
                let ratio = this.currentOffset / this.tileH;
                shiftAmount = Math.sign(ratio) * Math.floor(Math.abs(ratio) + (1 - snapThreshold));
                if (shiftAmount !== 0) {
                    this.shiftCol(this.dragIndex, shiftAmount);
                }
            }
            
            if (shiftAmount !== 0) {
                this.moves++;
                this.onMoveCallback(this.moves);
                this.checkWin();
            }
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
