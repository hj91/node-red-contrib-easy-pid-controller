# Easy PID Controller Node for Node-RED

This Node-RED node provides a PID (Proportional-Integral-Derivative) controller functionality. It utilizes the `simple-pid-controller` package to perform the control logic.

## Installation

Install the node package in your Node-RED environment by using the following command:

```bash
npm install node-red-contrib-easy-pid-controller
```

## Usage

Once installed, the "easy-pid-controller" will be available in the Node-RED palette. You can drag and drop it into your flow.

### Configuration Parameters

- **Set Point (SV)**: The target value for the process variable. This is what the PID controller will attempt to achieve.
- **Proportional Gain (Kp)**: The proportional gain factor in the PID controller. Determines how much of the output is determined by the current error.
- **Integral Gain (Ki)**: The integral gain factor in the PID controller. Determines how much of the output is determined by the accumulation of past errors.
- **Derivative Gain (Kd)**: The derivative gain factor in the PID controller. Determines how much of the output is determined by the prediction of future errors based on current rate of change.
- **Time Interval (dt)**: The time interval in seconds for the PID controller to update.
- **Sensor Type**: Determines the type of output scaling. Select either "0-10V" for voltage output or "4-20mA" for current output.

### Input Messages

The node responds to the following input messages:

- **auto**: When the `payload` is `true`, the PID controller starts updating at every time interval (dt) and sends output.
- **PV**: The process variable value. This should be a numeric value representing the current state of the process being controlled.

### Output Messages

The node sends an output message with the following properties in `payload`:

- **PV**: The current process variable value.
- **SV**: The current set point.
- **P**: The proportional part of the PID output.
- **I**: The integral part of the PID output.
- **D**: The derivative part of the PID output.
- **Output**: The control output from the PID controller, scaled according to the sensor type.

## Limitations

The node currently does not support dynamically updating the PID parameters or the set point during runtime. To change these values, you must redeploy the node with the new parameters.

## Example Flow

Here is an example of how to use this node in a flow:

