import 'package:flutter/material.dart';

import '../services/alert_service.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final AlertService _alertService = AlertService();

  List<dynamic> _alerts = [];
  bool _loading = true;
  String? _error;
  final Set<int> _busyAlerts = {};

  @override
  void initState() {
    super.initState();
    _loadAlerts();
  }

  Future<void> _loadAlerts() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final alerts = await _alertService.fetchAlerts();

      if (!mounted) return;

      setState(() {
        _alerts = alerts;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  Future<void> _acknowledge(int alertId) async {
    setState(() => _busyAlerts.add(alertId));

    try {
      await _alertService.acknowledgeAlert(alertId);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Alert acknowledged successfully')),
      );

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

  String _formatTimestamp(dynamic value) {
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

  String _formatType(dynamic type) {
    switch (type) {
      case 'over_temperature':
        return 'Over temperature';
      case 'inactive':
        return 'Inactive device';
      case 'offline':
        return 'Device offline';
      default:
        return '${type ?? 'Unknown alert'}'
            .replaceAll('_', ' ');
    }
  }

  @override
  Widget build(BuildContext context) {
    final openCount = _alerts.where((alert) {
      return alert['acknowledged'] != 1 &&
          alert['acknowledged'] != true;
    }).length;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        backgroundColor: Colors.white,
        actions: [
          IconButton(
            onPressed: _loadAlerts,
            tooltip: 'Refresh alerts',
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadAlerts,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text(
              'Alert Center',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Review device alerts and acknowledge resolved issues.',
              style: TextStyle(color: Colors.blueGrey),
            ),
            const SizedBox(height: 20),
            Card(
              elevation: 0,
              color: Colors.white,
              child: ListTile(
                leading: const Icon(
                  Icons.warning_amber_rounded,
                  color: Colors.deepOrange,
                  size: 32,
                ),
                title: const Text('Open alerts'),
                subtitle: const Text('Awaiting acknowledgement'),
                trailing: Text(
                  '$openCount',
                  style: const TextStyle(
                    fontSize: 25,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _loadAlerts,
                        child: const Text('Try Again'),
                      ),
                    ],
                  ),
                ),
              )
            else if (_alerts.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: Text('No alerts found.')),
                ),
              )
            else
              ..._alerts.map((alert) {
                final id = alert['id'] as int;
                final acknowledged =
                    alert['acknowledged'] == 1 ||
                    alert['acknowledged'] == true;
                final type = alert['type'];

                return Card(
                  elevation: 0,
                  color: Colors.white,
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              type == 'over_temperature'
                                  ? Icons.thermostat
                                  : type == 'offline'
                                      ? Icons.cloud_off
                                      : Icons.directions_run,
                              color: acknowledged
                                  ? Colors.green
                                  : Colors.deepOrange,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _formatType(type),
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            Chip(
                              label: Text(
                                acknowledged ? 'Acknowledged' : 'Open',
                              ),
                              backgroundColor: acknowledged
                                  ? const Color(0xFFE4F7EA)
                                  : const Color(0xFFFFE8E5),
                              side: BorderSide.none,
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${alert['message'] ?? 'No message provided'}',
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Alert ID: $id  •  Device: ${alert['device_id']}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.blueGrey,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Raised: ${_formatTimestamp(alert['raised_at'])}',
                          style: const TextStyle(
                            fontSize: 12,
                            color: Colors.blueGrey,
                          ),
                        ),
                        if (acknowledged &&
                            alert['acknowledged_at'] != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            'Acknowledged: ${_formatTimestamp(alert['acknowledged_at'])}',
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.green,
                            ),
                          ),
                        ],
                        if (!acknowledged) ...[
                          const SizedBox(height: 12),
                          Align(
                            alignment: Alignment.centerRight,
                            child: OutlinedButton.icon(
                              onPressed: _busyAlerts.contains(id)
                                  ? null
                                  : () => _acknowledge(id),
                              icon: _busyAlerts.contains(id)
                                  ? const SizedBox(
                                      width: 16,
                                      height: 16,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                      ),
                                    )
                                  : const Icon(Icons.check_circle_outline),
                              label: const Text('Acknowledge'),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}