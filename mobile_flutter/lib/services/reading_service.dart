import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class ReadingService {
  Future<Map<String, dynamic>> fetchReadings({
    required int deviceId,
    int page = 1,
    int limit = 20,
  }) async {
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/api/devices/$deviceId/readings',
    ).replace(
      queryParameters: {
        'page': page.toString(),
        'limit': limit.toString(),
      },
    );

    try {
      final response = await http.get(uri);

      if (response.statusCode != 200) {
  debugPrint('Reading API URL: $uri');
  debugPrint('Reading API status: ${response.statusCode}');
  debugPrint('Reading API response: ${response.body}');

  throw Exception(
    'Failed to load readings. HTTP ${response.statusCode}: ${response.body}',
  );
}

      final decoded = jsonDecode(response.body);

      if (decoded is Map<String, dynamic> &&
          decoded['readings'] is List) {
        return decoded;
      }

      throw Exception('Unexpected reading API response format.');
    } catch (error) {
      debugPrint('Reading API error: $error');
      rethrow;
    }
  }
}