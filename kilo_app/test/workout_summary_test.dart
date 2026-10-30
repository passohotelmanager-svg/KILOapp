import 'package:flutter_test/flutter_test.dart';
import 'package:kilo_app/models/workout_analysis.dart';
import 'package:kilo_app/models/workout_summary.dart';

void main() {
  test('요약은 서버 형식으로 바뀌고 개인정보 필드가 없다', () {
    final summary = WorkoutSummary(
      periodStart: DateTime(2026, 10, 23),
      periodEnd: DateTime(2026, 10, 29),
      sessionCount: 4,
      totalSets: 60,
      totalDurationMin: 240,
      bodyParts: const [BodyPartSummary(bodyPart: '가슴', volumeKg: 4200, sets: 20)],
    );
    final json = summary.toJson();
    expect(json['periodStart'], '2026-10-23');
    expect(json.keys, isNot(contains('email')));
    expect(json.keys, isNot(contains('name')));
  });

  test('서버 응답을 분석 결과로 읽는다', () {
    final analysis = WorkoutAnalysis.fromJson({
      'summary': '꾸준합니다',
      'strengths': ['하체 볼륨 증가'],
      'weakBodyParts': [
        {'bodyPart': '등', 'reason': '기록 없음'},
      ],
      'nextWorkout': ['랫풀다운 4세트 10회'],
    });
    expect(analysis.weakBodyParts.single.bodyPart, '등');
    expect(() => WorkoutAnalysis.fromJson({}), throwsFormatException);
  });
}
