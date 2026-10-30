// AI 분석 요청에 보내는 운동 기록 요약.
// 이메일, 이름 같은 개인정보 필드는 일부러 두지 않는다.
class BodyPartSummary {
  const BodyPartSummary({
    required this.bodyPart,
    required this.volumeKg,
    required this.sets,
  });

  // 가슴, 등, 어깨, 하체, 팔, 복근, 유산소 중 하나
  final String bodyPart;
  final int volumeKg;
  final int sets;

  Map<String, Object> toJson() => {
        'bodyPart': bodyPart,
        'volumeKg': volumeKg,
        'sets': sets,
      };
}

class WorkoutSummary {
  const WorkoutSummary({
    required this.periodStart,
    required this.periodEnd,
    required this.sessionCount,
    required this.totalSets,
    required this.totalDurationMin,
    required this.bodyParts,
  });

  final DateTime periodStart;
  final DateTime periodEnd;
  final int sessionCount;
  final int totalSets;
  final int totalDurationMin;
  final List<BodyPartSummary> bodyParts;

  // 분석할 만한 기록이 있는지
  bool get hasRecords => sessionCount > 0 && bodyParts.isNotEmpty;

  // 서버가 받는 형식 (날짜는 YYYY-MM-DD)
  Map<String, Object> toJson() => {
        'periodStart': _date(periodStart),
        'periodEnd': _date(periodEnd),
        'sessionCount': sessionCount,
        'totalSets': totalSets,
        'totalDurationMin': totalDurationMin,
        'bodyParts': bodyParts.map((p) => p.toJson()).toList(),
      };

  static String _date(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-'
      '${d.month.toString().padLeft(2, '0')}-'
      '${d.day.toString().padLeft(2, '0')}';
}
