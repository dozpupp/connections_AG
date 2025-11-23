
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

        // C Minor Chord (C2, Eb2, G2)
        const freqs = [65.41, 77.78, 98.00];
        const oscillators = [];
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();

        // Master Gain for Ambience
        gain.gain.value = 0.05; // Low volume background

        // Filter Setup
        filter.type = 'lowpass';
        filter.frequency.value = 200; // Base cutoff
        filter.Q.value = 1;

        // LFO Setup (Modulates Filter Frequency)
        lfo.type = 'sine';
        lfo.frequency.value = 0.1; // Slow breathing (0.1 Hz)
        lfoGain.gain.value = 100; // Modulation depth (+/- 100Hz)

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        // Create Oscillators
        freqs.forEach(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth'; // Richer harmonic content
            osc.frequency.value = freq;
            osc.connect(filter);
            osc.start();
            oscillators.push(osc);
        });

        filter.connect(gain);
        gain.connect(this.ctx.destination);
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

        return dist < 20; // Hit tolerance
    }
}

class Constraint {
    validate(nodes, edges, edgeToRemove) {
        return { valid: true };
    }
}

class ConnectivityConstraint extends Constraint {
    validate(nodes, edges, edgeToRemove) {
        const adj = new Map();
        nodes.forEach(n => adj.set(n.id, []));

        for (const edge of edges) {
            if (edge.active && edge !== edgeToRemove) {
                adj.get(edge.nodeA.id).push(edge.nodeB.id);
                adj.get(edge.nodeB.id).push(edge.nodeA.id);
            }
        }

        const startNodeId = nodes[0].id;
        const visited = new Set();
        const queue = [startNodeId];
        visited.add(startNodeId);

        while (queue.length > 0) {
            const currId = queue.shift();
            const neighbors = adj.get(currId);
            if (neighbors) {
                for (const neighborId of neighbors) {
                    if (!visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push(neighborId);
                    }
                }
            }
        }

        if (visited.size === nodes.length) {
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

    validate(nodes, edges, edgeToRemove) {
        const checkNode = (nodeId) => {
            let degree = 0;
            for (const edge of edges) {
                if (edge.active && edge !== edgeToRemove) {
                    if (edge.nodeA.id === nodeId || edge.nodeB.id === nodeId) {
                        degree++;
                    }
                }
            }
            return degree;
        };

        if (edgeToRemove) {
            const degreeA = checkNode(edgeToRemove.nodeA.id);
            const degreeB = checkNode(edgeToRemove.nodeB.id);
            if (degreeA < this.minDegree || degreeB < this.minDegree) {
                return { valid: false, reason: `Nodes must have at least ${this.minDegree} connection(s)` };
            }
        } else {
            for (const node of nodes) {
                if (checkNode(node.id) < this.minDegree) {
                    return { valid: false, reason: `All nodes must have at least ${this.minDegree} connection(s)` };
                }
            }
        }

        return { valid: true };
    }
}

class SpecificConnectionConstraint extends Constraint {
    constructor(requiredPairs) {
        super();
        this.requiredPairs = requiredPairs; // Array of [id1, id2]
    }

    validate(nodes, edges, edgeToRemove) {
        if (!edgeToRemove) {
            return { valid: true };
        }

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

    validate(nodes, edges, edgeToRemove) {
        const adj = new Map();
        nodes.forEach(n => adj.set(n.id, []));

        for (const edge of edges) {
            if (edge.active && edge !== edgeToRemove) {
                adj.get(edge.nodeA.id).push(edge.nodeB.id);
                adj.get(edge.nodeB.id).push(edge.nodeA.id);
            }
        }

        const queue = [[this.nodeAId, 0]];
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

    validate(nodes, edges, edgeToRemove) {
        let connections = 0;
        for (const edge of edges) {
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

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.nodes = [];
        this.edges = [];
        this.complexity = 0;
        this.targetComplexity = 0;
        this.constraints = [];
        this.lives = 3;
        this.audio = new AudioController();

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
            reqList: document.getElementById('requirements-list'),
            reqContainer: document.getElementById('requirements-container'),
            livesContainer: document.getElementById('lives-container')
        };

        document.querySelector('h1').textContent = "Connections v1.1";

        this.level = 1;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleClick(e));

        if (this.ui.nextBtn) this.ui.nextBtn.addEventListener('click', () => this.startLevel(this.level + 1));
        if (this.ui.startBtn) this.ui.startBtn.addEventListener('click', () => this.startGame());
        if (this.ui.continueBtn) this.ui.continueBtn.addEventListener('click', () => this.continueGame());
        if (this.ui.restartBtn) this.ui.restartBtn.addEventListener('click', () => this.restartLevel());

        this.checkSave();
        this.loop();
    }

    checkSave() {
        try {
            const savedLevel = localStorage.getItem('connections_level');
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
        this.lives = 3;
        this.ui.messageArea.classList.add('hidden');

        this.generateLevel(level);
        this.updateStats();
        this.updateStats();
        this.updateLivesUI();
        this.updateRequirementsUI();
    }

    generateLevel(level) {
        const nodeCount = level + 3;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) * 0.3;

        // 1. Create Nodes
        for (let i = 0; i < nodeCount; i++) {
            const angle = (i / nodeCount) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            this.nodes.push(new Node(x, y, i + 1));
        }

        // 2. Generate Constraints
        this.constraints = this.generateConstraints(level, this.nodes);

        // 3. Generate Solution (Minimal valid graph)
        const solutionEdges = this.generateSolution(this.nodes, this.constraints);

        // 4. Calculate Target Complexity
        this.targetComplexity = solutionEdges.length;

        // 5. Generate Initial Game Graph (Solution + Noise)
        this.edges = this.addNoise(this.nodes, solutionEdges, level);
    }

    generateConstraints(level, nodes) {
        const constraints = [
            new ConnectivityConstraint(),
            new MinDegreeConstraint(1)
        ];

        const nodeCount = nodes.length;

        // Level 2+: Specific Connections
        if (level >= 2) {
            const requiredPairs = [];
            const numConstraints = Math.floor(level / 2);
            for (let k = 0; k < numConstraints; k++) {
                const id1 = Math.floor(Math.random() * nodeCount) + 1;
                let id2 = Math.floor(Math.random() * nodeCount) + 1;
                while (id1 === id2) id2 = Math.floor(Math.random() * nodeCount) + 1;

                const exists = requiredPairs.some(p => (p[0] === id1 && p[1] === id2) || (p[0] === id2 && p[1] === id1));
                if (!exists) requiredPairs.push([id1, id2]);
            }
            if (requiredPairs.length > 0) constraints.push(new SpecificConnectionConstraint(requiredPairs));
        }

        // Level 3+: Hubs
        if (level >= 3) {
            const hubNodeId = Math.floor(Math.random() * nodeCount) + 1;
            const minConnections = 3;
            constraints.push(new HubConstraint(hubNodeId, minConnections));
            const hubNode = nodes.find(n => n.id === hubNodeId);
            if (hubNode) hubNode.color = '#ff00ff'; // Highlight hub
        }

        // Level 4+: Max Distance
        if (level >= 4) {
            const id1 = Math.floor(Math.random() * nodeCount) + 1;
            let id2 = Math.floor(Math.random() * nodeCount) + 1;
            while (id1 === id2) id2 = Math.floor(Math.random() * nodeCount) + 1;
            const maxHops = 2;
            constraints.push(new MaxDistanceConstraint(id1, id2, maxHops));
        }

        return constraints;
    }

    generateSolution(nodes, constraints) {
        // Start with a Spanning Tree to ensure connectivity
        let edges = [];
        const unvisited = [...nodes];
        const visited = [unvisited.shift()];

        while (unvisited.length > 0) {
            const u = visited[Math.floor(Math.random() * visited.length)];
            const vIndex = Math.floor(Math.random() * unvisited.length);
            const v = unvisited[vIndex];

            edges.push(new Edge(u, v));

            visited.push(v);
            unvisited.splice(vIndex, 1);
        }

        // Satisfy Specific Connections
        const specific = constraints.find(c => c instanceof SpecificConnectionConstraint);
        if (specific) {
            for (const pair of specific.requiredPairs) {
                const u = nodes.find(n => n.id === pair[0]);
                const v = nodes.find(n => n.id === pair[1]);
                // Check if edge exists
                if (!edges.some(e => (e.nodeA === u && e.nodeB === v) || (e.nodeA === v && e.nodeB === u))) {
                    edges.push(new Edge(u, v));
                }
            }
        }

        // Satisfy Hubs (Add random edges to hub until satisfied)
        const hubs = constraints.filter(c => c instanceof HubConstraint);
        for (const hub of hubs) {
            const u = nodes.find(n => n.id === hub.nodeId);
            let currentDegree = edges.filter(e => e.nodeA === u || e.nodeB === u).length;

            while (currentDegree < hub.minConnections) {
                // Find a node not connected to u
                const candidates = nodes.filter(n => n !== u && !edges.some(e => (e.nodeA === u && e.nodeB === n) || (e.nodeA === n && e.nodeB === u)));
                if (candidates.length === 0) break;

                const v = candidates[Math.floor(Math.random() * candidates.length)];
                edges.push(new Edge(u, v));
                currentDegree++;
            }
        }

        // Satisfy Max Distance
        const dists = constraints.filter(c => c instanceof MaxDistanceConstraint);
        for (const d of dists) {
            const validation = d.validate(nodes, edges, null);
            if (!validation.valid) {
                const u = nodes.find(n => n.id === d.nodeAId);
                const v = nodes.find(n => n.id === d.nodeBId);
                if (!edges.some(e => (e.nodeA === u && e.nodeB === v) || (e.nodeA === v && e.nodeB === u))) {
                    edges.push(new Edge(u, v));
                }
            }
        }

        return this.pruneGraph(nodes, edges, constraints);
    }

    pruneGraph(nodes, edges, constraints) {
        let currentEdges = [...edges];
        // Shuffle to get varied solutions
        for (let i = currentEdges.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [currentEdges[i], currentEdges[j]] = [currentEdges[j], currentEdges[i]];
        }

        for (let i = currentEdges.length - 1; i >= 0; i--) {
            const edgeToRemove = currentEdges[i];
            // Check if valid without this edge
            let isValid = true;
            for (const constraint of constraints) {
                const result = constraint.validate(nodes, currentEdges, edgeToRemove);
                if (!result.valid) {
                    isValid = false;
                    break;
                }
            }

            if (isValid) {
                currentEdges.splice(i, 1);
            }
        }

        return currentEdges;
    }

    addNoise(nodes, solutionEdges, level) {
        let edges = [...solutionEdges];
        // Add random edges to create the puzzle

        let noiseCount;
        if (level === 1) {
            // Level 1: Keep it relatively simple but populated
            noiseCount = Math.floor(nodes.length * 1.5);
        } else {
            // Level 2+: Reduce density to avoid complete graphs
            // Use a lower multiplier and add a bit based on level
            noiseCount = Math.floor(nodes.length * 1.0) + Math.floor(level * 0.5);

            // Cap total edges to ensure graph isn't too dense (e.g., max 70% of complete graph)
            const maxPossibleEdges = (nodes.length * (nodes.length - 1)) / 2;
            const currentCount = edges.length;
            const maxAllowed = Math.floor(maxPossibleEdges * 0.7);

            if (currentCount + noiseCount > maxAllowed) {
                noiseCount = Math.max(0, maxAllowed - currentCount);
            }
        }

        let attempts = 0;
        while (edges.length < solutionEdges.length + noiseCount && attempts < 1000) {
            attempts++;
            const u = nodes[Math.floor(Math.random() * nodes.length)];
            const v = nodes[Math.floor(Math.random() * nodes.length)];

            if (u === v) continue;

            const exists = edges.some(e => (e.nodeA === u && e.nodeB === v) || (e.nodeA === v && e.nodeB === u));
            if (!exists) {
                edges.push(new Edge(u, v));
            }
        }

        return edges;
    }

    updateRequirementsUI() {
        this.ui.reqList.innerHTML = '';
        let hasReqs = false;

        const specific = this.constraints.find(c => c instanceof SpecificConnectionConstraint);
        if (specific) {
            specific.requiredPairs.forEach(pair => {
                const li = document.createElement('li');
                li.textContent = `Connect ${pair[0]} ↔ ${pair[1]}`;
                this.ui.reqList.appendChild(li);
                hasReqs = true;
            });
        }

        const hubs = this.constraints.filter(c => c instanceof HubConstraint);
        hubs.forEach(hub => {
            const li = document.createElement('li');
            li.textContent = `Node ${hub.nodeId}: Min ${hub.minConnections} links`;
            li.style.color = '#ff00ff';
            this.ui.reqList.appendChild(li);
            hasReqs = true;
        });

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

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

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

    handleClick(e) {
        // Ensure audio context is running on first interaction
        if (this.audio && !this.audio.ambienceStarted) {
            this.audio.startAmbience();
        }

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (const edge of this.edges) {
            if (edge.active && edge.isPointNearLine(x, y)) {
                const validation = this.canRemoveEdge(edge);
                if (validation.valid) {
                    edge.active = false;
                    this.audio.playTone();
                    this.updateStats();
                    this.checkWin();
                } else {
                    console.log("Cannot remove:", validation.reason);
                    this.audio.playError();
                    this.showToast(validation.reason);
                    this.lives--;
                    this.updateLivesUI();
                    this.checkGameOver();
                }
                break;
            }
        }
    }

    canRemoveEdge(edgeToRemove) {
        const activeEdges = this.edges.filter(e => e.active);

        for (const constraint of this.constraints) {
            const result = constraint.validate(this.nodes, activeEdges, edgeToRemove);
            if (!result.valid) {
                return result;
            }
        }
        return { valid: true };
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    checkWin() {
        if (this.complexity <= this.targetComplexity) {
            this.ui.messageArea.classList.remove('hidden');
            document.getElementById('message-title').textContent = ">> SEQUENCE_COMPLETE";
            document.getElementById('message-desc').textContent = "CONNECTION_ESTABLISHED";
            this.ui.nextBtn.classList.remove('hidden');
        }
    }

    checkGameOver() {
        if (this.lives <= 0) {
            this.ui.messageArea.classList.remove('hidden');
            document.getElementById('message-title').textContent = ">> SYSTEM_FAILURE";
            document.getElementById('message-desc').textContent = "SIGNAL_LOST. REBOOT_REQUIRED.";
            this.ui.nextBtn.classList.add('hidden');
        }
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
        this.edges.forEach(edge => edge.draw(this.ctx));
        this.nodes.forEach(node => node.draw(this.ctx));
        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('load', () => {
    console.log("Window loaded, initializing Game...");
    try {
        new Game();
        console.log("Game initialized successfully");
    } catch (e) {
        console.error("Game initialization failed:", e);
    }
});
