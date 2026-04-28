import time
import json
import random
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


MQTT_HOST = "hivemq"
MQTT_PORT = 1883

DATA_TOPIC = "iot/heat/meter/demo"
CONTROL_TOPIC = "iot/heat/meter/demo/control"

# 5 кВт = 5000 Дж/с
BASE_POWER_W = 5000
DEVIATION = 0.20
INTERVAL_SEC = 1


valve_open = True
total_energy_j = 0.0


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def generate_power_w():
    return round(random.uniform(
        BASE_POWER_W * (1 - DEVIATION),
        BASE_POWER_W * (1 + DEVIATION)
    ), 2)


def on_connect(client, userdata, flags, reason_code, properties):
    print(f"Connected with result code: {reason_code}")
    client.subscribe(CONTROL_TOPIC)
    print(f"Subscribed to control topic: {CONTROL_TOPIC}")


def on_message(client, userdata, msg):
    global valve_open

    try:
        payload = json.loads(msg.payload.decode("utf-8"))

        if "valve_open" in payload:
            valve_open = bool(payload["valve_open"])

            state_payload = {
                "device_id": "heat_meter_001",
                "timestamp": now_iso(),
                "valve_open": valve_open,
                "meter_type": "heat",
                "event": "valve_state_changed"
            }

            client.publish(DATA_TOPIC, json.dumps(state_payload))
            print("Valve state changed:", state_payload)

    except Exception as e:
        print("Invalid control message:", e)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()


while True:
    if valve_open:
        power_w = generate_power_w()

        energy_delta_j = power_w * INTERVAL_SEC
        total_energy_j += energy_delta_j

        payload = {
            "device_id": "heat_meter_001",
            "timestamp": now_iso(),
            "power_w": power_w,
            "energy_delta_j": round(energy_delta_j, 2),
            "total_energy_j": round(total_energy_j, 2),
            "valve_open": valve_open,
            "meter_type": "heat"
        }

        client.publish(DATA_TOPIC, json.dumps(payload))
        print(payload)

    else:
        payload = {
            "device_id": "heat_meter_001",
            "timestamp": now_iso(),
            "valve_open": valve_open,
            "meter_type": "heat",
            "event": "valve_closed"
        }

        client.publish(DATA_TOPIC, json.dumps(payload))
        print(payload)

    time.sleep(INTERVAL_SEC)
