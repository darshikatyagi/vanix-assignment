import 'package:flutter/material.dart';

import '../services/alert_service.dart';
import '../services/reading_service.dart';
import 'reading_history_screen.dart';

class DeviceDetailsScreen extends StatefulWidget {
  final Map<String, dynamic> device;

  const DeviceDetailsScreen({super.key, required this.device});

  @override
  State<DeviceDetailsScreen> createState() => _DeviceDetailsScreenState();
}

class _DeviceDetailsScreenState extends State<DeviceDetailsScreen> {
  final AlertService _alertService = AlertService();
  final ReadingService _readingService = ReadingService();

  List<dynamic> _alerts = [];
  List<dynamic> _readings = [];

  bool _loadingAlerts = true;
  bool _loadingReadings = true;
  final Set<int> _busyAlerts = {};
  String? _alertError;
  String? _readingError;

  @override
  void initState() {
    super.initState();
    _loadAlerts();
    _loadRecentReadings();
  }

  Future<void> _loadAlerts() async {
    try {
      final alerts = await _alertService.fetchAlerts();

      if (!mounted) return;

      final deviceId = (widget.device['deviceId'] as num).toInt();

      setState(() {
        _alerts = alerts.where((alert) {
          return (alert['device_id'] as num?)?.toInt() == deviceId;
        }).toList();
        _loadingAlerts = false;
        _alertError = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _alertError = error.toString();
        _loadingAlerts = false;
      });
    }
  }

  Future<void> _loadRecentReadings() async {
    try {
      final result = await _readingService.fetchReadings(
        deviceId: (widget.device['deviceId'] as num).toInt(),
        page: 1,
        limit: 20,
      );

      if (!mounted) return;

      final readings = result['readings'] as List<dynamic>? ?? [];
      final cutoff =
          DateTime.now()
              .subtract(const Duration(hours: 1))
              .millisecondsSinceEpoch ~/
          1000;

      setState(() {
        _readings = readings.where((reading) {
          final timestamp = reading['timestamp'];
          return timestamp is num && timestamp >= cutoff;
        }).toList();
        _loadingReadings = false;
        _readingError = null;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _readingError = error.toString();
        _loadingReadings = false;
      });
    }
  }

