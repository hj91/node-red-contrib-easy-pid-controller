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

        try {
            node.k_p = Number(config.k_p);
            node.k_i = Number(config.k_i);
            node.k_d = Number(config.k_d);
            node.dt = Number(config.dt);
            node.sensor_type = config.sensor_type;
            node.range_min = Number(config.range_min);
            node.range_max = Number(config.range_max);
        } catch (error) {
            node.error("Error parsing configuration parameters: " + error.message);
            return;
        }

        node.currentValue = 0;

        if (isNaN(node.k_p) || isNaN(node.k_i) || isNaN(node.k_d) || isNaN(node.dt) || isNaN(node.range_min) || isNaN(node.range_max)) {
            node.error("Invalid parameters: Ensure Kp, Ki, Kd, dt, range_min, and range_max are numbers.");
            return;
        }

        if (node.dt <= 0) {
            node.error("Invalid parameter: dt must be greater than 0.");
            return;
        }

        try {
            controller = new PIDController(node.k_p, node.k_i, node.k_d);
        } catch (error) {
            node.error("Error creating PID Controller: " + error.message);
            return;
        }

        let pidTimer = null;

        function mapToRange(value, inputMin, inputMax, outputMin, outputMax) {
            return outputMin + (value - inputMin) * (outputMax - outputMin) / (inputMax - inputMin);
        }

    node.on('input', function(msg) {
    try {
        if (msg.topic === 'SV') {
            controller.setTarget(msg.payload);
        }

        if (msg.topic === 'auto' && msg.payload === true) {
            if (pidTimer == null) {
                pidTimer = setInterval(function() {
                    let pidOutput = controller.update(node.currentValue);

                    // Map the PID output to the user's range
                    let scaledOutput = mapToRange(pidOutput, node.range_min, node.range_max, 0, 1);

                    let signal, value;

                    if (node.sensor_type === "0-10V") {
                        signal = scaledOutput * 10;  // Map to [0, 10]
                        value = mapToRange(node.currentValue, node.range_min, node.range_max, 0, 10); // Map current value to [0, 10]
                    } else {
                        signal = 4 + scaledOutput * 16; // Map to [4, 20]
                        value = mapToRange(node.currentValue, node.range_min, node.range_max, 4, 20); // Map current value to [4, 20]
                    }

                    let msgOutput = {
                        payload: {
                            PV: node.currentValue,
                            SV: controller.target,
                            P: controller.p,
                            I: controller.i,
                            D: controller.d,
                            Output: signal,
                            Value: value  // Adding the new 'Value' field here - Use Range node if required..
                        }
                    };

                    node.send(msgOutput);
                }, node.dt * 1000);
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
 
        


        node.on('close', function() {
            try {
                if (pidTimer != null) {
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

