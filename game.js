
class Node {
    constructor(x, y, id) {
        this.x = x;
        this.y = y;
        this.id = id;
        this.size = 30; // Size of the square
        this.color = '#00ff00'; // Hacker Green
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Glow effect
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;

        // Draw Square Node
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);

        // Draw ID
        ctx.fillStyle = this.color;
        ctx.font = '16px "VT323", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.id, 0, 0);

        ctx.restore();
    }
}

class Edge {
    constructor(nodeA, nodeB) {
        this.nodeA = nodeA;
        this.nodeB = nodeB;
        this.active = true;
        this.hovered = false;
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.nodeA.x, this.nodeA.y);
        ctx.lineTo(this.nodeB.x, this.nodeB.y);

        // Neon Line Style
        ctx.strokeStyle = this.hovered ? '#ff00ff' : '#00ffff'; // Magenta on hover, Cyan otherwise
        ctx.lineWidth = this.hovered ? 3 : 1;
        ctx.shadowBlur = this.hovered ? 15 : 5;
        ctx.shadowColor = ctx.strokeStyle;

        ctx.stroke();
        ctx.restore();
    }

    isPointNearLine(x, y) {
        if (!this.active) return false;

        const x1 = this.nodeA.x;
        const y1 = this.nodeA.y;
        const x2 = this.nodeB.x;
        const y2 = this.nodeB.y;

        // Distance from point to line segment
        const A = x - x1;
        const B = y - y1;
        const C = x2 - x1;
        const D = y2 - y1;

        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq != 0) // in case of 0 length line
            param = dot / len_sq;

        let xx, yy;

        if (param < 0) {
            xx = x1;
            yy = y1;
        }
        else if (param > 1) {
            xx = x2;
            yy = y2;
        }
        else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }

        const dx = x - xx;
        const dy = y - yy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        return dist < 10; // Hit tolerance
    }
}

class Constraint {
    validate(game, edgeToRemove) {
        return { valid: true };
    }
}

class ConnectivityConstraint extends Constraint {
    validate(game, edgeToRemove) {
        // 1. Build adjacency list from ACTIVE edges, excluding the one to remove
        const adj = new Map();
        game.nodes.forEach(n => adj.set(n, []));

        for (const edge of game.edges) {
            if (edge.active && edge !== edgeToRemove) {
                adj.get(edge.nodeA).push(edge.nodeB);
                adj.get(edge.nodeB).push(edge.nodeA);
            }
        }

        // 2. BFS from first node
        const startNode = game.nodes[0];
        const visited = new Set();
        const queue = [startNode];
        visited.add(startNode);

        while (queue.length > 0) {
            const curr = queue.shift();
            const neighbors = adj.get(curr);
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push(neighbor);
                }
            }
        }

        // 3. If visited count == nodes count, it's connected
        if (visited.size === game.nodes.length) {
            return { valid: true };
        } else {
            return { valid: false, reason: "Graph must remain connected" };
        }
    }
}

class MinDegreeConstraint extends Constraint {
    constructor(minDegree = 1) {
        super();
        this.minDegree = minDegree;
    }

    validate(game, edgeToRemove) {
        // Check if removing this edge would leave any node with < minDegree edges
        // We only need to check the two endpoints of the edge being removed

        const checkNode = (node) => {
            let degree = 0;
            for (const edge of game.edges) {
                if (edge.active && edge !== edgeToRemove) {
                    if (edge.nodeA === node || edge.nodeB === node) {
                        degree++;
                    }
                }
            }
            return degree;
        };

        const degreeA = checkNode(edgeToRemove.nodeA);
        const degreeB = checkNode(edgeToRemove.nodeB);

        if (degreeA < this.minDegree || degreeB < this.minDegree) {
            return { valid: false, reason: `Nodes must have at least ${this.minDegree} connection(s)` };
        }

        return { valid: true };
    }
}

class SpecificConnectionConstraint extends Constraint {
    constructor(requiredPairs) {
        super();
        this.requiredPairs = requiredPairs; // Array of [id1, id2]
    }

    validate(game, edgeToRemove) {
        const idA = edgeToRemove.nodeA.id;
        const idB = edgeToRemove.nodeB.id;

        for (const pair of this.requiredPairs) {
            if ((pair[0] === idA && pair[1] === idB) || (pair[0] === idB && pair[1] === idA)) {
                return { valid: false, reason: `Must keep connection between ${idA} and ${idB}` };
            }
        }
        return { valid: true };
    }
}

