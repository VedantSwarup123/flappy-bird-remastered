const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = 400;
canvas.height = 600;

ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'low';

let gameState = 'start';
let score = 0;
let highScore = localStorage.getItem('flappyBirdHighScore') || 0;
document.getElementById('highScoreDisplay').textContent = highScore;

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch(type) {
        case 'flap':
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(200, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;

        case 'score':
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.15);
            break;

        case 'death':
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.5);
            gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);

            setTimeout(() => {
                const noise = audioContext.createBufferSource();
                const noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 0.3, audioContext.sampleRate);
                const output = noiseBuffer.getChannelData(0);
                for (let i = 0; i < noiseBuffer.length; i++) {
                    output[i] = Math.random() * 2 - 1;
                }
                noise.buffer = noiseBuffer;

                const noiseGain = audioContext.createGain();
                noiseGain.gain.setValueAtTime(0.3, audioContext.currentTime);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

                noise.connect(noiseGain);
                noiseGain.connect(audioContext.destination);
                noise.start();
            }, 50);
            break;
    }
}

let backgroundMusic = null;

function initBackgroundMusic() {
    backgroundMusic = new Audio();
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.3;
    backgroundMusic.src = 'sounds/Dopamine.m4a';
    backgroundMusic.addEventListener('error', () => {
        console.log('Could not load music file.');
    });
}

function startBackgroundMusic() {
    if (backgroundMusic && backgroundMusic.src) {
        backgroundMusic.play().catch(e => {
            console.log('Music autoplay prevented. Click to start:', e);
        });
    }
}

function stopBackgroundMusic() {
    if (backgroundMusic) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
}

initBackgroundMusic();

const bird = {
    x: 80,
    y: 250,
    width: 34,
    height: 24,
    velocity: 0,
    gravity: 0.5,
    jump: -9,
    rotation: 0,
    wingAngle: 0,
    wingSpeed: 0
};

let pipes = [];
const pipeWidth = 60;
const pipeGap = 180;
const basePipeSpeed = 2.5;
let currentSpeed = basePipeSpeed;

let particles = [];
let bloodSplatters = [];
let feathers = [];

let clouds = [];
for (let i = 0; i < 5; i++) {
    clouds.push({
        x: Math.random() * canvas.width,
        y: Math.random() * 200,
        width: 60 + Math.random() * 40,
        speed: 0.3 + Math.random() * 0.5
    });
}

let grassBlades = [];
for (let i = 0; i < canvas.width; i += 8) {
    grassBlades.push({
        x: i,
        height: 8 + Math.random() * 6
    });
}

let dirtPatches = [];
for (let i = 0; i < canvas.width; i += 50) {
    dirtPatches.push({
        x: i + 20
    });
}

document.getElementById('startButton').addEventListener('click', startGame);
document.getElementById('restartButton').addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && gameState === 'playing') {
        e.preventDefault();
        flap();
    } else if (e.code === 'Space' && gameState === 'start') {
        e.preventDefault();
        startGame();
    }
});

canvas.addEventListener('click', () => {
    if (gameState === 'playing') {
        flap();
    }
});

function startGame() {
    gameState = 'playing';
    score = 0;
    bird.y = 250;
    bird.velocity = 0;
    bird.wingAngle = 0;
    bird.wingSpeed = 0;
    pipes = [];
    particles = [];
    bloodSplatters = [];
    feathers = [];
    currentSpeed = basePipeSpeed;

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('scoreDisplay').classList.remove('hidden');
    document.getElementById('scoreDisplay').textContent = '0';

    startBackgroundMusic();
    createPipe();
}

function flap() {
    bird.velocity = bird.jump;
    bird.wingSpeed = -0.8;
    createParticles(bird.x, bird.y + bird.height / 2, '#FFD700');
    playSound('flap');
}

function createPipe() {
    const minHeight = 50;
    const maxHeight = canvas.height - pipeGap - minHeight - 100;
    const height = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    
    pipes.push({
        x: canvas.width,
        topHeight: height,
        bottomY: height + pipeGap,
        scored: false
    });
}

function createParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            life: 25,
            color: color,
            size: 3 + Math.random() * 2
        });
    }
}

