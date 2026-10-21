class PIDController {
  constructor(Kp, Ti, Td, minOutput = -Infinity, maxOutput = Infinity, N = 10) {
    this.Kp = Kp;
    this.Ti = Ti; // Integral time in seconds
    this.Td = Td; // Derivative time in seconds
    this.minOutput = minOutput;
    this.maxOutput = maxOutput;
    this.N = N;   // Derivative filter coefficient (typically 8–20)

    this.integral = 0;
    this.previousPV = null;
    this.filteredDerivative = 0;
  }

  update(setpoint, processValue, dt) {
    // 1. Sanitize dt to prevent spike on page load or tab unhide
    const safeDt = Math.max(0.001, Math.min(0.1, dt));

    // 2. Prevent startup spike: initialize previousPV and skip derivative on first step
    if (this.previousPV === null) {
      this.previousPV = processValue;
      const initialError = setpoint - processValue;
      const initialP = this.Kp * initialError;
      return Math.max(this.minOutput, Math.min(this.maxOutput, initialP));
    }

    const error = setpoint - processValue;

    // 3. Proportional term
    const P = this.Kp * error;

    // 4. Derivative on Measurement with Low-Pass Filter (eliminates derivative kick)
    const dPV = (processValue - this.previousPV) / safeDt;
    this.previousPV = processValue;

    if (this.Td > 0) {
      const alpha = safeDt / (this.Td / this.N + safeDt);
      this.filteredDerivative += alpha * (dPV - this.filteredDerivative);
    } else {
      this.filteredDerivative = 0;
    }
    const D = this.Kp * this.Td * this.filteredDerivative;

    // 5. Integral term calculation with candidate update
    const Ki = this.Ti > 0 ? this.Kp / this.Ti : 0;
    const prospectiveIntegral = this.integral + Ki * error * safeDt;

    // 6. Preliminary unclamped output calculation
    let output = P + prospectiveIntegral - D;

    // 7. Output Clamping & Anti-Windup (Conditional Integration)
    const isSaturatedHigh = output > this.maxOutput;
    const isSaturatedLow = output < this.minOutput;

    if (isSaturatedHigh) {
      output = this.maxOutput;
      // Only integrate if error is driving output back in-bounds
      if (Ki > 0 && error < 0) {
        this.integral = prospectiveIntegral;
      }
    } else if (isSaturatedLow) {
      output = this.minOutput;
      // Only integrate if error is driving output back in-bounds
      if (Ki > 0 && error > 0) {
        this.integral = prospectiveIntegral;
      }
    } else {
      if (Ki > 0) {
        this.integral = prospectiveIntegral;
      }
    }

    return output;
  }

  setParameters(Kp, Ti, Td) {
    this.Kp = Kp;
    this.Ti = Ti;
    this.Td = Td;
  }

  reset() {
    this.integral = 0;
    this.previousPV = null;
    this.filteredDerivative = 0;
  }
}