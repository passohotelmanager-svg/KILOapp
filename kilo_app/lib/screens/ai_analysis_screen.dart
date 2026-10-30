import 'package:flutter/material.dart';

import '../data/workout_summary_source.dart';
import '../models/workout_analysis.dart';
import '../services/ai_analysis_service.dart';
import '../theme/kilo_colors.dart';

// AI 분석 결과 화면. 로딩, 오류, 한도 초과, 로그인 필요, 기록 없음, 결과 상태를 나눠 보여준다
class AiAnalysisScreen extends StatefulWidget {
  const AiAnalysisScreen({
    super.key,
    required this.service,
    required this.summarySource,
  });

  final AiAnalysisService service;
  final WorkoutSummarySource summarySource;

  @override
  State<AiAnalysisScreen> createState() => _AiAnalysisScreenState();
}

class _AiAnalysisScreenState extends State<AiAnalysisScreen> {
  // null이면 로딩 중
  AiAnalysisResult? _result;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _result = null);
    final summary = await widget.summarySource.recentSummary();
    final result = await widget.service.analyze(summary);
    if (!mounted) return;
    setState(() => _result = result);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: KiloColors.background,
      appBar: AppBar(
        title: const Text('AI 운동 분석'),
        backgroundColor: KiloColors.background,
        foregroundColor: KiloColors.textPrimary,
        elevation: 0,
      ),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    final result = _result;
    return switch (result) {
      null => const _LoadingView(),
      AiAnalysisSuccess success => _ResultView(result: success),
      AiAnalysisLimitExceeded(:final message) => _MessageView(
          title: '오늘 이용 횟수를 모두 사용했어요',
          message: message,
        ),
      AiAnalysisNeedLogin() => const _MessageView(
          title: '로그인이 필요해요',
          message: '로그인하면 최근 운동 기록을 AI가 분석해 드려요.',
        ),
      AiAnalysisNoRecords() => const _MessageView(
          title: '분석할 운동 기록이 없어요',
          message: '최근 7일 안에 운동을 기록하면 AI 분석을 받을 수 있어요.',
        ),
      AiAnalysisFailure(:final message) => _MessageView(
          title: '분석하지 못했어요',
          message: message,
          isError: true,
          onRetry: _load,
        ),
    };
  }
}

// 로딩 상태
class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircularProgressIndicator(color: KiloColors.primary),
          SizedBox(height: 16),
          Text(
            'KILO AI가 최근 운동 기록을 분석하고 있어요',
            style: TextStyle(color: KiloColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

// 한도 초과, 오류, 로그인 필요, 기록 없음 상태
class _MessageView extends StatelessWidget {
  const _MessageView({
    required this.title,
    required this.message,
    this.isError = false,
    this.onRetry,
  });

  final String title;
  final String message;
  final bool isError;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: isError ? KiloColors.decrease : KiloColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: KiloColors.textSecondary, height: 1.5),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 24),
              FilledButton(
                style: FilledButton.styleFrom(backgroundColor: KiloColors.primary),
                onPressed: onRetry,
                child: const Text('다시 시도'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// 분석 결과 상태
class _ResultView extends StatelessWidget {
  const _ResultView({required this.result});

  final AiAnalysisSuccess result;

  @override
  Widget build(BuildContext context) {
    final WorkoutAnalysis a = result.analysis;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _Section(title: '한 줄 평가', children: [_Line(a.summary)]),
        _Section(title: '잘한 점', children: a.strengths.map(_Line.new).toList()),
        _Section(
          title: '부족한 부위',
          children: a.weakBodyParts.isEmpty
              ? const [_Line('고르게 운동하고 있어요.')]
              : a.weakBodyParts.map((w) => _Line('${w.bodyPart}: ${w.reason}')).toList(),
        ),
        _Section(title: '다음 운동 제안', children: a.nextWorkout.map(_Line.new).toList()),
        Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(
            '오늘 남은 분석 횟수 ${result.remaining} / ${result.limit}',
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 12, color: KiloColors.textSecondary),
          ),
        ),
      ],
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: KiloColors.surface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: KiloColors.primary,
            ),
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }
}

class _Line extends StatelessWidget {
  const _Line(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        text,
        style: const TextStyle(color: KiloColors.textPrimary, height: 1.5),
      ),
    );
  }
}
