import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class DeviceService {
  Future<List<dynamic>> fetchDevices() async {
    final url = Uri.parse(ApiConfig.devicesEndpoint);

    try {
      final response = await http.get(url);

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);

        if (decoded is List) {
          return decoded;
        }

        if (decoded is Map<String, dynamic>) {
          final devices = decoded['devices'];

          if (devices is List) {
            return devices;
          }
        }

        throw Exception('Unexpected device API response format.');
      }

      throw Exception(
        'Failed to load devices. HTTP ${response.statusCode}',
      );
    } catch (error) {
      debugPrint('Device API error: $error');
      rethrow;
    }
  }
}