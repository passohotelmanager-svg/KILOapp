import 'package:flutter/material.dart';

import '../theme/kilo_colors.dart';

// 투데이 화면의 AI 추천 운동 카드 (PRD 7.5, F-09)
// 보조 문구 "KILO AI가 추천하는", 제목 "오늘의 운동으로 시작하기", 오른쪽 원형 AI 버튼, 그라데이션 테두리
class AiRecommendCard extends StatelessWidget {
  const AiRecommendCard({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(20);
    return Semantics(
      button: true,
      label: 'KILO AI가 추천하는 오늘의 운동으로 시작하기',
      child: DecoratedBox(
        // 바깥 그라데이션이 1.5px 테두리 역할을 한다
        decoration: BoxDecoration(gradient: KiloColors.aiGradient, borderRadius: radius),
        child: Padding(
          padding: const EdgeInsets.all(1.5),
          child: Material(
            color: KiloColors.surface,
            borderRadius: BorderRadius.circular(18.5),
            child: InkWell(
              borderRadius: BorderRadius.circular(18.5),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 16, 18),
                child: Row(
                  children: [
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'KILO AI가 추천하는',
                            style: TextStyle(fontSize: 13, color: KiloColors.textSecondary),
                          ),
                          SizedBox(height: 4),
                          Text(
                            '오늘의 운동으로 시작하기',
                            style: TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w700,
                              color: KiloColors.textPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: KiloColors.aiGradient,
                      ),
                      alignment: Alignment.center,
                      child: const Text(
                        'AI',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
