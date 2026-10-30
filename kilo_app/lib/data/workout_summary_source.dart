import '../models/workout_summary.dart';

// 최근 운동 기록 요약을 만들어 주는 곳.
// 운동 기록 저장(Supabase 테이블 등)을 붙이면 이 인터페이스를 구현한 클래스로 바꾼다.
abstract class WorkoutSummarySource {
  // 최근 7일 기록 요약. 기록이 없으면 null
  Future<WorkoutSummary?> recentSummary();
}

// 운동 기록 저장 기능이 붙기 전까지 쓰는 빈 구현
class EmptyWorkoutSummarySource implements WorkoutSummarySource {
  const EmptyWorkoutSummarySource();

  @override
  Future<WorkoutSummary?> recentSummary() async => null;
}