```
[
    {
        "id": "af9c01cee2f5fe78",
        "type": "tab",
        "label": "easy-pid-controller",
        "disabled": false,
        "info": "",
        "env": []
    },
    {
        "id": "bda83d7cae08210b",
        "type": "inject",
        "z": "af9c01cee2f5fe78",
        "name": "",
        "props": [
            {
                "p": "payload"
            },
            {
                "p": "topic",
                "vt": "str"
            }
        ],
        "repeat": "",
        "crontab": "",
        "once": false,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "true",
        "payloadType": "bool",
        "x": 230,
        "y": 160,
        "wires": [
            [
                "d8a37bb6a0343960"
            ]
        ]
    },
    {
        "id": "d8a37bb6a0343960",
        "type": "change",
        "z": "af9c01cee2f5fe78",
        "name": "",
        "rules": [
            {
                "t": "set",
                "p": "topic",
                "pt": "msg",
                "to": "auto",
                "tot": "str"
            }
        ],
        "action": "",
        "property": "",
        "from": "",
        "to": "",
        "reg": false,
        "x": 390,
        "y": 160,
        "wires": [
            [
                "d61bd67142d4257d"
            ]
        ]
    },
    {
        "id": "6d72cfb9e75def77",
        "type": "debug",
        "z": "af9c01cee2f5fe78",
        "name": "debug 239",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": true,
        "complete": "payload",
        "targetType": "msg",
        "statusVal": "payload",
        "statusType": "auto",
        "x": 790,
        "y": 360,
        "wires": []
    },
    {
        "id": "d61bd67142d4257d",
        "type": "easy-pid-controller",
        "z": "af9c01cee2f5fe78",
        "name": "",
        "sv": "10",
        "k_p": 1,
        "k_i": "0.5",
        "k_d": "0.05",
        "sensor_type": "0-10V",
        "dt": "1",
        "x": 610,
        "y": 280,
        "wires": [
            [
                "6d72cfb9e75def77",
                "83ee3ce3431113a9"
            ]
        ]
    },
    {
        "id": "3f5e510e2ee024fa",
        "type": "mqtt in",
        "z": "af9c01cee2f5fe78",
        "name": "",
        "topic": "PV",
        "qos": "2",
        "datatype": "auto-detect",
        "broker": "8101d945.ea6768",
        "nl": false,
        "rap": true,
        "rh": 0,
        "inputs": 0,
        "x": 210,
        "y": 280,
        "wires": [
            [
                "d61bd67142d4257d"
            ]
        ]
    },
    {
        "id": "83ee3ce3431113a9",
        "type": "json",
        "z": "af9c01cee2f5fe78",
        "name": "",
        "property": "payload",
        "action": "obj",
        "pretty": false,
        "x": 770,
        "y": 160,
        "wires": [
            [
                "408f9f5b2e1e16b4"
            ]
        ]
    },
    {
        "id": "408f9f5b2e1e16b4",
        "type": "function",
        "z": "af9c01cee2f5fe78",
        "name": "Get SV",
        "func": "var sv = msg.payload.SV\n\nmsg.payload = sv\n\nreturn msg;",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 920,
        "y": 160,
        "wires": [
            [
                "423393d0936759f8",
                "29151daedc3b24de"
            ]
        ]
    },
    {
        "id": "423393d0936759f8",
        "type": "debug",
        "z": "af9c01cee2f5fe78",
        "name": "debug 240",
        "active": true,
        "tosidebar": true,
        "console": false,
        "tostatus": true,
        "complete": "payload",
        "targetType": "msg",
        "statusVal": "payload",
        "statusType": "auto",
        "x": 1070,
        "y": 60,
        "wires": []
    },
    {
        "id": "29151daedc3b24de",
        "type": "mqtt out",
        "z": "af9c01cee2f5fe78",
        "name": "",
        "topic": "sv",
        "qos": "2",
        "retain": "true",
        "respTopic": "",
        "contentType": "",
        "userProps": "",
        "correl": "",
        "expiry": "",
        "broker": "8101d945.ea6768",
        "x": 1070,
        "y": 240,
        "wires": []
    },
    {
        "id": "20228a4423dcac13",
        "type": "comment",
        "z": "af9c01cee2f5fe78",
        "name": "Send this value to virtual valve",
        "info": "The virtual valve takes this value and accordingly publishes PV which is then provided as FB to simple-pid-controller",
        "x": 1080,
        "y": 300,
        "wires": []
    },
    {
        "id": "3fb6c2a7c734e69a",
        "type": "comment",
        "z": "af9c01cee2f5fe78",
        "name": "Get this value from virtual valve",
        "info": "",
        "x": 210,
        "y": 340,
        "wires": []
    },
    {
        "id": "9b83dcad223c3d8e",
        "type": "comment",
        "z": "af9c01cee2f5fe78",
        "name": "Sample flow using simple-pid-controller library",
        "info": "",
        "x": 250,
        "y": 60,
        "wires": []
    },
    {
        "id": "8101d945.ea6768",
        "type": "mqtt-broker",
        "name": "Local MQTT",
        "broker": "mqtt://localhost",
        "port": "1883",
        "clientid": "",
        "autoConnect": true,
        "usetls": false,
        "protocolVersion": "4",
        "keepalive": "60",
        "cleansession": true,
        "birthTopic": "",
        "birthQos": "0",
        "birthRetain": "false",
        "birthPayload": "",
        "birthMsg": {},
        "closeTopic": "",
        "closeQos": "0",
        "closeRetain": "false",
        "closePayload": "",
        "closeMsg": {},
        "willTopic": "",
        "willQos": "0",
        "willRetain": "false",
        "willPayload": "",
        "willMsg": {},
        "userProps": "",
        "sessionExpiry": ""
    }
]
```

## License

This project is licensed under the terms of the GPL-3.0 license.

## Contact

If you have any questions, issues, or feedback, feel free to open an issue in this project's GitHub repository.


