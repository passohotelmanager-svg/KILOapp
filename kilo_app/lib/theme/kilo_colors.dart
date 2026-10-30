import 'package:flutter/material.dart';

// PRD 7.2 디자인 토큰
class KiloColors {
  KiloColors._();

  static const primary = Color(0xFF3399FF);
  static const primaryLight = Color(0xFFD6EAFF);
  static const background = Color(0xFFF2F4F6);
  static const surface = Color(0xFFFFFFFF);
  static const textPrimary = Color(0xFF191F28);
  static const textSecondary = Color(0xFF8B95A1);
  static const border = Color(0xFFE5E8EB);
  static const decrease = Color(0xFFF04452);

  // AI 추천 카드 그라데이션 테두리
  static const aiGradient = LinearGradient(
    colors: [Color(0xFF3399FF), Color(0xFF6250D6), Color(0xFF1BAF7A)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}