function createBloodyExplosion(x, y) {
    for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i) / 30;
        const speed = 3 + Math.random() * 5;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 3,
            life: 60 + Math.random() * 30,
            color: Math.random() > 0.5 ? '#8B0000' : '#DC143C',
            size: 2 + Math.random() * 4,
            gravity: 0.6,
            hasGravity: true
        });
    }

    for (let i = 0; i < 20; i++) {
        bloodSplatters.push({
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * -6 - 2,
            size: 4 + Math.random() * 6,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.3,
            gravity: 0.6,
            life: 90
        });
    }

    for (let i = 0; i < 20; i++) {
        feathers.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * -6 - 2,
            width: 6 + Math.random() * 4,
            height: 10 + Math.random() * 6,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            gravity: 0.4,
            color: Math.random() > 0.3 ? '#FFD93D' : '#FFF9E6',
            life: 80
        });
    }

    for (let i = 0; i < 15; i++) {
        feathers.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 7,
            vy: Math.random() * -5 - 1,
            width: 5 + Math.random() * 3,
            height: 8 + Math.random() * 5,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.4,
            gravity: 0.4,
            color: '#FF9800',
            life: 80
        });
    }
}

function update() {
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].x += particles[i].vx;
        particles[i].y += particles[i].vy;

        if (particles[i].hasGravity) {
            particles[i].vy += particles[i].gravity;
        }

        particles[i].life--;

        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }

    for (let i = bloodSplatters.length - 1; i >= 0; i--) {
        bloodSplatters[i].x += bloodSplatters[i].vx;
        bloodSplatters[i].y += bloodSplatters[i].vy;
        bloodSplatters[i].vy += bloodSplatters[i].gravity;
        bloodSplatters[i].rotation += bloodSplatters[i].rotationSpeed;
        bloodSplatters[i].life--;

        if (bloodSplatters[i].life <= 0) {
            bloodSplatters.splice(i, 1);
        }
    }

    for (let i = feathers.length - 1; i >= 0; i--) {
        feathers[i].x += feathers[i].vx;
        feathers[i].y += feathers[i].vy;
        feathers[i].vy += feathers[i].gravity;
        feathers[i].vx *= 0.98;
        feathers[i].rotation += feathers[i].rotationSpeed;
        feathers[i].life--;

        if (feathers[i].life <= 0) {
            feathers.splice(i, 1);
        }
    }

    if (gameState !== 'playing') return;

    bird.velocity += bird.gravity;
    bird.y += bird.velocity;
    bird.rotation = Math.min(Math.max(bird.velocity * 3, -30), 90);

    bird.wingAngle += bird.wingSpeed;
    bird.wingSpeed += 0.05;

    if (bird.wingAngle > 0.5) {
        bird.wingAngle = 0.5;
        bird.wingSpeed = 0;
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        pipes[i].x -= currentSpeed;

        if (!pipes[i].scored && pipes[i].x + pipeWidth < bird.x) {
            pipes[i].scored = true;
            score++;
            document.getElementById('scoreDisplay').textContent = score;
            createParticles(bird.x + bird.width / 2, bird.y + bird.height / 2, '#00FF00');
            playSound('score');

            currentSpeed = basePipeSpeed + (Math.floor(score / 5) * 0.5);
        }

        if (pipes[i].x + pipeWidth < 0) {
            pipes.splice(i, 1);
        }
    }

    if (pipes.length === 0 || pipes[pipes.length - 1].x < canvas.width - 250) {
        createPipe();
    }

    clouds.forEach(cloud => {
        cloud.x -= cloud.speed * (currentSpeed / basePipeSpeed);
        if (cloud.x + cloud.width < 0) {
            cloud.x = canvas.width;
            cloud.y = Math.random() * 200;
        }
    });

    checkCollisions();
}

function checkCollisions() {
    if (bird.y + bird.height > canvas.height - 100 || bird.y < 0) {
        gameOver();
        return;
    }

    for (let pipe of pipes) {
        if (bird.x + bird.width > pipe.x && bird.x < pipe.x + pipeWidth) {
            if (bird.y < pipe.topHeight || bird.y + bird.height > pipe.bottomY) {
                gameOver();
                return;
            }
        }
    }
}

