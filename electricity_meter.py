import time
import json
import random
from datetime import datetime, timezone

import paho.mqtt.client as mqtt


MQTT_HOST = "hivemq"
MQTT_PORT = 1883

DATA_TOPIC = "iot/energy/meter/demo"
CONTROL_TOPIC = "iot/energy/meter/demo/control"

BASE_POWER_KW = 5.0
DEVIATION = 0.20
INTERVAL_SEC = 1


relay_enabled = True
total_energy_kwh = 0.0


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def generate_power_kw():
    return round(random.uniform(
        BASE_POWER_KW * (1 - DEVIATION),
        BASE_POWER_KW * (1 + DEVIATION)
    ), 3)


def on_connect(client, userdata, flags, reason_code, properties):
    print(f"Connected with result code: {reason_code}")
    client.subscribe(CONTROL_TOPIC)
    print(f"Subscribed to control topic: {CONTROL_TOPIC}")


def on_message(client, userdata, msg):
    global relay_enabled

    try:
        payload = json.loads(msg.payload.decode("utf-8"))

        if "relay_enabled" in payload:
            relay_enabled = bool(payload["relay_enabled"])

            state_payload = {
                "device_id": "energy_meter_001",
                "timestamp": now_iso(),
                "relay_enabled": relay_enabled,
                "meter_type": "electricity",
                "event": "relay_state_changed"
            }

            client.publish(DATA_TOPIC, json.dumps(state_payload))
            print("Relay state changed:", state_payload)

    except Exception as e:
        print("Invalid control message:", e)


client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

client.on_connect = on_connect
client.on_message = on_message

client.connect(MQTT_HOST, MQTT_PORT, 60)
client.loop_start()


while True:
    if relay_enabled:
        power_kw = generate_power_kw()
        energy_delta_kwh = power_kw * INTERVAL_SEC / 3600
        total_energy_kwh += energy_delta_kwh

        payload = {
            "device_id": "energy_meter_001",
            "timestamp": now_iso(),
            "power_kw": power_kw,
            "energy_delta_kwh": round(energy_delta_kwh, 8),
            "total_energy_kwh": round(total_energy_kwh, 6),
            "relay_enabled": relay_enabled,
            "meter_type": "electricity"
        }

        client.publish(DATA_TOPIC, json.dumps(payload))
        print(payload)

    else:
        payload = {
            "device_id": "energy_meter_001",
            "timestamp": now_iso(),
            "relay_enabled": relay_enabled,
            "meter_type": "electricity",
            "event": "power_cutoff"
        }

        client.publish(DATA_TOPIC, json.dumps(payload))
        print(payload)

    time.sleep(INTERVAL_SEC)
