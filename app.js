// ---- State ----
let currentMode = null; // 'directions' | 'numbers' | 'colours'
let isRunning = false;

let elapsedMs = 0;
let timerIntervalId = null;
let switchIntervalId = null;
let startTimestamp = null;
let audioCtx = null;

const DEFAULT_INTERVAL_MS = 1000;
const DIRECTION_OPTIONS = [
  { key: "up", label: "Up", symbol: "↑" },
  { key: "down", label: "Down", symbol: "↓" },
  { key: "left", label: "Left", symbol: "←" },
  { key: "right", label: "Right", symbol: "→" }
];

const COLOUR_OPTIONS = [
  { id: "red", name: "Red", value: "#ef4444" },
  { id: "orange", name: "Orange", value: "#f97316" },
  { id: "amber", name: "Amber", value: "#f59e0b" },
  { id: "yellow", name: "Yellow", value: "#eab308" },
  { id: "lime", name: "Lime", value: "#65a30d" },
  { id: "green", name: "Green", value: "#16a34a" },
  { id: "teal", name: "Teal", value: "#0f766e" },
  { id: "cyan", name: "Cyan", value: "#22d3ee" },
  { id: "blue", name: "Blue", value: "#2563eb" },
  { id: "indigo", name: "Indigo", value: "#4338ca" },
  { id: "violet", name: "Violet", value: "#7c3aed" },
  { id: "magenta", name: "Magenta", value: "#c026d3" },
  { id: "pink", name: "Pink", value: "#ec4899" },
  { id: "brown", name: "Brown", value: "#8b5c37" }
];

const SETTINGS_KEY = "focusTrainerSettingsV1";

let switchDelayMs = DEFAULT_INTERVAL_MS;
let userSettings = {
  switchDelayMs: DEFAULT_INTERVAL_MS,
  directions: DIRECTION_OPTIONS.map((d) => d.key),
  numbers: { min: 1, max: 24 },
  colours: COLOUR_OPTIONS.map((c) => c.id)
};

const SWITCH_ANIMATION_CLASS = "switch-cue";
const SCREEN_ANIMATION_CLASS = "mode-screen-cue";

// ---- DOM references ----
const homeScreen = document.getElementById("home-screen");
const modeScreen = document.getElementById("mode-screen");
const topBar = document.getElementById("top-bar");
const clockEl = document.getElementById("clock");
const backButton = document.getElementById("back-button");

const modeLabel = document.getElementById("mode-label");
const initLayer = document.getElementById("initialization-layer");
const contentLayer = document.getElementById("content-layer");
const playPauseIcon = document.getElementById("play-pause-icon");
const displayMain = document.getElementById("display-main");
const displaySub = document.getElementById("display-sub");

const settingsButton = document.getElementById("settings-button");
const settingsPanel = document.getElementById("settings-panel");
const intervalInput = document.getElementById("interval-input");
const intervalValue = document.getElementById("interval-value");
const directionOptionsContainer = document.getElementById("direction-options");
const colourOptionsContainer = document.getElementById("colour-options");
const numberMinInput = document.getElementById("number-min");
const numberMaxInput = document.getElementById("number-max");
const numberError = document.getElementById("number-error");

const directionsSubtitleEl = document.querySelector(".mode-card.directions .mode-subtitle");
const numbersSubtitleEl = document.querySelector(".mode-card.numbers .mode-subtitle");
const coloursSubtitleEl = document.querySelector(".mode-card.colours .mode-subtitle");

// ---- Initialization ----
document.addEventListener("DOMContentLoaded", () => {
  setupModeButtons();
  setupSettings();
  setupNavigation();
  enterHome();
  registerServiceWorker();
});

// ---- Mode selection ----
function setupModeButtons() {
  document.querySelectorAll(".mode-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.dataset.mode;
      openMode(mode);
    });
  });
}

function openMode(mode) {
  currentMode = mode;
  applyModeBaseStyle();
  modeLabel.textContent = mode.toUpperCase();

  resetTimer();
  enterIdleState(); // show play icon, 0:00:00

  homeScreen.classList.add("hidden");
  modeScreen.classList.remove("hidden");
  homeScreen.classList.remove("active");
  modeScreen.classList.add("active");

  topBar.classList.remove("hidden");
}

// ---- Navigation ----
function setupNavigation() {
  // Back button closes mode and resets everything
  backButton.addEventListener("click", (event) => {
    event.stopPropagation();
    enterHome();
  });

  // Entire mode screen toggles between running and paused/idle
  modeScreen.addEventListener("click", () => {
    if (!currentMode) return;

    if (isRunning) {
      // Tap during running: go to "Initialization Page" with pause icon
      enterPausedState();
    } else {
      // Tap from idle OR paused: resume/start running
      enterRunningState();
    }
  });
}

