# Comprehensive Test Plan: Quran Quiz React Native

## 1. Unit Testing
- Module: src/utils/quran.ts
- Sura Metadata: Verify SURA_NAME and SURA_AYAS mapping.
- Index Lookups: Test getSuraIdx with boundary values (1, 30, 77878).
- Part Logic: Verify getPartNumberFromWordIdx correctly identifies parts.
- Randomization: Ensure randperm returns valid permutation.

## 2. Database Integration
- Schema Creation: Verify q table exists with all columns.
- Data Import: Verify total word count matches q.json (77,878 rows).
- Query Correctness: Test getTxt fetching and similarity lookups.

## 3. State Management
- Persistence: Verify settings preserved via AsyncStorage after restart.
- Progress Tracking: Verify addCorrect increments part scores correctly.
- State Integrity: Verify partial setting updates via setSetting.

## 4. Quiz Engine
- Question Parity: Compare createNormalQ output with original logic.
- Difficulty Balance: Ensure similarity options prioritized.
- Shuffle Integrity: Verify correct answer randomly positioned.

## 5. UI & Component Testing
- Setup Flow: Test import progress UI and auto-navigation.
- Quiz Interaction: Test card logic, scoring, and RTL alignment.
- Study Mode: Verify Sura selection and metadata display.
- Profile: Verify real-time stats updates.

## 6. End-to-End Scenarios
- First Launch: Import -> First Quiz -> Check Progress.
- Settings Toggle: Toggle Ayah marks -> Verify visual change in Quiz.

## 7. Performance
- SQLite Latency: Ensure query lookups take <10ms.
- Memory Usage: Monitor during bulk SQLite import.
