/***

easy-pid.js - Copyright 2023-2026 Harshad Joshi and Bufferstack.IO Analytics Technology LLP, Pune

Licensed under the GNU General Public License, Version 3.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

https://www.gnu.org/licenses/gpl-3.0.html

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Updated for simple-pid-controller v2.0.0:
  - Constructor now uses options object (outputMin/Max, integralMin/Max, deadband, settledTolerance)
  - Dynamic dt via real timestamps (fixed dt is fallback only)
  - Derivative on measurement — no derivative kick on setpoint changes
  - setTarget() resets integral and derivative state automatically
  - Anti-windup via integralMin/integralMax clamping
  - Output clamping via outputMin/outputMax
  - Deadband support
  - Manual / Auto mode with bumpless transfer via setMode() / setManualOutput()
  - Runtime gain update via updateGains()
  - getStatus() used for structured telemetry output
  - EventEmitter: 'update' and 'settled' events replace manual interval-based checks
  - reset() called on node close and on 'reset' topic input
  - New input topics: 'gains', 'mode', 'manual_output', 'reset'

***/

"use strict";

const PIDController = require('simple-pid-controller');

module.exports = function (RED) {

  function EasyPIDControllerNode(config) {
    RED.nodes.createNode(this, config);
    const node = this;
    let controller = null;
    let pidTimer   = null;

    // ── Parse and validate configuration from Node-RED editor ──────────────────
    try {
      node.k_p         = Number(config.k_p);
      node.k_i         = Number(config.k_i);
      node.k_d         = Number(config.k_d);
      node.dt          = Number(config.dt);
      node.sensor_type = config.sensor_type;
      node.range_min   = Number(config.range_min);
      node.range_max   = Number(config.range_max);
      node.output_min  = Number(config.output_min);   // NEW: output clamp lower bound
      node.output_max  = Number(config.output_max);   // NEW: output clamp upper bound
      node.int_min     = Number(config.int_min);      // NEW: integral clamp lower bound (anti-windup)
      node.int_max     = Number(config.int_max);      // NEW: integral clamp upper bound (anti-windup)
      node.deadband    = Number(config.deadband)  || 0;    // NEW: suppress output for negligible errors
      node.settled_tol = Number(config.settled_tol) || 0;  // NEW: tolerance for 'settled' event
    } catch (error) {
      node.error('Error parsing configuration parameters: ' + error.message);
      return;
    }

    // ── Validate required numeric parameters ───────────────────────────────────
    if (
      isNaN(node.k_p) || isNaN(node.k_i) || isNaN(node.k_d) || isNaN(node.dt) ||
      isNaN(node.range_min) || isNaN(node.range_max)
    ) {
      node.error('Invalid parameters: Ensure Kp, Ki, Kd, dt, range_min, and range_max are numbers.');
      return;
    }

    if (node.dt <= 0) {
      node.error('Invalid parameter: dt must be greater than 0.');
      return;
    }

    // ── Instantiate the v2.0.0 PID controller with full options ────────────────
    try {
      controller = new PIDController(node.k_p, node.k_i, node.k_d, node.dt, {
        outputMin:        isNaN(node.output_min) ? -Infinity : node.output_min,
        outputMax:        isNaN(node.output_max) ?  Infinity : node.output_max,
        integralMin:      isNaN(node.int_min)    ? -Infinity : node.int_min,
        integralMax:      isNaN(node.int_max)    ?  Infinity : node.int_max,
        deadband:         node.deadband,
        settledTolerance: node.settled_tol,
      });
    } catch (error) {
      node.error('Error creating PID Controller: ' + error.message);
      return;
    }

    // Current process variable — updated by incoming 'PV' topic messages
    node.currentValue = 0;

    // ── Helper: map a value from one range to another ──────────────────────────
    function mapToRange(value, inputMin, inputMax, outputMin, outputMax) {
      return outputMin + (value - inputMin) * (outputMax - outputMin) / (inputMax - inputMin);
    }

    // ── Helper: build and send the output message using getStatus() ────────────
    // Uses the structured getStatus() snapshot from v2.0.0 instead of reading
    // individual controller.p / .i / .d properties directly.
    function sendOutput(status) {
      const pidOutput    = status.output;
      const scaledOutput = mapToRange(pidOutput, node.range_min, node.range_max, 0, 1);

      let signal, value;

      if (node.sensor_type === '0-10V') {
        signal = scaledOutput * 10;
        value  = mapToRange(node.currentValue, node.range_min, node.range_max, 0, 10);
      } else {
        // 4-20mA
        signal = 4 + scaledOutput * 16;
        value  = mapToRange(node.currentValue, node.range_min, node.range_max, 4, 20);
      }

      node.send({
        payload: {
          PV:      status.pv,
          SV:      status.sv,
          error:   parseFloat(status.error.toFixed(4)),
          P:       parseFloat(status.p.toFixed(4)),
          I:       parseFloat(status.i.toFixed(4)),
          D:       parseFloat(status.d.toFixed(4)),
          output:  parseFloat(status.output.toFixed(4)),  // raw clamped PID output
          Signal:  parseFloat(signal.toFixed(4)),         // scaled to sensor range
          Value:   parseFloat(value.toFixed(4)),          // PV mapped to sensor units
          mode:    status.mode,
        },
      });
    }

    // ── Event: 'update' ────────────────────────────────────────────────────────
    // Fired by the controller every cycle. Replaces the inline output block
    // that was previously inside the setInterval callback.
    controller.on('update', (status) => {
      sendOutput(status);
    });

    // ── Event: 'settled' ───────────────────────────────────────────────────────
    // Fired once when |error| <= settledTolerance (if configured).
    // Stops the interval and updates the node status badge.
    controller.on('settled', (status) => {
      node.status({ fill: 'green', shape: 'dot', text: 'Settled at SV: ' + status.sv });
      if (pidTimer !== null) {
        clearInterval(pidTimer);
        pidTimer = null;
      }
    });

    // ── Input message handler ──────────────────────────────────────────────────
    node.on('input', function (msg) {
      try {

        switch (msg.topic) {

          // ── SV: update setpoint ───────────────────────────────────────────────
          // setTarget() in v2.0.0 also resets integral and derivative state,
          // preventing carryover when the setpoint changes.
          case 'SV':
            controller.setTarget(msg.payload);
            node.status({ fill: 'yellow', shape: 'dot', text: 'Setpoint: ' + msg.payload });
            break;

          // ── PV: update process variable ───────────────────────────────────────
          case 'PV':
            if (typeof msg.payload !== 'number') {
              node.error('Received PV value is not a number.');
              return;
            }
            node.currentValue = msg.payload;
            node.status({ fill: 'blue', shape: 'ring', text: 'PV: ' + node.currentValue });
            break;

          // ── auto true: start PID loop ─────────────────────────────────────────
          // setMode('auto') performs bumpless transfer if coming from manual mode.
          case 'auto':
            if (msg.payload === true) {
              controller.setMode('auto');
              node.status({ fill: 'green', shape: 'dot', text: 'PID active' });

              if (pidTimer === null) {
                // update() computes true elapsed dt internally via timestamps;
                // the setInterval period here is just the target loop rate.
                pidTimer = setInterval(function () {
                  controller.update(node.currentValue);
                  // Output is sent via the 'update' event listener above
                }, node.dt * 1000);
              }

            } else if (msg.payload === false) {
              // Stop the loop and switch to manual mode
              controller.setMode('manual');
              if (pidTimer !== null) {
                clearInterval(pidTimer);
                pidTimer = null;
              }
              node.status({ fill: 'red', shape: 'ring', text: 'PID inactive' });
            }
            break;

          // ── gains: update PID gains at runtime ───────────────────────────────
          // NEW in v2.0.0. Expects payload: { k_p: number, k_i: number, k_d: number }
          // Does not reset integral state — send 'reset' topic first if needed.
          case 'gains':
            if (
              typeof msg.payload.k_p === 'number' &&
              typeof msg.payload.k_i === 'number' &&
              typeof msg.payload.k_d === 'number'
            ) {
              controller.updateGains(msg.payload.k_p, msg.payload.k_i, msg.payload.k_d);
              node.status({ fill: 'yellow', shape: 'dot',
                text: 'Gains: ' + msg.payload.k_p + '/' + msg.payload.k_i + '/' + msg.payload.k_d });
            } else {
              node.error('gains payload must be { k_p, k_i, k_d } — all numbers.');
            }
            break;

          // ── mode: switch between auto and manual ─────────────────────────────
          // NEW in v2.0.0. Expects payload: 'auto' or 'manual' (string).
          // manual → auto performs bumpless transfer automatically.
          case 'mode':
            controller.setMode(msg.payload);
            node.status({ fill: 'yellow', shape: 'dot', text: 'Mode: ' + msg.payload });
            break;

          // ── manual_output: set fixed output for manual mode ───────────────────
          // NEW in v2.0.0. Expects payload: number.
          // Also seeds the bumpless transfer integral when switching back to auto.
          case 'manual_output':
            if (typeof msg.payload !== 'number') {
              node.error('manual_output payload must be a number.');
              return;
            }
            controller.setManualOutput(msg.payload);
            node.status({ fill: 'blue', shape: 'dot', text: 'Manual output: ' + msg.payload });
            break;

          // ── reset: clear all internal controller state ────────────────────────
          // NEW in v2.0.0. Clears integral, derivative, PV history, and timestamp.
          // Use after fault recovery, recipe change, or process restart.
          case 'reset':
            controller.reset();
            node.status({ fill: 'grey', shape: 'ring', text: 'Controller reset' });
            break;

          default:
            node.warn('Unknown topic: ' + msg.topic);
        }

      } catch (error) {
        node.error('Error handling input: ' + error.message);
        node.status({ fill: 'red', shape: 'ring', text: 'Error: ' + error.message });
      }
    });

    // ── Node close: clean up interval and controller state ─────────────────────
    node.on('close', function () {
      try {
        if (pidTimer !== null) {
          clearInterval(pidTimer);
          pidTimer = null;
        }
        if (controller) {
          controller.reset();
        }
      } catch (error) {
        node.error('Error handling node closure: ' + error.message);
      }
    });
  }

  RED.nodes.registerType('easy-pid-controller', EasyPIDControllerNode);
};
