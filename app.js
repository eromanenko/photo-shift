document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const menuScreen = document.getElementById('menu-screen');
    const gameScreen = document.getElementById('game-screen');
    const loadingOverlay = document.getElementById('loading-overlay');
    const btnStart = document.getElementById('btn-start');
    const btnReturn = document.getElementById('btn-return');
    const btnRestart = document.getElementById('btn-restart');
    const btnHint = document.getElementById('btn-hint');
    const fileUpload = document.getElementById('file-upload');
    const diffRadios = document.getElementsByName('difficulty');
    const sourceRadios = document.getElementsByName('photo-source');
    const lblPicsum = document.getElementById('lbl-picsum');
    const lblUpload = document.getElementById('lbl-upload');
    const moveCounter = document.getElementById('move-counter');
    
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
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                gameConfig.uploadedDataUrl = ev.target.result;
                document.querySelector('input[name="photo-source"][value="upload"]').checked = true;
                
                if (gameScreen.classList.contains('active')) {
                    btnStart.click();
                }
            };
            reader.readAsDataURL(file);
        }
    });

    // Removed lblUpload click listener because clicking a label automatically clicks its associated radio input.
    sourceRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'upload' && !gameConfig.uploadedDataUrl) {
                fileUpload.click();
            }
        });
    });

    btnStart.addEventListener('click', async () => {
        // Collect settings
        gameConfig.difficulty = parseInt(document.querySelector('input[name="difficulty"]:checked').value);
        gameConfig.source = document.querySelector('input[name="photo-source"]:checked').value;
        
        let imageSrc = '';
        
        if (gameConfig.source === 'upload' && !gameConfig.uploadedDataUrl) {
            alert('Please select a photo first or switch to Random.');
            return;
        }

        // Show loading state
        menuScreen.classList.remove('active');
        menuScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        gameScreen.classList.add('active');
        loadingOverlay.classList.remove('hidden');

        if (gameConfig.source === 'picsum') {
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
    });

    function returnToMenu() {
        gameScreen.classList.remove('active');
        gameScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
        menuScreen.classList.add('active');
        loadingOverlay.classList.add('hidden');
        successModal.classList.add('hidden');
        hintModal.classList.add('hidden');
        
        if (currentGame) {
            currentGame.container.innerHTML = '';
            currentGame = null;
        }
    }

    btnReturn.addEventListener('click', returnToMenu);
    
    btnRestart.addEventListener('click', () => {
        if (document.querySelector('input[name="photo-source"]:checked').value === 'picsum') {
            btnStart.click(); // Re-trigger random photo and start
        } else {
            fileUpload.click(); // Prompt for new local photo
        }
    });

    // --- Game Logic Bindings ---
    function startGame(imgSrc, diff, imgW, imgH) {
        moveCounter.innerText = '0';
        currentGame = new PhotoShiftGame('game-board', {
            imageSrc: imgSrc,
            difficulty: diff,
            imgW: imgW,
            imgH: imgH,
            onMove: (moves) => {
                moveCounter.innerText = moves;
            },
            onWin: (moves) => {
                finalMoves.innerText = moves;
                successModal.classList.remove('hidden');
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

    // Close modals on background click
    [hintModal, successModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });
});