function gameOver() {
    gameState = 'gameOver';

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('flappyBirdHighScore', highScore);
    }

    createBloodyExplosion(bird.x + bird.width / 2, bird.y + bird.height / 2);
    playSound('death');
    stopBackgroundMusic();

    document.getElementById('scoreDisplay').classList.add('hidden');
    document.getElementById('finalScore').textContent = score;
    document.getElementById('bestScore').textContent = highScore;

    setTimeout(() => {
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }, 2000);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGradient.addColorStop(0, '#4A90E2');
    skyGradient.addColorStop(0.5, '#87CEEB');
    skyGradient.addColorStop(0.8, '#B4E7FF');
    skyGradient.addColorStop(1, '#D4F1F4');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    
    drawSun();

    
    drawClouds();

    
    drawPipes();

    
    drawGround();

    
    if (gameState === 'playing') {
        drawBird();
    }

    
    drawBloodSplatters();
    drawFeathers();

    
    drawParticles();
}

function drawSun() {
    const sunX = canvas.width - 80;
    const sunY = 80;
    const sunRadius = 40;

    
    const glowGradient = ctx.createRadialGradient(sunX, sunY, sunRadius, sunX, sunY, sunRadius * 1.8);
    glowGradient.addColorStop(0, 'rgba(255, 220, 100, 0.3)');
    glowGradient.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius * 1.8, 0, Math.PI * 2);
    ctx.fill();

    
    const sunGradient = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunRadius);
    sunGradient.addColorStop(0, '#FFF9E6');
    sunGradient.addColorStop(1, '#FFD93D');
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
    ctx.fill();
}

function drawClouds() {
    
    ctx.fillStyle = 'rgba(150, 150, 150, 0.15)';
    clouds.forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud.x + 2, cloud.y + 3, cloud.width * 0.3, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.width * 0.3 + 2, cloud.y - 7, cloud.width * 0.35, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.width * 0.6 + 2, cloud.y + 3, cloud.width * 0.3, 0, Math.PI * 2);
        ctx.fill();
    });

    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    clouds.forEach(cloud => {
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.width * 0.3, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.width * 0.3, cloud.y - 10, cloud.width * 0.35, 0, Math.PI * 2);
        ctx.arc(cloud.x + cloud.width * 0.6, cloud.y, cloud.width * 0.3, 0, Math.PI * 2);
        ctx.fill();
    });
}

function drawBird() {
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(bird.rotation * Math.PI / 180);

    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(2, 4, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    
    const birdGradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, bird.width / 1.5);
    birdGradient.addColorStop(0, '#FFE66D');
    birdGradient.addColorStop(0.6, '#FFD93D');
    birdGradient.addColorStop(1, '#FF9800');
    ctx.fillStyle = birdGradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    
    ctx.strokeStyle = '#F57C00';
    ctx.lineWidth = 2;
    ctx.stroke();

    
    ctx.save();
    ctx.translate(-3, 2);
    ctx.rotate(bird.wingAngle);
    ctx.fillStyle = '#FF9800';
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 3, bird.height / 3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F57C00';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bird.width / 4, -bird.height / 4, 6, 0, Math.PI * 2);
    ctx.fill();

    
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bird.width / 4 + 1, -bird.height / 4, 3.5, 0, Math.PI * 2);
    ctx.fill();

    
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bird.width / 4 + 2, -bird.height / 4 - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    
    ctx.fillStyle = '#FF6347';
    ctx.beginPath();
    ctx.moveTo(bird.width / 2, 0);
    ctx.lineTo(bird.width / 2 + 10, -4);
    ctx.lineTo(bird.width / 2 + 10, 4);
    ctx.closePath();
    ctx.fill();

    
    ctx.strokeStyle = '#E53935';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.restore();
}

