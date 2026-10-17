import 'package:flutter/material.dart';
import 'services/device_service.dart';
import 'screens/device_details_screen.dart';
import 'screens/alerts_screen.dart';

void main() {
  runApp(const VanixApp());
}

class VanixApp extends StatelessWidget {
  const VanixApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Vanix Device Monitor',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
        ),
        scaffoldBackgroundColor: const Color(0xFFF4F7FB),
      ),
      home: const DeviceListScreen(),
    );
  }
}

class DeviceListScreen extends StatefulWidget {
  const DeviceListScreen({super.key});

  @override
  State<DeviceListScreen> createState() => _DeviceListScreenState();
}

class _DeviceListScreenState extends State<DeviceListScreen> {
  final DeviceService _deviceService = DeviceService();

  List<dynamic> _devices = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadDevices();
  }

  Future<void> _loadDevices() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final devices = await _deviceService.fetchDevices();

      if (!mounted) return;

      setState(() {
        _devices = devices;
        _isLoading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.toString();
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final alertCount = _devices.where((device) {
      return device['hasOpenAlert'] == 1 ||
          device['hasOpenAlert'] == true;
    }).length;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Vanix Monitor',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            Text(
              'Device Management',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
          ],
        ),
        
actions: [
  IconButton(
    tooltip: 'View alerts',
    icon: const Icon(Icons.notifications_active_outlined),
    
onPressed: () async {
  await Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => const AlertsScreen(),
    ),
  );

  if (mounted) {
    await _loadDevices();
  }
},
  ),
  IconButton(
    onPressed: _loadDevices,
    tooltip: 'Refresh devices',
    icon: const Icon(Icons.refresh),
  ),
  const SizedBox(width: 8),
],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDevices,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            const Text(
              'Dashboard',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Monitor your connected devices and their status.',
              style: TextStyle(color: Colors.blueGrey),
            ),
            const SizedBox(height: 22),
            if (_isLoading)
              const Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              _buildError()
            else ...[
              Row(
                children: [
                  Expanded(
                    child: _summaryCard(
                      'Total Devices',
                      '${_devices.length}',
                      Icons.devices,
                      Colors.blue,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _summaryCard(
                      'Open Alerts',
                      '$alertCount',
                      Icons.warning_amber_rounded,
                      Colors.deepOrange,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 26),
              const Text(
                'Registered Devices',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 12),
              if (_devices.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: Text('No devices found.')),
                  ),
                )
              else
                ..._devices.map((device) {
                  return _deviceCard(device);
                }),
            ],
          ],
        ),
      ),
    );
  }

  Widget _summaryCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    return Card(
      elevation: 0,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 14),
            Text(
              value,
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              title,
              style: const TextStyle(color: Colors.blueGrey),
            ),
          ],
        ),
      ),
    );
  }

  
  Widget _deviceCard(Map<String, dynamic> device) {
    final temperature = device['latestTemperature'];
    final activity = device['activityScore'];
    final hasAlert = device['hasOpenAlert'] == 1 ||
        device['hasOpenAlert'] == true;

    final lastSeen = device['lastSeen'];
    String lastSeenText = 'Not available';

    if (lastSeen is num) {
      final date = DateTime.fromMillisecondsSinceEpoch(
        lastSeen.toInt() * 1000,
      ).toLocal();

      lastSeenText =
          '${date.day.toString().padLeft(2, '0')}/'
          '${date.month.toString().padLeft(2, '0')}/'
          '${date.year} '
          '${date.hour.toString().padLeft(2, '0')}:'
          '${date.minute.toString().padLeft(2, '0')}';
    }

    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 14),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => DeviceDetailsScreen(
                device: Map<String, dynamic>.from(device),
              ),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE8EFFF),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.memory,
                      color: Color(0xFF2563EB),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${device['label'] ?? 'Unknown device'}',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Device ID: ${device['deviceId'] ?? 'N/A'}',
                          style: const TextStyle(
                            color: Colors.blueGrey,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: hasAlert
                          ? const Color(0xFFFFE8E5)
                          : const Color(0xFFE4F7EA),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      hasAlert ? 'Alert' : 'Normal',
                      style: TextStyle(
                        color: hasAlert
                            ? Colors.red.shade800
                            : Colors.green.shade800,
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
              const Divider(height: 28),
              Row(
                children: [
                  Expanded(
                    child: _deviceMetric(
                      'Temperature',
                      temperature == null
                          ? 'N/A'
                          : '${(temperature as num).toStringAsFixed(1)} °C',
                      Icons.thermostat,
                    ),
                  ),
                  Expanded(
                    child: _deviceMetric(
                      'Activity Score',
                      activity == null
                          ? 'N/A'
                          : (activity as num).toStringAsFixed(1),
                      Icons.show_chart,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(
                    Icons.access_time,
                    size: 16,
                    color: Colors.blueGrey,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Last seen: $lastSeenText',
                      style: const TextStyle(
                        color: Colors.blueGrey,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _deviceMetric(String title, String value, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 17, color: Colors.blueGrey),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                title,
                style: const TextStyle(
                  color: Colors.blueGrey,
                  fontSize: 12,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildError() {
    return Card(
      color: Colors.white,
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const Icon(
              Icons.cloud_off,
              size: 48,
              color: Colors.redAccent,
            ),
            const SizedBox(height: 12),
            const Text(
              'Could not load devices',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ?? 'An unexpected error occurred.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.blueGrey),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _loadDevices,
              icon: const Icon(Icons.refresh),
              label: const Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}