import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kilo_app/widgets/ai_recommend_card.dart';

void main() {
  testWidgets('AI 추천 카드는 문구를 보여주고 누르면 콜백을 부른다', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: AiRecommendCard(onTap: () => tapped++)),
      ),
    );

    expect(find.text('KILO AI가 추천하는'), findsOneWidget);
    expect(find.text('오늘의 운동으로 시작하기'), findsOneWidget);

    await tester.tap(find.byType(AiRecommendCard));
    expect(tapped, 1);
  });
}