function enterHome() {
  currentMode = null;
  isRunning = false;
  stopTimer();
  stopSwitching();
  resetTimer();

  modeScreen.classList.add("hidden");
  homeScreen.classList.remove("hidden");
  modeScreen.classList.remove("active");
  homeScreen.classList.add("active");

  topBar.classList.add("hidden");
}

// ---- Mode screen visual state ----
function enterIdleState() {
  isRunning = false;
  initLayer.classList.remove("hidden");
  contentLayer.classList.add("hidden");
  playPauseIcon.textContent = "▶";
  modeLabel.classList.remove("hidden"); // show "DIRECTIONS / NUMBERS / COLOURS"
  updateClockDisplay(0);
}

function enterPausedState() {
  isRunning = false;
  stopTimer();
  stopSwitching();
  initLayer.classList.remove("hidden");
  contentLayer.classList.add("hidden");
  playPauseIcon.textContent = "⏸";
  modeLabel.classList.remove("hidden"); // still visible on paused init page
}

function enterRunningState() {
  if (!currentMode) return;
  isRunning = true;
  initLayer.classList.add("hidden");
  contentLayer.classList.remove("hidden");
  playPauseIcon.textContent = "";
  modeLabel.classList.add("hidden"); // hide label/background while running

  startTimer();
  startSwitching();
}

function applyModeBaseStyle() {
  modeScreen.classList.remove("mode-directions", "mode-numbers", "mode-colours");
  modeScreen.classList.add(`mode-${currentMode}`);

  // reset any inline overrides
  modeScreen.style.backgroundColor = "";
  displaySub.style.color = "#f9fafb";
  displayMain.style.color = "#f9fafb";
}

// ---- Stopwatch ----
function startTimer() {
  if (timerIntervalId) return;
  startTimestamp = Date.now();
  timerIntervalId = setInterval(() => {
    const now = Date.now();
    const total = elapsedMs + (now - startTimestamp);
    updateClockDisplay(total);
  }, 50); // refresh fast enough to show milliseconds smoothly
}

function stopTimer() {
  if (!timerIntervalId) return;
  clearInterval(timerIntervalId);
  timerIntervalId = null;
  if (startTimestamp) {
    elapsedMs += Date.now() - startTimestamp;
  }
}

function resetTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
  elapsedMs = 0;
  updateClockDisplay(0);
}

function updateClockDisplay(totalMs) {
  const minutes = Math.floor(totalMs / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = Math.floor(totalMs % 1000);

  const m = String(minutes).padStart(2, "0");
  const s = String(seconds).padStart(2, "0");
  const ms = String(milliseconds).padStart(3, "0");

  clockEl.textContent = `${m}:${s}.${ms}`;
}

// ---- Random switching ----
function startSwitching() {
  if (!currentMode) return;
  if (switchIntervalId) {
    clearInterval(switchIntervalId);
  }
  showRandomValue();
  switchIntervalId = setInterval(showRandomValue, switchDelayMs);
}

function stopSwitching() {
  if (!switchIntervalId) return;
  clearInterval(switchIntervalId);
  switchIntervalId = null;
}

function showRandomValue() {
  if (!currentMode) return;

  if (currentMode === "directions") {
    showRandomDirection();
  } else if (currentMode === "numbers") {
    showRandomNumber();
  } else if (currentMode === "colours") {
    showRandomColour();
  }
}

function pickRandom(list) {
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function showRandomDirection() {
  if (!userSettings.directions.length) return;
  const key = pickRandom(userSettings.directions);
  const option = DIRECTION_OPTIONS.find((d) => d.key === key) || DIRECTION_OPTIONS[0];

  displayMain.textContent = option.symbol;
  displaySub.textContent = "";   // no “LEFT/RIGHT/UP/DOWN” text

  triggerSwitchCue();
}

function showRandomNumber() {
  const { min, max } = userSettings.numbers;
  const span = max - min + 1;
  if (span <= 0) return;

  const n = Math.floor(Math.random() * span) + min;
  displayMain.textContent = n;
  displaySub.textContent = "";

  triggerSwitchCue();
}

function showRandomColour() {
  if (!userSettings.colours.length) return;
  const id = pickRandom(userSettings.colours);
  const colour = COLOUR_OPTIONS.find((c) => c.id === id) || COLOUR_OPTIONS[0];

  modeScreen.style.backgroundColor = colour.value; // Full-screen solid colour

  displayMain.textContent = "";
  displaySub.textContent = colour.name;

  displaySub.style.color = "#f9fafb";
  displayMain.style.color = "#f9fafb";

  triggerSwitchCue();
}

// ---- Settings: interval, directions, numbers, colours ----
function setupSettings() {
  loadSettingsFromStorage();
  applyIntervalUI();
  renderDirectionOptions();
  renderColourOptions();
  setupNumberRangeInputs();
  updateHomeSubtitles();

  intervalInput.addEventListener("input", handleIntervalChange);

  settingsButton.addEventListener("click", (event) => {
    event.stopPropagation();
    settingsPanel.classList.toggle("hidden");
  });

  settingsPanel.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    const isOpen = !settingsPanel.classList.contains("hidden");
    if (!isOpen) return;

    const clickInsidePanel = settingsPanel.contains(event.target);
    const clickOnButton = settingsButton.contains(event.target);
    if (!clickInsidePanel && !clickOnButton) {
      hideSettingsPanel();
    }
  });
}

