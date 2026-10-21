// Global State
var SP = 50; // Setpoint as a percentage of tank height
var MV = 50; // Process Variable as a percentage of tank height
var OUT = 0; // PID Output (0% to 100% Inflow Pump)
var KP = 1.0; // High Kp to demonstrate sustained oscillation (K_u)
var TI = 0.0;  // Integral time in seconds
var TD = 0.0;  // Derivative time in seconds
var manualMode = false;

var bias = 0;

// Display Updates
function updateDisplay($element, value, showDecimal = true) {
  value = Math.round(value * 10) / 10;
  var realNumber = Math.floor(value).toString();
  var decimal = Math.floor((value % 1) * 10).toString();
  if (value == 100) {
    decimal = "";
  }
  $element.find(".numbers .real-number").text(realNumber.padStart(showDecimal ? 2 : 3, '0'));
  if (showDecimal) {
    $element.find(".numbers .decimal").text(decimal);
  }
  $element.find(".progress-bar").css("height", Math.max(0, Math.min(100, value)) + "%");
}

function updateBar($element, value) {
  $element.find(".progress-bar").css("height", Math.max(0, Math.min(100, value)) + "%");
}

function updateProcessVisual(value) {
  $("#tank-bottom-cap").attr("cy", scaleValue(value, 100, 0, -38, 261))
  $("#tank-bottom-fill").attr("y", scaleValue(value, 100, 0, -38, 261))
  $("#tank-bottom-fill").attr("height", scaleValue(value, 0, 100, 0, 300))
  
  $("#tank-top-fill").attr("height", scaleValue(value, 100, 0, 0, 300))
  $("#tank-top-bottom").attr("transform", "translate(191.87944," + (scaleValue(value, 100, 0, -50, 250)- 1.5) + ")")


}

function scaleValue(val, srcMin, srcMax, destMin, destMax) {
    return destMin + ((val - srcMin) / (srcMax - srcMin)) * (destMax - destMin);
}

function fitProcessVisualization() {
  const svg = document.querySelector(".process-visualization svg");
  const controller = document.querySelector(".regelaar");
  if (!svg || !controller) return;

  if (window.matchMedia("(max-width: 767.98px)").matches) {
    svg.style.removeProperty("width");
    svg.style.removeProperty("height");
    return;
  }

  const viewBox = svg.viewBox.baseVal;
  const availableWidth = svg.parentElement.clientWidth;
  const maxHeight = controller.getBoundingClientRect().height;
  const scale = Math.min(maxHeight / viewBox.height, availableWidth / viewBox.width);

  svg.style.width = `${viewBox.width * scale}px`;
  svg.style.height = `${viewBox.height * scale}px`;
}

// Setter Functions
function setKp(value) {
  KP = Math.max(0, value);
  updateDisplay($("#display-kp"), KP);
}

function setTi(value) {
  TI = Math.max(0, value);
  updateDisplay($("#display-ti"), TI);
}

function setTd(value) {
  TD = Math.max(0, value);
  updateDisplay($("#display-td"), TD);
}

function setSp(value) {
  SP = Math.max(0, Math.min(100, value));
  updateDisplay($("#display-sp"), SP);
  $("#input-sp").val(SP);
}

function setOut(value) {
  OUT = Math.max(0, Math.min(100, value));
  setManualMode(true);
  updateDisplay($("#display-out"), OUT);
  updateBar($("#progress-bar-out"), OUT);
}

function setMv(value) {
  MV = Math.max(0, Math.min(100, value));
  tankLevel = (MV / 100) * tankHeight;
  sensorBuffer.length = 0;
  updateDisplay($("#display-mv"), MV);
  updateBar($("#progress-bar-mv"), MV);
  updateProcessVisual(MV);
}

function setManualMode(isManual) {
  manualMode = isManual;
  $("#button-am")
    .attr("aria-pressed", manualMode)
    .toggleClass("btn-warning", manualMode)
    .toggleClass("btn-primary", !manualMode);
}

// Physical Process Constants
const tankDiameter = 0.8; // Tank diameter in meters
const tankHeight = 1.0; // Maximum liquid height in meters
const tankArea = Math.PI * Math.pow(tankDiameter / 2, 2);
const maxInflowRate = 0.5; // 500 L/s in m^3/s for a fast classroom response
const valveTimeConstant = 0.2; // 0.2 second actuator lag

