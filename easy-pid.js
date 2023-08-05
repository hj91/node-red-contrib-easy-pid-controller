/**

 easy-pid.js - Copyright 2023 Harshad Joshi and Bufferstack.IO Analytics Technology LLP, Pune

 Licensed under the GNU General Public License, Version 3.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.gnu.org/licenses/gpl-3.0.html

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 **/


const PIDController = require('simple-pid-controller');

module.exports = function(RED) {
    function EasyPIDControllerNode(config) {
        RED.nodes.createNode(this, config);

        const node = this;
        let controller = null;

        // Parse configuration parameters
        try {
            node.sv = Number(config.sv);
            node.k_p = Number(config.k_p);
            node.k_i = Number(config.k_i);
            node.k_d = Number(config.k_d);
            node.dt = Number(config.dt);
           // node.step_count = Number(config.step_count);
            node.sensor_type = config.sensor_type;
        } catch (error) {
            node.error("Error parsing configuration parameters: " + error.message);
            return;
        }

        // Current process value
        node.currentValue = 0;

        // Validate parameters
        if (isNaN(node.sv) || isNaN(node.k_p) || isNaN(node.k_i) || isNaN(node.k_d) || isNaN(node.dt)) { // || isNaN(node.step_count)) {
            node.error("Invalid parameters: Check that SV, Kp, Ki, Kd, dt, and step count are numbers.");
            return;
        }

        if (node.dt <= 0) {
            node.error("Invalid parameter: dt must be greater than 0.");
            return;
        }

        // Create PID Controller
        try {
            controller = new PIDController(node.k_p, node.k_i, node.k_d, node.dt);
            controller.setTarget(node.sv);
        } catch (error) {
            node.error("Error creating PID Controller: " + error.message);
            return;
        }

        let pidTimer = null;

        node.on('input', function(msg) {
            try {
                if (msg.topic === 'auto' && msg.payload === true) {
                    if(pidTimer == null){
                        // Start a repeating timer that fires every dt milliseconds
                        pidTimer = setInterval(function() {
                            let output;
                            try {
                                output = controller.update(node.currentValue);
                            } catch (error) {
                                node.error("Error updating PID Controller: " + error.message);
                                clearInterval(pidTimer);
                                pidTimer = null;
                                return;
                            }

                            let msg = {
                                payload: {
                                    PV: node.currentValue,
                                    SV: node.sv,
                                    P: controller.p,
                                    I: controller.i,
                                    D: controller.d,
                                    Output: node.sensor_type === "0-10V" ? limitRange(convertToVoltage(output), 0, 10) : limitRange(convertToCurrent(output), 4, 20)
                                }
                            };

                            node.send(msg);
                        }, node.dt * 1000); // dt is in seconds, convert to milliseconds
                    }
                }
                if (msg.topic === 'PV') {
                    if (typeof msg.payload !== 'number') {
                        node.error("Received PV value is not a number.");
                        return;
                    }
                    node.currentValue = msg.payload;
                }
            } catch (error) {
                node.error("Error handling input: " + error.message);
            }
        });

        function convertToVoltage(output) {
            // Convert output to percentage then scale to 0-10V
            let percent = (output - node.sv) / node.sv;
            return limitRange(percent * 10, 0, 10);
        }

        function convertToCurrent(output) {
            // Convert output to percentage then scale to 4-20mA
            let percent = (output - node.sv) / node.sv;
            return limitRange(4 + (percent * (20 - 4)), 4, 20);
        }

        // A utility function to limit output within a range
        function limitRange(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        node.on('close', function() {
            try {
                if(pidTimer != null){
                    clearInterval(pidTimer);
                    pidTimer = null;
                }
            } catch (error) {
                node.error("Error handling node closure: " + error.message);
            }
        });
    }

    RED.nodes.registerType("easy-pid-controller", EasyPIDControllerNode);
}