function loadSettingsFromStorage() {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);

      // Security: Prevent prototype pollution by validating the parsed object
      // and only accessing known properties
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Invalid settings format');
      }

      // Security: Freeze the parsed object to prevent modification
      Object.freeze(parsed);

      if (typeof parsed.switchDelayMs === "number") {
        userSettings.switchDelayMs = clampInterval(parsed.switchDelayMs);
      }
      if (Array.isArray(parsed.directions)) {
        userSettings.directions = parsed.directions.filter((key) =>
          DIRECTION_OPTIONS.some((d) => d.key === key)
        );
      }
      if (parsed.numbers && typeof parsed.numbers === "object") {
        const maybeMin = parseInt(parsed.numbers.min, 10);
        const maybeMax = parseInt(parsed.numbers.max, 10);
        if (isValidNumberRange(maybeMin, maybeMax)) {
          userSettings.numbers = { min: maybeMin, max: maybeMax };
        }
      }
      if (Array.isArray(parsed.colours)) {
        userSettings.colours = parsed.colours.filter((id) =>
          COLOUR_OPTIONS.some((c) => c.id === id)
        );
      }
    } catch (err) {
      console.warn("Could not parse stored settings", err);
    }
  } else {
    // legacy interval only
    const legacyInterval = localStorage.getItem("switchDelayMs");
    if (legacyInterval) {
      const parsed = parseInt(legacyInterval, 10);
      if (!isNaN(parsed)) {
        userSettings.switchDelayMs = clampInterval(parsed);
      }
    }
  }

  // fallbacks / sanity
  if (!userSettings.directions.length) {
    userSettings.directions = DIRECTION_OPTIONS.map((d) => d.key);
  }
  if (!userSettings.colours.length) {
    userSettings.colours = COLOUR_OPTIONS.map((c) => c.id);
  }
  if (!isValidNumberRange(userSettings.numbers.min, userSettings.numbers.max)) {
    userSettings.numbers = { min: 1, max: 24 };
  }

  switchDelayMs = userSettings.switchDelayMs;
  saveSettingsToStorage(); // ensure storage stays normalized
}

function handleIntervalChange() {
  const sec = parseInt(intervalInput.value, 10);
  if (isNaN(sec)) return;
  switchDelayMs = clampInterval(sec * 1000);
  userSettings.switchDelayMs = switchDelayMs;
  intervalValue.textContent = `${switchDelayMs / 1000} s`;
  saveSettingsToStorage();

  // If currently running, apply new interval immediately
  if (isRunning && currentMode) {
    stopSwitching();
    startSwitching();
  }
}

function applyIntervalUI() {
  const seconds = switchDelayMs / 1000;
  intervalInput.value = seconds.toString();
  intervalValue.textContent = `${seconds.toFixed(0)} s`;
}

function renderDirectionOptions() {
  directionOptionsContainer.innerHTML = "";
  DIRECTION_OPTIONS.forEach((option) => {
    const label = document.createElement("label");
    label.className = "checkbox-pill direction-pill";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.key;
    input.checked = userSettings.directions.includes(option.key);
    input.addEventListener("change", () => {
      const next = new Set(userSettings.directions);
      if (input.checked) {
        next.add(option.key);
      } else {
        next.delete(option.key);
      }
      if (!next.size) {
        input.checked = true; // keep at least one option
        return;
      }
      userSettings.directions = Array.from(next);
      saveSettingsToStorage();
      updateHomeSubtitles();
      if (isRunning && currentMode === "directions") {
        stopSwitching();
        startSwitching();
      }
    });

    const text = document.createElement("span");
    text.className = "pill-text";
    text.textContent = option.label;

    label.appendChild(input);
    label.appendChild(text);
    directionOptionsContainer.appendChild(label);
  });
}