function drawPipes() {
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    pipes.forEach(pipe => {
        ctx.fillRect(pipe.x + 4, 0, pipeWidth, pipe.topHeight);
        ctx.fillRect(pipe.x + 4, pipe.bottomY, pipeWidth, canvas.height - pipe.bottomY);
    });

    
    pipes.forEach(pipe => {
        
        const pipeGradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
        pipeGradient.addColorStop(0, '#4CAF50');
        pipeGradient.addColorStop(0.5, '#66BB6A');
        pipeGradient.addColorStop(1, '#2E7D32');

        
        ctx.fillStyle = pipeGradient;
        ctx.fillRect(pipe.x, 0, pipeWidth, pipe.topHeight - 30);

        
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 30, pipeWidth + 10, 30);

        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(pipe.x - 5, pipe.topHeight - 30, pipeWidth + 10, 8);

        
        ctx.fillStyle = pipeGradient;
        ctx.fillRect(pipe.x, pipe.bottomY + 30, pipeWidth, canvas.height - pipe.bottomY - 30);

        
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(pipe.x - 5, pipe.bottomY, pipeWidth + 10, 30);

        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(pipe.x - 5, pipe.bottomY, pipeWidth + 10, 8);

        
        ctx.strokeStyle = '#2E7D32';
        ctx.lineWidth = 2;
        ctx.strokeRect(pipe.x, 0, pipeWidth, pipe.topHeight - 30);
        ctx.strokeRect(pipe.x - 5, pipe.topHeight - 30, pipeWidth + 10, 30);
        ctx.strokeRect(pipe.x, pipe.bottomY + 30, pipeWidth, canvas.height - pipe.bottomY - 30);
        ctx.strokeRect(pipe.x - 5, pipe.bottomY, pipeWidth + 10, 30);

        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pipe.x + 5, 0);
        ctx.lineTo(pipe.x + 5, pipe.topHeight - 30);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pipe.x + 5, pipe.bottomY + 30);
        ctx.lineTo(pipe.x + 5, canvas.height);
        ctx.stroke();
    });
}

function drawGround() {
    const groundHeight = 100;

    
    const groundGradient = ctx.createLinearGradient(0, canvas.height - groundHeight, 0, canvas.height);
    groundGradient.addColorStop(0, '#8BC34A');
    groundGradient.addColorStop(0.3, '#7CB342');
    groundGradient.addColorStop(0.6, '#689F38');
    groundGradient.addColorStop(1, '#558B2F');
    ctx.fillStyle = groundGradient;
    ctx.fillRect(0, canvas.height - groundHeight, canvas.width, groundHeight);

    
    ctx.fillStyle = '#9CCC65';
    for (let grass of grassBlades) {
        ctx.fillRect(grass.x, canvas.height - groundHeight, 4, grass.height);
    }

    
    ctx.fillStyle = 'rgba(121, 85, 72, 0.3)';
    for (let patch of dirtPatches) {
        ctx.beginPath();
        ctx.arc(patch.x, canvas.height - groundHeight + 30, 15, 0, Math.PI * 2);
        ctx.fill();
    }

    
    ctx.strokeStyle = '#7CB342';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - groundHeight);
    ctx.lineTo(canvas.width, canvas.height - groundHeight);
    ctx.stroke();
}

function drawBloodSplatters() {
    bloodSplatters.forEach(splatter => {
        ctx.save();
        ctx.globalAlpha = Math.min(splatter.life / 60, 1);
        ctx.translate(splatter.x, splatter.y);
        ctx.rotate(splatter.rotation);

        
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.ellipse(0, 0, splatter.size, splatter.size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        
        ctx.fillStyle = '#660000';
        ctx.beginPath();
        ctx.ellipse(0, 0, splatter.size * 0.5, splatter.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    });
    ctx.globalAlpha = 1;
}

function drawFeathers() {
    feathers.forEach(feather => {
        ctx.save();
        ctx.globalAlpha = Math.min(feather.life / 80, 1);
        ctx.translate(feather.x, feather.y);
        ctx.rotate(feather.rotation);

        
        ctx.fillStyle = feather.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, feather.width / 2, feather.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, -feather.height / 2);
        ctx.lineTo(0, feather.height / 2);
        ctx.stroke();

        ctx.restore();
    });
    ctx.globalAlpha = 1;
}

function drawParticles() {
    
    particles.forEach(particle => {
        ctx.globalAlpha = particle.life / 30;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();
