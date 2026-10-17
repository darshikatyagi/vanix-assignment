import 'package:flutter/material.dart';

import '../services/reading_service.dart';

class ReadingHistoryScreen extends StatefulWidget {
  final int deviceId;
  final String deviceLabel;

  const ReadingHistoryScreen({
    super.key,
    required this.deviceId,
    required this.deviceLabel,
  });

  @override
  State<ReadingHistoryScreen> createState() =>
      _ReadingHistoryScreenState();
}

class _ReadingHistoryScreenState extends State<ReadingHistoryScreen> {
  final ReadingService _service = ReadingService();

  List<dynamic> _readings = [];
  int _page = 1;
  int _totalPages = 1;
  int _total = 0;
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadReadings();
  }

  Future<void> _loadReadings({int page = 1}) async {
    setState(() {
      if (page == 1) {
        _loading = true;
      } else {
        _loadingMore = true;
      }
      _error = null;
    });

    try {
      final result = await _service.fetchReadings(
        deviceId: widget.deviceId,
        page: page,
        limit: 20,
      );

      if (!mounted) return;

      setState(() {
        _page = result['page'] as int? ?? page;
        _totalPages = result['totalPages'] as int? ?? 1;
        _total = result['total'] as int? ?? 0;

        if (page == 1) {
          _readings = result['readings'] as List<dynamic>;
        } else {
          _readings.addAll(result['readings'] as List<dynamic>);
        }

        _loading = false;
        _loadingMore = false;
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.toString();
        _loading = false;
        _loadingMore = false;
      });
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reading History'),
        backgroundColor: Colors.white,
      ),
      body: RefreshIndicator(
        onRefresh: () => _loadReadings(page: 1),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              widget.deviceLabel,
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.bold,
              ),
            ),
            Text(
              'Device ID: ${widget.deviceId}',
              style: const TextStyle(color: Colors.blueGrey),
            ),
            const SizedBox(height: 16),
            Card(
              elevation: 0,
              color: Colors.white,
              child: ListTile(
                leading: const Icon(
                  Icons.history,
                  color: Color(0xFF2563EB),
                ),
                title: const Text('Recorded readings'),
                subtitle: Text('Total available: $_total'),
                trailing: Text(
                  '$_page / $_totalPages',
                  style: const TextStyle(fontWeight: FontWeight.bold),
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
                        onPressed: () => _loadReadings(page: 1),
                        child: const Text('Try Again'),
                      ),
                    ],
                  ),
                ),
              )
            else if (_readings.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: Center(child: Text('No readings found.')),
                ),
              )
            else ...[
              ..._readings.map((reading) {
                final temperature = reading['temperature'];
                final activity = reading['activity_score'];
                final battery = reading['battery'];

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
                            const Icon(
                              Icons.sensors,
                              color: Color(0xFF2563EB),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Sequence ${reading['sequence']}',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            Text(
                              battery == null ? 'Battery N/A' : '$battery%',
                              style: const TextStyle(
                                color: Colors.blueGrey,
                              ),
                            ),
                          ],
                        ),
                        const Divider(height: 24),
                        Row(
                          children: [
                            Expanded(
                              child: _metric(
                                'Temperature',
                                temperature == null
                                    ? 'N/A'
                                    : '${(temperature as num).toStringAsFixed(2)} °C',
                                Icons.thermostat,
                              ),
                            ),
                            Expanded(
                              child: _metric(
                                'Activity',
                                activity == null
                                    ? 'N/A'
                                    : (activity as num).toStringAsFixed(2),
                                Icons.show_chart,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),
                        Text(
                          _formatTimestamp(reading['timestamp']),
                          style: const TextStyle(
                            color: Colors.blueGrey,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
              if (_page < _totalPages)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: OutlinedButton.icon(
                    onPressed: _loadingMore
                        ? null
                        : () => _loadReadings(page: _page + 1),
                    icon: _loadingMore
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.expand_more),
                    label: Text(
                      _loadingMore ? 'Loading...' : 'Load More Readings',
                    ),
                  ),
                ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metric(String label, String value, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 17, color: Colors.blueGrey),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: Colors.blueGrey,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }
}