function setupNumberRangeInputs() {
  numberMinInput.value = userSettings.numbers.min;
  numberMaxInput.value = userSettings.numbers.max;

  const handleNumberChange = () => {
    const min = parseInt(numberMinInput.value, 10);
    const max = parseInt(numberMaxInput.value, 10);
    const valid = isValidNumberRange(min, max);

    numberError.classList.toggle("hidden", valid);
    numberMinInput.classList.toggle("input-error", !valid);
    numberMaxInput.classList.toggle("input-error", !valid);

    if (!valid) return;

    userSettings.numbers = { min, max };
    saveSettingsToStorage();
    updateHomeSubtitles();
    if (isRunning && currentMode === "numbers") {
      stopSwitching();
      startSwitching();
    }
  };

  numberMinInput.addEventListener("input", handleNumberChange);
  numberMaxInput.addEventListener("input", handleNumberChange);
}

function renderColourOptions() {
  colourOptionsContainer.innerHTML = "";
  COLOUR_OPTIONS.forEach((option) => {
    const label = document.createElement("label");
    label.className = "checkbox-pill colour-pill";
    const swatch = document.createElement("span");
    swatch.className = "pill-swatch";
    swatch.style.backgroundColor = option.value;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.id;
    input.checked = userSettings.colours.includes(option.id);
    input.addEventListener("change", () => {
      const next = new Set(userSettings.colours);
      if (input.checked) {
        next.add(option.id);
      } else {
        next.delete(option.id);
      }
      if (!next.size) {
        input.checked = true; // keep at least one colour to avoid blank screen
        return;
      }
      userSettings.colours = Array.from(next);
      saveSettingsToStorage();
      updateHomeSubtitles();
      if (isRunning && currentMode === "colours") {
        stopSwitching();
        startSwitching();
      }
    });

    const text = document.createElement("span");
    text.className = "pill-text";
    text.textContent = option.name;

    label.appendChild(input);
    label.appendChild(swatch);
    label.appendChild(text);
    colourOptionsContainer.appendChild(label);
  });
}

function updateHomeSubtitles() {
  const directionLabels = userSettings.directions
    .map((key) => DIRECTION_OPTIONS.find((d) => d.key === key))
    .filter(Boolean)
    .map((d) => d.label);

  const colourLabels = userSettings.colours
    .map((id) => COLOUR_OPTIONS.find((c) => c.id === id))
    .filter(Boolean)
    .map((c) => c.name);

  directionsSubtitleEl.textContent = `Arrows: ${directionLabels.join(", ")}`;
  numbersSubtitleEl.textContent = `${userSettings.numbers.min} to ${userSettings.numbers.max}`;

  const colourPreview = colourLabels.slice(0, 3).join(", ");
  const remainder = colourLabels.length - 3;
  coloursSubtitleEl.textContent = remainder > 0
    ? `${colourPreview} +${remainder}`
    : colourLabels.join(", ");
}

function saveSettingsToStorage() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(userSettings));
  // keep legacy key for backward compatibility with earlier version
  localStorage.setItem("switchDelayMs", userSettings.switchDelayMs.toString());
}

function hideSettingsPanel() {
  settingsPanel.classList.add("hidden");
}

function clampInterval(value) {
  const ms = Math.max(1000, Math.min(10000, value));
  return Math.round(ms);
}

function isValidNumberRange(min, max) {
  return Number.isInteger(min) && Number.isInteger(max) && max > min;
}

// ---- Visual cue per switch ----
function triggerSwitchCue() {
  // restart animation by toggling classes
  contentLayer.classList.remove(SWITCH_ANIMATION_CLASS);
  modeScreen.classList.remove(SCREEN_ANIMATION_CLASS);

  // force reflow so animation can replay
  void contentLayer.offsetWidth;

  contentLayer.classList.add(SWITCH_ANIMATION_CLASS);
  modeScreen.classList.add(SCREEN_ANIMATION_CLASS);

  playSwitchSound();
}

// ---- Service worker registration (PWA) ----
function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch((err) => {
          console.log("Service worker registration failed:", err);
        });
    });
  }
}

// ---- Audio feedback ----
function playSwitchSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") {
      // resume on first user gesture
      audioCtx.resume();
    }

    const duration = 0.12;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(880, now); // A5 tone

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.warn("Unable to play switch sound:", err);
  }
}
