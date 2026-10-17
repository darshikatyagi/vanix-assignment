import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class AlertService {
  Future<List<dynamic>> fetchAlerts() async {
    final url = Uri.parse('${ApiConfig.alertsEndpoint}?status=all');

    try {
      final response = await http.get(url);

      if (response.statusCode != 200) {
        throw Exception(
          'Failed to load alerts. HTTP ${response.statusCode}',
        );
      }

      final decoded = jsonDecode(response.body);

      if (decoded is List) {
        return decoded;
      }

      if (decoded is Map<String, dynamic> &&
          decoded['alerts'] is List) {
        return decoded['alerts'] as List<dynamic>;
      }

      throw Exception('Unexpected alerts API response format.');
    } catch (error) {
      debugPrint('Alert API error: $error');
      rethrow;
    }
  }

  Future<void> acknowledgeAlert(int alertId) async {
  final url = Uri.parse('${ApiConfig.alertsEndpoint}/$alertId');

  final response = await http.patch(url);

  if (response.statusCode < 200 || response.statusCode >= 300) {
    throw Exception(
      'Failed to acknowledge alert. HTTP ${response.statusCode}',
    );
  }
}
}