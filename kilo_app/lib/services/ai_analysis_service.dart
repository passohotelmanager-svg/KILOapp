import 'package:supabase_flutter/supabase_flutter.dart';

import '../models/workout_analysis.dart';
import '../models/workout_summary.dart';

// 분석 요청 결과. 화면은 이 종류에 따라 상태를 나눠 보여준다
sealed class AiAnalysisResult {
  const AiAnalysisResult();
}

class AiAnalysisSuccess extends AiAnalysisResult {
  const AiAnalysisSuccess(this.analysis, {required this.remaining, required this.limit});

  final WorkoutAnalysis analysis;
  // 오늘 남은 호출 횟수
  final int remaining;
  final int limit;
}

// 하루 호출 한도 초과
class AiAnalysisLimitExceeded extends AiAnalysisResult {
  const AiAnalysisLimitExceeded(this.message);

  final String message;
}

// 로그인이 필요함
class AiAnalysisNeedLogin extends AiAnalysisResult {
  const AiAnalysisNeedLogin();
}

// 분석할 운동 기록이 없음
class AiAnalysisNoRecords extends AiAnalysisResult {
  const AiAnalysisNoRecords();
}

// 그 밖의 오류 (네트워크, 서버, 입력 형식 등)
class AiAnalysisFailure extends AiAnalysisResult {
  const AiAnalysisFailure(this.message);

  final String message;
}

// Supabase Edge Function analyze-workout을 호출하는 서비스.
// Gemini API 키는 앱에 없고, 서버가 비밀값으로 보관한 키로 대신 호출한다.
// 로그인 토큰은 supabase_flutter가 요청 헤더에 자동으로 붙인다.
class AiAnalysisService {
  AiAnalysisService({SupabaseClient? client})
      : _client = client ?? Supabase.instance.client;

  static const _functionName = 'analyze-workout';

  final SupabaseClient _client;

  Future<AiAnalysisResult> analyze(WorkoutSummary? summary) async {
    final user = _client.auth.currentUser;
    if (user == null || user.isAnonymous) {
      return const AiAnalysisNeedLogin();
    }
    if (summary == null || !summary.hasRecords) {
      return const AiAnalysisNoRecords();
    }

    try {
      final response = await _client.functions
          .invoke(_functionName, body: summary.toJson())
          .timeout(const Duration(seconds: 70));
      final data = response.data as Map<String, dynamic>;
      return AiAnalysisSuccess(
        WorkoutAnalysis.fromJson(data['analysis'] as Map<String, dynamic>),
        remaining: (data['remaining'] as num?)?.toInt() ?? 0,
        limit: (data['limit'] as num?)?.toInt() ?? 0,
      );
    } on FunctionException catch (e) {
      // 서버 오류 응답 형식: { code, message }
      final details = e.details;
      final message = details is Map ? details['message'] as String? : null;
      switch (e.status) {
        case 429:
          return AiAnalysisLimitExceeded(message ?? '오늘 AI 분석 이용 횟수를 모두 사용했습니다.');
        case 401:
        case 403:
          return const AiAnalysisNeedLogin();
        case 400:
          return AiAnalysisFailure(message ?? '운동 기록을 분석할 수 없습니다.');
        default:
          return const AiAnalysisFailure('AI 분석을 잠시 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      }
    } on FormatException {
      return const AiAnalysisFailure('분석 결과를 읽을 수 없습니다. 다시 시도해 주세요.');
    } on TypeError {
      return const AiAnalysisFailure('분석 결과를 읽을 수 없습니다. 다시 시도해 주세요.');
    } catch (_) {
      return const AiAnalysisFailure('네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
    }
  }
}
