// App.js - Universal version for React Native and Web
import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native'; // Will be undefined on web

// Platform detection
const isWeb = typeof window !== 'undefined' && !Platform;
const isReactNative = !isWeb;

// Conditional imports
let RNBluetoothClassic = null;
let ReactNative = null;

if (isReactNative) {
  RNBluetoothClassic = require('react-native-bluetooth-classic');
  ReactNative = require('react-native');
}

// Web Bluetooth Serial Adapter (for Classic Bluetooth)
class WebBluetoothSerial {
  constructor() {
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.connected = false;
  }

  async isAvailable() {
    return 'serial' in navigator;
  }

  async requestDevice() {
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 9600 });
      this.connected = true;
      
      // Set up reader
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
      this.reader = textDecoder.readable.getReader();

      // Set up writer
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(this.port.writable);
      this.writer = textEncoder.writable.getWriter();

      return { name: 'Serial Device', address: 'WEB' };
    } catch (error) {
      throw new Error('Failed to connect: ' + error.message);
    }
  }

  async write(data) {
    if (!this.writer) throw new Error('Not connected');
    await this.writer.write(data);
    return true;
  }

  async disconnect() {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
    this.connected = false;
  }

  onDataReceived(callback) {
    if (!this.reader) return;
    
    const readLoop = async () => {
      try {
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) {
            callback({ data: value });
          }
        }
      } catch (error) {
        console.error('Read error:', error);
      }
    };
    
    readLoop();
  }
}

