export interface RatingWeightSnapshot {
  source_weight:      number;
  trust_weight:       number;
  reliability_weight: number;
  context_weight:     number;
  time_weight:        number;
  anomaly_weight:     number;
  final_weight:       number;
}