import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  PermissionsAndroid,
  Platform,
  FlatList,
  Modal,
  ToastAndroid,
} from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    initializeBluetooth();
    addLog('App Started');

    return () => {
      clearInterval(timer);
      if (connectedDevice) {
        disconnectDevice();
      }
    };
  }, []);

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
    try {
      const enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      
      if (enabled) {
        setIsBluetoothEnabled(true);
        addLog('Bluetooth Enabled');
        if (Platform.OS === 'android') {
          ToastAndroid.show('Bluetooth Enabled', ToastAndroid.SHORT);
        }
      } else {
        addLog('User declined to enable Bluetooth');
        Alert.alert(
          'Bluetooth Required',
          'This app requires Bluetooth to be enabled. Please enable it in your device settings.',
          [
            {
              text: 'Try Again',
              onPress: () => enableBluetooth(),
            },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('Enable Bluetooth error:', error);
      addLog('Failed to enable Bluetooth: ' + error.message);
      Alert.alert('Error', 'Could not enable Bluetooth: ' + error.message);
    }
  };

  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
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
          } else {
            Alert.alert('Permissions Required', 'Please grant all Bluetooth permissions');
          }
        } else {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);
          
          if (granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED) {
            addLog('Permissions Granted');
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
    try {
      const enabled = await RNBluetoothClassic.isBluetoothEnabled();
      
      if (!enabled) {
        addLog('Bluetooth is disabled, requesting to enable...');
        await enableBluetooth();
        
        const nowEnabled = await RNBluetoothClassic.isBluetoothEnabled();
        if (!nowEnabled) {
          return;
        }
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
        allDevices.forEach(device => {
          addLog(`Device: ${device.name || 'Unknown'}`);
        });
      }
      
    } catch (error) {
      console.error('Scan error:', error);
      addLog('Scan Error: ' + error.message);
      setIsScanning(false);
      Alert.alert('Scan Error', error.message);
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
        
        if (Platform.OS === 'android') {
          ToastAndroid.show(`Connected to ${device.name}`, ToastAndroid.SHORT);
        }
        
        device.onDataReceived((data) => {
          handleReceivedData(data.data);
        });
        
        startAutoMonitoring();
        
      } else {
        addLog('Connection failed');
        Alert.alert('Error', 'Failed to connect to device');
      }
      
    } catch (error) {
      console.error('Connection error:', error);
      addLog('Connection Error: ' + error.message);
      Alert.alert('Connection Error', error.message);
    }
  };

  const disconnectDevice = async () => {
    try {
      if (connectedDevice) {
        await connectedDevice.disconnect();
        setIsConnected(false);
        setConnectedDevice(null);
        setVoltage('0');
        setCurrent('0');
        setStatus('OFF');
        addLog('Device Disconnected');
        
        if (Platform.OS === 'android') {
          ToastAndroid.show('Disconnected', ToastAndroid.SHORT);
        }
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      addLog('Disconnect Error: ' + error.message);
    }
  };

  const sendData = async (data) => {
    try {
      if (!connectedDevice || !isConnected) {
        throw new Error('Device not connected');
      }
      
      const sent = await connectedDevice.write(data);
      
      if (sent) {
        addLog(`Sent: ${data}`);
        return true;
      } else {
        throw new Error('Failed to send data');
      }
    } catch (error) {
      console.error('Send error:', error);
      addLog('Send Error: ' + error.message);
      Alert.alert('Send Error', error.message);
      return false;
    }
  };

  const handleReceivedData = (data) => {
    try {
      addLog(`Received: ${data}`);
      
      try {
        const jsonData = JSON.parse(data);
        if (jsonData.voltage !== undefined) {
          setVoltage(jsonData.voltage.toString());
        }
        if (jsonData.current !== undefined) {
          setCurrent(jsonData.current.toString());
        }
        if (jsonData.status !== undefined) {
          setStatus(jsonData.status);
        }
        if (jsonData.faultCode !== undefined) {
          setFaultCode(jsonData.faultCode);
        }
        addLog('Device status updated from JSON');
        return;
      } catch (jsonError) {
        // Not JSON, try comma-separated format
      }
      
      const parts = data.split(',');
      parts.forEach(part => {
        if (part.startsWith('V:')) {
          setVoltage(part.substring(2));
        } else if (part.startsWith('C:')) {
          setCurrent(part.substring(2));
        } else if (part.startsWith('S:')) {
          setStatus(part.substring(2));
        } else if (part.startsWith('F:')) {
          setFaultCode(part.substring(2));
        }
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
      Alert.alert(
        'Already Connected',
        'Disconnect current device first?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Disconnect', onPress: disconnectDevice },
        ]
      );
      return;
    }
    
    await scanForDevices();
  };

  const handleUpdate = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Please pair device first');
      return;
    }
    
    const now = new Date();
    const dateTimeString = formatDateTimeFor24Hour(now);
    
    Alert.alert(
      'Firmware Update',
      `Send update with current date/time?\n${dateTimeString}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            addLog(`Sending update with time: ${dateTimeString}`);
            const updateCommand = `UPDATE_FIRMWARE,DATETIME:${dateTimeString}\n`;
            const success = await sendData(updateCommand);
            if (success) {
              Alert.alert('Success', 'Firmware update initiated with current date/time');
            }
          },
        },
      ]
    );
  };

  const handleGetData = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Please pair device first');
      return;
    }
    
    addLog('Requesting device data...');
    const success = await sendData('GET_DATA\n');
    
    if (success) {
      if (Platform.OS === 'android') {
        ToastAndroid.show('Data request sent', ToastAndroid.SHORT);
      }
    }
  };

  const handleSend = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Please pair device first');
      return;
    }
    
    try {
      const config = `MODE:${selectedMode},HV:${highVoltage},LV:${lowVoltage},OFF:${offTimeHour}:${offTimeMinute}\n`;
      
      addLog('Sending configuration...');
      const success = await sendData(config);
      
      if (success) {
        Alert.alert('Success', 'Configuration sent to device');
        if (Platform.OS === 'android') {
          ToastAndroid.show('Configuration sent', ToastAndroid.SHORT);
        }
      }
      
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSaveSettings = async () => {
    if (!isConnected) {
      Alert.alert('Error', 'Please pair device first');
      return;
    }
    
    try {
      const settings = `SETTINGS:BAUD:${baudRate},DATA:${dataBits},STOP:${stopBits},PARITY:${parity}\n`;
      
      addLog('Saving settings...');
      const success = await sendData(settings);
      
      if (success) {
        Alert.alert('Success', 'Settings saved successfully');
        if (Platform.OS === 'android') {
          ToastAndroid.show('Settings saved', ToastAndroid.SHORT);
        }
      }
      
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const addLog = (event) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    setEventLog(prev => [{ time: timeStr, event }, ...prev].slice(0, 50));
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a237e" />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Light Remote</Text>
        <Text style={styles.headerSubtitle}>BT Controller</Text>
        <Text style={styles.dateTime}>{formatDateTime(currentTime)}</Text>
      </View>

      <Modal
        visible={showDeviceList}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeviceList(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Available Devices</Text>
            {isScanning && (
              <Text style={styles.scanningText}>Scanning...</Text>
            )}
            <FlatList
              data={discoveredDevices}
              keyExtractor={(item, index) => item.address || index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.deviceItem}
                  onPress={() => connectToDevice(item)}
                >
                  <Text style={styles.deviceName}>
                    {item.name || 'Unknown Device'}
                  </Text>
                  <Text style={styles.deviceId}>{item.address}</Text>
                  <Text style={styles.deviceBonded}>
                    {item.bonded ? '(Paired)' : '(Not Paired)'}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {isScanning ? 'Searching for devices...' : 'No devices found. Make sure Bluetooth is ON and device is in range.'}
                </Text>
              }
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={scanForDevices}
                disabled={isScanning}
              >
                <Text style={styles.rescanText}>
                  {isScanning ? 'SCANNING...' : 'RESCAN'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setShowDeviceList(false)}
              >
                <Text style={styles.closeModalText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.scrollView}>
        <View style={styles.card}>
          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.pairBtn]}
              onPress={handlePair}
            >
              <Text style={styles.actionBtnText}>
                {isConnected ? 'PAIRED' : 'PAIR'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.updateBtn]}
              onPress={handleUpdate}
            >
              <Text style={styles.actionBtnText}>UPDATE</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.getDataBtn]}
              onPress={handleGetData}
            >
              <Text style={styles.actionBtnText}>GET DATA</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.connectionStatus}>
            <Text style={styles.statusText}>Status: </Text>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }]} />
            <Text style={styles.statusText}>
              {isConnected ? (connectedDevice?.name || 'Connected') : 'Disconnected'}
            </Text>
          </View>
          {isConnected && (
            <TouchableOpacity
              style={styles.disconnectBtn}
              onPress={disconnectDevice}
            >
              <Text style={styles.actionBtnText}>DISCONNECT</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Select Mode</Text>
          
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeBtn, selectedMode === 'A' && styles.modeBtnActive]}
              onPress={() => setSelectedMode('A')}
            >
              <Text style={[styles.modeBtnText, selectedMode === 'A' && styles.modeBtnTextActive]}>
                Mode A{'\n'}Sensor Mode
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, selectedMode === 'B' && styles.modeBtnActive]}
              onPress={() => setSelectedMode('B')}
            >
              <Text style={[styles.modeBtnText, selectedMode === 'B' && styles.modeBtnTextActive]}>
                Mode B{'\n'}Astro Mode
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, selectedMode === 'C' && styles.modeBtnActive]}
              onPress={() => setSelectedMode('C')}
            >
              <Text style={[styles.modeBtnText, selectedMode === 'C' && styles.modeBtnTextActive]}>
                Mode C{'\n'}Clock Mode
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>High Voltage Cut-off (V)</Text>
            <TextInput
              style={styles.input}
              value={highVoltage}
              onChangeText={setHighVoltage}
              keyboardType="numeric"
              placeholder="285"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Low Voltage Cut-off (V)</Text>
            <TextInput
              style={styles.input}
              value={lowVoltage}
              onChangeText={setLowVoltage}
              keyboardType="numeric"
              placeholder="150"
              placeholderTextColor="#666"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Off Time (HH:MM)</Text>
            <View style={styles.timeInputContainer}>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={offTimeHour}
                onChangeText={setOffTimeHour}
                keyboardType="numeric"
                maxLength={2}
                placeholder="22"
                placeholderTextColor="#666"
              />
              <Text style={styles.timeSeparator}>:</Text>
              <TextInput
                style={[styles.input, styles.timeInput]}
                value={offTimeMinute}
                onChangeText={setOffTimeMinute}
                keyboardType="numeric"
                maxLength={2}
                placeholder="00"
                placeholderTextColor="#666"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendBtnText}>SEND</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Status</Text>
          <View style={styles.statusGrid}>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Voltage</Text>
              <Text style={styles.statusValue}>{voltage} V</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Current</Text>
              <Text style={styles.statusValue}>{current} A</Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={[styles.statusValue, status === 'ON' ? styles.statusOn : styles.statusOff]}>
                {status}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Text style={styles.statusLabel}>Fault Code</Text>
              <Text style={styles.statusValue}>{faultCode}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Settings</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Baud Rate</Text>
            <View style={styles.pickerContainer}>
              {['9600', '19200', '38400', '57600', '115200'].map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[styles.pickerBtn, baudRate === rate && styles.pickerBtnActive]}
                  onPress={() => setBaudRate(rate)}
                >
                  <Text style={[styles.pickerBtnText, baudRate === rate && styles.pickerBtnTextActive]}>
                    {rate}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Data Bits</Text>
            <View style={styles.pickerContainer}>
              {['7', '8'].map((bits) => (
                <TouchableOpacity
                  key={bits}
                  style={[styles.pickerBtn, dataBits === bits && styles.pickerBtnActive]}
                  onPress={() => setDataBits(bits)}
                >
                  <Text style={[styles.pickerBtnText, dataBits === bits && styles.pickerBtnTextActive]}>
                    {bits}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Stop Bits</Text>
            <View style={styles.pickerContainer}>
              {['1', '2'].map((bits) => (
                <TouchableOpacity
                  key={bits}
                  style={[styles.pickerBtn, stopBits === bits && styles.pickerBtnActive]}
                  onPress={() => setStopBits(bits)}
                >
                  <Text style={[styles.pickerBtnText, stopBits === bits && styles.pickerBtnTextActive]}>
                    {bits}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Parity</Text>
            <View style={styles.pickerContainer}>
              {['None', 'Even', 'Odd'].map((par) => (
                <TouchableOpacity
                  key={par}
                  style={[styles.pickerBtn, parity === par && styles.pickerBtnActive]}
                  onPress={() => setParity(par)}
                >
                  <Text style={[styles.pickerBtnText, parity === par && styles.pickerBtnTextActive]}>
                    {par}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
            <Text style={styles.saveBtnText}>SAVE SETTINGS</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Event Log</Text>
          <View style={styles.logContainer}>
            {eventLog.slice(0, 15).map((log, index) => (
              <View key={index} style={styles.logItem}>
                <Text style={styles.logTime}>{log.time}</Text>
                <Text style={styles.logEvent}>{log.event}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#1a237e',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#bbdefb',
    marginTop: 5,
  },
  dateTime: {
    fontSize: 14,
    color: '#ffffff',
    marginTop: 10,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    textAlign: 'center',
  },
  scanningText: {
    color: '#4CAF50',
    textAlign: 'center',
    marginBottom: 10,
    fontSize: 14,
  },
  deviceItem: {
    backgroundColor: '#2a2a2a',
    padding: 15,
    marginBottom: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
  },
  deviceName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  deviceId: {
    color: '#888',
    fontSize: 12,
    marginTop: 5,
  },
  deviceBonded: {
    color: '#4CAF50',
    fontSize: 11,
    marginTop: 3,
  },
  emptyText: {
    color: '#888',
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 15,
  },
  rescanBtn: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 5,
  },
  rescanText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  closeModalBtn: {
    flex: 1,
    backgroundColor: '#F44336',
    padding: 15,
    borderRadius: 5,
  },
  closeModalText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  card: {
    backgroundColor: '#1e1e1e',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    paddingBottom: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  pairBtn: {
    backgroundColor: '#2196F3',
  },
  updateBtn: {
    backgroundColor: '#FF9800',
  },
  getDataBtn: {
    backgroundColor: '#4CAF50',
  },
  disconnectBtn: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 15,
    backgroundColor: '#2a2a2a',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#1976D2',
    borderColor: '#2196F3',
  },
  modeBtnText: {
    color: '#999',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  modeBtnTextActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 15,
  },
  inputLabel: {
    color: '#bbdefb',
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#ffffff',
    padding: 12,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
    fontSize: 16,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeInput: {
    flex: 1,
    textAlign: 'center',
  },
  timeSeparator: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  sendBtn: {
    backgroundColor: '#4CAF50',
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2a2a2a',
    padding: 15,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
  },
  statusLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 5,
  },
  statusValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusOn: {
    color: '#4CAF50',
  },
  statusOff: {
    color: '#F44336',
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerBtn: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444',
  },
  pickerBtnActive: {
    backgroundColor: '#1976D2',
    borderColor: '#2196F3',
  },
  pickerBtnText: {
    color: '#999',
    fontSize: 14,
  },
  pickerBtnTextActive: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  saveBtn: {
    backgroundColor: '#1976D2',
    paddingVertical: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  logContainer: {
    maxHeight: 300,
  },
  logItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  logTime: {
    color: '#4CAF50',
    fontSize: 12,
    fontFamily: 'monospace',
    width: 80,
  },
  logEvent: {
    color: '#ffffff',
    fontSize: 12,
    flex: 1,
  },
});
