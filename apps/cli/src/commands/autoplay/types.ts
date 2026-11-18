export type AutoplayOutcome =
  | 'dead'
  | 'capped'
  | 'no-supported-task'
  | 'uncertain'
  | 'read-error'
  | 'start-error';

export interface AutoplayInterruption {
  readonly operation: 'start' | 'board-read' | 'shop-read' | 'action';
  readonly message: string;
  readonly statusCode?: number;
  readonly uncertainWrite: boolean;
}