class MaxDistanceConstraint extends Constraint {
    constructor(nodeAId, nodeBId, maxHops) {
        super();
        this.nodeAId = nodeAId;
        this.nodeBId = nodeBId;
        this.maxHops = maxHops;
    }

    validate(game, edgeToRemove) {
        // 1. Build adjacency list from ACTIVE edges, excluding the one to remove
        const adj = new Map();
        game.nodes.forEach(n => adj.set(n.id, []));

        for (const edge of game.edges) {
            if (edge.active && edge !== edgeToRemove) {
                adj.get(edge.nodeA.id).push(edge.nodeB.id);
                adj.get(edge.nodeB.id).push(edge.nodeA.id);
            }
        }

        // 2. BFS to find distance between nodeA and nodeB
        const queue = [[this.nodeAId, 0]]; // [id, distance]
        const visited = new Set();
        visited.add(this.nodeAId);

        while (queue.length > 0) {
            const [currId, dist] = queue.shift();

            if (currId === this.nodeBId) {
                if (dist <= this.maxHops) {
                    return { valid: true };
                } else {
                    return { valid: false, reason: `Distance between ${this.nodeAId} and ${this.nodeBId} must be ≤ ${this.maxHops} hops` };
                }
            }

            if (dist < this.maxHops) {
                const neighbors = adj.get(currId);
                if (neighbors) {
                    for (const neighborId of neighbors) {
                        if (!visited.has(neighborId)) {
                            visited.add(neighborId);
                            queue.push([neighborId, dist + 1]);
                        }
                    }
                }
            }
        }

        return { valid: false, reason: `Nodes ${this.nodeAId} and ${this.nodeBId} must remain connected` };
    }
}

class HubConstraint extends Constraint {
    constructor(nodeId, minConnections) {
        super();
        this.nodeId = nodeId;
        this.minConnections = minConnections;
    }

    validate(game, edgeToRemove) {
        let connections = 0;
        for (const edge of game.edges) {
            if (edge.active && edge !== edgeToRemove) {
                if (edge.nodeA.id === this.nodeId || edge.nodeB.id === this.nodeId) {
                    connections++;
                }
            }
        }

        if (connections < this.minConnections) {
            return { valid: false, reason: `Node ${this.nodeId} must have at least ${this.minConnections} connections` };
        }
        return { valid: true };
    }
}

class AudioController {
    constructor() {
        this.ctx = null;
        this.scale = [261.63, 311.13, 349.23, 392.00, 466.16, 523.25]; // C4, Eb4, F4, G4, Bb4, C5 (C Minor Pentatonic)
        this.ambienceStarted = false;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    startAmbience() {
        if (this.ambienceStarted) return;
        this.init();

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        this.ambienceStarted = true;

        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        // Drone 1
        osc1.type = 'triangle';
        osc1.frequency.value = 110; // A2

        // Drone 2 (Detuned)
        osc2.type = 'sine';
        osc2.frequency.value = 111; // Detuned

        // Filter for darker sound
        filter.type = 'lowpass';
        filter.frequency.value = 300;

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        gain.gain.value = 0.1; // Increased volume

        osc1.start();
        osc2.start();
    }

    playTone() {
        if (!this.ctx) this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        // Random note from scale
        const freq = this.scale[Math.floor(Math.random() * this.scale.length)];
        osc.frequency.value = freq;
        osc.type = 'sawtooth'; // Cyberpunk/Retro feel

        // Envelope
        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + 0.01); // Attack
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3); // Decay

