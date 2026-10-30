import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'data/workout_summary_source.dart';
import 'screens/today_screen.dart';
import 'services/ai_analysis_service.dart';
import 'theme/kilo_colors.dart';

// Supabase 접속 정보는 실행할 때 --dart-define으로 넘긴다.
// 둘 다 앱에 들어가도 되는 공개 값이며(행 단위 보안으로 보호), Gemini API 키와 secret 키는 절대 넣지 않는다.
const _supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const _supabasePublishableKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (_supabaseUrl.isEmpty || _supabasePublishableKey.isEmpty) {
    throw StateError(
      'SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY 값이 없습니다. '
      'flutter run --dart-define-from-file=supabase.json 으로 실행하세요.',
    );
  }
  await Supabase.initialize(url: _supabaseUrl, publishableKey: _supabasePublishableKey);
  runApp(const KiloApp());
}

class KiloApp extends StatelessWidget {
  const KiloApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'KILO',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: KiloColors.primary),
        scaffoldBackgroundColor: KiloColors.background,
      ),
      home: TodayScreen(
        aiService: AiAnalysisService(),
        // 운동 기록 저장 기능을 붙이면 실제 구현으로 교체한다
        summarySource: const EmptyWorkoutSummarySource(),
      ),
    );
  }
}
