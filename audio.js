class AudioEngine {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    playSnap() {
        if (!this.enabled || !this.ctx) return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        // Quick downward sweep for a tap/knock sound
        osc.frequency.setValueAtTime(300, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.08);
        
        // Fast decay
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }

    playWin() {
        if (!this.enabled || !this.ctx) return;

        // Arpeggio: A4, C#5, E5, A5
        const notes = [
            { freq: 440, delay: 0 },   
            { freq: 554.37, delay: 0.1 }, 
            { freq: 659.25, delay: 0.2 }, 
            { freq: 880, delay: 0.3 }  
        ];

        notes.forEach(note => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = note.freq;
            
            const startTime = this.ctx.currentTime + note.delay;
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.6);
            
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 0.6);
        });
    }
}

window.audioEngine = new AudioEngine();
