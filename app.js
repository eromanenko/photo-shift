document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const menuScreen = document.getElementById('menu-screen');
    const gameScreen = document.getElementById('game-screen');
    const loadingOverlay = document.getElementById('loading-overlay');
    const btnReturn = document.getElementById('btn-return');
    const btnRestart = document.getElementById('btn-restart');
    const btnHint = document.getElementById('btn-hint');
    const fileUpload = document.getElementById('file-upload');
    const cameraUpload = document.getElementById('camera-upload');
    const sourceCards = document.querySelectorAll('.source-card');
    const selectedSourceInput = document.getElementById('selected-source');
    const moveCounter = document.getElementById('move-counter');
    
    // Audio Hook
    const btnSound = document.getElementById('btn-sound');
    const iconSoundOn = document.getElementById('icon-sound-on');
    const iconSoundOff = document.getElementById('icon-sound-off');
    
    if (btnSound) {
        btnSound.addEventListener('click', () => {
            if (window.audioEngine) {
                const isEnabled = window.audioEngine.toggle();
                iconSoundOn.style.display = isEnabled ? 'block' : 'none';
                iconSoundOff.style.display = isEnabled ? 'none' : 'block';
            }
        });
    }
    
    // Modals
    const hintModal = document.getElementById('hint-modal');
    const btnCloseHint = document.getElementById('btn-close-hint');
    const hintImage = document.getElementById('hint-image-view');
    
    const successModal = document.getElementById('success-modal');
    const btnPlayAgain = document.getElementById('btn-play-again');
    const finalMoves = document.getElementById('final-moves');

    let gameConfig = {
        difficulty: 3,
        source: 'picsum',
        uploadedDataUrl: null
    };
    
    let currentGame = null;

    // --- Menu Event Listeners ---
    // --- Source Selection logic ---
    function generateLettersImage(difficulty) {
        const W = 800; // Fixed canvas size matching standard expected dimensions
        const H = 800;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        
        const tileW = W / difficulty;
        const tileH = H / difficulty;
        
        let letterIndex = 0;
        
        for (let r = 0; r < difficulty; r++) {
            for (let c = 0; c < difficulty; c++) {
                // Determine color by normalizing coordinates
                const x = difficulty > 1 ? c / (difficulty - 1) : 0.5;
                const y = difficulty > 1 ? r / (difficulty - 1) : 0.5;
                
                const rColor = Math.round(255 * (1 - x));
                // Make the bottom-right Green darker (e.g. 150) so transition from Yellow is stronger
                const gColor = Math.round(y * (255 - 105 * x));
                const bColor = Math.round(255 * x * (1 - y));
                
                ctx.fillStyle = `rgb(${rColor}, ${gColor}, ${bColor})`;
                ctx.fillRect(c * tileW, r * tileH, tileW, tileH);
                
                // Draw letter
                ctx.fillStyle = '#ffffff'; 
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Canvas font property does not support CSS variables directly; using explicit font names
                ctx.font = `bold ${Math.floor(tileH * 0.45)}px 'Outfit', system-ui, sans-serif`;
                
                // Add soft shadow to improve contrast over bright colors
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
                
                const letter = String.fromCharCode(65 + letterIndex);
                ctx.fillText(letter, (c + 0.5) * tileW, (r + 0.5) * tileH);
                
                ctx.shadowColor = 'transparent';
                letterIndex++;
            }
        }
        
        return canvas.toDataURL('image/jpeg', 0.9);
    }

    function setSource(source) {
        selectedSourceInput.value = source;
    }

    // Initialize with default
    setSource('picsum');

    sourceCards.forEach(card => {
        card.addEventListener('click', () => {
            const source = card.id.replace('card-', '');
            setSource(source);
            
            if (source === 'camera') {
                cameraUpload.click();
            } else if (source === 'gallery') {
                fileUpload.click();
            } else if (source === 'picsum' || source === 'letters') {
                startGameFlow();
            }
        });
    });

    function handleFile(file) {
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                gameConfig.uploadedDataUrl = ev.target.result;
                startGameFlow();
            };
            reader.readAsDataURL(file);
        }
    }

    fileUpload.addEventListener('change', (e) => handleFile(e.target.files[0]));
    cameraUpload.addEventListener('change', (e) => handleFile(e.target.files[0]));

    async function startGameFlow() {
        // Init audio context on user interaction
        if (window.audioEngine) window.audioEngine.init();
        
        // Collect settings
        const checkedDiff = document.querySelector('input[name="difficulty"]:checked');
        gameConfig.difficulty = checkedDiff ? parseInt(checkedDiff.value) : 3;
        gameConfig.source = selectedSourceInput.value;
        
        let imageSrc = '';
        
        if ((gameConfig.source === 'gallery' || gameConfig.source === 'camera') && !gameConfig.uploadedDataUrl) {
            // Wait for file selection (already handled by handleFile calling startGameFlow)
            return;
        }

        // Show loading state
        menuScreen.classList.remove('active');
        menuScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        gameScreen.classList.add('active');
        loadingOverlay.classList.remove('hidden');

        if (gameConfig.source === 'letters') {
            imageSrc = generateLettersImage(gameConfig.difficulty);
        } else if (gameConfig.source === 'picsum') {
            // Need a cache-busting URL to ensure new random image
            // We fetch the image, convert to blob url to ensure it loads cleanly
            try {
                const response = await fetch(`https://picsum.photos/800/800?random=${Date.now()}`);
                const blob = await response.blob();
                imageSrc = URL.createObjectURL(blob);
            } catch (err) {
                console.error("Failed to load random image", err);
                alert("Could not load image. Are you offline? Try uploading instead.");
                returnToMenu();
                return;
            }
        } else {
            imageSrc = gameConfig.uploadedDataUrl;
        }

        hintImage.src = imageSrc;

        // Ensure image is fully loaded before rendering board
        const img = new Image();
        img.onload = () => {
            loadingOverlay.classList.add('hidden');
            startGame(imageSrc, gameConfig.difficulty, img.naturalWidth, img.naturalHeight);
        };
        img.src = imageSrc;
    }

    function returnToMenu() {
        gameScreen.classList.remove('active');
        gameScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
        menuScreen.classList.add('active');
        loadingOverlay.classList.add('hidden');
        successModal.classList.add('hidden');
        hintModal.classList.add('hidden');
        
        if (currentGame) {
            currentGame.destroy();
            currentGame.container.innerHTML = '';
            currentGame = null;
        }
    }

    btnReturn.addEventListener('click', returnToMenu);
    
    btnRestart.addEventListener('click', () => {
        const source = selectedSourceInput.value;
        if (source === 'picsum' || source === 'letters') {
            startGameFlow(); 
        } else if (source === 'camera') {
            cameraUpload.click();
        } else {
            fileUpload.click();
        }
    });

    // --- Game Logic Bindings ---
    function startGame(imgSrc, diff, imgW, imgH) {
        if (currentGame) {
            currentGame.destroy();
        }
        moveCounter.innerText = '0';
        currentGame = new PhotoShiftGame('game-board', {
            imageSrc: imgSrc,
            difficulty: diff,
            imgW: imgW,
            imgH: imgH,
            onMove: (moves) => {
                moveCounter.innerText = moves;
            },
            onSnap: () => {
                if (window.audioEngine) window.audioEngine.playSnap();
                if (navigator.vibrate) navigator.vibrate(10);
            },
            onWin: (moves) => {
                finalMoves.innerText = moves;
                document.getElementById('final-difficulty').innerText = `${diff}x${diff}`;
                document.getElementById('success-image-view').src = imgSrc;
                successModal.classList.remove('hidden');
                
                if (window.audioEngine) window.audioEngine.playWin();
                if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200]);
                if (window.confetti) {
                    const duration = 2000;
                    const end = Date.now() + duration;
                    (function frame() {
                        confetti({
                            particleCount: 5,
                            angle: 60,
                            spread: 55,
                            origin: { x: 0 },
                            colors: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6']
                        });
                        confetti({
                            particleCount: 5,
                            angle: 120,
                            spread: 55,
                            origin: { x: 1 },
                            colors: ['#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6']
                        });
                        if (Date.now() < end) requestAnimationFrame(frame);
                    }());
                }
            }
        });
    }

    // --- Modals ---
    btnHint.addEventListener('click', () => {
        hintModal.classList.remove('hidden');
    });
    
    btnCloseHint.addEventListener('click', () => {
        hintModal.classList.add('hidden');
    });

    btnPlayAgain.addEventListener('click', () => {
        successModal.classList.add('hidden');
        returnToMenu();
    });

    const btnShare = document.getElementById('btn-share');
    if (btnShare) {
        btnShare.addEventListener('click', async () => {
            try {
                const diff = document.getElementById('final-difficulty').innerText;
                const moves = finalMoves.innerText;
                const shareData = {
                    title: 'Photo Shift',
                    text: `I solved a ${diff} Photo Shift puzzle in ${moves} moves! Can you beat my score?`,
                    url: 'https://photo-shift.netlify.app/'
                };
                if (navigator.share) {
                    await navigator.share(shareData).catch(err => {
                        if (err.name !== 'AbortError') console.error('Share failed:', err);
                    });
                } else {
                    await navigator.clipboard.writeText(`${shareData.text} Play here: ${shareData.url}`);
                    const originalText = btnShare.innerHTML;
                    btnShare.innerHTML = 'Copied to clipboard!';
                    setTimeout(() => { btnShare.innerHTML = originalText; }, 2000);
                }
            } catch (err) {
                console.error('Error sharing', err);
            }
        });
    }

    // Close modals on background click
    [hintModal, successModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
});
