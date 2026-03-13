## Easy PID Controller Node for Node-RED

The `easy-pid-controller` is a Node-RED node that provides industrial-grade Proportional-Integral-Derivative (PID) control based on [`simple-pid-controller` v2.0.0](https://www.npmjs.com/package/simple-pid-controller). It integrates easily with PLCs, MQTT, and SCADA systems, and supports `0-10V` and `4-20mA` control signals with safety features like anti-windup, output clamping, and bumpless transfer.

### Features

- Easy to configure PID parameters: Kp, Ki, Kd.
- Setpoint (`SV`) and Process Variable (`PV`) inputs over `msg.topic`.
- Outputs full PID status: `PV`, `SV`, `error`, `P`, `I`, `D`, `output`, scaled `Signal`, and `Value`.
- Choice of control signal types: `0-10V` or `4-20mA`.
- Anti-windup (integral clamping) and output clamping (min/max).
- Deadband support to suppress output when the error is negligible.
- `settled` handling: stop the loop automatically when within tolerance.
- Manual / Auto mode with **bumpless transfer**.
- Runtime gain tuning (`gains` topic) and controller reset (`reset` topic).
- Real-time status updates via node status text and optional MQTT/InfluxDB integration.

### Installation

```bash
npm install node-red-contrib-easy-pid-controller
```

### Usage

1. Drag and drop the `easy-pid-controller` node into your Node-RED flow.
2. Double click on the node to configure:
   - PID gains: Kp, Ki, Kd.
   - Loop interval `dt` (seconds).
   - Output and integral limits.
   - Deadband and settled tolerance.
   - Signal type (`0-10V` or `4-20mA`) and engineering range.
3. Connect MQTT / Inject / Function nodes to provide `SV`, `PV`, `auto`, and optional advanced topics (`gains`, `mode`, `manual_output`, `reset`).
4. Deploy and monitor the outputs (`output`, `Signal`, `Value`, `mode`) in real-time.

***

### Inputs

All control is driven by `msg.topic` and `msg.payload`:

- `SV` (number)  
  Desired setpoint value for the controller.  
  - `msg.topic = "SV"`  
  - `msg.payload = <number>`

- `PV` (number)  
  Process variable / current state of the system.  
  - `msg.topic = "PV"`  
  - `msg.payload = <number>`

- `auto` (boolean)  
  Start/stop the PID loop and auto mode.  
  - `msg.topic = "auto"`  
  - `msg.payload = true` → start loop and switch to auto mode  
  - `msg.payload = false` → stop loop and switch to manual mode

- `gains` (object) — v2.0.0  
  Runtime PID gain tuning without restarting the node.  
  - `msg.topic = "gains"`  
  - `msg.payload = { k_p: <number>, k_i: <number>, k_d: <number> }`

- `mode` (string) — v2.0.0  
  Explicitly switch controller mode.  
  - `msg.topic = "mode"`  
  - `msg.payload = "auto"` or `"manual"`  
  - Switching `manual → auto` uses bumpless transfer (no output jump).

- `manual_output` (number) — v2.0.0  
  Fixed output used in manual mode, also seeds bumpless transfer when returning to auto.  
  - `msg.topic = "manual_output"`  
  - `msg.payload = <number>`

- `reset` (any) — v2.0.0  
  Reset controller internal state (integral, derivative, timestamp).  
  - `msg.topic = "reset"`  
  - `msg.payload` can be any value

***

### Outputs

The node outputs an object on `msg.payload` with the following fields (from `simple-pid-controller` v2.0.0):

- `PV` (number)  
  Current process variable.

- `SV` (number)  
  Current setpoint.

- `error` (number) — v2.0.0  
  Current control error: `SV - PV`.

- `P` (number)  
  Proportional component.

- `I` (number)  
  Integral component (clamped by `Integral Min/Max` for anti-windup).

- `D` (number)  
  Derivative component (derivative on measurement — no kick on setpoint changes).

- `output` (number) — v2.0.0  
  Raw clamped PID output (`P + I + D`, limited by `Output Min/Max`).

- `Signal` (number)  
  Output mapped to the configured signal range:
  - `0-10V` → 0 to 10  
  - `4-20mA` → 4 to 20

- `Value` (number)  
  `PV` mapped to the signal units for easier UI or Range node usage.

- `mode` (string) — v2.0.0  
  Current controller mode: `"auto"` or `"manual"`.

***

### Node Configuration Fields (Editor)

- **Kp, Ki, Kd**: PID gains.
- **dt (s)**: Target loop interval in seconds (controller internally uses dynamic timestamps; `dt` is a base rate / initial fallback).
- **Output Min / Output Max**: Clamp bounds for `output`.
- **Integral Min / Integral Max**: Anti-windup clamps on the integral accumulator.
- **Deadband**: If `|error|` is below this value, output is forced to `0` (disable with `0`).
- **Settled Tolerance**: When `|error|` falls below this value, the controller emits a `settled` event and the node stops the loop; restart with `auto: true`.
- **Signal Type**: `0-10V` or `4-20mA`.
- **Range Min / Range Max**: Engineering range for mapping PV and output to signal units.

***

### Changelog

#### v2.0.1

- **Updated core** to use `simple-pid-controller` v2.0.0 with:
  - Dynamic `dt` based on real timestamps (constructor `dt` used as fallback).
  - Anti-windup via configurable `Integral Min/Max`.
  - Output clamping via `Output Min/Max`.
  - Deadband support to suppress small-error output.
  - `setTarget()` now resets integral and derivative state.
  - Derivative on measurement, avoiding derivative kick on setpoint steps.
  - EventEmitter-based `update` and `settled` events internally.

- **Inputs**
  - **Added**: `gains` topic for runtime tuning of `{ k_p, k_i, k_d }`.
  - **Added**: `mode` topic to switch `auto`/`manual` with bumpless transfer.
  - **Added**: `manual_output` topic to set fixed output in manual mode.
  - **Added**: `reset` topic to clear internal controller state.
  - **Improved**: `auto` topic now also sets mode to `auto`/`manual` instead of just starting/stopping the timer.

- **Outputs**
  - **Added**: `error`, `output`, and `mode` in the payload.
  - **Kept**: `PV`, `SV`, `P`, `I`, `D`, `Signal`, `Value` for compatibility.

- **Node behaviour**
  - **Improved**: Node status messages show setpoint, PV, mode, and reset events.
  - **Improved**: On node close, the controller is reset and the internal timer is cleared.

#### v1.2.1

- **Added**: Node status updates during runtime to display relevant information like current PV, PID activation state, and more.

#### v1.2.0

- **Changed**: Moved the Setpoint (`SV`) from node configuration to `msg.payload` with the topic `SV`.

#### v1.1.0

- **Added**: New output value `Value` that provides the direct control signal based on the sensor type configuration.
- **Improved**: Code documentation and error handling for invalid inputs.

#### v1.0.0

- Initial release with basic PID functionalities.
- Support for `0-10V` and `4-20mA` signal types.

***

### Contributing

Contributions to improve the node or fix any issues are welcome. Please submit an issue or pull request on the GitHub repository.

### License

GPL-3.0 License. See the `LICENSE` file for details.

### Example

See the `examples/` directory for sample flows illustrating:

- Basic PID control.
- MQTT-based SV/PV input.
- InfluxDB logging of PID status.
- Runtime gain tuning and mode switching.

### Author

Harshad Joshi @ Bufferstack.IO Analytics Technology LLP, Pune
