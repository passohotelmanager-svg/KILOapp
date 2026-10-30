import 'package:flutter/material.dart';

import '../data/workout_summary_source.dart';
import '../services/ai_analysis_service.dart';
import '../theme/kilo_colors.dart';
import '../widgets/ai_recommend_card.dart';
import 'ai_analysis_screen.dart';

// 투데이 화면 (PRD 7.5)
// 지금은 AI 추천 운동 카드만 들어 있다. 나머지 영역(주간 달력, 식단, 운동 목표 등)은 이후 단계에서 추가한다.
class TodayScreen extends StatelessWidget {
  const TodayScreen({
    super.key,
    required this.aiService,
    required this.summarySource,
  });

  final AiAnalysisService aiService;
  final WorkoutSummarySource summarySource;

  void _openAiAnalysis(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AiAnalysisScreen(service: aiService, summarySource: summarySource),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KiloColors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Padding(
              padding: EdgeInsets.fromLTRB(4, 8, 4, 16),
              child: Text(
                '투데이',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  color: KiloColors.textPrimary,
                ),
              ),
            ),
            AiRecommendCard(onTap: () => _openAiAnalysis(context)),
          ],
        ),
      ),
    );
  }
}
