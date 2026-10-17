import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/main.dart';

void main() {
  testWidgets('Vanix dashboard displays its main heading', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(const VanixApp());

    expect(find.text('Vanix Monitor'), findsOneWidget);
    expect(find.text('Device Management'), findsOneWidget);
    expect(find.text('Dashboard'), findsOneWidget);
  });
}