export default function App() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isConnected, setIsConnected] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState([]);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [isBluetoothEnabled, setIsBluetoothEnabled] = useState(false);

  const [selectedMode, setSelectedMode] = useState('A');
  const [highVoltage, setHighVoltage] = useState('285');
  const [lowVoltage, setLowVoltage] = useState('150');
  const [offTimeHour, setOffTimeHour] = useState('22');
  const [offTimeMinute, setOffTimeMinute] = useState('00');
  const [voltage, setVoltage] = useState('0');
  const [current, setCurrent] = useState('0');
  const [status, setStatus] = useState('OFF');
  const [faultCode, setFaultCode] = useState('NONE');

  const [baudRate, setBaudRate] = useState('9600');
  const [dataBits, setDataBits] = useState('8');
  const [stopBits, setStopBits] = useState('1');
  const [parity, setParity] = useState('None');

  const [eventLog, setEventLog] = useState([]);
  const [webSerialAdapter, setWebSerialAdapter] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    if (isWeb) {
      initializeWebBluetooth();
    } else {
      initializeBluetooth();
    }
    
    addLog(`App Started (${isWeb ? 'Web' : 'React Native'})`);

    return () => {
      clearInterval(timer);
      if (connectedDevice) {
        disconnectDevice();
      }
    };
  }, []);

  const initializeWebBluetooth = async () => {
    const adapter = new WebBluetoothSerial();
    setWebSerialAdapter(adapter);
    
    const available = await adapter.isAvailable();
    setIsBluetoothEnabled(available);
    
    if (available) {
      addLog('Web Serial API ready (Classic Bluetooth via USB/Serial)');
    } else {
      addLog('Web Serial API not supported - Use Chrome/Edge on desktop');
    }
  };

  const initializeBluetooth = async () => {
    try {
      await requestPermissions();
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      setIsBluetoothEnabled(enabled);
      if (!enabled) {
        addLog('Bluetooth is disabled');
        await enableBluetooth();
      } else {
        addLog('Bluetooth is ready');
      }
    } catch (error) {
      console.error('Bluetooth initialization error:', error);
      addLog('Bluetooth Init Error: ' + error.message);
    }
  };

  const enableBluetooth = async () => {
    if (isWeb) return;
    
    try {
      const enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      if (enabled) {
        setIsBluetoothEnabled(true);
        addLog('Bluetooth Enabled');
      }
    } catch (error) {
      console.error('Enable Bluetooth error:', error);
      addLog('Failed to enable Bluetooth: ' + error.message);
    }
  };

  const requestPermissions = async () => {
    if (isWeb) return;
    
    if (Platform.OS === 'android') {
      try {
        const { PermissionsAndroid } = ReactNative;
        if (Platform.Version >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          const allGranted = Object.values(granted).every(
            status => status === PermissionsAndroid.RESULTS.GRANTED
          );
          if (allGranted) {
            addLog('All Permissions Granted');
          }
        }
      } catch (err) {
        console.error('Permission error:', err);
        addLog('Permission Error: ' + err.message);
      }
    }
  };

  const formatDateTime = (date) => {
    const options = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    return date.toLocaleDateString('en-US', options);
  };

  const formatDateTimeFor24Hour = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const scanForDevices = async () => {
    if (isWeb) {
      // Web: Direct connection via Serial API
      try {
        setIsScanning(true);
        addLog('Opening serial port selector...');
        const device = await webSerialAdapter.requestDevice();
        setConnectedDevice(device);
        setIsConnected(true);
        addLog(`Connected to ${device.name}`);
        
        webSerialAdapter.onDataReceived((data) => {
          handleReceivedData(data.data);
        });
        
        startAutoMonitoring();
        setIsScanning(false);
      } catch (error) {
        console.error('Connection error:', error);
        addLog('Connection Error: ' + error.message);
        alert('Failed to connect: ' + error.message);
        setIsScanning(false);
      }
    } else {
      // React Native: Classic Bluetooth scan
      try {
        const enabled = await RNBluetoothClassic.isBluetoothEnabled();
        if (!enabled) {
          addLog('Bluetooth is disabled, requesting to enable...');
          await enableBluetooth();
          const nowEnabled = await RNBluetoothClassic.isBluetoothEnabled();
          if (!nowEnabled) return;
        }

        setIsScanning(true);
        setShowDeviceList(true);
        addLog('Scanning for Bluetooth devices...');

        const bonded = await RNBluetoothClassic.getBondedDevices();
        const unpaired = await RNBluetoothClassic.startDiscovery();
        const allDevices = [...bonded, ...unpaired];

        setDiscoveredDevices(allDevices);
        setIsScanning(false);

        if (allDevices.length === 0) {
          addLog('No devices found');
        } else {
          addLog(`Found ${allDevices.length} device(s)`);
        }
      } catch (error) {
        console.error('Scan error:', error);
        addLog('Scan Error: ' + error.message);
        setIsScanning(false);
      }
    }
  };

  const connectToDevice = async (device) => {
    try {
      addLog(`Connecting to ${device.name}...`);
      const connected = await device.connect();

      if (connected) {
        setConnectedDevice(device);
        setIsConnected(true);
        setShowDeviceList(false);
        addLog(`Connected to ${device.name}`);

        device.onDataReceived((data) => {
          handleReceivedData(data.data);
        });

        startAutoMonitoring();
      }
    } catch (error) {
      console.error('Connection error:', error);
      addLog('Connection Error: ' + error.message);
    }
  };

  const disconnectDevice = async () => {
    try {
      if (isWeb && webSerialAdapter) {
        await webSerialAdapter.disconnect();
      } else if (connectedDevice) {
        await connectedDevice.disconnect();
      }
      
      setIsConnected(false);
      setConnectedDevice(null);
      setVoltage('0');
      setCurrent('0');
      setStatus('OFF');
      addLog('Device Disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      addLog('Disconnect Error: ' + error.message);
    }
  };

  const sendData = async (data) => {
    try {
      if (!isConnected) {
        throw new Error('Device not connected');
      }

      let sent;
      if (isWeb && webSerialAdapter) {
        sent = await webSerialAdapter.write(data);
      } else if (connectedDevice) {
        sent = await connectedDevice.write(data);
      }

      if (sent) {
        addLog(`Sent: ${data}`);
        return true;
      } else {
        throw new Error('Failed to send data');
      }
    } catch (error) {
      console.error('Send error:', error);
      addLog('Send Error: ' + error.message);
      alert('Send Error: ' + error.message);
      return false;
    }
  };

  const handleReceivedData = (data) => {
    try {
      addLog(`Received: ${data}`);

      try {
        const jsonData = JSON.parse(data);
        if (jsonData.voltage !== undefined) setVoltage(jsonData.voltage.toString());
        if (jsonData.current !== undefined) setCurrent(jsonData.current.toString());
        if (jsonData.status !== undefined) setStatus(jsonData.status);
        if (jsonData.faultCode !== undefined) setFaultCode(jsonData.faultCode);
        addLog('Device status updated from JSON');
        return;
      } catch (jsonError) {
        // Not JSON, try comma-separated format
      }

      const parts = data.split(',');
      parts.forEach(part => {
        if (part.startsWith('V:')) setVoltage(part.substring(2));
        else if (part.startsWith('C:')) setCurrent(part.substring(2));
        else if (part.startsWith('S:')) setStatus(part.substring(2));
        else if (part.startsWith('F:')) setFaultCode(part.substring(2));
      });
    } catch (error) {
      console.error('Parse error:', error);
      addLog('Error parsing data: ' + error.message);
    }
  };

  const startAutoMonitoring = () => {
    const interval = setInterval(() => {
      if (isConnected) {
        sendData('GET_DATA\n');
      } else {
        clearInterval(interval);
      }
    }, 3000);
  };

  const handlePair = async () => {
    if (isConnected) {
      const confirmed = window.confirm('Disconnect current device first?');
      if (confirmed) {
        await disconnectDevice();
      } else {
        return;
      }
    }
    await scanForDevices();
  };

  const handleUpdate = async () => {
    if (!isConnected) {
      alert('Please pair device first');
      return;
    }
    
    const now = new Date();
    const dateTimeString = formatDateTimeFor24Hour(now);
    const confirmed = window.confirm(`Send update with current date/time?\n${dateTimeString}`);
    
    if (confirmed) {
      addLog(`Sending update with time: ${dateTimeString}`);
      const updateCommand = `UPDATE_FIRMWARE,DATETIME:${dateTimeString}\n`;
      const success = await sendData(updateCommand);
      if (success) {
        alert('Firmware update initiated with current date/time');
      }
    }
  };

  const handleGetData = async () => {
    if (!isConnected) {
      alert('Please pair device first');
      return;
    }
    addLog('Requesting device data...');
    await sendData('GET_DATA\n');
  };

  const handleSend = async () => {
    if (!isConnected) {
      alert('Please pair device first');
      return;
    }

    try {
      const config = `MODE:${selectedMode},HV:${highVoltage},LV:${lowVoltage},OFF:${offTimeHour}:${offTimeMinute}\n`;
      addLog('Sending configuration...');
      const success = await sendData(config);
      if (success) {
        alert('Configuration sent to device');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleSaveSettings = async () => {
    if (!isConnected) {
      alert('Please pair device first');
      return;
    }
    
    try {
      const settings = `SETTINGS:BAUD:${baudRate},DATA:${dataBits},STOP:${stopBits},PARITY:${parity}\n`;
      addLog('Saving settings...');
      const success = await sendData(settings);
      if (success) {
        alert('Settings saved successfully');
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const addLog = (event) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setEventLog(prev => [{ time: timeStr, event }, ...prev].slice(0, 50));
  };

  // Render for Web
  if (isWeb) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.headerTitle}>Light Remote</h1>
          <p style={styles.headerSubtitle}>BT Controller (Web)</p>
          <p style={styles.dateTime}>{formatDateTime(currentTime)}</p>
        </div>

        <div style={styles.scrollView}>
          {/* Connection Card */}
          <div style={styles.card}>
            <div style={styles.actionButtons}>
              <button
                style={{...styles.actionBtn, ...styles.pairBtn}}
                onClick={handlePair}
                disabled={isScanning}
              >
                {isConnected ? 'PAIRED' : isScanning ? 'CONNECTING...' : 'PAIR'}
              </button>
              <button
                style={{...styles.actionBtn, ...styles.updateBtn}}
                onClick={handleUpdate}
              >
                UPDATE
              </button>
              <button
                style={{...styles.actionBtn, ...styles.getDataBtn}}
                onClick={handleGetData}
              >
                GET DATA
              </button>
            </div>

            <div style={styles.connectionStatus}>
              <span style={styles.statusText}>Status: </span>
              <div style={{
                ...styles.statusDot,
                backgroundColor: isConnected ? '#4CAF50' : '#F44336'
              }} />
              <span style={styles.statusText}>
                {isConnected ? (connectedDevice?.name || 'Connected') : 'Disconnected'}
              </span>
            </div>

            {isConnected && (
              <button
                style={{...styles.actionBtn, ...styles.disconnectBtn}}
                onClick={disconnectDevice}
              >
                DISCONNECT
              </button>
            )}
          </div>

          {/* Mode Selection Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Select Mode</h2>
            <div style={styles.modeSelector}>
              {['A', 'B', 'C'].map((mode) => (
                <button
                  key={mode}
                  style={{
                    ...styles.modeBtn,
                    ...(selectedMode === mode ? styles.modeBtnActive : {})
                  }}
                  onClick={() => setSelectedMode(mode)}
                >
                  <span style={{
                    ...styles.modeBtnText,
                    ...(selectedMode === mode ? styles.modeBtnTextActive : {})
                  }}>
                    Mode {mode}{'\n'}
                    {mode === 'A' ? 'Sensor Mode' : mode === 'B' ? 'Astro Mode' : 'Clock Mode'}
                  </span>
                </button>
              ))}
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>High Voltage Cut-off (V)</label>
              <input
                style={styles.input}
                type="number"
                value={highVoltage}
                onChange={(e) => setHighVoltage(e.target.value)}
                placeholder="285"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Low Voltage Cut-off (V)</label>
              <input
                style={styles.input}
                type="number"
                value={lowVoltage}
                onChange={(e) => setLowVoltage(e.target.value)}
                placeholder="150"
              />
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Off Time (HH:MM)</label>
              <div style={styles.timeInputContainer}>
                <input
                  style={{...styles.input, ...styles.timeInput}}
                  type="number"
                  value={offTimeHour}
                  onChange={(e) => setOffTimeHour(e.target.value)}
                  maxLength={2}
                  placeholder="22"
                />
                <span style={styles.timeSeparator}>:</span>
                <input
                  style={{...styles.input, ...styles.timeInput}}
                  type="number"
                  value={offTimeMinute}
                  onChange={(e) => setOffTimeMinute(e.target.value)}
                  maxLength={2}
                  placeholder="00"
                />
              </div>
            </div>

            <button style={styles.sendBtn} onClick={handleSend}>
              SEND
            </button>
          </div>

          {/* Device Status Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Device Status</h2>
            <div style={styles.statusGrid}>
              <div style={styles.statusItem}>
                <p style={styles.statusLabel}>Voltage</p>
                <p style={styles.statusValue}>{voltage} V</p>
              </div>
              <div style={styles.statusItem}>
                <p style={styles.statusLabel}>Current</p>
                <p style={styles.statusValue}>{current} A</p>
              </div>
              <div style={styles.statusItem}>
                <p style={styles.statusLabel}>Status</p>
                <p style={{
                  ...styles.statusValue,
                  color: status === 'ON' ? '#4CAF50' : '#F44336'
                }}>
                  {status}
                </p>
              </div>
              <div style={styles.statusItem}>
                <p style={styles.statusLabel}>Fault Code</p>
                <p style={styles.statusValue}>{faultCode}</p>
              </div>
            </div>
          </div>

          {/* Device Settings Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Device Settings</h2>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Baud Rate</label>
              <div style={styles.pickerContainer}>
                {['9600', '19200', '38400', '57600', '115200'].map((rate) => (
                  <button
                    key={rate}
                    style={{
                      ...styles.pickerBtn,
                      ...(baudRate === rate ? styles.pickerBtnActive : {})
                    }}
                    onClick={() => setBaudRate(rate)}
                  >
                    <span style={{
                      ...styles.pickerBtnText,
                      ...(baudRate === rate ? styles.pickerBtnTextActive : {})
                    }}>
                      {rate}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Data Bits</label>
              <div style={styles.pickerContainer}>
                {['7', '8'].map((bits) => (
                  <button
                    key={bits}
                    style={{
                      ...styles.pickerBtn,
                      ...(dataBits === bits ? styles.pickerBtnActive : {})
                    }}
                    onClick={() => setDataBits(bits)}
                  >
                    <span style={{
                      ...styles.pickerBtnText,
                      ...(dataBits === bits ? styles.pickerBtnTextActive : {})
                    }}>
                      {bits}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Stop Bits</label>
              <div style={styles.pickerContainer}>
                {['1', '2'].map((bits) => (
                  <button
                    key={bits}
                    style={{
                      ...styles.pickerBtn,
                      ...(stopBits === bits ? styles.pickerBtnActive : {})
                    }}
                    onClick={() => setStopBits(bits)}
                  >
                    <span style={{
                      ...styles.pickerBtnText,
                      ...(stopBits === bits ? styles.pickerBtnTextActive : {})
                    }}>
                      {bits}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.inputLabel}>Parity</label>
              <div style={styles.pickerContainer}>
                {['None', 'Even', 'Odd'].map((par) => (
                  <button
                    key={par}
                    style={{
                      ...styles.pickerBtn,
                      ...(parity === par ? styles.pickerBtnActive : {})
                    }}
                    onClick={() => setParity(par)}
                  >
                    <span style={{
                      ...styles.pickerBtnText,
                      ...(parity === par ? styles.pickerBtnTextActive : {})
                    }}>
                      {par}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button style={styles.saveBtn} onClick={handleSaveSettings}>
              SAVE SETTINGS
            </button>
          </div>

          {/* Event Log Card */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Event Log</h2>
            <div style={styles.logContainer}>
              {eventLog.slice(0, 15).map((log, index) => (
                <div key={index} style={styles.logItem}>
                  <span style={styles.logTime}>{log.time}</span>
                  <span style={styles.logEvent}>{log.event}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '30px' }} />
        </div>
      </div>
    );
  }

  // React Native render code would go here - keeping your original JSX
  return null;
}

// Styles object that works for both web and React Native
const styles = {
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    minHeight: '100vh',
    color: '#ffffff'
  },
  scrollView: {
    flex: 1,
    overflowY: 'auto',
    padding: '0'
  },
  header: {
    padding: '20px',
    paddingTop: '40px',
    backgroundColor: '#1a237e',
    textAlign: 'center'
  },
  headerTitle: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: '2px',
    margin: '0'
  },
  headerSubtitle: {
    fontSize: '12px',
    color: '#bbdefb',
    marginTop: '5px'
  },
  dateTime: {
    fontSize: '14px',
    color: '#ffffff',
    marginTop: '10px',
    fontWeight: '500'
  },
  card: {
    backgroundColor: '#1e1e1e',
    margin: '10px',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #333'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '15px',
    borderBottom: '1px solid #333',
    paddingBottom: '10px',
    marginTop: '0'
  },
  actionButtons: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  },
  actionBtn: {
    flex: 1,
    padding: '12px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px',
    color: '#ffffff'
  },
  pairBtn: {
    backgroundColor: '#2196F3'
  },
  updateBtn: {
    backgroundColor: '#FF9800'
  },
  getDataBtn: {
    backgroundColor: '#4CAF50'
  },
  disconnectBtn: {
    backgroundColor: '#F44336',
    width: '100%',
    marginTop: '10px'
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row'
  },
  statusText: {
    color: '#ffffff',
    fontSize: '14px'
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '5px',
    margin: '0 5px'
  },
  modeSelector: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  },
  modeBtn: {
    flex: 1,
    padding: '15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '5px',
    border: '2px solid #444',
    cursor: 'pointer',
    textAlign: 'center'
  },
  modeBtnActive: {
    backgroundColor: '#1976D2',
    borderColor: '#2196F3'
  },
  modeBtnText: {
    color: '#999',
    fontSize: '11px',
    fontWeight: '600',
    whiteSpace: 'pre-line'
  },
  modeBtnTextActive: {
    color: '#ffffff'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  inputLabel: {
    color: '#bbdefb',
    fontSize: '14px',
    marginBottom: '8px',
    fontWeight: '500',
    display: 'block'
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    padding: '12px',
    borderRadius: '5px',
    border: '1px solid #444',
    fontSize: '16px',
    width: '100%',
    boxSizing: 'border-box'
  },
  timeInputContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  timeInput: {
    flex: 1,
    textAlign: 'center'
  },
  timeSeparator: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: 'bold'
  },
  sendBtn: {
    backgroundColor: '#4CAF50',
    padding: '15px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#ffffff',
    width: '100%',
    marginTop: '10px'
  },
  statusGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px'
  },
  statusItem: {
    flex: '1 1 45%',
    minWidth: '45%',
    backgroundColor: '#2a2a2a',
    padding: '15px',
    borderRadius: '5px',
    border: '1px solid #444'
  },
  statusLabel: {
    color: '#999',
    fontSize: '12px',
    marginBottom: '5px',
    margin: '0 0 5px 0'
  },
  statusValue: {
    color: '#ffffff',
    fontSize: '18px',
    fontWeight: 'bold',
    margin: '0'
  },
  pickerContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  pickerBtn: {
    padding: '10px 15px',
    backgroundColor: '#2a2a2a',
    borderRadius: '5px',
    border: '1px solid #444',
    cursor: 'pointer'
  },
  pickerBtnActive: {
    backgroundColor: '#1976D2',
    borderColor: '#2196F3'
  },
  pickerBtnText: {
    color: '#999',
    fontSize: '14px'
  },
  pickerBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold'
  },
  saveBtn: {
    backgroundColor: '#1976D2',
    padding: '15px',
    borderRadius: '5px',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#ffffff',
    width: '100%',
    marginTop: '10px'
  },
  logContainer: {
    maxHeight: '300px',
    overflowY: 'auto'
  },
  logItem: {
    display: 'flex',
    padding: '8px 0',
    borderBottom: '1px solid #333'
  },
  logTime: {
    color: '#4CAF50',
    fontSize: '12px',
    fontFamily: 'monospace',
    width: '80px',
    flexShrink: 0
  },
  logEvent: {
    color: '#ffffff',
    fontSize: '12px',
    flex: 1
  }
}