  Future<void> _acknowledgeAlert(int alertId) async {
    setState(() => _busyAlerts.add(alertId));

    try {
      await _alertService.acknowledgeAlert(alertId);

      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Alert acknowledged')));

      await _loadAlerts();
    } catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not acknowledge alert: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _busyAlerts.remove(alertId));
      }
    }
  }

  String _formatTime(dynamic value) {
    if (value is! num) return 'Not available';

    final date = DateTime.fromMillisecondsSinceEpoch(
      value.toInt() * 1000,
    ).toLocal();

    return '${date.day.toString().padLeft(2, '0')}/'
        '${date.month.toString().padLeft(2, '0')}/'
        '${date.year} '
        '${date.hour.toString().padLeft(2, '0')}:'
        '${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final device = widget.device;
    final temperature = device['latestTemperature'];
    final activity = device['activityScore'];
    final hasAlert =
        device['hasOpenAlert'] == 1 || device['hasOpenAlert'] == true;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Device Details'),
        backgroundColor: Colors.white,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Icon(Icons.memory_rounded, size: 64, color: Color(0xFF2563EB)),
          const SizedBox(height: 12),
          Center(
            child: Text(
              '${device['label'] ?? 'Unknown device'}',
              style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
            ),
          ),
          Center(
            child: Text(
              'Device ID: ${device['deviceId'] ?? 'N/A'}',
              style: const TextStyle(color: Colors.blueGrey),
            ),
          ),
          const SizedBox(height: 24),
          _detailTile(
            'Latest Temperature',
            temperature == null
                ? 'Not available'
                : '${(temperature as num).toStringAsFixed(2)} °C',
            Icons.thermostat,
          ),
          _detailTile(
            'Activity Score',
            activity == null
                ? 'Not available'
                : (activity as num).toStringAsFixed(2),
            Icons.show_chart,
          ),
          _detailTile(
            'Last Seen',
            _formatTime(device['lastSeen']),
            Icons.access_time,
          ),
          _detailTile(
            'Location',
            (device['location'] as String?)?.isNotEmpty == true
                ? device['location'] as String
                : 'Not provided',
            Icons.location_on_outlined,
          ),
          _detailTile(
            'Install Date',
            device['installDate']?.toString() ?? 'Not provided',
            Icons.calendar_today_outlined,
          ),
          _detailTile(
            'Alert Status',
            hasAlert ? 'Open alert exists' : 'No open alert',
            Icons.warning_amber_rounded,
          ),
          const SizedBox(height: 20),
          const Text(
            'Temperature History — Last Hour',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          if (_loadingReadings)
            const Center(child: CircularProgressIndicator())
          else if (_readingError != null)
            Text('Could not load readings: $_readingError')
          else if (_readings.isEmpty)
            const Text('No readings found in the last hour.')
          else
            Card(
              elevation: 0,
              color: Colors.white,
              child: Column(
                children: _readings.map((reading) {
                  final value = reading['temperature'];
                  return ListTile(
                    leading: const Icon(
                      Icons.thermostat,
                      color: Color(0xFF2563EB),
                    ),
                    title: Text(
                      value is num
                          ? '${value.toStringAsFixed(2)} °C'
                          : 'Temperature unavailable',
                    ),
                    subtitle: Text(
                      'Sequence ${reading['sequence']} · '
                      '${_formatTime(reading['timestamp'])}',
                    ),
                  );
                }).toList(),
              ),
            ),
          const SizedBox(height: 20),
          const Text(
            'Device Alerts',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 10),
          if (_loadingAlerts)
            const Center(child: CircularProgressIndicator())
          else if (_alertError != null)
            Text('Could not load alerts: $_alertError')
          else if (_alerts.isEmpty)
            const Text('No alerts recorded for this device.')
          else
            ..._alerts.map((alert) {
              final id = (alert['id'] as num).toInt();
              final acknowledged =
                  alert['acknowledged'] == 1 || alert['acknowledged'] == true;

              return Card(
                elevation: 0,
                color: Colors.white,
                margin: const EdgeInsets.only(bottom: 10),
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${alert['type']}'.replaceAll('_', ' '),
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text('${alert['message'] ?? ''}'),
                      const SizedBox(height: 6),
                      Text(
                        'Raised: ${_formatTime(alert['raised_at'])}',
                        style: const TextStyle(
                          color: Colors.blueGrey,
                          fontSize: 12,
                        ),
                      ),
                      if (acknowledged)
                        const Align(
                          alignment: Alignment.centerRight,
                          child: Chip(label: Text('Acknowledged')),
                        )
                      else
                        Align(
                          alignment: Alignment.centerRight,
                          child: OutlinedButton(
                            onPressed: _busyAlerts.contains(id)
                                ? null
                                : () => _acknowledgeAlert(id),
                            child: _busyAlerts.contains(id)
                                ? const SizedBox(
                                    height: 16,
                                    width: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('Acknowledge'),
                          ),
                        ),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => ReadingHistoryScreen(
                    deviceId: (device['deviceId'] as num).toInt(),
                    deviceLabel: '${device['label'] ?? 'Device'}',
                  ),
                ),
              );
            },
            icon: const Icon(Icons.history),
            label: const Text('View Full Reading History'),
          ),
        ],
      ),
    );
  }

  Widget _detailTile(String title, String value, IconData icon) {
    return Card(
      elevation: 0,
      color: Colors.white,
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: const Color(0xFF2563EB)),
        title: Text(title, style: const TextStyle(color: Colors.blueGrey)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 5),
          child: Text(
            value,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
        ),
      ),
    );
  }
}
