import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import mqtt from 'mqtt';

const Dashboard = () => {
  const [temperature, setTemperature] = useState({ truck1: null, truck2: null });
  const [humidity, setHumidity] = useState({ truck1: null, truck2: null });
  const [temperatureHistory, setTemperatureHistory] = useState({ truck1: [], truck2: [] });
  const [humidityHistory, setHumidityHistory] = useState({ truck1: [], truck2: [] });
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [lastMessage, setLastMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // State for thresholds
  const [tempThresholds, setTempThresholds] = useState({ truck1: { min: null, max: null }, truck2: { min: null, max: null } });
  const [humThresholds, setHumThresholds] = useState({ truck1: { min: null, max: null }, truck2: { min: null, max: null } });
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    console.log('Connecting to MQTT brokers...');

    const clients = [
      mqtt.connect('wss://231ef5091034455baa4f947709be541f.s1.eu.hivemq.cloud:8884/mqtt', {
        username: 'iamsid63',
        password: 'Sidarth63',
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        protocolVersion: 4,
        clean: true,
      }),
      mqtt.connect('wss://a78bc778c48640a8beb9af6c1ae04ab8.s1.eu.hivemq.cloud:8884/mqtt', {
        username: 'iamsid63', // Update with actual username if different
        password: 'Sidarth63', // Update with actual password if different
        keepalive: 60,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        protocolVersion: 4,
        clean: true,
      }),
    ];

    clients.forEach((client, index) => {
      client.on('connect', () => {
        console.log(`Connected to MQTT broker for Truck ${index + 1}`);
        setConnectionStatus('Connected');
        setErrorMessage('');
        client.subscribe('temp', (err) => {
          if (err) {
            console.error(`Error subscribing to temp for Truck ${index + 1}:`, err);
          } else {
            console.log(`Subscribed to temp topic for Truck ${index + 1}`);
          }
        });
        client.subscribe('hum', (err) => {
          if (err) {
            console.error(`Error subscribing to hum for Truck ${index + 1}:`, err);
          } else {
            console.log(`Subscribed to hum topic for Truck ${index + 1}`);
          }
        });
      });

      client.on('error', (err) => {
        console.error('Connection error:', err);
        setConnectionStatus('Error');
        setErrorMessage(`Error: ${err.message}`);
      });

      client.on('message', (topic, message) => {
        const truckKey = `truck${index + 1}`;
        const value = parseFloat(message.toString());
        const timestamp = new Date().toLocaleTimeString();
        setLastMessage(`${topic}: ${message.toString()}`);

        if (topic === 'temp') {
          setTemperature(prev => ({ ...prev, [truckKey]: value }));
          setTemperatureHistory(prev => ({
            ...prev,
            [truckKey]: [...prev[truckKey], { time: timestamp, value }].slice(-10),
          }));
          checkTemperatureThreshold(value, timestamp, truckKey);
        } else if (topic === 'hum') {
          setHumidity(prev => ({ ...prev, [truckKey]: value }));
          setHumidityHistory(prev => ({
            ...prev,
            [truckKey]: [...prev[truckKey], { time: timestamp, value }].slice(-10),
          }));
          checkHumidityThreshold(value, timestamp, truckKey);
        }
      });

      client.on('close', () => {
        console.log(`Connection closed for Truck ${index + 1}`);
        setConnectionStatus('Disconnected');
      });

      client.on('end', () => {
        console.log(`Client disconnected for Truck ${index + 1}`);
        setConnectionStatus('Disconnected');
      });
    });

    return () => {
      clients.forEach(client => {
        console.log('Cleaning up MQTT client');
        client.end();
      });
    };
  }, [tempThresholds, humThresholds]);

  const checkTemperatureThreshold = (value, timestamp, truckKey) => {
    if (tempThresholds[truckKey].min !== null && value < tempThresholds[truckKey].min) {
      setAlerts(prev => [...prev, `Truck ${truckKey} Temperature breach! (${value}°C at ${timestamp}) - Below minimum threshold of ${tempThresholds[truckKey].min}°C`]);
    }
    if (tempThresholds[truckKey].max !== null && value > tempThresholds[truckKey].max) {
      setAlerts(prev => [...prev, `Truck ${truckKey} Temperature breach! (${value}°C at ${timestamp}) - Above maximum threshold of ${tempThresholds[truckKey].max}°C`]);
    }
  };

  const checkHumidityThreshold = (value, timestamp, truckKey) => {
    if (humThresholds[truckKey].min !== null && value < humThresholds[truckKey].min) {
      setAlerts(prev => [...prev, `Truck ${truckKey} Humidity breach! (${value}% at ${timestamp}) - Below minimum threshold of ${humThresholds[truckKey].min}%`]);
    }
    if (humThresholds[truckKey].max !== null && value > humThresholds[truckKey].max) {
      setAlerts(prev => [...prev, `Truck ${truckKey} Humidity breach! (${value}% at ${timestamp}) - Above maximum threshold of ${humThresholds[truckKey].max}%`]);
    }
  };

  const handleTempThresholdChange = (e, truckKey) => {
    const { name, value } = e.target;
    setTempThresholds(prev => ({
      ...prev,
      [truckKey]: { ...prev[truckKey], [name]: value ? parseFloat(value) : null },
    }));
    validateThresholds();
  };

  const handleHumThresholdChange = (e, truckKey) => {
    const { name, value } = e.target;
    setHumThresholds(prev => ({
      ...prev,
      [truckKey]: { ...prev[truckKey], [name]: value ? parseFloat(value) : null },
    }));
    validateThresholds();
  };

  const validateThresholds = () => {
    for (const key in tempThresholds) {
      if (tempThresholds[key].min !== null && tempThresholds[key].max !== null && tempThresholds[key].min >= tempThresholds[key].max) {
        setErrorMessage('Temperature Min must be less than Max');
        return false;
      }
    }
    for (const key in humThresholds) {
      if (humThresholds[key].min !== null && humThresholds[key].max !== null && humThresholds[key].min >= humThresholds[key].max) {
        setErrorMessage('Humidity Min must be less than Max');
        return false;
      }
    }
    setErrorMessage('');
    return true;
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Cold Transport Truck Dashboard</h1>
      
      <div className="mb-4 p-2 bg-gray-100 rounded">
        <p>Connection Status: {connectionStatus}</p>
        <p>Last Message: {lastMessage}</p>
        {errorMessage && <p className="text-red-500">Error: {errorMessage}</p>}
      </div>

      {/* Alerts */}
      <div className="mb-4">
        {alerts.length > 0 && (
          <div className="p-2 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
            <h2 className="font-bold">Alerts:</h2>
            <ul>
              {alerts.map((alert, index) => (
                <li key={index}>{alert}</li>
              ))}
            </ul>
            <button onClick={() => setAlerts([])} className="mt-2 text-blue-500 hover:underline">Clear Alerts</button>
          </div>
        )}
      </div>

      {/* Threshold Settings */}
      <div className="mb-4 p-4 border rounded shadow">
        <h2 className="text-xl font-semibold">Set Thresholds</h2>
        {['truck1', 'truck2'].map(truckKey => (
          <div key={truckKey} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <h3 className="text-lg font-semibold">{`Thresholds for ${truckKey.toUpperCase()}`}</h3>
              <label className="block mb-2">Temperature Min (°C):</label>
              <input
                type="number"
                name="min"
                value={tempThresholds[truckKey].min || ''}
                onChange={(e) => handleTempThresholdChange(e, truckKey)}
                className="border p-2 rounded w-full"
                placeholder="Min Temp"
              />
              <label className="block mb-2">Temperature Max (°C):</label>
              <input
                type="number"
                name="max"
                value={tempThresholds[truckKey].max || ''}
                onChange={(e) => handleTempThresholdChange(e, truckKey)}
                className="border p-2 rounded w-full"
                placeholder="Max Temp"
              />
            </div>
            <div>
              <label className="block mb-2">Humidity Min (%):</label>
              <input
                type="number"
                name="min"
                value={humThresholds[truckKey].min || ''}
                onChange={(e) => handleHumThresholdChange(e, truckKey)}
                className="border p-2 rounded w-full"
                placeholder="Min Humidity"
              />
              <label className="block mb-2">Humidity Max (%):</label>
              <input
                type="number"
                name="max"
                value={humThresholds[truckKey].max || ''}
                onChange={(e) => handleHumThresholdChange(e, truckKey)}
                className="border p-2 rounded w-full"
                placeholder="Max Humidity"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Display the current temperature and humidity for each truck */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {['truck1', 'truck2'].map(truckKey => (
          <div key={truckKey} className="p-4 border rounded shadow">
            <h2 className="text-xl font-semibold">{`Temperature (${truckKey.toUpperCase()})`}</h2>
            <p className="text-4xl font-bold">
              {temperature[truckKey] !== null ? `${temperature[truckKey].toFixed(1)}°C` : '--'}
            </p>
            <h2 className="text-xl font-semibold">{`Humidity (${truckKey.toUpperCase()})`}</h2>
            <p className="text-4xl font-bold">
              {humidity[truckKey] !== null ? `${humidity[truckKey].toFixed(1)}%` : '--'}
            </p>
          </div>
        ))}
      </div>
      
      {/* Display the temperature and humidity history in line charts */}
      <div className="grid grid-cols-1 gap-4">
        {['truck1', 'truck2'].map(truckKey => (
          <div key={truckKey} className="p-4 border rounded shadow">
            <h2 className="text-xl font-semibold">{`Temperature History (${truckKey.toUpperCase()})`}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={temperatureHistory[truckKey]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" name="Temperature (°C)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
        {['truck1', 'truck2'].map(truckKey => (
          <div key={truckKey} className="p-4 border rounded shadow">
            <h2 className="text-xl font-semibold">{`Humidity History (${truckKey.toUpperCase()})`}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={humidityHistory[truckKey]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#82ca9d" name="Humidity (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;

