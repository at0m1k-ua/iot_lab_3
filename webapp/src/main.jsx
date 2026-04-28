import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import mqtt from "mqtt";
import "./style.css";

const MQTT_WS_URL =
  window.__APP_CONFIG__?.MQTT_WS_URL &&
  !window.__APP_CONFIG__.MQTT_WS_URL.includes("${")
    ? window.__APP_CONFIG__.MQTT_WS_URL
    : "ws://localhost:8000/mqtt";

const TOPICS = {
  electricityData: "iot/energy/meter/demo",
  electricityControl: "iot/energy/meter/demo/control",
  heatData: "iot/heat/meter/demo",
  heatControl: "iot/heat/meter/demo/control",
};

function formatNumber(value, digits = 3) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "—";
  }
  return Number(value).toFixed(digits);
}

function MeterCard({
  title,
  type,
  data,
  connected,
  onToggle,
  controlLabelOn,
  controlLabelOff,
  enabled,
}) {
  const isElectricity = type === "electricity";

  return (
    <section className="card">
      <div className="cardHeader">
        <div>
          <h2>{title}</h2>
          <p>{data?.device_id || "waiting for data..."}</p>
        </div>
        <span className={enabled ? "badge ok" : "badge off"}>
          {enabled ? controlLabelOn : controlLabelOff}
        </span>
      </div>

      <div className="metrics">
        <div className="metric">
          <span>{isElectricity ? "Power" : "Heat power"}</span>
          <strong>
            {isElectricity
              ? `${formatNumber(data?.power_kw)} kW`
              : `${formatNumber(data?.power_w, 2)} W`}
          </strong>
        </div>

        <div className="metric">
          <span>Delta</span>
          <strong>
            {isElectricity
              ? `${formatNumber(data?.energy_delta_kwh, 8)} kWh`
              : `${formatNumber(data?.energy_delta_j, 2)} J`}
          </strong>
        </div>

        <div className="metric full">
          <span>Total</span>
          <strong>
            {isElectricity
              ? `${formatNumber(data?.total_energy_kwh, 6)} kWh`
              : `${formatNumber(data?.total_energy_j, 2)} J`}
          </strong>
        </div>
      </div>

      <div className="meta">
        <span>Last event: {data?.event || "measurement"}</span>
        <span>{data?.timestamp || "—"}</span>
      </div>

      <button disabled={!connected} onClick={() => onToggle(!enabled)}>
        {enabled ? `Turn off ${controlLabelOn.toLowerCase()}` : `Turn on ${controlLabelOn.toLowerCase()}`}
      </button>
    </section>
  );
}

function App() {
  const clientRef = useRef(null);

  const [status, setStatus] = useState("disconnected");
  const [logs, setLogs] = useState([]);

  const [electricity, setElectricity] = useState(null);
  const [heat, setHeat] = useState(null);

  const electricityEnabled = electricity?.relay_enabled ?? true;
  const heatEnabled = heat?.valve_open ?? true;

  const connected = status === "connected";

  const addLog = (message) => {
    setLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] ${message}`,
      ...prev,
    ].slice(0, 30));
  };

  useEffect(() => {
    const client = mqtt.connect(MQTT_WS_URL, {
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      clientId: `web_meter_${Math.random().toString(16).slice(2)}`,
    });

    clientRef.current = client;

    client.on("connect", () => {
      setStatus("connected");
      addLog(`Connected to ${MQTT_WS_URL}`);
      client.subscribe([TOPICS.electricityData, TOPICS.heatData], (err) => {
        if (err) addLog(`Subscribe error: ${err.message}`);
        else addLog("Subscribed to meter topics");
      });
    });

    client.on("reconnect", () => setStatus("reconnecting"));
    client.on("close", () => setStatus("disconnected"));
    client.on("error", (err) => addLog(`MQTT error: ${err.message}`));

    client.on("message", (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());

        if (topic === TOPICS.electricityData) {
          setElectricity((prev) => ({ ...prev, ...payload }));
        }

        if (topic === TOPICS.heatData) {
          setHeat((prev) => ({ ...prev, ...payload }));
        }
      } catch (err) {
        addLog(`Invalid JSON from ${topic}: ${err.message}`);
      }
    });

    return () => {
      client.end(true);
    };
  }, []);

  const publishJson = (topic, payload) => {
    if (!clientRef.current || !connected) return;

    clientRef.current.publish(topic, JSON.stringify(payload), {}, (err) => {
      if (err) addLog(`Publish error: ${err.message}`);
      else addLog(`Published ${JSON.stringify(payload)} to ${topic}`);
    });
  };

  const summary = useMemo(() => {
    return {
      electricity: electricity?.total_energy_kwh ?? 0,
      heat: heat?.total_energy_j ?? 0,
    };
  }, [electricity, heat]);

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>IoT Meter Dashboard</h1>
          <p>MQTT WebSocket: {MQTT_WS_URL}</p>
        </div>
        <span className={`status ${status}`}>{status}</span>
      </header>

      <section className="summary">
        <div>
          <span>Total electricity</span>
          <strong>{formatNumber(summary.electricity, 6)} kWh</strong>
        </div>
        <div>
          <span>Total heat</span>
          <strong>{formatNumber(summary.heat, 2)} J</strong>
        </div>
      </section>

      <div className="grid">
        <MeterCard
          title="Electricity meter"
          type="electricity"
          data={electricity}
          connected={connected}
          enabled={electricityEnabled}
          controlLabelOn="Relay enabled"
          controlLabelOff="Relay disabled"
          onToggle={(enabled) =>
            publishJson(TOPICS.electricityControl, { relay_enabled: enabled })
          }
        />

        <MeterCard
          title="Heat meter"
          type="heat"
          data={heat}
          connected={connected}
          enabled={heatEnabled}
          controlLabelOn="Valve open"
          controlLabelOff="Valve closed"
          onToggle={(enabled) =>
            publishJson(TOPICS.heatControl, { valve_open: enabled })
          }
        />
      </div>

      <section className="logs">
        <h2>Logs</h2>
        {logs.length === 0 ? <p>No logs yet.</p> : logs.map((log, i) => <code key={i}>{log}</code>)}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
