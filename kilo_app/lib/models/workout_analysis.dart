// 서버(analyzeWorkout)가 돌려주는 AI 분석 결과
class WeakBodyPart {
  const WeakBodyPart({required this.bodyPart, required this.reason});

  final String bodyPart;
  final String reason;
}

class WorkoutAnalysis {
  const WorkoutAnalysis({
    required this.summary,
    required this.strengths,
    required this.weakBodyParts,
    required this.nextWorkout,
  });

  final String summary;
  final List<String> strengths;
  final List<WeakBodyPart> weakBodyParts;
  final List<String> nextWorkout;

  // 서버 응답을 읽는다. 형식이 다르면 FormatException을 던진다
  factory WorkoutAnalysis.fromJson(Map<Object?, Object?> json) {
    List<String> strings(Object? v) {
      if (v is! List) throw const FormatException('목록 형식이 아닙니다.');
      return v.map((e) => e.toString()).toList();
    }

    final weak = json['weakBodyParts'];
    if (json['summary'] is! String || weak is! List) {
      throw const FormatException('분석 결과 형식이 올바르지 않습니다.');
    }
    return WorkoutAnalysis(
      summary: json['summary'] as String,
      strengths: strings(json['strengths']),
      weakBodyParts: weak.map((e) {
        final m = e as Map<Object?, Object?>;
        return WeakBodyPart(
          bodyPart: m['bodyPart'].toString(),
          reason: m['reason'].toString(),
        );
      }).toList(),
      nextWorkout: strings(json['nextWorkout']),
    );
  }
}