// Torricelli Discharge Coefficient (sqrt drain dynamics)
const outflowCoeff = maxInflowRate / Math.sqrt(tankHeight);

// Process states
let valveOpening = 50.0; // Percent
let tankLevel = tankHeight * 0.5; // Meters

// Measurement Delay Buffer (0.1 second sensor lag)
let sensorBuffer = [];
const sensorDelaySeconds = 0.1;

function simulateProcess(controlOut, dt, currentTimeSeconds) {
  const valveCommand = Math.max(0, Math.min(100, controlOut));

  // 1. Valve Actuator Dynamics (First-Order Lag)
  const dValve_dt = (valveCommand - valveOpening) / valveTimeConstant;
  valveOpening += dValve_dt * dt;
  valveOpening = Math.max(0, Math.min(100, valveOpening));

  // 2. Tank Hydraulic Mass Balance (Torricelli Gravity Outflow)
  const inflow = (valveOpening / 100) * maxInflowRate;
  const outflow = outflowCoeff * Math.sqrt(Math.max(0, tankLevel));
  const dLevel_dt = (inflow - outflow) / tankArea;

  tankLevel += dLevel_dt * dt;
  tankLevel = Math.max(0, Math.min(tankHeight, tankLevel));

  const actualMV = (tankLevel / tankHeight) * 100;

  // 3. Sensor Delay Buffer (Transport Delay)
  sensorBuffer.push({ time: currentTimeSeconds, value: actualMV });
  const targetTime = currentTimeSeconds - sensorDelaySeconds;

  while (sensorBuffer.length > 1 && sensorBuffer[1].time <= targetTime) {
    sensorBuffer.shift();
  }

  return sensorBuffer[0].value; // Delayed PV
}

// Main Initializations & Control Loop
$(document).ready(function () {
  updateDisplay($("#display-sp"), SP);
  updateDisplay($("#display-mv"), MV);
  updateDisplay($("#display-out"), OUT);
  updateDisplay($("#display-kp"), KP);
  updateDisplay($("#display-ti"), TI);
  updateDisplay($("#display-td"), TD);

  fitProcessVisualization();
  window.addEventListener("resize", fitProcessVisualization);
  const controller = document.querySelector(".regelaar");
  if (controller && "ResizeObserver" in window) {
    new ResizeObserver(fitProcessVisualization).observe(controller);
  }

  $("#progress-bar-mv .progress-bar").css("height", MV + "%");
  $("#progress-bar-out .progress-bar").css("height", OUT + "%");

  $("#input-sp").on("input", function () {
    setSp(parseFloat($(this).val()) || 0);
  });

  const pid = new PIDController(KP, TI, TD, 0, 100);
  $("#button-am").on("click", function () {
    setManualMode(!manualMode);
    if (!manualMode) pid.reset();
  });

  let lastTime = null;

  function loop(currentTime) {
    if (!lastTime) {
      lastTime = currentTime;
      requestAnimationFrame(loop);
      return;
    }

    let dt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Sanitize dt to handle tab switches cleanly
    if (dt <= 0 || dt > 0.5) {
      dt = 0.016;
    }

    pid.setParameters(KP, TI, TD);

    // 1. Calculate Control Output
    if (!manualMode) {
      OUT = pid.update(SP, MV, dt);
    }

    updateDisplay($("#display-out"), OUT);
    updateBar($("#progress-bar-out"), OUT);

    // 2. Run Process Physics (passing time in seconds for delay line)
    MV = simulateProcess(OUT, dt, currentTime / 1000);

    updateDisplay($("#display-mv"), MV);
    updateBar($("#progress-bar-mv"), MV);
    updateProcessVisual(MV);

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
});

$(document).ready(function () {
  $('.content').click(function () {
    $(this).parent().find('.buttons').toggleClass('d-flex d-none');
  });

  $('[data-param].btn-adjust').click(function () {
    var varname = String($(this).data('param')).toUpperCase();
    var delta = Number($(this).data('delta'));
    var setter = window['set' + capitalizeFirstLetter(varname.toLowerCase())];
    if (Number.isFinite(delta) && typeof setter === 'function') {
      setter(window[varname] + delta);
    }
  });
});

function capitalizeFirstLetter(val) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}