export interface CoAssessmentTask {
  taskKey: string;
  co: 'CO1' | 'CO2' | 'CO3';
  coWeight: number;
  assessmentTask: string;
  atWeight: number;
}

export const CO_ASSESSMENT_TASKS: CoAssessmentTask[] = [
  { taskKey: 'co1_exercise1', co: 'CO1', coWeight: 30, assessmentTask: 'Exercise 1', atWeight: 25 },
  { taskKey: 'co1_quiz1', co: 'CO1', coWeight: 30, assessmentTask: 'Quiz 1', atWeight: 25 },
  { taskKey: 'co1_exam1', co: 'CO1', coWeight: 30, assessmentTask: 'Exam 1', atWeight: 50 },
  { taskKey: 'co2_exercise2', co: 'CO2', coWeight: 30, assessmentTask: 'Exercise 2', atWeight: 10 },
  { taskKey: 'co2_exam1', co: 'CO2', coWeight: 30, assessmentTask: 'Exam 1', atWeight: 30 },
  { taskKey: 'co2_quiz2', co: 'CO2', coWeight: 30, assessmentTask: 'Quiz 2', atWeight: 15 },
  { taskKey: 'co2_exam2', co: 'CO2', coWeight: 30, assessmentTask: 'Exam 2', atWeight: 20 },
  { taskKey: 'co2_presentation', co: 'CO2', coWeight: 30, assessmentTask: 'Presentation', atWeight: 10 },
  { taskKey: 'co2_commodity_study_output', co: 'CO2', coWeight: 30, assessmentTask: 'Commodity study output', atWeight: 15 },
  { taskKey: 'co3_exercise3', co: 'CO3', coWeight: 40, assessmentTask: 'Exercise 3', atWeight: 10 },
  { taskKey: 'co3_quiz3', co: 'CO3', coWeight: 40, assessmentTask: 'Quiz 3', atWeight: 15 },
  { taskKey: 'co3_exam2', co: 'CO3', coWeight: 40, assessmentTask: 'Exam 2', atWeight: 30 },
  { taskKey: 'co3_presentation', co: 'CO3', coWeight: 40, assessmentTask: 'Presentation', atWeight: 15 },
  { taskKey: 'co3_commodity_study_output', co: 'CO3', coWeight: 40, assessmentTask: 'Commodity study output', atWeight: 30 },
];

export function finalWeightPercent(task: Pick<CoAssessmentTask, 'coWeight' | 'atWeight'>): number {
  return (task.coWeight * task.atWeight) / 100;
}

export function createEmptyAssessmentScores(): Record<string, number> {
  return CO_ASSESSMENT_TASKS.reduce<Record<string, number>>((acc, task) => {
    acc[task.taskKey] = 0;
    return acc;
  }, {});
}

export function calculateTotalGradePercent(scoresByTaskKey: Record<string, number>): number {
  const total = CO_ASSESSMENT_TASKS.reduce((sum, task) => {
    const score = Number(scoresByTaskKey[task.taskKey] ?? 0);
    return sum + (score * finalWeightPercent(task)) / 100;
  }, 0);

  return Math.round(total);
}

export function percentToGradePoint5(percent: number): number {
  if (percent >= 97) return 1.0;
  if (percent >= 93) return 1.25;
  if (percent >= 89) return 1.5;
  if (percent >= 85) return 1.75;
  if (percent >= 80) return 2.0;
  if (percent >= 75) return 2.25;
  if (percent >= 70) return 2.5;
  if (percent >= 65) return 2.75;
  if (percent >= 60) return 3.0;
  return 5.0; // 59 or below
}

/** Format as string (e.g. "1.25", "2.00", "5.00") for display. */
export function formatGradePoint5(percent: number): string {
  const gp = percentToGradePoint5(percent);
  return gp.toFixed(2);
}