        osc.start(now);
        osc.stop(now + 0.3);
    }

    playError() {
        if (!this.ctx) this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.frequency.value = 100; // Low pitch
        osc.type = 'square'; // Buzz sound

        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.start(now);
        osc.stop(now + 0.3);
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.complexity = 0;
        this.targetComplexity = 0;
        this.constraints = []; // Initialize empty, set per level
        this.audio = new AudioController();
        this.lives = 3; // Initial lives

        this.ui = {
            complexity: document.getElementById('complexity-score'),
            target: document.getElementById('target-score'),
            messageArea: document.getElementById('message-area'),
            nextBtn: document.getElementById('next-level-btn'),
            startScreen: document.getElementById('start-screen'),
            startBtn: document.getElementById('start-btn'),
            continueBtn: document.getElementById('continue-btn'),
            restartBtn: document.getElementById('restart-btn'),
            reqList: document.getElementById('requirements-list'),
            reqContainer: document.getElementById('requirements-container'),
            livesContainer: document.getElementById('lives-container')
        };

        document.querySelector('h1').textContent = "Connections v1.0";

        this.level = 1;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });

        // Removed addEventListener for nextBtn to avoid conflicts with gameOver logic
        // if (this.ui.nextBtn) this.ui.nextBtn.addEventListener('click', () => this.startLevel(this.level + 1));

        if (this.ui.startBtn) this.ui.startBtn.addEventListener('click', () => this.startGame());

        if (this.ui.continueBtn) {
            this.ui.continueBtn.addEventListener('click', () => this.continueGame());
        } else {
            console.error("Continue button not found");
        }

        if (this.ui.restartBtn) {
            this.ui.restartBtn.addEventListener('click', () => this.restartLevel());
        } else {
            console.error("Restart button not found");
        }

        this.checkSave();

        // Initial render (empty background)
        this.loop();
    }

    checkSave() {
        try {
            const savedLevel = localStorage.getItem('connections_level');
            console.log("Saved level:", savedLevel);
            if (savedLevel && parseInt(savedLevel) > 1) {
                if (this.ui.continueBtn) {
                    this.ui.continueBtn.classList.remove('hidden');
                    this.ui.continueBtn.textContent = `Continue Level ${savedLevel}`;
                }
            }
        } catch (e) {
            console.warn("LocalStorage access failed:", e);
        }
    }

    continueGame() {
        const savedLevel = localStorage.getItem('connections_level');
        this.audio.startAmbience();
        if (savedLevel) {
            this.ui.startScreen.classList.add('hidden');
            this.startLevel(parseInt(savedLevel));
        } else {
            this.startGame();
        }
    }

    startGame() {
        this.ui.startScreen.classList.add('hidden');
        this.audio.startAmbience();
        this.startLevel(1);
    }

    restartLevel() {
        this.startLevel(this.level);
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }

    startLevel(level) {
        this.level = level;
        localStorage.setItem('connections_level', level);

        this.nodes = [];
        this.edges = [];
        this.ui.messageArea.classList.add('hidden');

        // Reset Next Button to default "Next Level" behavior
        this.ui.nextBtn.textContent = "[ EXECUTE_NEXT_PHASE ]";
        this.ui.nextBtn.onclick = () => this.startLevel(this.level + 1);

        // Generate Level
        this.generateLevel(level);
        this.lives = 3; // Reset lives
        this.updateStats();
        this.updateRequirementsUI();
        this.updateLivesUI();
    }

    generateLevel(level) {
        const nodeCount = level + 3; // Increase nodes slightly faster
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;

        // Create Nodes
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            this.nodes.push(new Node(x, y, i + 1));
        }

        // Connect everyone to everyone (Complete Graph)
        for (let i = 0; i < this.nodes.length; i++) {
            for (let j = i + 1; j < this.nodes.length; j++) {
                this.edges.push(new Edge(this.nodes[i], this.nodes[j]));
            }
        }

        // Define Constraints
        this.constraints = [
            new ConnectivityConstraint(),
            new MinDegreeConstraint(1)
        ];

        // Level 2+: Specific Constraints
        if (level >= 2) {
            const requiredPairs = [];
            const numConstraints = Math.floor(level / 2);

            for (let k = 0; k < numConstraints; k++) {
                const id1 = Math.floor(Math.random() * nodeCount) + 1;
                let id2 = Math.floor(Math.random() * nodeCount) + 1;
                while (id1 === id2) {
                    id2 = Math.floor(Math.random() * nodeCount) + 1;
                }
                const exists = requiredPairs.some(p => (p[0] === id1 && p[1] === id2) || (p[0] === id2 && p[1] === id1));
                if (!exists) {
                    requiredPairs.push([id1, id2]);
                }
            }
            if (requiredPairs.length > 0) {
                this.constraints.push(new SpecificConnectionConstraint(requiredPairs));
            }
        }

        // Level 3+: Hub Constraints
        if (level >= 3) {
            const hubNodeId = Math.floor(Math.random() * nodeCount) + 1;
            const minConnections = 3; // Hub needs at least 3 connections
            this.constraints.push(new HubConstraint(hubNodeId, minConnections));
            // Color the hub differently?
            const hubNode = this.nodes.find(n => n.id === hubNodeId);
            if (hubNode) hubNode.color = '#ffaa00'; // Neon Orange
        }

        // Level 4+: Max Distance Constraints
        if (level >= 4) {
            const id1 = Math.floor(Math.random() * nodeCount) + 1;
            let id2 = Math.floor(Math.random() * nodeCount) + 1;
            while (id1 === id2) id2 = Math.floor(Math.random() * nodeCount) + 1;

            const maxHops = 2;
            this.constraints.push(new MaxDistanceConstraint(id1, id2, maxHops));
        }

        this.targetComplexity = this.nodes.length - 1;
    }

    updateRequirementsUI() {
        this.ui.reqList.innerHTML = '';
        let hasReqs = false;

        // Specific Connections
        const specific = this.constraints.find(c => c instanceof SpecificConnectionConstraint);
        if (specific) {
            specific.requiredPairs.forEach(pair => {
                const li = document.createElement('li');
                li.textContent = `Connect ${pair[0]} ↔ ${pair[1]}`;
                this.ui.reqList.appendChild(li);
                hasReqs = true;
            });
        }

        // Hubs
        const hubs = this.constraints.filter(c => c instanceof HubConstraint);
        hubs.forEach(hub => {
            const li = document.createElement('li');
            li.textContent = `Node ${hub.nodeId}: Min ${hub.minConnections} links`;
            li.style.color = '#fcd34d'; // Match hub color
            this.ui.reqList.appendChild(li);
            hasReqs = true;
        });

        // Max Distance
        const dists = this.constraints.filter(c => c instanceof MaxDistanceConstraint);
        dists.forEach(d => {
            const li = document.createElement('li');
            li.textContent = `${d.nodeAId} ↔ ${d.nodeBId} (≤ ${d.maxHops} hops)`;
            this.ui.reqList.appendChild(li);
            hasReqs = true;
        });

        this.ui.reqContainer.style.display = hasReqs ? 'block' : 'none';
    }

    updateStats() {
        this.complexity = this.edges.filter(e => e.active).length;
        this.ui.complexity.textContent = this.complexity;
        this.ui.target.textContent = this.targetComplexity;
    }

    updateLivesUI() {
        this.ui.livesContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const hex = document.createElement('div');
            hex.className = 'life-hex';
            if (i >= this.lives) {
                hex.classList.add('lost');
            }
            this.ui.livesContainer.appendChild(hex);
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        let hovered = false;
        for (const edge of this.edges) {
            if (edge.isPointNearLine(x, y)) {
                edge.hovered = true;
                hovered = true;
                this.canvas.style.cursor = 'pointer';
            } else {
                edge.hovered = false;
            }
        }
        if (!hovered) {
            this.canvas.style.cursor = 'default';
        }
    }

    handleTouch(e) {
        e.preventDefault(); // Prevent scrolling
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;

        // Reuse click logic
        this.handleClick({ clientX: touch.clientX, clientY: touch.clientY });
    }

    handleClick(e) {
        // Ensure audio context is running on first interaction
        if (this.audio && !this.audio.ambienceStarted) {
            this.audio.startAmbience();
        }

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        for (const edge of this.edges) {
            if (edge.active && edge.isPointNearLine(x, y)) {
                const validation = this.canRemoveEdge(edge);
                if (validation.valid) {
                    edge.active = false;
                    this.audio.playTone();
                    this.updateStats();
                    this.checkWin();
                } else {
                    // Visual feedback for invalid move (shake/flash)
                    console.log("Cannot remove:", validation.reason);
                    this.audio.playError();
                    this.showToast(validation.reason);

                    this.lives--;
                    this.updateLivesUI();

                    if (this.lives <= 0) {
                        this.gameOver();
                    }
                }
                break;
            }
        }
    }

    gameOver() {
        this.ui.messageArea.classList.remove('hidden');
        document.getElementById('message-title').textContent = ">> SYSTEM_FAILURE";
        document.getElementById('message-desc').textContent = "CRITICAL_ERROR: TOO_MANY_FAULTS";
        this.ui.nextBtn.textContent = "[ REBOOT_SYSTEM ]";

        // Set next button behavior for this state
        this.ui.nextBtn.onclick = () => {
            this.restartLevel();
        };
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);

        // Remove after animation
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    canRemoveEdge(edgeToRemove) {
        for (const constraint of this.constraints) {
            const result = constraint.validate(this, edgeToRemove);
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true };
    }

    checkWin() {
        if (this.complexity <= this.targetComplexity) {
            this.ui.messageArea.classList.remove('hidden');
        }
    }

    loop() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Grid
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.1)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;

        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        this.ctx.restore();

        // Draw Edges first (behind nodes)
        this.edges.forEach(edge => edge.draw(this.ctx));

        // Draw Nodes
        this.nodes.forEach(node => node.draw(this.ctx));

        requestAnimationFrame(() => this.loop());
    }
}

new Game();
